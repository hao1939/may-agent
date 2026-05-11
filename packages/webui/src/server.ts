#!/usr/bin/env bun
/**
 * may-agent Web UI — HTTP server for dashboard + chat.
 *
 * Can run standalone: bun packages/webui/src/server.ts --state-dir .state --port 8080
 * Can be imported:    import { startWebUI } from "@may-agent/webui"
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const Bun: {
  serve(opts: {
    port: number;
    hostname?: string;
    fetch(req: Request, server: any): Response | Promise<Response> | undefined;
    websocket: { open(ws: any): void; message(ws: any, msg: any): void; close(ws: any): void };
  }): { port: number };
};
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import type { Duplex } from "node:stream";
import { connectSocketEndpoint, daemonSocketPath, sendDaemonEvent } from "../../control/src/client.js";
import { openStateDb, type SqliteDb } from "./state-db.js";
import { buildLoopTrace, type LoopTraceTarget } from "./loop-trace.js";

// ── Public API ────────────────────────────────────────────────────────

const LIVE_VITAL_METRIC_IDS = [
  "agent.heartbeat-dark-count-2h",
  "agent.config-invalid-count-1h",
  "handler.success-rate",
  "session.error-rate-6h",
  "session.first-turn-error-count-1h",
  "session.empty-assistant-stop-count-1h",
  "message.delivery-failed-count-1h",
  "capability.zombie-session-count",
  "evaluator.stale-running-session-count",
  "eval.llm-coverage-lag-h",
  "project.iterations-24h",
  "system.real-output-24h",
];

export interface WebUIOptions {
  stateDir: string;
  port: number;
}

export function startWebUI(opts: WebUIOptions): { port: number } {
  const STATE_DIR = opts.stateDir;
  const PORT = opts.port;
  const PROJECT_ROOT = process.env.PROJECT_ROOT || resolve(STATE_DIR, "..");
  const AGENTS_ROOT = process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents");
  const DAEMON_INSTANCE = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "default";
  const DAEMON_AGENT = process.env.DAEMON_AGENT || process.env.AGENT || "may";

  function _db(): SqliteDb {
    return openStateDb(join(STATE_DIR, "may.db"));
  }

  function listConfiguredAgents(): string[] {
    try {
      return readdirSync(AGENTS_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_") && entry.name !== "shared" && entry.name !== "gym")
        .map((entry) => {
          const configPath = join(AGENTS_ROOT, entry.name, "agent.json");
          if (!existsSync(configPath)) return null;
          try {
            const config = JSON.parse(readFileSync(configPath, "utf-8")) as { name?: string; disabled?: boolean; heartbeat?: boolean };
            if (config.disabled || config.heartbeat === false) return null;
            return config.name ?? entry.name;
          } catch {
            return entry.name;
          }
        })
        .filter((name): name is string => Boolean(name))
        .sort();
    } catch {
      return [];
    }
  }

  function listScheduledHeartbeatAgents(configuredAgents: string[]): string[] {
    const configured = new Set(configuredAgents);
    const agents = new Set<string>();
    const cronPath = join(AGENTS_ROOT, "may", "cron.json");
    try {
      const cron = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{
        name?: string;
        enabled?: boolean;
        agent?: string;
        handler?: string;
        handlerConfig?: { agent?: string; workflow?: string };
      }>;
      for (const entry of cron) {
        if (entry.enabled === false) continue;
        const isHeartbeat = entry.name === "heartbeat"
          || entry.name?.startsWith("heartbeat-")
          || entry.handler === "heartbeat"
          || entry.handlerConfig?.workflow?.includes("heartbeat");
        if (!isHeartbeat) continue;
        const agent = (entry.handlerConfig?.agent || entry.agent || "").trim();
        if (agent && configured.has(agent)) agents.add(agent);
      }
    } catch {
      // If cron metadata is unavailable, fall back to all configured agents.
      for (const agent of configuredAgents) agents.add(agent);
    }
    return [...agents].sort();
  }

  function parseEventData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== "string") return {};
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  function parseProjectIdentity(path: string, content?: string): { owner: string; name: string; projectId: string } {
    const parts = path.split("/");
    const name = parts[1] === "shared" && parts[2] === "projects"
      ? parts[3]?.replace(/\.md$/, "") ?? ""
      : parts[parts.length - 1]?.replace(/\.md$/, "") ?? "";
    let owner = parts[1] === "shared" ? "shared" : parts[1] ?? "";
    const ownerMatch = content?.match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m);
    if (ownerMatch?.[1]) owner = ownerMatch[1].trim().replace(/^["']|["']$/g, "");
    return { owner, name, projectId: `${owner}/${name}` };
  }

  function conventionSocketPath(): string {
    return daemonSocketPath(STATE_DIR, {
      instance: DAEMON_INSTANCE,
      interfaceAgent: DAEMON_AGENT,
    });
  }

  // ── API handlers ──────────────────────────────────────────────────

  function handleLiveness(url?: URL): Response {
    const db = _db();
    const now = Date.now();
    // Window for the activity timeline. Default 4h. Operator-selectable
    // from the WebUI via ?hours=N (clamped 1..72).
    const rawHours = Number(url?.searchParams.get("hours"));
    const hours = Number.isFinite(rawHours) && rawHours > 0
      ? Math.min(72, Math.max(1, rawHours))
      : 4;
    const since = now - hours * 60 * 60 * 1000;
    const oneHour = now - 60 * 60 * 1000;
    const agents = listConfiguredAgents();
    const scheduledHeartbeatAgents = new Set(listScheduledHeartbeatAgents(agents));

    const heartbeatRows = db.prepare(
      // Heartbeat detection covers all dispatch styles in production:
      //   1. Cron-driven sessions whose task starts with "[heartbeat]".
      //   2. Per-agent workflow sessions whose task is rebuilt internally
      //      to start with "You are **<agent>** waking up for your heartbeat."
      //      (Source is just "workflow"; only the task body identifies it.
      //      We anchor at the start of task to avoid matching aftermath
      //      reviews that embed a heartbeat session's JSON inside their task.)
      //   3. Future workflows that adopt source="workflow:<agent>-heartbeat"
      //      or source="heartbeat" once we standardize trigger typing.
      // TODO: replace string matching once heartbeat workflows set a typed
      // source / trigger field (see webui.md "Data model gaps to close" §2).
      `SELECT sessionId, agent, status, kind, source, startedAt, endedAt
       FROM sessions
       WHERE startedAt > ?
         AND (
           source LIKE 'workflow:%heartbeat%'
           OR source = 'heartbeat'
           OR task LIKE '[heartbeat]%'
           OR task LIKE 'You are %waking up for your heartbeat.%'
         )
       ORDER BY startedAt ASC`
    ).all(since) as any[];

    // All sessions in the selected window (not just heartbeats). The
    // timeline shows everything an agent did so the operator sees real
    // activity distribution, not only the cron tick. Each session is
    // classified into a 'category' bucket which maps to a color in the
    // frontend.
    const allRows = db.prepare(
      `SELECT sessionId, agent, status, kind, source, projectId, parentSessionId,
              startedAt, endedAt
       FROM sessions
       WHERE startedAt > ? AND agent IS NOT NULL AND agent != ''
       ORDER BY startedAt ASC`
    ).all(since) as any[];

    // Heartbeat detection mirrors heartbeatRows above (same predicates).
    // Pre-build a Set of heartbeat sessionIds for O(1) classification.
    const heartbeatIds = new Set(heartbeatRows.map((r) => r.sessionId));

    function classifyKind(row: any): string {
      if (heartbeatIds.has(row.sessionId)) return "heartbeat";
      const src = String(row.source || "").toLowerCase();
      // Project work: explicit projectId tag or source mentions a project
      // workflow. (`workflow:project` is the generic project worker.)
      if (row.projectId && String(row.projectId).trim() !== "") return "project";
      if (src === "workflow:project" || src.startsWith("workflow:project-")) return "project";
      // Chat: human-initiated turns (telegram, web UI, CLI, explicit chat kind)
      if (row.kind === "chat") return "chat";
      if (src === "telegram" || src === "web" || src === "human" || src === "cli") return "chat";
      if (src.includes("chat") || src.includes("message")) return "chat";
      // Workflow: any workflow-dispatched session that isn't a heartbeat or
      // project. Catches aftermath, triage, orchestrator, goal-driver,
      // closed-loop-steward, etc. — the bulk of background agent activity.
      if (src.startsWith("workflow:") || src === "closed-loop-steward") return "workflow";
      return "other";
    }

    const byAgent = new Map<string, any[]>();
    for (const agent of agents) byAgent.set(agent, []);
    for (const row of allRows) {
      if (!byAgent.has(row.agent)) byAgent.set(row.agent, []);
      // 'category' is the timeline bucket (heartbeat / project / chat /
      // workflow / other). Distinct from row.kind which is the DB-level
      // session kind (call / chat / etc).
      byAgent.get(row.agent)!.push({ ...row, category: classifyKind(row) });
    }

    const agentRows = [...byAgent.entries()].map(([name, sessions]) => {
      const heartbeatsForAgent = sessions.filter((s) => s.category === "heartbeat");
      const lastHb = heartbeatsForAgent[heartbeatsForAgent.length - 1] ?? null;
      const categoryCounts: Record<string, number> = { heartbeat: 0, project: 0, chat: 0, workflow: 0, other: 0 };
      for (const s of sessions) categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
      return {
        name,
        heartbeatCount: heartbeatsForAgent.length,
        sessionCount: sessions.length,
        categoryCounts,
        lastHeartbeat: lastHb?.startedAt ?? null,
        lastStatus: lastHb?.status ?? null,
        sessions,
      };
    }).sort((a, b) => (b.lastHeartbeat ?? 0) - (a.lastHeartbeat ?? 0));

    const activeSessions = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle')").get() as any)?.c ?? 0;
    const openAlerts = db.prepare(
      `SELECT ma.id as alertId, ma.metric_id as metricId, ma.message, ma.created_at as createdAt,
              COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
              m.project, m.priority, m.current, m.threshold, m.target
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
         AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
       WHERE ma.resolved_at IS NULL
       ORDER BY ma.created_at DESC
       LIMIT 20`
    ).all() as any[];

    const metricOrder = new Map(LIVE_VITAL_METRIC_IDS.map((id, idx) => [id, idx]));
    const vitalPlaceholders = LIVE_VITAL_METRIC_IDS.map(() => "?").join(", ");
    const openAlertMetricIds = new Set(openAlerts.map((alert) => alert.metricId));
    const vitals = db.prepare(
      `SELECT id, name, owner, current, target, threshold, unit, priority, alert_op, updated_at as updatedAt
       FROM metrics
       WHERE id IN (${vitalPlaceholders}) AND status = 'active'`
    ).all(...LIVE_VITAL_METRIC_IDS) as any[];
    const vitalMetrics = vitals
      .map((m) => {
        const current = typeof m.current === "number" ? m.current : null;
        const threshold = typeof m.threshold === "number" ? m.threshold : null;
        const breached = current != null && threshold != null
          ? (m.alert_op === ">" || m.alert_op === "above" ? current > threshold : current < threshold)
          : false;
        return {
          ...m,
          owner: m.owner || "may",
          breached,
          alertOpen: openAlertMetricIds.has(m.id),
        };
      })
      .sort((a, b) => (metricOrder.get(a.id) ?? 999) - (metricOrder.get(b.id) ?? 999));

    const messages = (db.prepare(
      `SELECT event_type, source, owner, data, timestamp
       FROM events
       WHERE event_type = 'message.created' AND timestamp > ?
       ORDER BY timestamp DESC
       LIMIT 20`
    ).all(oneHour) as any[]).map((row) => {
      const data = parseEventData(row.data);
      return {
        timestamp: row.timestamp,
        from: data.from ?? row.source ?? "unknown",
        to: data.to ?? row.owner ?? "unknown",
        priority: data.priority ?? null,
        intent: data.intent ?? null,
        content: data.content ?? "",
      };
    });

    const recentDecisions = (db.prepare(
      `SELECT sessionId, agent, task, status, startedAt, outcome
       FROM sessions
       WHERE startedAt > ?
         AND (
           source LIKE 'workflow:%heartbeat%'
           OR source = 'heartbeat'
           OR task LIKE '[heartbeat]%'
           OR task LIKE 'You are %waking up for your heartbeat.%'
         )
       ORDER BY startedAt DESC
       LIMIT 8`
    ).all(since) as any[])
      .map((row) => ({
        sessionId: row.sessionId,
        agent: row.agent,
        timestamp: row.startedAt,
        status: row.status,
        text: (row.outcome || row.task || "").replace(/^\[heartbeat\]\s*/i, "").slice(0, 220),
      }));

    const scheduledAgentRows = agentRows.filter((agent) => scheduledHeartbeatAgents.has(agent.name));
    const scheduledHeartbeatRows = scheduledAgentRows.filter((agent) => agent.lastHeartbeat);
    const staleAgents = scheduledAgentRows.filter((agent) => !agent.lastHeartbeat).map((agent) => agent.name);

    return json({
      summary: {
        agentsConfigured: scheduledHeartbeatAgents.size || agents.length,
        agentsTotal: agents.length,
        expectedHeartbeatAgents: scheduledHeartbeatAgents.size || agents.length,
        // NOTE: keep `*4h` field names even though the window is now
        // operator-selectable — they're consumed elsewhere as the
        // "heartbeat coverage in window" signal, and the window default
        // is still 4h. Use `windowHours` for accurate labeling.
        heartbeatAgents4h: scheduledHeartbeatRows.length,
        heartbeats4h: heartbeatRows.length,
        windowHours: hours,
        windowSince: since,
        activeSessions,
        openAlerts: openAlerts.length,
        staleAgents: staleAgents.length,
      },
      agents: agentRows,
      heartbeats: heartbeatRows,
      recentDecisions,
      messages,
      alerts: openAlerts,
      vitals: vitalMetrics,
    });
  }

  function handleSession(sessionId: string): Response {
    const session = _db().prepare("SELECT * FROM sessions WHERE sessionId = ?").get(sessionId);
    if (!session) return json({ error: "Session not found" }, 404);
    const children = _db()
      .prepare(
        `
      WITH RECURSIVE tree AS (
        SELECT sessionId, agent, task, status, kind, parentSessionId, outcome, startedAt, endedAt, opCount, error, 0 as depth
        FROM sessions WHERE parentSessionId = ?
        UNION ALL
        SELECT s.sessionId, s.agent, s.task, s.status, s.kind, s.parentSessionId, s.outcome, s.startedAt, s.endedAt, s.opCount, s.error, t.depth + 1
        FROM sessions s JOIN tree t ON s.parentSessionId = t.sessionId WHERE t.depth < 10
      ) SELECT * FROM tree ORDER BY startedAt ASC
    `,
      )
      .all(sessionId);
    const evaluation = _db().prepare("SELECT * FROM evaluations WHERE sessionId = ?").get(sessionId) || null;
    return json({ session, children, evaluation });
  }

  function handleTranscript(sessionId: string): Response {
    let jsonlPath = join(STATE_DIR, "sessions", sessionId, "session.jsonl");
    if (!existsSync(jsonlPath)) jsonlPath = join(STATE_DIR, "sessions", "history", sessionId, "session.jsonl");
    if (!existsSync(jsonlPath)) return json({ error: "Transcript not found" }, 404);
    const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
    const messages: unknown[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.role === "user") {
          const text = Array.isArray(entry.content)
            ? entry.content.map((b: any) => b.text || "").join("")
            : typeof entry.content === "string"
              ? entry.content
              : "";
          // Skip session context injection (buildSessionContext output)
          if (text && !text.startsWith("# Session Context")) messages.push({ role: "user", text });
        } else if (entry.role === "assistant") {
          const blocks = Array.isArray(entry.content) ? entry.content : [];
          const text = blocks
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
          const toolCalls = blocks
            .filter((b: any) => b.type === "tool_use")
            .map((b: any) => ({ id: b.id, tool: b.name, args: b.input }));
          if (text || toolCalls.length) messages.push({ role: "assistant", text, toolCalls });
        } else if (entry.role === "tool_result") {
          const content = Array.isArray(entry.content)
            ? entry.content
                .map((b: any) => b.text || "")
                .join("")
                .slice(0, 2000)
            : typeof entry.content === "string"
              ? entry.content.slice(0, 2000)
              : "";
          messages.push({ role: "tool_result", toolCallId: entry.toolCallId, content, isError: entry.isError });
        }
      } catch {}
    }
    return json({ sessionId, messageCount: messages.length, messages });
  }

  function handleDigest(url: URL): Response {
    const digestDir = join(STATE_DIR, "..", "agents", "shared", "daily-digests");
    if (!existsSync(digestDir)) return json({ digest: null, date: null, available: [] });
    const files = readdirSync(digestDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return json({ digest: null, date: null, available: [] });
    const available = files.map((f) => f.replace(".md", ""));
    const reqDate = url.searchParams.get("date");
    const target = reqDate && available.includes(reqDate) ? reqDate + ".md" : files[0];
    const content = readFileSync(join(digestDir, target), "utf-8");
    return json({ digest: content, date: target.replace(".md", ""), available });
  }

  function handleBenchmarks(url: URL): Response {
    try {
      const agentFilter = url.searchParams.get("agent") || undefined;
      const batchId = url.searchParams.get("batch") || undefined;

      // Detailed batch view
      if (batchId) {
        const runs = _db()
          .prepare(
            `SELECT r.id, r.scenario, r.passed, r.duration_ms, r.timestamp, r.categories, r.tags, r.tier, r.prompt_hash, r.model FROM gym_runs r WHERE r.batch_id = ? ORDER BY r.scenario`,
          )
          .all(batchId) as any[];
        const checks: Record<number, any[]> = {};
        for (const run of runs) {
          checks[run.id] = _db()
            .prepare("SELECT check_name, passed, detail FROM gym_checks WHERE run_id = ?")
            .all(run.id) as any[];
        }
        return json({ batch_id: batchId, runs, checks });
      }

      const where = agentFilter ? "WHERE r.agent_name = ?" : "";
      const params = agentFilter ? [agentFilter] : [];

      // Batch listing
      const batchWhere = agentFilter
        ? "WHERE r.agent_name = ? AND r.batch_id IS NOT NULL"
        : "WHERE r.batch_id IS NOT NULL";
      const batches = _db()
        .prepare(
          `SELECT r.batch_id, r.agent_name, r.run_tag, r.prompt_hash, r.model, r.framework_sha, COUNT(*) as total, SUM(r.passed) as passed, MIN(r.timestamp) as started_at FROM gym_runs r ${batchWhere} GROUP BY r.batch_id ORDER BY started_at DESC LIMIT 50`,
        )
        .all(...params) as any[];

      // Per-agent per-scenario summary
      const summary = _db()
        .prepare(
          `
        SELECT r.agent_name as agent, r.scenario, COUNT(*) as runs, SUM(r.passed) as passes,
          MAX(r.timestamp) as lastRun, AVG(r.duration_ms) as avgMs, r.categories, r.tags, r.tier
        FROM gym_runs r ${where} GROUP BY r.agent_name, r.scenario ORDER BY r.agent_name, r.scenario
      `,
        )
        .all(...params) as any[];
      const agents: Record<string, any[]> = {};
      for (const row of summary) {
        if (!agents[row.agent]) agents[row.agent] = [];
        agents[row.agent].push({
          scenario: row.scenario,
          runs: row.runs,
          passes: row.passes,
          passRate: row.runs > 0 ? row.passes / row.runs : 0,
          lastRun: row.lastRun,
          avgMs: row.avgMs ? Math.round(row.avgMs) : null,
          categories: row.categories ? JSON.parse(row.categories) : [],
          tags: row.tags ? JSON.parse(row.tags) : [],
          tier: row.tier,
        });
      }
      const checkDetails: Record<string, any[]> = {};
      if (agentFilter) {
        const latestRuns = _db()
          .prepare(
            `SELECT r.id, r.scenario FROM gym_runs r WHERE r.agent_name = ? AND r.id = (SELECT MAX(r2.id) FROM gym_runs r2 WHERE r2.agent_name = r.agent_name AND r2.scenario = r.scenario) ORDER BY r.scenario`,
          )
          .all(agentFilter) as any[];
        for (const run of latestRuns) {
          checkDetails[run.scenario] = _db()
            .prepare("SELECT check_name, passed, detail FROM gym_checks WHERE run_id = ?")
            .all(run.id) as any[];
        }
      }
      const totalRuns = _db().prepare("SELECT COUNT(*) as cnt FROM gym_runs").get() as any;
      return json({
        agents,
        scenarios: [...new Set(summary.map((r) => r.scenario))].sort(),
        runs: totalRuns?.cnt || 0,
        checkDetails,
        batches,
      });
    } catch (err) {
      return json({ error: String(err), agents: {}, scenarios: [], runs: 0, batches: [] });
    }
  }

  function handleBenchmarkPrompts(url: URL): Response {
    try {
      const hash = url.searchParams.get("hash");
      const diffWith = url.searchParams.get("diff");
      if (hash && diffWith) {
        const a = _db()
          .prepare("SELECT prompt_text, agent_name, model FROM gym_prompts WHERE prompt_hash = ?")
          .get(hash) as any;
        const b = _db()
          .prepare("SELECT prompt_text, agent_name, model FROM gym_prompts WHERE prompt_hash = ?")
          .get(diffWith) as any;
        if (!a || !b) return json({ error: "Prompt not found" }, 404);
        return json({
          a: { hash, text: a.prompt_text, agent: a.agent_name, model: a.model },
          b: { hash: diffWith, text: b.prompt_text, agent: b.agent_name, model: b.model },
        });
      }
      if (hash) {
        const row = _db().prepare("SELECT * FROM gym_prompts WHERE prompt_hash = ?").get(hash) as any;
        if (!row) return json({ error: "Prompt not found" }, 404);
        return json(row);
      }
      const rows = _db()
        .prepare(
          `SELECT p.prompt_hash, p.agent_name, p.model, p.framework_sha, p.created_at, (SELECT COUNT(*) FROM gym_runs r WHERE r.prompt_hash = p.prompt_hash) as run_count FROM gym_prompts p ORDER BY p.created_at DESC`,
        )
        .all() as any[];
      return json({ prompts: rows });
    } catch (err) {
      return json({ error: String(err) });
    }
  }

  function handleBenchmarkCompare(url: URL): Response {
    try {
      const batchA = url.searchParams.get("a");
      const batchB = url.searchParams.get("b");
      if (!batchA || !batchB) return json({ error: "Need ?a=<batch_id>&b=<batch_id>" }, 400);
      const runsA = _db()
        .prepare("SELECT scenario, passed, duration_ms, prompt_hash FROM gym_runs WHERE batch_id = ?")
        .all(batchA) as any[];
      const runsB = _db()
        .prepare("SELECT scenario, passed, duration_ms, prompt_hash FROM gym_runs WHERE batch_id = ?")
        .all(batchB) as any[];
      const mapA: Record<string, any> = {};
      for (const r of runsA) mapA[r.scenario] = r;
      const mapB: Record<string, any> = {};
      for (const r of runsB) mapB[r.scenario] = r;
      const allScenarios = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])].sort();
      const regressions: any[] = [],
        improvements: any[] = [],
        unchanged: any[] = [];
      for (const s of allScenarios) {
        const a = mapA[s],
          b = mapB[s];
        const passedA = a ? !!a.passed : null,
          passedB = b ? !!b.passed : null;
        const entry = { scenario: s, a: passedA, b: passedB };
        if (passedA === true && passedB === false) regressions.push(entry);
        else if (passedA === false && passedB === true) improvements.push(entry);
        else unchanged.push(entry);
      }
      return json({
        batchA,
        batchB,
        regressions,
        improvements,
        unchanged,
        promptHashA: runsA[0]?.prompt_hash || null,
        promptHashB: runsB[0]?.prompt_hash || null,
      });
    } catch (err) {
      return json({ error: String(err) });
    }
  }

  function handleStats(): Response {
    const now = Date.now();
    const day = now - 86400000;
    const week = now - 7 * 86400000;
    const sess24h = _db()
      .prepare(
        `SELECT agent, COUNT(*) as cnt, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors, AVG(endedAt - startedAt) as avgMs FROM sessions WHERE startedAt > ? GROUP BY agent ORDER BY cnt DESC`,
      )
      .all(day);
    const req24h: unknown[] = [];
    const totalSess7d = (_db().prepare("SELECT COUNT(*) as cnt FROM sessions WHERE startedAt > ?").get(week) as any)
      .cnt;
    const humanReq7d = 0;
    return json({
      last24h: { sessions: sess24h, requests: req24h },
      last7d: { totalSessions: totalSess7d, humanRequests: humanReq7d },
      socketAvailable: existsSync(conventionSocketPath()),
      socketPath: conventionSocketPath(),
    });
  }

  // ── Agent Activity API ──────────────────────────────────────────────

  function handleAgentActivity(): Response {
    const now = Date.now();
    const dayStart = now - 86400000;
    const rows = _db()
      .prepare(
        `SELECT agent,
                MAX(startedAt) as lastSession,
                COUNT(*) as sessionsToday,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as doneCount,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errorCount
         FROM sessions
         WHERE startedAt > ?
         GROUP BY agent
         ORDER BY lastSession DESC`,
      )
      .all(dayStart) as Array<{
      agent: string;
      lastSession: number;
      sessionsToday: number;
      doneCount: number;
      errorCount: number;
    }>;

    const agents = rows.map((r) => {
      const elapsed = now - r.lastSession;
      let status: "active" | "idle" | "inactive";
      if (elapsed < 30 * 60 * 1000) status = "active";
      else if (elapsed < 2 * 60 * 60 * 1000) status = "idle";
      else status = "inactive";

      return {
        name: r.agent,
        lastSession: r.lastSession,
        sessionsToday: r.sessionsToday,
        successRate: r.sessionsToday > 0 ? Math.round((r.doneCount / r.sessionsToday) * 100) : 0,
        status,
      };
    });

    return json({ agents });
  }

  function handleAgentTimeline(url: URL): Response {
    const hours = Math.min(parseInt(url.searchParams.get("hours") || "24", 10), 168);
    const since = Date.now() - hours * 60 * 60 * 1000;

    const rows = _db()
      .prepare(
        `SELECT sessionId, agent, startedAt, endedAt, status
         FROM sessions
         WHERE startedAt > ?
         ORDER BY agent, startedAt ASC`,
      )
      .all(since) as Array<{
      sessionId: string;
      agent: string;
      startedAt: number;
      endedAt: number | null;
      status: string;
    }>;

    const agentMap: Record<string, Array<{ id: string; start: number; end: number | null; status: string }>> = {};
    for (const r of rows) {
      if (!agentMap[r.agent]) agentMap[r.agent] = [];
      agentMap[r.agent].push({
        id: r.sessionId,
        start: r.startedAt,
        end: r.endedAt,
        status: r.status,
      });
    }

    const agents = Object.entries(agentMap).map(([name, sessions]) => ({ name, sessions }));
    return json({ agents, since, now: Date.now() });
  }

  function handleSystemHealth(): Response {
    const now = Date.now();
    const todayStart = now - 86400000;
    const yesterdayStart = todayStart - 86400000;

    const todayStats = _db()
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
                AVG(CASE WHEN endedAt IS NOT NULL THEN endedAt - startedAt END) as avgDuration
         FROM sessions WHERE startedAt > ?`,
      )
      .get(todayStart) as { total: number; done: number; errors: number; avgDuration: number | null };

    const yesterdayStats = _db()
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors
         FROM sessions WHERE startedAt > ? AND startedAt <= ?`,
      )
      .get(yesterdayStart, todayStart) as { total: number; errors: number };

    const activeAgents = _db()
      .prepare(
        `SELECT COUNT(DISTINCT agent) as cnt FROM sessions WHERE startedAt > ?`,
      )
      .get(now - 2 * 60 * 60 * 1000) as { cnt: number };

    const todayErrorRate = todayStats.total > 0 ? Math.round((todayStats.errors / todayStats.total) * 100) : 0;
    const yesterdayErrorRate = yesterdayStats.total > 0 ? Math.round((yesterdayStats.errors / yesterdayStats.total) * 100) : 0;

    return json({
      sessionsToday: todayStats.total,
      successRate: todayStats.total > 0 ? Math.round((todayStats.done / todayStats.total) * 100) : 0,
      activeAgents: activeAgents.cnt,
      avgDurationMs: todayStats.avgDuration ? Math.round(todayStats.avgDuration) : null,
      errorRateToday: todayErrorRate,
      errorRateYesterday: yesterdayErrorRate,
      errorTrend: todayErrorRate - yesterdayErrorRate,
    });
  }

  // ── Agent Detail API ─────────────────────────────────────────────

  function handleAgentDetail(agentName: string): Response {
    // 1. Recent sessions
    const recentSessions = (_db()
      .prepare(
        `SELECT sessionId, task, status, startedAt, endedAt, opCount, outcome
         FROM sessions WHERE agent = ? ORDER BY startedAt DESC LIMIT 50`,
      )
      .all(agentName) as Array<{ sessionId: string; task: string | null; status: string; startedAt: number; endedAt: number | null; opCount: number | null; outcome: string | null }>)
      .map((row) => ({
        id: row.sessionId,
        task: row.task?.slice(0, 120),
        status: row.status,
        startedAt: row.startedAt,
        duration: row.endedAt ? Math.round((row.endedAt - row.startedAt) / 1000) : null,
        opCount: row.opCount,
        outcome: row.outcome?.slice(0, 100),
      }));

    // 2. Eval trend
    const evalTrend = _db()
      .prepare(
        `SELECT quality, efficiency, verdict, createdAt
         FROM evaluations WHERE agent = ? ORDER BY createdAt DESC LIMIT 20`,
      )
      .all(agentName) as Array<{ quality: number; efficiency: number; verdict: string; createdAt: number }>;

    // 3. Delegation map
    const since = Date.now() - 7 * 86400000;

    const delegatesTo = _db()
      .prepare(
        `SELECT c.agent, COUNT(*) as count
         FROM sessions p JOIN sessions c ON c.parentSessionId = p.sessionId
         WHERE p.agent = ? AND p.startedAt > ?
         GROUP BY c.agent ORDER BY count DESC`,
      )
      .all(agentName, since) as Array<{ agent: string; count: number }>;

    const delegatedFrom = _db()
      .prepare(
        `SELECT p.agent, COUNT(*) as count
         FROM sessions c JOIN sessions p ON c.parentSessionId = p.sessionId
         WHERE c.agent = ? AND c.startedAt > ?
         GROUP BY p.agent ORDER BY count DESC`,
      )
      .all(agentName, since) as Array<{ agent: string; count: number }>;

    // 4. Workspace files
    const wsDir = join(STATE_DIR, "..", "agents", agentName, "workspace");
    let workspaceFiles: string[] = [];
    if (existsSync(wsDir)) {
      workspaceFiles = readdirSync(wsDir)
        .filter((f) => !f.startsWith("."))
        .slice(0, 50);
    }

    return json({
      recentSessions,
      evalTrend,
      delegationMap: { delegatesTo, delegatedFrom },
      workspaceFiles,
    });
  }

  // ── Knowledge API ──────────────────────────────────────────────────

  // ── Browse API: generic file/directory browser for knowledge base ──
  function handleMetrics(_url: URL): Response {
    const db = _db();
    const metrics = db.prepare(`
      SELECT m.id, m.name, m.type,
             COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
             m.owner as explicitOwner, m.project, m.current, m.target, m.threshold,
             m.unit, m.priority, m.status, m.speed, m.alert_op,
             m.source, m.updated_at
      FROM metrics m
      LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
        AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
      WHERE m.status = 'active'
      ORDER BY owner, m.priority, m.name
    `).all() as any[];

    const openAlerts = db.prepare(`
      SELECT ma.id as alertId, ma.metric_id as metricId, ma.alert_type as alertType,
             ma.message, ma.created_at as createdAt,
             m.name, m.type,
             COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
             m.owner as explicitOwner, m.project, m.current, m.target, m.threshold,
             m.unit, m.priority, m.status, m.speed, m.alert_op,
             m.source, m.updated_at
      FROM metric_alerts ma
      INNER JOIN metrics m ON m.id = ma.metric_id
      LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
        AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
      WHERE ma.resolved_at IS NULL
        AND m.status = 'active'
      ORDER BY ma.created_at DESC
    `).all() as any[];

    const openAlertByMetric = new Map(openAlerts.map((alert) => [alert.metricId, alert]));
    const metricsWithAlertState = metrics.map((metric) => {
      const alert = openAlertByMetric.get(metric.id);
      return alert
        ? { ...metric, alertOpen: true, alertId: alert.alertId, alertMessage: alert.message, alertType: alert.alertType }
        : { ...metric, alertOpen: false };
    });

    const snapshots = db.prepare(`
      SELECT ms.metric_id, ms.value, ms.sample_size, ms.measured_at, ms.note
      FROM metric_snapshots ms
      INNER JOIN (
        SELECT metric_id, MAX(measured_at) as max_at
        FROM metric_snapshots GROUP BY metric_id
      ) latest ON ms.metric_id = latest.metric_id AND ms.measured_at = latest.max_at
      ORDER BY ms.measured_at DESC
    `).all() as any[];

    const recentSnapshots = db.prepare(`
      SELECT ms.metric_id, ms.value, ms.sample_size, ms.measured_at, ms.measured_by, ms.note
      FROM metric_snapshots ms ORDER BY ms.measured_at DESC LIMIT 50
    `).all() as any[];

    return new Response(JSON.stringify({ metrics: metricsWithAlertState, latestSnapshots: snapshots, recentSnapshots, alerts: openAlerts }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  function handleBrowse(url: URL): Response {
    const relPath = url.searchParams.get("path") ?? "";
    const sharedDir = join(STATE_DIR, "..", "agents", "shared");

    // Security: only allow browsing under agents/shared/
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

  function serveIndex(): Response {
    const candidates = [
      join(dirname(new URL(import.meta.url).pathname), "..", "static", "index.html"),
      "/usr/local/share/may-agent-web/static/index.html",
      join(STATE_DIR, "..", "packages", "webui", "static", "index.html"),
    ];
    for (const p of candidates) {
      if (existsSync(p))
        return new Response(readFileSync(p, "utf-8"), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
    }
    return new Response("index.html not found", { status: 404 });
  }

  function handleProjects(): Response {
    const projects: Array<Record<string, unknown>> = [];

    // Helper to process a project directory entry
    const processProject = (projectFile: string, relPath: string, name: string, fallbackOwner: string) => {
      try {
        const content = readFileSync(projectFile, "utf-8");
        // Parse YAML frontmatter if present (current convention).
        // Legacy per-agent projects may still use old `**Owner**: x` lines.
        const isSharedProject = relPath.startsWith("agents/shared/projects/");
        let frontmatter: Record<string, string> = {};
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        if (fmMatch) {
          for (const line of fmMatch[1].split("\n")) {
            const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
            if (kv) frontmatter[kv[1].toLowerCase()] = kv[2];
          }
        }
        const formatErrors: string[] = [];
        if (isSharedProject && !fmMatch) formatErrors.push("missing YAML frontmatter");
        for (const required of ["id", "owner", "status"]) {
          if (isSharedProject && !frontmatter[required]) formatErrors.push(`missing frontmatter field: ${required}`);
        }
        if (isSharedProject && content.replace(/^---\n[\s\S]*?\n---\n/, "").match(/^\s*\*\*(Owner|Status):?\*\*:?\s*/mi)) {
          formatErrors.push("metadata duplicated as bold body field");
        }
        const field = (n: string) => {
          // YAML frontmatter wins; fall back to bold-prefixed line only for legacy projects.
          if (frontmatter[n.toLowerCase()] !== undefined) return frontmatter[n.toLowerCase()];
          if (isSharedProject) return null;
          const m = content.match(new RegExp(`^\\*\\*${n}\\*\\*:\\s*(.+)$`, "m"));
          return m ? m[1].trim() : null;
        };
        const msX = (content.match(/^- \[x\]/gim) || []).length;
        const msO = (content.match(/^- \[ \]/gm) || []).length;
        projects.push({
          name: name.replace(/\.md$/, ""),
          path: relPath,
          owner: field("Owner") || fallbackOwner,
          status: field("Status") || "unknown",
          priority: field("Priority"),
          iteration: parseInt(field("Iteration") || "0", 10),
          health: field("Health"),
          formatErrors,
          milestonesDone: msX,
          milestonesTotal: msX + msO,
          metrics: (() => {
            const mIdx = content.indexOf("## Metrics\n");
            if (mIdx === -1) return [];
            const after = content.slice(mIdx + "## Metrics\n".length);
            const ns = after.indexOf("\n## ");
            const section = (ns === -1 ? after : after.slice(0, ns)).trim();
            const ids = section.split("\n").filter((l: string) => l.startsWith("- ")).map((l: string) => {
              const m = l.match(/^- `?(\S+?)`?:/);
              const t = l.match(/target\s*([<>]=?\s*)?(\d[\d.]*%?)/);
              return m ? { id: m[1].replace(/`/g, ""), target: t ? (t[1] || "") + t[2] : null } : null;
            }).filter(Boolean) as Array<{id: string; target: string | null}>;
            if (ids.length === 0) return [];
            try {
              const db = _db();
              return ids.map(({ id, target }) => {
                const row = db.prepare("SELECT current, threshold, alert_op FROM metrics WHERE id = ?").get(id) as any;
                const current = row?.current ?? null;
                const threshold = row?.threshold;
                const above = row?.alert_op === "above" || row?.alert_op === ">";
                const breached = threshold != null && current != null && (above ? current > threshold : current < threshold);
                return { id, current, target, breached };
              });
            } catch { return ids.map(({ id, target }) => ({ id, current: null, target, breached: false })); }
          })(),
          updatedAt: statSync(projectFile).mtimeMs,
        });
      } catch { /* skip */ }
    };

    try {
      // Scan shared projects (new location)
      const sharedProjDir = join(AGENTS_ROOT, "shared", "projects");
      if (existsSync(sharedProjDir)) {
        for (const entry of readdirSync(sharedProjDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const projectFile = join(sharedProjDir, entry.name, "project.md");
          if (!existsSync(projectFile)) continue;
          const relPath = `agents/shared/projects/${entry.name}`;
          processProject(projectFile, relPath, entry.name, "unknown");
        }
      }

      // Scan legacy per-agent locations
      for (const dir of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name === "shared") continue;
        const projDir = join(AGENTS_ROOT, dir.name, "workspace", "projects");
        if (!existsSync(projDir)) continue;
        for (const entry of readdirSync(projDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const projectFile = join(projDir, entry.name, "project.md");
          if (!existsSync(projectFile)) continue;
          const relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          processProject(projectFile, relPath, entry.name, dir.name);
        }
      }
    } catch { /* skip */ }
    return json(projects);
  }

  function handleProjectJournal(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (path.endsWith(".md")) return json({ content: "(Legacy project — journal is in the project file)" });
    const journalPath = join(PROJECT_ROOT, path, "journal.md");
    try {
      return json({ content: readFileSync(journalPath, "utf-8") });
    } catch {
      return json({ content: "(No journal found)" });
    }
  }

  function handleProjectDiscussion(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (path.endsWith(".md")) return json({ content: "(Legacy project — no discussion file)" });
    const discPath = join(PROJECT_ROOT, path, "discussion.md");
    try {
      return json({ content: readFileSync(discPath, "utf-8") });
    } catch {
      return json({ content: "(No discussion yet)" });
    }
  }

  function handleProjectContent(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!path.match(/^agents\/(shared\/projects\/|[^/]+\/workspace\/projects\/)/)) return json({ error: "Access denied" }, 403);
    const filePath = path.endsWith(".md") ? join(PROJECT_ROOT, path) : join(PROJECT_ROOT, path, "project.md");
    try {
      const content = readFileSync(filePath, "utf-8");
      return json({ content });
    } catch {
      return json({ content: "(No project file found)" });
    }
  }

  /**
   * GET /api/projects/detail?path=<projectPath> — dense rollup for the
   * project detail page header. Replaces the operator's eyeballing of
   * project.md frontmatter / scrolling for goals.
   *
   * Returns:
   *   {
   *     path, name, owner,                  — identity
   *     frontmatter: {...},                  — raw parsed YAML
   *     status, iteration, priority,         — promoted from frontmatter
   *     goal: string|null,                  — first ## Goal section content
   *     milestonesDone, milestonesTotal,    — counted from '- [ ]' / '- [x]'
   *     citedMetrics: [string],             — metric-id-shaped tokens in body
   *     ownedMetrics: [Metric],             — metrics where project=<id>
   *     sessionCount, recentSessions: [..], — from sessions table
   *     updatedAt, createdAt,               — file mtime / ctime
   *   }
   */
  function handleProjectDetail(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!path.match(/^agents\/(shared\/projects\/|[^/]+\/workspace\/projects\/)/)) return json({ error: "Access denied" }, 403);
    const filePath = path.endsWith(".md") ? join(PROJECT_ROOT, path) : join(PROJECT_ROOT, path, "project.md");
    if (!existsSync(filePath)) return json({ error: "not found" }, 404);

    let content = "";
    let stat: { mtimeMs: number; ctimeMs: number } | null = null;
    try {
      content = readFileSync(filePath, "utf-8");
      stat = statSync(filePath);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }

    // Parse frontmatter ("---\n...\n---").
    const frontmatter: Record<string, string> = {};
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    let body = content;
    if (fmMatch) {
      body = content.slice(fmMatch[0].length);
      for (const ln of fmMatch[1].split("\n")) {
        const kv = ln.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.+?)\s*$/);
        if (kv) frontmatter[kv[1]] = kv[2];
      }
    }

    // Derive identity. Canonical projectId is owner/name, even for shared path.
    const identity = parseProjectIdentity(path, content);
    const owner = frontmatter.owner || identity.owner;
    const projectName = identity.name;
    const projectId = `${owner}/${projectName}`;

    // Extract Goal section (everything between '## Goal' and the next '## ').
    let goal: string | null = null;
    const goalMatch = body.match(/^##\s+Goal\s*\n([\s\S]*?)(?=\n##\s|$)/m);
    if (goalMatch) goal = goalMatch[1].trim() || null;

    // Count milestones: lines like '- [ ] foo' / '- [x] foo' anywhere in body.
    const checkboxes = body.match(/^[\s\-*]*\[[ xX]\]/gm) || [];
    const milestonesTotal = checkboxes.length;
    const milestonesDone = (body.match(/^[\s\-*]*\[[xX]\]/gm) || []).length;

    // Find metric-id-shaped backtick tokens in the body.
    const cited = new Set<string>();
    const re = /`([a-z]+(?:\.[a-z0-9-]+)+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      // Only keep tokens that look like our metric IDs (start with a known
      // axis prefix). Limits noise (e.g., file paths like 'foo.md').
      const tok = m[1];
      if (/^(metric|capability|project|handler|session|evaluator|agent|system|v2)\./.test(tok)) cited.add(tok);
    }

    // Resolve owned metrics + cited-metrics-that-exist via DB.
    const db = _db();
    let ownedMetrics: Array<Record<string, unknown>> = [];
    let citedMetricsResolved: Array<Record<string, unknown>> = [];
    try {
      ownedMetrics = db.prepare(`SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE project = ?`).all(projectName) as any[];
      if (cited.size > 0) {
        const placeholders = [...cited].map(() => "?").join(",");
        citedMetricsResolved = db.prepare(`SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE id IN (${placeholders})`).all(...[...cited]) as any[];
      }
    } catch { /* tolerate missing column */ }

    // Recent sessions for this project. Two-tier:
    //   tier 1: rows tagged with projectId (canonical)
    //   tier 2: rows whose task mentions the project name (best-effort)
    let recentSessions: Array<Record<string, unknown>> = [];
    let sessionCount = 0;
    let mentionCount = 0;
    try {
      const tagged = db.prepare(
        `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE projectId = ? ORDER BY startedAt DESC LIMIT 10`
      ).all(projectId) as any[];
      for (const r of tagged) recentSessions.push({ ...r, link: "tagged" });
      const cnt = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE projectId = ?`).get(projectId) as any;
      sessionCount = cnt?.c ?? 0;
      // Tier 2 — only if tagged is short.
      if (tagged.length < 10 && projectName.length >= 6) {
        const seen = new Set(tagged.map(t => t.sessionId));
        const mentions = db.prepare(
          `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ? ORDER BY startedAt DESC LIMIT 10`
        ).all(`%${projectName}%`) as any[];
        for (const r of mentions) {
          if (!seen.has(r.sessionId)) recentSessions.push({ ...r, link: "mention" });
        }
        const mcnt = db.prepare(
          `SELECT COUNT(*) as c FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ?`
        ).get(`%${projectName}%`) as any;
        mentionCount = mcnt?.c ?? 0;
      }
    } catch { /* skip */ }

    return json({
      path,
      name: projectName,
      owner,
      projectId,
      frontmatter,
      status: frontmatter.status || null,
      iteration: frontmatter.iteration ? Number(frontmatter.iteration) : 0,
      priority: frontmatter.priority || null,
      type: frontmatter.type || null,
      workflow: frontmatter.workflow || null,
      goal,
      milestonesTotal,
      milestonesDone,
      citedMetrics: [...cited],
      ownedMetrics,
      citedMetricsResolved,
      sessionCount,
      mentionCount,
      recentSessions,
      updatedAt: stat ? Math.floor(stat.mtimeMs) : null,
      createdAt: stat ? Math.floor(stat.ctimeMs) : null,
    });
  }

  /**
   * GET /api/projects/lineage?path=<projectPath> — every session that
   * causally touched this project, deduplicated, with provenance.
   *
   * The premise: there is no single source of truth for 'sessions in a
   * project'. Only ~27% of sessions have sessions.projectId set (the
   * canonical tag, only populated by workflow dispatch). The rest of
   * the lineage emerges from 5 independent signals combined:
   *
   *   tier 1 (tagged):    sessions.projectId = <owner>/<name>
   *   tier 2 (workflow):  sessions.workflowRunId in (runs tagged with
   *                       projectId, or legacy runs whose task mentions
   *                       the project path)
   *   tier 3 (file-read): file_reads.filePath like %/<name>/% — the
   *                       session opened a file inside the project dir.
   *                       This is *strong* signal even if the session
   *                       was a heartbeat (agent literally looked).
   *   tier 4 (mention):   sessions.task like %<name>% — weakest, only
   *                       used if name is distinctive (length ≥ 6).
   *   tier 5 (children):  sessions.parentSessionId in (any of above)
   *                       — recursive descent so worker sessions show
   *                       up under their master.
   *
   * Output: deduplicated by sessionId, sorted by startedAt, each session
   * carries its `link` provenance (highest-confidence wins on dedup).
   * Returns parentSessionId so the frontend can render a tree.
   *
   * Scale: 15k sessions · 6k file_reads · 8k workflow_runs. All queries
   * indexed-or-bounded; tier 4 LIKE %name% is the slowest (~5–10ms).
   * Total budget: <50ms for any project. Acceptable for review UX.
   */
  function handleProjectLineage(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!path.match(/^agents\/(shared\/projects\/|[^/]+\/workspace\/projects\/)/)) return json({ error: "Access denied" }, 403);

    let content = "";
    try { content = readFileSync(path.endsWith(".md") ? join(PROJECT_ROOT, path) : join(PROJECT_ROOT, path, "project.md"), "utf-8"); } catch {}
    const { name, projectId } = parseProjectIdentity(path, content);

    // link confidence ranking; lower = stronger.
    const RANK: Record<string, number> = { tagged: 0, workflow: 1, "file-read": 2, child: 3, mention: 4 };
    const byId = new Map<string, any>();
    const accept = (row: any, link: string) => {
      if (!row?.sessionId) return;
      const existing = byId.get(row.sessionId);
      if (!existing || RANK[link] < RANK[existing.link]) {
        byId.set(row.sessionId, { ...row, link });
      }
    };

    const SELECT = `SELECT sessionId, agent, status, kind, source, parentSessionId, workflowRunId, projectId, startedAt, endedAt, opCount, outcome, task FROM sessions`;
    const db = _db();

    try {
      // tier 1: tagged.
      for (const r of db.prepare(`${SELECT} WHERE projectId = ? ORDER BY startedAt DESC LIMIT 200`).all(projectId) as any[]) {
        accept(r, "tagged");
      }

      // tier 2: workflow_runs tagged with this project, plus legacy runs
      // whose task mentions the project path or name.
      // Project path appears in master-worker tasks like 'project: /app/agents/shared/projects/<name>'.
      const runRows = db.prepare(
        `SELECT runId FROM workflow_runs WHERE projectId = ? OR task LIKE ? OR task LIKE ? LIMIT 200`
      ).all(projectId, `%${path}%`, `%projects/${name}%`) as Array<{ runId: string }>;
      if (runRows.length > 0) {
        const placeholders = runRows.map(() => "?").join(",");
        const ids = runRows.map(r => r.runId);
        for (const r of db.prepare(`${SELECT} WHERE workflowRunId IN (${placeholders}) ORDER BY startedAt DESC LIMIT 200`).all(...ids) as any[]) {
          accept(r, "workflow");
        }
      }

      // tier 3: file_reads of any file inside the project dir.
      // filePath patterns vary: '/app/agents/shared/projects/<name>/...', './agents/...', 'agents/...'
      const readRows = db.prepare(
        `SELECT DISTINCT sessionId FROM file_reads WHERE filePath LIKE ? OR filePath LIKE ? OR filePath LIKE ? LIMIT 500`
      ).all(
        `%/projects/${name}/%`,
        `%projects/${name}/%`,
        `%${path}/%`,
      ) as Array<{ sessionId: string }>;
      if (readRows.length > 0) {
        const placeholders = readRows.map(() => "?").join(",");
        const ids = readRows.map(r => r.sessionId);
        for (const r of db.prepare(`${SELECT} WHERE sessionId IN (${placeholders}) ORDER BY startedAt DESC LIMIT 500`).all(...ids) as any[]) {
          accept(r, "file-read");
        }
      }

      // tier 4: task mention. Only if name is distinctive.
      if (name.length >= 6) {
        for (const r of db.prepare(`${SELECT} WHERE task LIKE ? AND (projectId IS NULL OR projectId != ?) ORDER BY startedAt DESC LIMIT 100`).all(`%${name}%`, projectId) as any[]) {
          accept(r, "mention");
        }
      }

      // tier 5: children of any session above (one-level descent; recursive
      // descent left for later if needed). parentSessionId is barely populated
      // today (5 rows) but if it grows this is the hook.
      const ids = [...byId.keys()];
      if (ids.length > 0 && ids.length <= 200) {
        const placeholders = ids.map(() => "?").join(",");
        for (const r of db.prepare(`${SELECT} WHERE parentSessionId IN (${placeholders}) ORDER BY startedAt DESC LIMIT 200`).all(...ids) as any[]) {
          accept(r, "child");
        }
      }
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }

    // Sort by startedAt asc (oldest first — timeline reads top-down).
    const sessions = [...byId.values()].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));

    // Counts by link for the header chips.
    const byLink: Record<string, number> = { tagged: 0, workflow: 0, "file-read": 0, child: 0, mention: 0 };
    for (const s of sessions) byLink[s.link] = (byLink[s.link] || 0) + 1;

    // Optionally pull session_digests for first N sessions — inline review fuel.
    // Capped to 30 to keep payload reasonable; the rest can be fetched on click.
    const digestIds = sessions.slice(0, 30).map(s => s.sessionId);
    const digestsBySession: Record<string, any[]> = {};
    if (digestIds.length > 0) {
      try {
        const placeholders = digestIds.map(() => "?").join(",");
        const rows = db.prepare(
          `SELECT sessionId, step, trigger, what_happened, outcome, still_open, action, action_reason, created_at FROM session_digests WHERE sessionId IN (${placeholders}) ORDER BY sessionId, step`
        ).all(...digestIds) as any[];
        for (const d of rows) {
          if (!digestsBySession[d.sessionId]) digestsBySession[d.sessionId] = [];
          digestsBySession[d.sessionId].push(d);
        }
      } catch { /* digest table may differ */ }
    }

    return json({
      path,
      projectId,
      total: sessions.length,
      byLink,
      sessions,
      digestsBySession,
    });
  }

  function handleProjectSessions(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    // Canonical projectId is owner/name, even for shared path.
    let content = "";
    try { content = readFileSync(path.endsWith(".md") ? join(PROJECT_ROOT, path) : join(PROJECT_ROOT, path, "project.md"), "utf-8"); } catch {}
    const { name, projectId } = parseProjectIdentity(path, content);

    // Two-tier query:
    //   tier 1 = sessions where projectId column is set (canonical — tagged at
    //            dispatch time by the workflow runtime)
    //   tier 2 = sessions where the task body mentions the project name
    //            (best-effort — catches heartbeat sessions that reference the
    //            project but weren't dispatched through it)
    // Always return both, with `link` field marking provenance so the UI
    // can distinguish 'work done on this project' vs 'mentioned this project'.
    const sessions: any[] = [];
    try {
      const db = _db();
      const tagged = db.prepare(
        "SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE projectId = ? ORDER BY startedAt DESC LIMIT 50"
      ).all(projectId) as any[];
      for (const r of tagged) sessions.push({ ...r, link: "tagged" });
      // Tier 2: only if tagged is short, look for task mentions. Cap the
      // scan so big DBs don't get slow; project names are typically distinctive
      // (e.g. 'evaluator-low-quality-rate-calibration') so LIKE %name% is safe.
      if (tagged.length < 20 && name.length >= 6) {
        const seen = new Set(tagged.map(t => t.sessionId));
        const mentions = db.prepare(
          "SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ? ORDER BY startedAt DESC LIMIT 30"
        ).all(`%${name}%`) as any[];
        for (const r of mentions) {
          if (!seen.has(r.sessionId)) sessions.push({ ...r, link: "mention" });
        }
      }
    } catch { /* projectId column may not exist */ }

    if (sessions.length > 0) return json(sessions);

    // Final fallback: scan workflow run files (legacy path).
    const searchPaths = [path, path.replace(/^agents\//, "")];
    for (const dir of [join(STATE_DIR, "workflow-runs"), join(STATE_DIR, "workflows")]) {
      try {
        for (const f of readdirSync(dir)) {
          try {
            const run = JSON.parse(readFileSync(join(dir, f), "utf-8"));
            if (searchPaths.some(sp => run.task?.includes(sp))) {
              for (const step of run.steps ?? []) {
                if (step.sessionId) sessions.push({ sessionId: step.sessionId, agent: step.agent, status: step.status, startedAt: step.startedAt, task: step.task?.slice(0, 80), link: "workflow-file" });
              }
            }
          } catch { /* skip corrupted files */ }
        }
      } catch { /* dir may not exist */ }
    }
    return json(sessions);
  }

  async function handleProjectComment(req: Request): Promise<Response> {
    try {
      const body = await req.json() as { path?: string; comment?: string };
      const { path, comment } = body;
      if (!path || !comment) return json({ error: "path and comment required" }, 400);
      if (!path.match(/^agents\/(shared\/projects\/|[^/]+\/workspace\/projects\/)/)) return json({ error: "Access denied" }, 403);

      const projectFile = join(PROJECT_ROOT, path, "project.md");
      if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);

      const trigger = await sendDaemonFrame({
        type: "project.comment.created",
        source: "web-ui",
        projectPath: path,
        comment,
        author: "hao",
      });

      return json({ ok: true, triggered: trigger.ok, triggerError: trigger.error });
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  function handleEvents(url: URL): Response {
    const db = _db();
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const owner = url.searchParams.get("owner");
    const eventType = url.searchParams.get("type");
    let query = "SELECT * FROM events";
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (owner) { conditions.push("owner = ?"); params.push(owner); }
    if (eventType) { conditions.push("event_type = ?"); params.push(eventType); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);
    try {
      const rows = db.prepare(query).all(...params);
      return json(rows);
    } catch {
      return json([]); // table may not exist yet
    }
  }

  function handleLoopTrace(url: URL): Response {
    const eventId = url.searchParams.get("eventId");
    const alertId = url.searchParams.get("alertId");
    const metricId = url.searchParams.get("metricId");
    const workflowRunId = url.searchParams.get("workflowRunId");
    const sessionId = url.searchParams.get("sessionId");

    let target: LoopTraceTarget | null = null;
    if (eventId) {
      const id = Number(eventId);
      if (!Number.isFinite(id)) return json({ error: "eventId must be numeric" }, 400);
      target = { eventId: id };
    } else if (alertId) {
      const id = Number(alertId);
      if (!Number.isFinite(id)) return json({ error: "alertId must be numeric" }, 400);
      target = { alertId: id };
    } else if (metricId) {
      target = { metricId };
    } else if (workflowRunId) {
      target = { workflowRunId };
    } else if (sessionId) {
      target = { sessionId };
    }

    if (!target) {
      return json({ error: "one of eventId, alertId, metricId, workflowRunId, or sessionId is required" }, 400);
    }

    return json(buildLoopTrace(_db(), target));
  }

  function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // ── Steering verbs (POST → daemon event socket) ───────────────────
  //
  // The web process does not own the bus or manager. It sends event frames to
  // the daemon and waits only for the daemon's transport ack.
  //
  // Per webui.md "Plane C — Steering verbs": one event per verb, async.

  async function sendDaemonFrame(frame: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const socketPath = conventionSocketPath();
    try {
      await sendDaemonEvent(socketPath, frame, { timeoutMs: 2000 });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `daemon socket delivery failed at ${socketPath}: ${message}` };
    }
  }

  async function handleSessionCancel(sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const result = await sendDaemonFrame({ type: "session.cancel.requested", sessionId, source: "web-ui" });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId });
  }

  async function handleSessionMessage(req: Request, sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    let body: { content?: string };
    try { body = await req.json() as { content?: string }; } catch { return json({ error: "invalid json" }, 400); }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    // Use 'steer' — may.ts handles both branches:
    //   idle session    → manager.input()  (resumes from prior context with this as next user turn)
    //   running session → manager.steer()  (delivers mid-flight, agent sees it next tool turn)
    // The previous 'message' command required from/to/task and silently
    // dropped sessionId/content; this endpoint returned 200 but the agent
    // never saw the message.
    const result = await sendDaemonFrame({ type: "steer", sessionId, message: content });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId, deliveredAt: Date.now() });
  }

  /**
   * Resolve the "default chat session" for an agent. Telegram-style: each
   * agent has one persistent thread; this endpoint returns its sessionId.
   *
   * Strategy: pick the most-recently-active session for this agent
   * regardless of status (running/idle/done/error/interrupted). The 3b
   * cold-resume path means even a 'done' session can be woken up by
   * messaging it. Heartbeat / worker / fork-spawn sessions are NOT chat
   * threads (they're throwaway task runs) so we exclude them.
   *
   * Returns {sessionId: null} if no chat thread exists yet — UI can then
   * POST /api/agents/:name/message to spawn one.
   */
  /**
   * GET /api/agents — list all configured agents with rollups for the
   * Agents tab card grid. One row per agent.
   *
   * Aggregates from multiple sources:
   *   - agent.json:        description, model, tool count
   *   - sessions table:    heartbeats4h, last heartbeat, recent session count
   *   - metrics table:     owned-metric count, alerting count
   *   - filesystem scan:   project count for this owner (active+all)
   *
   * Cheap to compute (one query each); not cached. If this becomes a hot
   * path, memoize per ~5s.
   */
  function handleAgents(): Response {
    try {
      const db = _db();
      const fourHourAgo = Date.now() - 4 * 60 * 60 * 1000;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // 1. Discover agents from agents/ filesystem (source of truth: agent.json).
      const agents: Array<Record<string, unknown>> = [];
      for (const dir of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name === "shared") continue;
        const agentJsonPath = join(AGENTS_ROOT, dir.name, "agent.json");
        if (!existsSync(agentJsonPath)) continue;
        let cfg: Record<string, any> = {};
        try { cfg = JSON.parse(readFileSync(agentJsonPath, "utf-8")); } catch { /* skip */ }
        const name = cfg.name || dir.name;
        agents.push({
          name,
          description: cfg.description || "",
          domain: cfg.domain || "",
          model: cfg.model || "",
          toolCount: Array.isArray(cfg.tools) ? cfg.tools.length : 0,
        });
      }

      // 2. Per-agent session/metric rollups (single query each, indexed on agent).
      for (const a of agents) {
        const name = a.name as string;

        // Sessions in 4h, partitioned into heartbeat vs other.
        const sess4h = db.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN COALESCE(kind,'') = 'heartbeat' OR task LIKE '[heartbeat]%' OR task LIKE 'You are %waking up for your heartbeat.%' THEN 1 ELSE 0 END) as heartbeats,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND startedAt >= ?
        `).get(name, fourHourAgo) as any;
        a.sessions4h = sess4h?.total ?? 0;
        a.heartbeats4h = sess4h?.heartbeats ?? 0;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = sess4h?.errors ?? 0;

        // Sessions in 24h (for context).
        const sess24h = (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)?.c ?? 0;
        a.sessions24h = sess24h;

        // Owned metrics + breaches.
        const mets = db.prepare(`
          SELECT id, current, threshold, alert_op FROM metrics WHERE owner = ?
        `).all(name) as Array<{id: string; current: number | null; threshold: number | null; alert_op: string | null}>;
        a.metricCount = mets.length;
        a.metricBreached = mets.filter(m => {
          if (m.threshold == null || m.current == null) return false;
          const above = m.alert_op === "above" || m.alert_op === ">";
          return above ? m.current > m.threshold : m.current < m.threshold;
        }).length;
      }

      // 3. Project counts per owner (filesystem scan).
      const projByOwner: Record<string, { active: number; total: number }> = {};
      try {
        const HIDDEN = new Set(["done", "complete", "closed", "waiting", "blocked", "paused"]);
        const scanDir = (root: string, fallbackOwner: string | null) => {
          if (!existsSync(root)) return;
          for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const projectFile = join(root, entry.name, "project.md");
            if (!existsSync(projectFile)) continue;
            let owner = fallbackOwner ?? "unknown";
            let status = "unknown";
            try {
              const content = readFileSync(projectFile, "utf-8");
              const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
              if (fmMatch) {
                const oM = fmMatch[1].match(/^owner:\s*(.+?)\s*$/m);
                const sM = fmMatch[1].match(/^status:\s*(.+?)\s*$/m);
                if (oM) owner = oM[1];
                if (sM) status = sM[1];
              }
            } catch { /* skip */ }
            const key = owner;
            if (!projByOwner[key]) projByOwner[key] = { active: 0, total: 0 };
            projByOwner[key].total += 1;
            if (!HIDDEN.has(status)) projByOwner[key].active += 1;
          }
        };
        scanDir(join(AGENTS_ROOT, "shared", "projects"), null);
        for (const dir of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
          if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name === "shared") continue;
          scanDir(join(AGENTS_ROOT, dir.name, "workspace", "projects"), dir.name);
        }
      } catch { /* leave empty */ }
      for (const a of agents) {
        const counts = projByOwner[a.name as string] || { active: 0, total: 0 };
        a.projectsActive = counts.active;
        a.projectsTotal = counts.total;
      }

      // Sort: active first (recent session), then alphabetic.
      agents.sort((a: any, b: any) => {
        const aTime = a.lastSessionAt || 0;
        const bTime = b.lastSessionAt || 0;
        return bTime - aTime || String(a.name).localeCompare(String(b.name));
      });
      return json(agents);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  /**
   * GET /api/agents/:name/about — returns what's actually in the agent's
   * head: the system-prompt-loaded files (the operator's mental model is
   * 'what does this agent know?'), separated from supplementary files
   * that exist on disk but aren't auto-injected.
   *
   * Source of truth (manager.ts:resolveSystemPrompt):
   *   1. agents/shared/common-sense.md  (shared defaults, every agent)
   *   2. agents/<name>/AGENTS.md         (agent identity; role-specific behavior takes precedence)
   *   3. <runtime metadata block>        (synthesized at session start)
   *   PLUS def.systemPrompt if explicitly set in agent.json (overrides 1+2).
   *
   * Returns:
   *   { name, agentJson,
   *     promptFiles: [{name, path, content, bytes, source}],
   *     otherFiles:  [{name, path, content, bytes}] }
   *
   * If agent.json has an explicit systemPrompt, it's returned in promptFiles
   * as { name: '<inline systemPrompt>', source: 'agent.json' } and the
   * standard files are demoted to otherFiles.
   */
  function handleAgentAbout(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    const agentDir = join(AGENTS_ROOT, agentName);
    if (!existsSync(agentDir)) return json({ error: "agent not found" }, 404);
    let agentJson: Record<string, any> | null = null;
    try {
      const cfgPath = join(agentDir, "agent.json");
      if (existsSync(cfgPath)) agentJson = JSON.parse(readFileSync(cfgPath, "utf-8"));
    } catch { /* skip */ }

    const readFile = (path: string, displayName: string, source: string) => {
      if (!existsSync(path)) return null;
      try {
        const content = readFileSync(path, "utf-8");
        return { name: displayName, path: path.replace(STATE_DIR + "/..", "").replace(/^\//, ""), content, bytes: content.length, source };
      } catch { return null; }
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
      const sharedPath = join(AGENTS_ROOT, "shared", "common-sense.md");
      const sharedFile = readFile(sharedPath, "shared/common-sense.md", "manager.ts");
      if (sharedFile) promptFiles.push({ ...sharedFile, source: "shared (every agent)" });
      const agentsMd = readFile(join(agentDir, "AGENTS.md"), "AGENTS.md", "identity");
      if (agentsMd) promptFiles.push({ ...agentsMd, source: "agent identity (this agent)" });
    }

    // Other on-disk files (NOT in prompt). Useful for context but not auto-loaded.
    // Includes commonly-named convention files; agent decides when to read them.
    const otherCandidates = ["DOMAIN.md", "heartbeat.md", "context.md", "TOOLS.md", "LESSONS.md"];
    for (const f of otherCandidates) {
      const file = readFile(join(agentDir, f), f, "on-disk only");
      if (file) otherFiles.push(file);
    }

    return json({ name: agentName, agentJson, promptFiles, otherFiles });
  }

  function handleAgentDefaultSession(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    try {
      const db = _db();
      // Resolve the agent's chat session — only human-initiated conversations,
      // not workflows, heartbeats, or fork-spawned task sessions.
      const row = db.prepare(`
        SELECT sessionId, status, startedAt, kind, substr(task, 1, 200) as task
        FROM sessions
        WHERE agent = ?
          AND (kind = 'chat' OR source IN ('telegram', 'web-ui', 'web', 'cli'))
        ORDER BY startedAt DESC
        LIMIT 1
      `).get(agentName) as { sessionId: string; status: string; startedAt: number; kind: string | null; task: string } | undefined;
      if (!row) return json({ agent: agentName, sessionId: null });
      return json({
        agent: agentName,
        sessionId: row.sessionId,
        status: row.status,
        startedAt: row.startedAt,
        kind: row.kind,
        task: row.task,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  /**
   * Send a message to an agent. Telegram-style:
   *   1. resolve default session (most-recent non-throwaway)
   *   2. if a session exists, forward to /api/sessions/:id/message which
   *      uses the 'steer' command (handles running/idle/cold uniformly).
   *   3. if no session exists yet, spawn a fresh one with the message as
   *      the task. Returns the new sessionId.
   *
   * Either way the response shape is {ok:true, sessionId, deliveredAt}.
   */
  async function handleAgentMessage(req: Request, agentName: string, url?: URL): Promise<Response> {
    if (!agentName) return json({ error: "agent required" }, 400);
    let body: { content?: string };
    try { body = await req.json() as { content?: string }; } catch { return json({ error: "invalid json" }, 400); }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    const forceNew = url?.searchParams.get("new") === "true";

    // Resolve default session (skip if forcing new chat).
    if (!forceNew) {
      const resolveResp = handleAgentDefaultSession(agentName);
      const resolved = await resolveResp.json() as { agent: string; sessionId: string | null };
      if (resolved.sessionId) {
        const result = await sendDaemonFrame({ type: "steer", sessionId: resolved.sessionId, message: content });
        if (!result.ok) return json({ error: result.error }, 503);
        return json({ ok: true, agent: agentName, sessionId: resolved.sessionId, deliveredAt: Date.now(), spawned: false });
      }
    }

    // No prior session — spawn one. Use 'fork' command which routes through
    // manager.run() and is the canonical way to start a fresh agent session
    // from outside the runtime.
    const result = await sendDaemonFrame({ type: "fork", agent: agentName, task: content, opts: { kind: "chat", source: "web-ui" } });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, agent: agentName, sessionId: null, deliveredAt: Date.now(), spawned: true });
  }

  async function handleAgentHeartbeatNow(req: Request, agentName: string): Promise<Response> {    if (!agentName) return json({ error: "agent required" }, 400);
    // Resolve actor from request body if provided, default to "human" (UI).
    let actor = "human";
    try {
      const body = await req.json() as { actor?: string };
      if (body.actor) actor = String(body.actor);
    } catch { /* body optional */ }
    const result = await sendDaemonFrame({
      type: "heartbeat.trigger",
      agent: agentName,
      source: actor,
    });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, agent: agentName, triggeredAt: Date.now() });
  }

  async function handleMetricThreshold(req: Request, metricId: string): Promise<Response> {
    if (!metricId) return json({ error: "metricId required" }, 400);
    let body: { threshold?: number };
    try { body = await req.json() as { threshold?: number }; } catch { return json({ error: "invalid json" }, 400); }
    if (typeof body.threshold !== "number" || !Number.isFinite(body.threshold)) {
      return json({ error: "threshold (finite number) required" }, 400);
    }
    const db = _db();
    const existing = db.prepare("SELECT id, threshold FROM metrics WHERE id = ?").get(metricId) as { id: string; threshold: number | null } | undefined;
    if (!existing) return json({ error: "metric not found" }, 404);
    db.prepare("UPDATE metrics SET threshold = ?, updated_at = ? WHERE id = ?").run(body.threshold, Date.now(), metricId);
    // Best-effort emit so subscribers see the change.
    void sendDaemonFrame({
      type: "metric.threshold_changed",
      metric: metricId,
      from: existing.threshold,
      to: body.threshold,
      source: "web-ui",
    });
    return json({ ok: true, metric: metricId, from: existing.threshold, to: body.threshold });
  }

  async function handleAlertResolve(req: Request, alertId: string): Promise<Response> {
    const id = parseInt(alertId, 10);
    if (!Number.isFinite(id)) return json({ error: "numeric alertId required" }, 400);
    let body: { reason?: string } = {};
    try { body = await req.json() as { reason?: string }; } catch { /* body optional */ }
    const db = _db();
    const existing = db.prepare("SELECT id, metric_id, resolved_at FROM metric_alerts WHERE id = ?").get(id) as { id: number; metric_id: string; resolved_at: number | null } | undefined;
    if (!existing) return json({ error: "alert not found" }, 404);
    if (existing.resolved_at !== null) return json({ ok: true, alreadyResolved: true });
    db.prepare("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?").run(Date.now(), id);
    void sendDaemonFrame({
      type: "metric.alert_resolved",
      metric: existing.metric_id,
      alertId: id,
      source: "web-ui",
      reason: body.reason ?? null,
    });
    return json({ ok: true, alertId: id });
  }

  // ── WebSocket proxy ─────────────────────────────────────────────────

  const wsToUnix = new Map<any, Duplex>();

  function proxyWebSocket(ws: any): void {
    const socketPath = conventionSocketPath();
    if (!existsSync(socketPath)) {
      ws.send(JSON.stringify({ type: "error", message: `Daemon socket not found at ${socketPath}` }));
      ws.close();
      return;
    }
    const unix = connectSocketEndpoint(socketPath);
    wsToUnix.set(ws, unix);
    let buffer = "";
    unix.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          // Skip subscribe ack responses
          if (event.type === "ok" && event.command === "subscribe") continue;
          ws.send(line);
        } catch {
          try {
            ws.send(line);
          } catch {}
        }
      }
    });
    unix.on("error", (err: Error) => {
      try {
        ws.send(JSON.stringify({ type: "error", message: `Socket error: ${err.message}` }));
      } catch {}
      try {
        ws.close();
      } catch {}
    });
    unix.on("close", () => {
      try {
        ws.send(JSON.stringify({ type: "info", message: "Agent disconnected" }));
      } catch {}
      try {
        ws.close();
      } catch {}
    });
  }

  // ── Server ──────────────────────────────────────────────────────────

  const server = Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (server.upgrade(req)) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      if (url.pathname === "/api/liveness") return handleLiveness(url);
      if (url.pathname === "/api/stats") return handleStats();
      if (url.pathname === "/api/agents") return handleAgents();
      if (url.pathname === "/api/agents/activity") return handleAgentActivity();      if (url.pathname === "/api/agents/timeline") return handleAgentTimeline(url);
      if (url.pathname === "/api/agents/health") return handleSystemHealth();
      const defaultSessionMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/default-session$/);
      if (defaultSessionMatch) return handleAgentDefaultSession(defaultSessionMatch[1]);
      const aboutMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/about$/);
      if (aboutMatch) return handleAgentAbout(aboutMatch[1]);
      if (url.pathname === "/api/digest") return handleDigest(url);
      if (url.pathname === "/api/benchmarks") return handleBenchmarks(url);
      if (url.pathname === "/api/benchmarks/prompts") return handleBenchmarkPrompts(url);
      if (url.pathname === "/api/benchmarks/compare") return handleBenchmarkCompare(url);
      if (url.pathname === "/api/browse") return handleBrowse(url);
      if (url.pathname === "/api/metrics") return handleMetrics(url);
      if (url.pathname === "/api/projects") return handleProjects();
      if (url.pathname === "/api/projects/content") return handleProjectContent(url);
      if (url.pathname === "/api/projects/detail") return handleProjectDetail(url);
      if (url.pathname === "/api/projects/lineage") return handleProjectLineage(url);
      if (url.pathname === "/api/projects/journal") return handleProjectJournal(url);
      if (url.pathname === "/api/projects/discussion") return handleProjectDiscussion(url);
      if (url.pathname === "/api/projects/sessions") return handleProjectSessions(url);
      if (url.pathname === "/api/projects/comment" && req.method === "POST") return handleProjectComment(req);
      if (url.pathname === "/api/events") return handleEvents(url);
      if (url.pathname === "/api/loop-trace") return handleLoopTrace(url);
      const metricHistoryMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/history$/);
      if (metricHistoryMatch) {
        const metricId = decodeURIComponent(metricHistoryMatch[1]);
        const days = parseInt(url.searchParams.get("days") || "7", 10);
        const since = Date.now() - days * 86400000;
        const rows = _db().prepare(
          `SELECT value, sample_size, measured_at, measured_by, note FROM metric_snapshots WHERE metric_id = ? AND measured_at > ? ORDER BY measured_at ASC`
        ).all(metricId, since);
        return json({ metricId, days, snapshots: rows });
      }
      const agentDetailMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/detail$/);
      if (agentDetailMatch) return handleAgentDetail(agentDetailMatch[1]);
      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch) return handleSession(sessionMatch[1]);
      const transcriptMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/transcript$/);
      if (transcriptMatch) return handleTranscript(transcriptMatch[1]);

      // ── Steering verbs (POST) ───────────────────────────────────────
      if (req.method === "POST") {
        const sessionCancelMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/cancel$/);
        if (sessionCancelMatch) return handleSessionCancel(sessionCancelMatch[1]);
        const sessionMessageMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/message$/);
        if (sessionMessageMatch) return handleSessionMessage(req, sessionMessageMatch[1]);
        const heartbeatNowMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/heartbeat-now$/);
        if (heartbeatNowMatch) return handleAgentHeartbeatNow(req, heartbeatNowMatch[1]);
        const agentMessageMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
        if (agentMessageMatch) return handleAgentMessage(req, agentMessageMatch[1], url);
        const thresholdMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/threshold$/);
        if (thresholdMatch) return handleMetricThreshold(req, decodeURIComponent(thresholdMatch[1]));
        const alertResolveMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)\/resolve$/);
        if (alertResolveMatch) return handleAlertResolve(req, alertResolveMatch[1]);
      }

      if (url.pathname === "/" || url.pathname === "/index.html") return serveIndex();
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws: any) {
        proxyWebSocket(ws);
      },
      message(ws: any, msg: any) {
        const unix = wsToUnix.get(ws);
        if (unix && typeof msg === "string" && msg.trim()) unix.write(msg.trim() + "\n");
      },
      close(ws: any) {
        const unix = wsToUnix.get(ws);
        if (unix) {
          unix.destroy();
          wsToUnix.delete(ws);
        }
      },
    },
  });

  return { port: server.port };
}

// ── Standalone mode ───────────────────────────────────────────────────

if (process.argv.includes("--state-dir")) {
  // When run as compiled binary, argv is [binary, --state-dir, path, ...]
  // When run via bun, argv is [bun, web.ts, --state-dir, path, ...]
  // getArg works for both since it searches the full argv.
  const getArg = (name: string, fallback: string) => {
    const idx = process.argv.indexOf(name);
    return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
  };
  const stateDir = resolve(getArg("--state-dir", ".state"));
  const port = parseInt(getArg("--port", "8080"), 10);
  if (!existsSync(stateDir)) {
    console.error(`State directory not found: ${stateDir}`);
    process.exit(1);
  }
  console.log(`may-agent web UI\n  state: ${stateDir}\n  port:  ${port}`);
  const { port: actualPort } = startWebUI({ stateDir, port });
  console.log(`  url:   http://localhost:${actualPort}`);
}
