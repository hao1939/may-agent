/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { METRIC_LIST_LIMIT, readMetricObservations } from "../adapters/reporting/metric-observations.js";
import { describeOpenAlert, resolveObservabilityCatalog } from "../adapters/reporting/observability-summary.js";
import { listConfiguredAgentNames } from "@may-agent/sdk/runtime";
import type { SqliteDb } from "./read-model/state-db.js";

const DASHBOARD_SESSION_ROW_LIMIT = 2_000;
const DASHBOARD_ALERT_ROW_LIMIT = 20;

export type MetricDaemonFrameResult = {
  ok: boolean;
  error?: string;
  eventId?: number;
  eventType?: string;
  delivery?: "recorded" | "accepted" | "rejected";
  links?: unknown[];
};

export function createMetricAndKnowledgeRouteHandlers(options: {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  getDb: () => SqliteDb;
  listLoadedApps?: () => ReadonlyArray<Record<string, unknown>> | null;
  json: (data: unknown, status?: number) => Response;
  sendDaemonFrame: (frame: Record<string, unknown>) => Promise<MetricDaemonFrameResult>;
  buildPublishFrame: (
    type: string,
    data: Record<string, unknown>,
    options?: {
      target?: { appId?: string; taskId?: string; sessionId?: string };
      idempotencyKey?: string;
    },
  ) => Record<string, unknown>;
}) {
  const {
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    sendDaemonFrame,
    buildPublishFrame,
  } = options;

  function listConfiguredAgents(): string[] {
    return listConfiguredAgentNames(AGENTS_ROOT, PROJECTS_ROOT);
  }

  function parseEventData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== "string") return {};
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  function latestAlertJudgment(
    db: SqliteDb,
    alert: { alertId?: number; metricId?: string; createdAt?: number },
  ): Record<string, unknown> | null {
    const accepted = db
      .prepare(
        `SELECT app_id, task_id, attempt_id, timestamp, data
      FROM metric_dispositions WHERE metric_id = ? AND alert_id = ?
      ORDER BY timestamp DESC, attempt_id DESC LIMIT 1`,
      )
      .get(alert.metricId ?? null, alert.alertId ?? null);
    if (accepted)
      return {
        ...parseEventData(String(accepted.data)),
        owner: accepted.app_id,
        timestamp: accepted.timestamp,
        source: {
          kind: "accepted-task-result",
          appId: accepted.app_id,
          taskId: accepted.task_id,
          attemptId: accepted.attempt_id,
        },
      };
    const row = db
      .prepare(
        `SELECT id, owner, timestamp, data
       FROM events
       WHERE event_type = 'metric.alert_judged'
         AND timestamp >= ?
         AND (
           alert_id = CAST(? AS TEXT)
           OR (
             alert_id IS NULL
             AND metric_id = ?
           )
         )
       ORDER BY timestamp DESC, id DESC
       LIMIT 1`,
      )
      .get(alert.createdAt ?? 0, alert.alertId ?? null, alert.metricId ?? null) as {
      id?: number;
      owner?: string | null;
      timestamp?: number;
      data?: string | null;
    } | null;
    if (!row) return null;
    return {
      eventId: row.id ?? null,
      owner: row.owner ?? null,
      timestamp: row.timestamp ?? null,
      ...parseEventData(row.data),
    };
  }

  function enrichOpenAlerts(db: SqliteDb, alerts: any[]): any[] {
    return alerts.map((alert) => ({
      ...alert,
      latestJudgment: latestAlertJudgment(db, alert),
    }));
  }

  function handleLiveness(url?: URL): Response {
    const db = _db();
    const now = Date.now();
    // Window for the activity timeline. Default 4h. Operator-selectable
    // from the WebUI via ?hours=N (clamped 1..72).
    const rawHours = Number(url?.searchParams.get("hours"));
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(72, Math.max(1, rawHours)) : 4;
    const since = now - hours * 60 * 60 * 1000;
    const lookbackSince = since - 7 * 86_400_000;
    const agents = listConfiguredAgents();
    const appCatalog = resolveObservabilityCatalog(db, {
      projectsRoot: PROJECTS_ROOT,
      loadedApps: options.listLoadedApps?.() ?? null,
    });

    const agentLatestRows = db
      .prepare(
        `SELECT agent, status, startedAt AS lastSessionAt, sessionCount
         FROM (
           SELECT agent, status, startedAt,
                  COUNT(*) OVER (PARTITION BY agent) AS sessionCount,
                  ROW_NUMBER() OVER (PARTITION BY agent ORDER BY startedAt DESC) AS recency
           FROM sessions
           WHERE startedAt > ? AND agent IS NOT NULL AND agent != ''
         )
         WHERE recency = 1`,
      )
      .all(since) as Array<{
      agent: string;
      status: string;
      lastSessionAt: number;
      sessionCount: number;
    }>;
    const summaryByAgent = new Map(agentLatestRows.map((row) => [row.agent, row]));

    // All sessions in the selected window. Each session is classified into a
    // 'category' bucket which maps to a color in the frontend.
    const allCandidates = db
      .prepare(
        `SELECT sessionId, agent, status, kind, source, app_id, projectId, parentSessionId,
              startedAt, endedAt
       FROM sessions
       WHERE (startedAt > ? OR status IN ('running', 'idle') OR (endedAt IS NOT NULL AND endedAt > ?))
         AND agent IS NOT NULL AND agent != ''
       ORDER BY startedAt DESC
       LIMIT ?`,
      )
      .all(since, since, DASHBOARD_SESSION_ROW_LIMIT + 1) as any[];
    const allRows = allCandidates.slice(0, DASHBOARD_SESSION_ROW_LIMIT).reverse();
    const activityTruncated = allCandidates.length > DASHBOARD_SESSION_ROW_LIMIT;

    function classifyKind(row: any): string {
      const src = String(row.source || "").toLowerCase();
      if (src === "heartbeat" || src.includes("heartbeat")) return "heartbeat";
      // Project work: explicit projectId tag or source mentions a project
      // workflow. (`workflow:project` is the generic project worker.)
      if (row.projectId && String(row.projectId).trim() !== "") return "project";
      if (src === "workflow:project" || src.startsWith("workflow:project-")) return "project";
      // Chat: human-initiated turns (telegram, web UI, CLI, explicit chat kind)
      if (row.kind === "chat") return "chat";
      if (src === "telegram" || src === "web" || src === "human" || src === "cli") return "chat";
      if (src.includes("chat") || src.includes("message")) return "chat";
      // Workflow: any workflow-dispatched session that isn't a project.
      if (src.startsWith("workflow:")) return "workflow";
      return "other";
    }

    const byAgent = new Map<string, any[]>();
    for (const agent of agents) byAgent.set(agent, []);
    for (const row of summaryByAgent.keys()) {
      if (!byAgent.has(row)) byAgent.set(row, []);
    }
    const sessionById = new Map<string, any>();
    for (const row of allRows) {
      sessionById.set(row.sessionId, row);
      if (row.startedAt <= since) continue;
      if (!byAgent.has(row.agent)) byAgent.set(row.agent, []);
      // 'category' is the timeline bucket (heartbeat / project / chat /
      // workflow / other). Distinct from row.kind which is the DB-level
      // session kind (call / chat / etc).
      byAgent.get(row.agent)!.push({ ...row, category: classifyKind(row) });
    }

    const agentRows = [...byAgent.entries()]
      .map(([name, sessions]) => {
        const agentSummary = summaryByAgent.get(name);
        const categoryCounts: Record<string, number> = { heartbeat: 0, project: 0, chat: 0, workflow: 0, other: 0 };
        for (const s of sessions) categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
        return {
          name,
          sessionCount: agentSummary?.sessionCount ?? sessions.length,
          categoryCounts,
          lastSessionAt: agentSummary?.lastSessionAt ?? null,
          lastStatus: agentSummary?.status ?? null,
          sessions,
        };
      })
      .sort((a, b) => (b.lastSessionAt ?? 0) - (a.lastSessionAt ?? 0));

    // ── Unified Canonical Activity Timeline (Task Attempts + Workflows + Sessions + Human Inputs + Alerts) ──
    type UnifiedTimelineItem = {
      id: string;
      kind: "agent" | "codex" | "workflow" | "chat" | "human" | "heartbeat" | "other";
      legacyCategory: "heartbeat" | "project" | "chat" | "workflow" | "other";
      status: "running" | "converged" | "done" | "error" | "blocked" | "interrupted";
      appId: string | null;
      agent: string | null;
      sessionId: string | null;
      href: string;
      label: string;
      detail: string | null;
      startedAt: number;
      endedAt: number | null;
      isPin?: boolean;
    };

    const normalizeTimelineApp = (raw: unknown): string | null => {
      const s = typeof raw === "string" ? raw.trim().replace(/^projects\//i, "").replace(/\.app$/i, "") : "";
      if (!s || s === "platform" || s.startsWith("system:")) return null;
      if (appCatalog.disabledSet.has(s)) return null;
      return s;
    };

    const timelineItems: UnifiedTimelineItem[] = [];
    const claimedSessionIds = new Set<string>();
    const claimedAttemptKeys = new Set<string>();

    const attemptRows = db
      .prepare(
        `SELECT
           a.app_id AS appId,
           a.attempt_id AS attemptId,
           a.task_id AS taskId,
           a.state AS state,
           a.accepted_result_state AS resultState,
           a.started_at AS startedAt,
           CAST(unixepoch(json_extract(a.attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER) AS finishedAt,
           COALESCE(json_extract(a.attempt_json, '$.handler'), '') AS handler,
           NULLIF(trim(json_extract(a.attempt_json, '$.sessionId')), '') AS sessionId,
           COALESCE(
             NULLIF(trim(json_extract(a.attempt_json, '$.owner')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.agent')), ''),
             NULLIF(trim(json_extract(t.resource_json, '$.spec.owner')), '')
           ) AS owner
         FROM app_task_attempts a
         LEFT JOIN app_tasks t ON t.app_id = a.app_id AND t.task_id = a.task_id
         WHERE a.started_at >= ?
           AND (
             a.state = 'running'
             OR a.started_at > ?
             OR CAST(unixepoch(json_extract(a.attempt_json, '$.finishedAt'), 'subsec') * 1000 AS INTEGER) > ?
           )
         ORDER BY a.started_at DESC
         LIMIT 800`,
      )
      .all(lookbackSince, since, since) as Array<{
      appId: string;
      attemptId: string;
      taskId: string;
      state: string;
      resultState: string | null;
      startedAt: number;
      finishedAt: number | null;
      handler: string;
      sessionId: string | null;
      owner: string | null;
    }>;

    for (const r of attemptRows.reverse()) {
      const appId = normalizeTimelineApp(r.appId);
      if (r.appId && appCatalog.disabledSet.has(r.appId)) continue;
      claimedAttemptKeys.add(`${r.appId}::${r.attemptId}`);
      const linkedSession = r.sessionId ? sessionById.get(r.sessionId) : undefined;
      if (r.sessionId) claimedSessionIds.add(r.sessionId);

      const h = r.handler.toLowerCase();
      const kind: UnifiedTimelineItem["kind"] = h.startsWith("workflow:")
        ? "workflow"
        : h.startsWith("executor:codex") || h.startsWith("cli:")
          ? "codex"
          : h === "executor:conversation"
            ? "chat"
            : "agent";
      const legacyCategory: UnifiedTimelineItem["legacyCategory"] =
        kind === "workflow" ? "workflow" : kind === "chat" ? "chat" : "project";
      const isErr = r.state === "failed" || linkedSession?.status === "error";
      const status: UnifiedTimelineItem["status"] =
        r.state === "running"
          ? "running"
          : isErr
            ? "error"
            : r.resultState === "converged"
              ? "converged"
              : r.state === "interrupted"
                ? "interrupted"
                : "done";
      const agent = r.owner || (appId ? (appCatalog.ownerByAppId.get(appId) ?? appId) : null);
      const href = r.sessionId
        ? `/sessions/${encodeURIComponent(r.sessionId)}`
        : appId
          ? `/projects/${encodeURIComponent(appId + ".app")}/tasks?appId=${encodeURIComponent(appId)}&task=${encodeURIComponent(r.taskId)}`
          : "/projects";
      timelineItems.push({
        id: `att:${r.appId}:${r.attemptId}`,
        kind,
        legacyCategory,
        status,
        appId,
        agent,
        sessionId: r.sessionId,
        href,
        label: r.taskId,
        detail: r.handler || kind,
        startedAt: r.startedAt,
        endedAt: r.state === "running" ? null : (r.finishedAt ?? linkedSession?.endedAt ?? r.startedAt),
      });
    }

    const wfRows = db
      .prepare(
        `SELECT runId, workflow, status, app_id AS appId, projectId, attempt_id AS attemptId, startedAt, endedAt
         FROM workflow_runs
         WHERE parentWorkflowRunId IS NULL
           AND startedAt >= ?
           AND (status = 'running' OR startedAt > ? OR (endedAt IS NOT NULL AND endedAt > ?))
         ORDER BY startedAt DESC
         LIMIT 600`,
      )
      .all(lookbackSince, since, since) as Array<{
      runId: string;
      workflow: string;
      status: string;
      appId: string | null;
      projectId: string | null;
      attemptId: string | null;
      startedAt: number;
      endedAt: number | null;
    }>;

    for (const wf of wfRows.reverse()) {
      if (wf.appId && wf.attemptId && claimedAttemptKeys.has(`${wf.appId}::${wf.attemptId}`)) continue;
      const appId = normalizeTimelineApp(wf.appId ?? wf.projectId);
      const agent = appId ? (appCatalog.ownerByAppId.get(appId) ?? appId) : null;
      const status: UnifiedTimelineItem["status"] =
        wf.status === "running"
          ? "running"
          : wf.status === "error"
            ? "error"
            : wf.status === "blocked"
              ? "blocked"
              : wf.status === "interrupted"
                ? "interrupted"
                : "done";
      const params = new URLSearchParams({ workflow: wf.workflow, runs: "true" });
      if (appId) params.set("appId", appId);
      timelineItems.push({
        id: `wf:${wf.runId}`,
        kind: "workflow",
        legacyCategory: "workflow",
        status,
        appId,
        agent,
        sessionId: null,
        href: `/metrics?${params.toString()}`,
        label: wf.workflow,
        detail: `workflow · ${wf.runId}`,
        startedAt: wf.startedAt,
        endedAt: wf.status === "running" ? null : (wf.endedAt ?? wf.startedAt),
      });
    }

    for (const s of allRows) {
      if (claimedSessionIds.has(s.sessionId)) continue;
      const cat = classifyKind(s) as UnifiedTimelineItem["legacyCategory"];
      const kind: UnifiedTimelineItem["kind"] =
        cat === "heartbeat"
          ? "heartbeat"
          : cat === "chat"
            ? "chat"
            : cat === "workflow"
              ? "workflow"
              : cat === "project"
                ? "agent"
                : "other";
      const appId =
        normalizeTimelineApp(s.app_id ?? s.projectId) ??
        (s.agent ? (appCatalog.appIdByOwner.get(s.agent) ?? null) : null);
      const status: UnifiedTimelineItem["status"] =
        s.status === "error"
          ? "error"
          : s.status === "running" || s.status === "idle"
            ? "running"
            : s.status === "interrupted"
              ? "interrupted"
              : "done";
      const label =
        cat === "heartbeat"
          ? "heartbeat"
          : cat === "project"
            ? `project ${s.projectId || ""}`.trim()
            : cat === "chat"
              ? "chat"
              : s.source || "session";
      timelineItems.push({
        id: `sess:${s.sessionId}`,
        kind,
        legacyCategory: cat,
        status,
        appId,
        agent: s.agent || null,
        sessionId: s.sessionId,
        href: `/sessions/${encodeURIComponent(s.sessionId)}`,
        label,
        detail: s.sessionId,
        startedAt: s.startedAt,
        endedAt: status === "running" ? null : (s.endedAt ?? s.startedAt),
      });
    }

    const humanRows = db
      .prepare(
        `SELECT id, app_id AS appId, source_id AS sourceId, input_kind AS inputKind, created_at AS createdAt
         FROM app_inbox_items
         WHERE source_kind = 'human' AND created_at > ? AND created_at <= ?
         ORDER BY created_at ASC
         LIMIT 300`,
      )
      .all(since, now) as Array<{
      id: string;
      appId: string;
      sourceId: string;
      inputKind: string;
      createdAt: number;
    }>;

    for (const h of humanRows) {
      const appId = normalizeTimelineApp(h.appId);
      if (!appId) continue;
      timelineItems.push({
        id: `in:${h.id}`,
        kind: "human",
        legacyCategory: "chat",
        status: "done",
        appId,
        agent: appCatalog.ownerByAppId.get(appId) ?? appId,
        sessionId: null,
        href: `/projects/${encodeURIComponent(appId + ".app")}/tasks?appId=${encodeURIComponent(appId)}`,
        label: `human ${h.inputKind}`,
        detail: h.sourceId || "inbox",
        startedAt: h.createdAt,
        endedAt: h.createdAt,
        isPin: true,
      });
    }

    timelineItems.sort((a, b) => a.startedAt - b.startedAt);

    type Swimlane = {
      id: string;
      label: string;
      sublabel: string | null;
      href: string | null;
      runningCount: number;
      errorCount: number;
      totalCount: number;
      lastActivityAt: number | null;
      items: UnifiedTimelineItem[];
    };

    const appLaneMap = new Map<string, Swimlane>();
    for (const appId of appCatalog.visibleAppIds) {
      const owner = appCatalog.ownerByAppId.get(appId) ?? null;
      appLaneMap.set(appId, {
        id: appId,
        label: appId,
        sublabel: owner && owner !== appId ? owner : null,
        href: `/projects/${encodeURIComponent(appId + ".app")}/tasks?appId=${encodeURIComponent(appId)}`,
        runningCount: 0,
        errorCount: 0,
        totalCount: 0,
        lastActivityAt: null,
        items: [],
      });
    }
    const unboundAppLane: Swimlane = {
      id: "_host",
      label: "Host / Direct",
      sublabel: "unbound",
      href: "/metrics",
      runningCount: 0,
      errorCount: 0,
      totalCount: 0,
      lastActivityAt: null,
      items: [],
    };

    const agentLaneMap = new Map<string, Swimlane>();
    for (const ag of agents) {
      const mappedApp = appCatalog.appIdByOwner.get(ag) ?? null;
      agentLaneMap.set(ag, {
        id: ag,
        label: ag,
        sublabel: mappedApp && mappedApp !== ag ? mappedApp : null,
        href: `/agents/${encodeURIComponent(ag)}`,
        runningCount: 0,
        errorCount: 0,
        totalCount: 0,
        lastActivityAt: null,
        items: [],
      });
    }

    const pushToLane = (lane: Swimlane, item: UnifiedTimelineItem) => {
      lane.items.push(item);
      lane.totalCount += 1;
      if (item.status === "running") lane.runningCount += 1;
      if (item.status === "error") lane.errorCount += 1;
      const touchAt = item.status === "running" ? now : Math.max(item.startedAt, item.endedAt ?? item.startedAt);
      if (lane.lastActivityAt === null || touchAt > lane.lastActivityAt) lane.lastActivityAt = touchAt;
    };

    for (const item of timelineItems) {
      if (item.appId && appLaneMap.has(item.appId)) {
        pushToLane(appLaneMap.get(item.appId)!, item);
      } else if (item.appId) {
        let dyn = appLaneMap.get(item.appId);
        if (!dyn) {
          dyn = {
            id: item.appId,
            label: item.appId,
            sublabel: item.agent && item.agent !== item.appId ? item.agent : null,
            href: `/projects/${encodeURIComponent(item.appId + ".app")}/tasks?appId=${encodeURIComponent(item.appId)}`,
            runningCount: 0,
            errorCount: 0,
            totalCount: 0,
            lastActivityAt: null,
            items: [],
          };
          appLaneMap.set(item.appId, dyn);
        }
        pushToLane(dyn, item);
      } else {
        pushToLane(unboundAppLane, item);
      }

      if (item.agent) {
        let agLane = agentLaneMap.get(item.agent);
        if (!agLane) {
          agLane = {
            id: item.agent,
            label: item.agent,
            sublabel: item.appId && item.appId !== item.agent ? item.appId : null,
            href: `/agents/${encodeURIComponent(item.agent)}`,
            runningCount: 0,
            errorCount: 0,
            totalCount: 0,
            lastActivityAt: null,
            items: [],
          };
          agentLaneMap.set(item.agent, agLane);
        }
        pushToLane(agLane, item);
      }
    }

    const sortLanes = (list: Swimlane[]) =>
      list.sort(
        (a, b) =>
          b.runningCount - a.runningCount ||
          (b.totalCount > 0 ? 1 : 0) - (a.totalCount > 0 ? 1 : 0) ||
          (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0) ||
          a.label.localeCompare(b.label),
      );

    const appLanes = sortLanes([...appLaneMap.values()]);
    if (unboundAppLane.totalCount > 0) appLanes.push(unboundAppLane);
    const agentLanes = sortLanes([...agentLaneMap.values()]);

    const alertWindowRows = db
      .prepare(
        `SELECT ma.id AS alertId, ma.metric_id AS metricId, ma.created_at AS createdAt, ma.resolved_at AS resolvedAt,
                COALESCE(m.name, ma.metric_id) AS name, COALESCE(m.priority, 'P2') AS priority
         FROM metric_alerts ma
         LEFT JOIN metrics m ON m.id = ma.metric_id
         WHERE ma.created_at > ? OR (ma.resolved_at IS NOT NULL AND ma.resolved_at > ?)
         ORDER BY ma.created_at ASC
         LIMIT 100`,
      )
      .all(since, since) as Array<{
      alertId: number;
      metricId: string;
      createdAt: number;
      resolvedAt: number | null;
      name: string;
      priority: string;
    }>;

    const activeSessions =
      (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle')").get() as any)?.c ?? 0;
    const activeRunningItems = timelineItems.filter((i) => i.status === "running").length;
    const openAlertCandidates = enrichOpenAlerts(
      db,
      db
        .prepare(
          `SELECT ma.id as alertId, ma.metric_id as metricId, ma.message, ma.created_at as createdAt,
              m.name, m.config, m.owner as explicitOwner,
              COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'system:host') as owner,
              m.project, m.priority, m.current, m.threshold, m.target
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
         AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
       WHERE ma.resolved_at IS NULL
       ORDER BY ma.created_at DESC, ma.id DESC
       LIMIT ${DASHBOARD_ALERT_ROW_LIMIT + 1}`,
        )
        .all() as any[],
    ).map(({ config, explicitOwner, ...alert }) => {
      const routing = describeOpenAlert(
        {
          alertId: alert.alertId,
          metricId: alert.metricId,
          name: alert.name,
          priority: alert.priority,
          message: alert.message,
          createdAt: alert.createdAt,
          owner: explicitOwner ?? alert.owner,
          project: alert.project,
          config,
          latestJudgment: alert.latestJudgment,
        },
        appCatalog,
      );
      return {
        ...alert,
        scope: routing.scope,
        declaredOwner: routing.declaredOwner,
        declaredHandler: routing.declaredHandler,
        handlingStatus: routing.handlingStatus,
        linkedTask: routing.linkedTask,
      };
    });

    const openAlerts = openAlertCandidates.slice(0, DASHBOARD_ALERT_ROW_LIMIT);
    const openAlertsTruncated = openAlertCandidates.length > DASHBOARD_ALERT_ROW_LIMIT;

    return json({
      summary: {
        agentsConfigured: agents.length,
        agentsTotal: agents.length,
        activeAgentsInWindow: agentLanes.filter((lane) => lane.totalCount > 0).length,
        activeAppsInWindow: appLanes.filter((lane) => lane.id !== "_host" && lane.totalCount > 0).length,
        windowHours: hours,
        windowSince: since,
        windowEnd: now,
        activityRows: timelineItems.length,
        activityRowsTruncated: activityTruncated,
        rowLimit: DASHBOARD_SESSION_ROW_LIMIT,
        activeSessions,
        activeRunning: Math.max(activeSessions, activeRunningItems),
        openAlerts: openAlerts.length,
        openAlertsTruncated,
      },
      agents: agentRows,
      alerts: openAlerts,
      timeline: {
        appLanes,
        agentLanes,
        alertEvents: alertWindowRows,
      },
    });
  }

  function handleMetrics(url: URL): Response {
    const db = _db();
    const metricId = url.searchParams.get("id");
    const filterAppId = url.searchParams.get("appId")?.trim() || null;
    const appCatalog = resolveObservabilityCatalog(db, {
      projectsRoot: PROJECTS_ROOT,
      loadedApps: options.listLoadedApps?.() ?? null,
      filterAppId,
    });
    const observations = readMetricObservations(
      db,
      Date.now(),
      metricId === null ? undefined : [metricId],
      appCatalog,
    );
    const metrics = observations.metrics;

    const rawOpenAlerts = enrichOpenAlerts(
      db,
      db
        .prepare(
          `
      SELECT ma.id as alertId, ma.metric_id as metricId, ma.alert_type as alertType,
             ma.message, ma.created_at as createdAt,
             m.name, m.type, m.config,
             COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'system:host') as owner,
             m.owner as explicitOwner, m.project, m.current, m.target, m.threshold,
             m.unit, m.priority, m.status, m.speed, m.alert_op,
             m.source, m.updated_at
      FROM metric_alerts ma
      INNER JOIN metrics m ON m.id = ma.metric_id
      LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
        AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
      WHERE ma.resolved_at IS NULL
        AND m.status = 'active'
        ${metricId === null ? "" : "AND ma.metric_id = ?"}
      ORDER BY ma.created_at DESC, ma.id DESC
      LIMIT ${METRIC_LIST_LIMIT + 1}
    `,
        )
        .all(...(metricId === null ? [] : [metricId])) as any[],
    );
    const openAlerts = rawOpenAlerts.map(({ config, ...alert }) => {
      const routing = describeOpenAlert(
        {
          alertId: alert.alertId,
          metricId: alert.metricId,
          name: alert.name,
          priority: alert.priority,
          message: alert.message,
          createdAt: alert.createdAt,
          owner: alert.explicitOwner ?? alert.owner,
          project: alert.project,
          config,
          latestJudgment: alert.latestJudgment,
        },
        appCatalog,
      );
      return {
        ...alert,
        scope: routing.scope,
        handler: routing.handler,
        handlingStatus: routing.handlingStatus,
        linkedTask: routing.linkedTask,
      };
    });

    const alertsTruncated = openAlerts.length > METRIC_LIST_LIMIT;
    // Keep the latest alert, and never infer absence from a truncated global list.
    const openAlertByMetric = new Map([...openAlerts].reverse().map((alert) => [alert.metricId, alert]));
    const metricsWithAlertState = metrics.map((metric) => {
      const alert = openAlertByMetric.get(metric.id);
      return alert
        ? {
            ...metric,
            alertOpen: true,
            alertId: alert.alertId,
            alertMessage: alert.message,
            alertType: alert.alertType,
            latestJudgment: alert.latestJudgment,
          }
        : { ...metric, alertOpen: alertsTruncated ? null : false };
    });

    return new Response(
      JSON.stringify({
        metrics: metricsWithAlertState,
        generatedAt: observations.generatedAt,
        truncated: observations.truncated,
        alerts: openAlerts.slice(0, METRIC_LIST_LIMIT),
        alertsTruncated,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  function handleBrowse(url: URL): Response {
    const relPath = url.searchParams.get("path") ?? "";
    const sharedDir = SHARED_ROOT;

    // Only allow browsing under the shared root.
    const absPath = join(sharedDir, relPath);
    if (!absPath.startsWith(sharedDir)) return json({ error: "Access denied" }, 403);

    if (!existsSync(absPath)) return json({ error: "Not found" }, 404);

    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      // List directory contents
      const entries: Array<{ name: string; type: "dir" | "file"; size?: number }> = [];
      for (const name of readdirSync(absPath).sort()) {
        const childPath = join(absPath, name);
        try {
          const childStat = statSync(childPath);
          if (childStat.isDirectory()) {
            entries.push({ name, type: "dir" });
          } else if (name.endsWith(".md") || name.endsWith(".ts") || name.endsWith(".json")) {
            entries.push({ name, type: "file", size: childStat.size });
          }
        } catch {
          /* skip unreadable */
        }
      }
      return json({ path: relPath, type: "dir", entries });
    } else {
      // Serve file content
      const content = readFileSync(absPath, "utf-8");
      return json({ path: relPath, type: "file", content });
    }
  }

  function handleKnowledgeSearch(url: URL): Response {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(80, Number(url.searchParams.get("limit") || 40)));
    if (q.length < 2) return json({ query: q, results: [] });

    const roots: Array<{ label: string; dir: string }> = [];
    const sharedKnowledge = resolve(SHARED_ROOT, "knowledge");
    if (existsSync(sharedKnowledge)) roots.push({ label: "shared/knowledge", dir: sharedKnowledge });
    try {
      for (const entry of readdirSync(PROJECTS_ROOT, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const knowledgeDir = resolve(PROJECTS_ROOT, entry.name, "knowledge");
        if (existsSync(knowledgeDir)) roots.push({ label: `projects/${entry.name}/knowledge`, dir: knowledgeDir });
      }
    } catch {
      // Keep search available even if projects root is missing.
    }

    const results: Array<Record<string, unknown>> = [];
    const visit = (root: { label: string; dir: string }, dir: string, depth: number) => {
      if (results.length >= limit || depth > 5) return;
      let entries: any[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= limit) return;
        if (entry.name.startsWith(".")) continue;
        const abs = resolve(dir, entry.name);
        const rel = relative(root.dir, abs);
        if (rel.startsWith("..") || rel.startsWith("/")) continue;
        if (entry.isDirectory()) {
          visit(root, abs, depth + 1);
          continue;
        }
        if (!/\.(md|json|txt)$/i.test(entry.name)) continue;
        let stat: { size: number } | null = null;
        try {
          stat = statSync(abs);
          if (stat.size > 200_000) continue;
        } catch {
          continue;
        }
        const displayPath = `${root.label}/${rel.replace(/\\/g, "/")}`;
        let content = "";
        try {
          content = readFileSync(abs, "utf-8");
        } catch {
          continue;
        }
        const lowerPath = displayPath.toLowerCase();
        const lowerContent = content.toLowerCase();
        const pathHit = lowerPath.includes(q);
        const contentIdx = lowerContent.indexOf(q);
        if (!pathHit && contentIdx === -1) continue;
        const start = contentIdx === -1 ? 0 : Math.max(0, contentIdx - 90);
        const snippet = content
          .slice(start, Math.min(content.length, start + 240))
          .replace(/\s+/g, " ")
          .trim();
        results.push({
          path: displayPath,
          browsePath: root.label === "shared/knowledge" ? `knowledge/${rel.replace(/\\/g, "/")}` : null,
          source: root.label,
          size: stat.size,
          match: pathHit ? "path" : "content",
          snippet,
        });
      }
    };
    for (const root of roots) visit(root, root.dir, 0);
    return json({ query: q, results });
  }

  async function handleAlertResolve(req: Request, alertId: string): Promise<Response> {
    const id = parseInt(alertId, 10);
    if (!Number.isFinite(id)) return json({ error: "numeric alertId required" }, 400);
    let body: { reason?: string } = {};
    try {
      body = (await req.json()) as { reason?: string };
    } catch {
      /* body optional */
    }
    const existing = _db()
      .prepare(
        `SELECT ma.id, ma.metric_id, ma.resolved_at, m.owner
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       WHERE ma.id = ?`,
      )
      .get(id) as { id: number; metric_id: string; owner?: string | null; resolved_at: number | null } | undefined;
    if (!existing) return json({ error: "alert not found" }, 404);
    if (existing.resolved_at !== null) return json({ ok: true, alreadyResolved: true });
    const result = await sendDaemonFrame(
      buildPublishFrame("metric.alert_resolved", {
        metricId: existing.metric_id,
        alertId: id,
        reason: body.reason ?? null,
        metricOwner: existing.owner ?? "system:host",
      }),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, accepted: true, alertId: id });
  }

  return {
    handleLiveness,
    handleMetrics,
    handleBrowse,
    handleKnowledgeSearch,
    handleAlertResolve,
  };
}
