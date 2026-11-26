/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { metricThresholdBreached } from "../../lib/metrics.js";
import {
  readAgentCapabilityRollups,
  readDeclaredAppIdFromDir,
  resolveObservabilityCatalog,
} from "../adapters/reporting/observability-summary.js";
import { taskViewPhaseSql } from "../core/state/task-view-phase.js";
import { listRuntimeAgentDirectories, resolveRuntimeAgentDirectory } from "@may-agent/sdk/runtime";
import type { SqliteDb } from "./read-model/state-db.js";

function isMetricAlertsDisabled(rawConfig: string | null | undefined): boolean {
  if (!rawConfig) return false;
  try {
    const parsed = JSON.parse(rawConfig);
    const alert = parsed && typeof parsed === "object" ? (parsed as Record<string, any>).alert : null;
    return alert?.disabled === true || alert?.mode === "disabled";
  } catch {
    return false;
  }
}

export function createAgentRouteHandlers(options: {
  stateDir: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  getDb: () => SqliteDb;
  listLoadedApps?: () => ReadonlyArray<Record<string, unknown>> | null;
  listAppDirMap?: () => ReadonlyMap<string, string> | null;
  json: (data: unknown, status?: number) => Response;
  readProjects: () => Array<{ project: { owner: string; field: (key: string) => string | null | undefined } }>;
}) {
  const {
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    readProjects,
  } = options;

  function detectRegistrationApp(agentDir: string, appDirMap?: ReadonlyMap<string, string> | null): string | null {
    const rel = relative(PROJECTS_ROOT, agentDir).replace(/\\/g, "/");
    if (rel.startsWith("..") || rel.startsWith("/")) return null;
    const first = rel.split("/")[0] ?? "";
    if (!first.endsWith(".app")) return null;
    const appDir = resolve(PROJECTS_ROOT, first);
    const fromRegistry = appDirMap?.get(appDir);
    if (fromRegistry) return fromRegistry;
    const fromFile = readDeclaredAppIdFromDir(appDir);
    if (fromFile) return fromFile;
    return first.slice(0, -".app".length);
  }

  /**
   * GET /api/agents — list all configured agents with rollups for the
   * Agents tab card grid. One row per agent.
   */
  function handleAgents(): Response {
    try {
      const db = _db();
      const now = Date.now();
      const fourHourAgo = now - 4 * 60 * 60 * 1000;
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const catalog = resolveObservabilityCatalog(db, {
        projectsRoot: PROJECTS_ROOT,
        loadedApps: options.listLoadedApps?.() ?? null,
      });

      const ownedAppsByAgent = new Map<string, string[]>();
      for (const [appId, owner] of catalog.ownerByAppId.entries()) {
        if (!catalog.trulyInstalledSet.has(appId) && catalog.hasAuthoritativeApps) continue;
        const list = ownedAppsByAgent.get(owner) ?? [];
        list.push(appId);
        ownedAppsByAgent.set(owner, list);
      }

      const appDirMap = options.listAppDirMap?.() ?? null;
      // 1. Discover agents from agents/ filesystem AND project-local agents (source of truth: agent.json).
      const agents: Array<Record<string, unknown>> = [];
      const seenAgentNames = new Set<string>();

      for (const entry of listRuntimeAgentDirectories(AGENTS_ROOT, PROJECTS_ROOT)) {
        let cfg: Record<string, any>;
        try {
          cfg = JSON.parse(readFileSync(join(entry.dir, "agent.json"), "utf8"));
        } catch {
          continue;
        }
        if (cfg.disabled) continue;
        const name = cfg.name || entry.name;
        if (seenAgentNames.has(name)) continue;
        seenAgentNames.add(name);
        const localApp = detectRegistrationApp(entry.dir, appDirMap);
        const ownedApps = (ownedAppsByAgent.get(name) ?? []).sort();
        agents.push({
          name,
          description: cfg.description || "",
          domain: cfg.domain || "",
          model: cfg.model || "",
          toolCount: Array.isArray(cfg.tools) ? cfg.tools.length : 0,
          registrationScope: localApp ? "app-local" : "global",
          localApp,
          ownedApps,
        });
      }

      // Open alerts by metric_id for accurate active breach counts.
      const openAlertMetricIds = new Set<string>(
        (
          db
            .prepare(
              `SELECT DISTINCT ma.metric_id AS id
               FROM metric_alerts ma
               INNER JOIN metrics m ON m.id = ma.metric_id
               WHERE ma.resolved_at IS NULL AND m.status = 'active'`,
            )
            .all() as Array<{ id: string }>
        ).map((r) => r.id),
      );

      // Canonical open Tasks per resolved agent (`spec.agent` -> `spec.owner` -> App owner).
      const taskPhaseExpr = taskViewPhaseSql("t");
      const openTaskRows = db
        .prepare(
          `SELECT
             t.app_id AS appId,
             COALESCE(
               NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
               NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
             ) AS assignedAgent,
             ${taskPhaseExpr} AS viewPhase,
             COUNT(*) AS count
           FROM app_tasks t
           LEFT JOIN app_task_cancellations c ON c.app_id = t.app_id AND c.task_id = t.task_id
           WHERE c.task_id IS NULL
             AND json_extract(t.resource_json, '$.status.closure.state') IS NULL
           GROUP BY 1, 2, 3`,
        )
        .all() as Array<{ appId: string; assignedAgent: string | null; viewPhase: string; count: number }>;

      type AgentTasksSummary = {
        running: number;
        waiting: number;
        attention: number;
        pending: number;
        idle: number;
        openTotal: number;
      };
      const tasksByAgent = new Map<string, AgentTasksSummary>();
      const ensureTasks = (ag: string): AgentTasksSummary => {
        let s = tasksByAgent.get(ag);
        if (!s) {
          s = { running: 0, waiting: 0, attention: 0, pending: 0, idle: 0, openTotal: 0 };
          tasksByAgent.set(ag, s);
        }
        return s;
      };
      for (const row of openTaskRows) {
        if (catalog.disabledSet.has(row.appId)) continue;
        const resolvedAg = row.assignedAgent || catalog.ownerByAppId.get(row.appId) || null;
        if (!resolvedAg) continue;
        const t = ensureTasks(resolvedAg);
        if (row.viewPhase === "running") t.running += row.count;
        else if (row.viewPhase === "waiting") t.waiting += row.count;
        else if (row.viewPhase === "attention") t.attention += row.count;
        else if (row.viewPhase === "pending") t.pending += row.count;
        else if (row.viewPhase === "converged") t.idle += row.count;
        if (row.viewPhase !== "converged") t.openTotal += row.count;
      }

      // Canonical 24h & 4h Task attempts by resolved attempt owner (includes codex-goal & workflows).
      const resolvedAttemptOwnerExpr = `COALESCE(
        NULLIF(trim(json_extract(a.attempt_json, '$.owner')), ''),
        NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
        NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
      )`;
      const attemptRollupRows = db
        .prepare(
          `SELECT
             ${resolvedAttemptOwnerExpr} AS agent,
             COUNT(CASE WHEN a.started_at >= ? THEN 1 END) AS attempts24h,
             COUNT(CASE WHEN a.started_at >= ? THEN 1 END) AS attempts4h,
             COUNT(CASE WHEN a.state = 'running' AND NOT EXISTS (
               SELECT 1 FROM sessions s
               WHERE s.sessionId = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
                 AND s.agent = ${resolvedAttemptOwnerExpr}
                 AND s.status = 'running'
             ) THEN 1 END) AS disjointRunningAttempts,
             COUNT(CASE WHEN a.state = 'failed' AND a.started_at >= ? AND NOT EXISTS (
               SELECT 1 FROM sessions s
               WHERE s.sessionId = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '') AND s.status = 'error'
             ) THEN 1 END) AS disjointErrors4h,
             COUNT(CASE WHEN a.started_at >= ? AND NOT EXISTS (
               SELECT 1 FROM sessions s
               WHERE s.sessionId = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
             ) THEN 1 END) AS disjointAttempts24h,
             COUNT(CASE WHEN a.started_at >= ? AND NOT EXISTS (
               SELECT 1 FROM sessions s
               WHERE s.sessionId = COALESCE(json_extract(a.attempt_json, '$.sessionId'), '')
             ) THEN 1 END) AS disjointAttempts4h,
             MAX(a.started_at) AS lastAttemptAt
           FROM app_task_attempts a
           LEFT JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
           WHERE (a.started_at >= ? OR a.state = 'running')
           GROUP BY 1`,
        )
        .all(dayAgo, fourHourAgo, fourHourAgo, dayAgo, fourHourAgo, dayAgo) as Array<{
        agent: string | null;
        attempts24h: number;
        attempts4h: number;
        disjointRunningAttempts: number;
        disjointErrors4h: number;
        disjointAttempts24h: number;
        disjointAttempts4h: number;
        lastAttemptAt: number | null;
      }>;
      const attemptsByAgent = new Map(
        attemptRollupRows.filter((r): r is typeof r & { agent: string } => Boolean(r.agent)).map((r) => [r.agent, r]),
      );

      // 2. Per-agent session/metric rollups (single query each, indexed on agent).
      for (const a of agents) {
        const name = a.name as string;
        const att = attemptsByAgent.get(name);

        // Sessions in 4h (persisted 'idle' chats have no live process; only 'running' counts as active).
        const sess4h = db
          .prepare(
            `
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'running' THEN 1 END) as runningSess,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND (startedAt >= ? OR status = 'running')
        `,
          )
          .get(name, fourHourAgo) as any;
        const sessCount4h =
          (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, fourHourAgo) as any)
            ?.c ?? 0;
        a.sessions4h = sessCount4h;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = (sess4h?.errors ?? 0) + (att?.disjointErrors4h ?? 0);

        // Sessions in 24h (for context).
        const sess24h =
          (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)
            ?.c ?? 0;
        a.sessions24h = sess24h;

        a.executions4h = sessCount4h + (att?.disjointAttempts4h ?? 0);
        a.executions24h = sess24h + (att?.disjointAttempts24h ?? 0);
        const taskSummary = tasksByAgent.get(name) ?? {
          running: 0,
          waiting: 0,
          attention: 0,
          pending: 0,
          idle: 0,
          openTotal: 0,
        };
        a.tasksSummary = taskSummary;
        a.runningNow = Math.max(taskSummary.running, (sess4h?.runningSess ?? 0) + (att?.disjointRunningAttempts ?? 0));
        a.lastActivityAt =
          Math.max(Number(a.lastSessionAt ?? 0), Number(att?.lastAttemptAt ?? 0)) || null;

        // Owned ACTIVE metrics + actionable breaches (excluding retired metrics, no-exposure superseded values, & trend-only alertsDisabled rules).
        const mets = db
          .prepare(
            `
          SELECT id, current, updated_at, threshold, alert_op, config FROM metrics WHERE owner = ? AND status = 'active'
        `,
          )
          .all(name) as Array<{
          id: string;
          current: number | null;
          updated_at: number | null;
          threshold: number | null;
          alert_op: string | null;
          config: string | null;
        }>;
        a.metricCount = mets.length;
        a.metricBreached = mets.filter((m) => {
          if (openAlertMetricIds.has(m.id)) return true;
          if (isMetricAlertsDisabled(m.config)) return false;
          let current = m.current;
          try {
            const cfg = m.config ? JSON.parse(m.config) : null;
            const noExp = cfg?.lastNoExposureAt;
            if (typeof noExp === "number" && noExp > 0 && (m.updated_at == null || noExp > m.updated_at)) {
              current = null;
            }
          } catch {
            /* ignore */
          }
          if (m.threshold == null || current == null) return false;
          return metricThresholdBreached({ current, threshold: m.threshold, alert_op: m.alert_op });
        }).length;
      }

      // 3. Count the same metadata records shown by the Projects page.
      const projByOwner: Record<string, { active: number; total: number }> = {};
      const hidden = new Set(["done", "complete", "closed", "waiting", "blocked", "paused"]);
      for (const { project } of readProjects()) {
        const owner = project.owner.replace(/^agent:/, "");
        const counts = (projByOwner[owner] ??= { active: 0, total: 0 });
        counts.total += 1;
        if (!hidden.has(project.field("status") ?? "unknown")) counts.active += 1;
      }
      const capabilityRollup = readAgentCapabilityRollups(db, now);
      for (const a of agents) {
        const name = a.name as string;
        const counts = projByOwner[name] || { active: 0, total: 0 };
        a.projectsActive = counts.active;
        a.projectsTotal = counts.total;
        const cap = capabilityRollup(name);
        Object.assign(a, cap);
        const ownedApps = (a.ownedApps as string[]) ?? [];
        const localApp = (a.localApp as string | null) ?? null;
        a.homeApp = ownedApps[0] ?? localApp ?? cap.apps7d[0] ?? null;
        a.roleKind = ownedApps.length > 0 ? "app-owner" : a.homeApp ? "app-specialist" : "global";
      }

      // Sort: running first, then recent activity, then alphabetic.
      agents.sort((a: any, b: any) => {
        const aRun = (a.runningNow || 0) > 0 ? 1 : 0;
        const bRun = (b.runningNow || 0) > 0 ? 1 : 0;
        if (aRun !== bRun) return bRun - aRun;
        const aTime = a.lastActivityAt || a.lastSessionAt || 0;
        const bTime = b.lastActivityAt || b.lastSessionAt || 0;
        return bTime - aTime || String(a.name).localeCompare(String(b.name));
      });
      return json(agents);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  /**
   * GET /api/agents/:name/about — returns what's actually in the agent's
   * head (system-prompt-loaded files vs. on-disk convention files) plus
   * assigned durable Tasks and recent 24h Task/session executions.
   */
  function handleAgentAbout(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    const agentDir =
      resolveRuntimeAgentDirectory(AGENTS_ROOT, agentName, PROJECTS_ROOT)?.dir ?? join(AGENTS_ROOT, agentName);
    if (!existsSync(agentDir)) return json({ error: "agent not found" }, 404);
    let agentJson: Record<string, any> | null = null;
    try {
      const cfgPath = join(agentDir, "agent.json");
      if (existsSync(cfgPath)) agentJson = JSON.parse(readFileSync(cfgPath, "utf-8"));
    } catch {
      /* skip */
    }

    const readFile = (path: string, displayName: string, source: string) => {
      if (!existsSync(path)) return null;
      try {
        const content = readFileSync(path, "utf-8");
        return {
          name: displayName,
          path: path.replace(STATE_DIR + "/..", "").replace(/^\//, ""),
          content,
          bytes: content.length,
          source,
        };
      } catch {
        return null;
      }
    };

    const promptFiles: Array<Record<string, unknown>> = [];
    const otherFiles: Array<Record<string, unknown>> = [];

    // explicit systemPrompt overrides file-loading.
    if (agentJson && typeof agentJson.systemPrompt === "string") {
      promptFiles.push({
        name: "<inline systemPrompt>",
        path: `agents/${agentName}/agent.json#systemPrompt`,
        content: agentJson.systemPrompt,
        bytes: agentJson.systemPrompt.length,
        source: "agent.json",
      });
    } else {
      // Standard prompt assembly: shared defaults, then role-specific identity.
      const sharedPath = join(SHARED_ROOT, "common-sense.md");
      const sharedFile = readFile(sharedPath, "shared/common-sense.md", "manager.ts");
      if (sharedFile) promptFiles.push({ ...sharedFile, source: "shared (every agent)" });
      const agentsMd = readFile(join(agentDir, "AGENTS.md"), "AGENTS.md", "identity");
      if (agentsMd) promptFiles.push({ ...agentsMd, source: "agent identity (this agent)" });
    }

    // Other on-disk files (NOT in prompt). Useful for context but not auto-loaded.
    const otherCandidates = ["DOMAIN.md", "heartbeat.md", "context.md", "TOOLS.md", "LESSONS.md"];
    for (const f of otherCandidates) {
      const file = readFile(join(agentDir, f), f, "on-disk only");
      if (file) otherFiles.push(file);
    }

    // Assigned open/idle durable Tasks + recent 24h Task attempts for the Overview inspector.
    let assignedTasks: Array<Record<string, unknown>> = [];
    let recentAttempts: Array<Record<string, unknown>> = [];
    try {
      const db = _db();
      const catalog = resolveObservabilityCatalog(db, {
        projectsRoot: PROJECTS_ROOT,
        loadedApps: options.listLoadedApps?.() ?? null,
      });
      const defaultOwnedApps = [...catalog.ownerByAppId.entries()]
        .filter(([, owner]) => owner === agentName)
        .map(([appId]) => appId);
      const disabledApps = [...catalog.disabledSet];
      const taskPhaseExpr = taskViewPhaseSql("t");
      const specAgentExpr = `COALESCE(
        NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
        NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
      )`;
      const disabledSql = disabledApps.length ? `AND t.app_id NOT IN (${disabledApps.map(() => "?").join(",")})` : "";
      const ownedFallbackSql = defaultOwnedApps.length
        ? `OR (${specAgentExpr} IS NULL AND t.app_id IN (${defaultOwnedApps.map(() => "?").join(",")}))`
        : "";
      const rawTasks = db
        .prepare(
          `SELECT
             t.app_id AS appId,
             t.task_id AS taskId,
             ${taskPhaseExpr} AS phase,
             t.updated_at AS updatedAt,
             substr(
               COALESCE(
                 NULLIF(trim(json_extract(t.resource_json, '$.spec.outcome')), ''),
                 NULLIF(trim(json_extract(t.resource_json, '$.spec.goal')), ''),
                 NULLIF(trim(json_extract(t.resource_json, '$.spec.intent')), ''),
                 t.task_id
               ),
               1,
               160
             ) AS outcome
           FROM app_tasks t
           LEFT JOIN app_task_cancellations c ON c.app_id = t.app_id AND c.task_id = t.task_id
           WHERE c.task_id IS NULL
             AND json_extract(t.resource_json, '$.status.closure.state') IS NULL
             ${disabledSql}
             AND (${specAgentExpr} = ? ${ownedFallbackSql})
           ORDER BY
             CASE WHEN ${taskPhaseExpr} IN ('running', 'attention', 'waiting', 'pending') THEN 0 ELSE 1 END,
             t.updated_at DESC
           LIMIT 15`,
        )
        .all(...disabledApps, agentName, ...defaultOwnedApps) as Array<{
        appId: string;
        taskId: string;
        phase: string;
        updatedAt: number;
        outcome: string;
      }>;
      assignedTasks = rawTasks.map((r) => ({
        appId: r.appId,
        taskId: r.taskId,
        status: r.phase === "converged" ? "idle" : r.phase,
        updatedAt: r.updatedAt,
        outcome: r.outcome,
      }));

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      recentAttempts = db
        .prepare(
          `SELECT
             a.app_id AS appId,
             a.task_id AS taskId,
             a.attempt_id AS attemptId,
             a.state AS state,
             a.accepted_result_state AS resultState,
             a.started_at AS startedAt,
             COALESCE(json_extract(a.attempt_json, '$.handler'), '') AS handler,
             NULLIF(trim(json_extract(a.attempt_json, '$.sessionId')), '') AS sessionId
           FROM app_task_attempts a
           LEFT JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
           WHERE a.started_at >= ?
             AND COALESCE(
               NULLIF(trim(json_extract(a.attempt_json, '$.owner')), ''),
               NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
               NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
             ) = ?
           ORDER BY a.started_at DESC
           LIMIT 20`,
        )
        .all(dayAgo, agentName) as Array<Record<string, unknown>>;
    } catch {
      /* Read-only best-effort enrichment. */
    }

    return json({ name: agentName, agentJson, promptFiles, otherFiles, assignedTasks, recentAttempts });
  }

  return {
    handleAgents,
    handleAgentAbout,
  };
}
