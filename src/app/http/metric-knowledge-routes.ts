/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { METRIC_LIST_LIMIT, readMetricObservations } from "../adapters/reporting/metric-observations.js";
import { listConfiguredAgentNames } from "../loader/agent-discovery.js";
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
    const agents = listConfiguredAgents();

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
        `SELECT sessionId, agent, status, kind, source, projectId, parentSessionId,
              startedAt, endedAt
       FROM sessions
       WHERE startedAt > ? AND agent IS NOT NULL AND agent != ''
       ORDER BY startedAt DESC
       LIMIT ?`,
      )
      .all(since, DASHBOARD_SESSION_ROW_LIMIT + 1) as any[];
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
    for (const row of allRows) {
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

    const activeSessions =
      (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle')").get() as any)?.c ?? 0;
    const openAlertCandidates = enrichOpenAlerts(
      db,
      db
        .prepare(
          `SELECT ma.id as alertId, ma.metric_id as metricId, ma.message, ma.created_at as createdAt,
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
    );

    const openAlerts = openAlertCandidates.slice(0, DASHBOARD_ALERT_ROW_LIMIT);
    const openAlertsTruncated = openAlertCandidates.length > DASHBOARD_ALERT_ROW_LIMIT;

    return json({
      summary: {
        agentsConfigured: agents.length,
        agentsTotal: agents.length,
        activeAgentsInWindow: agentRows.filter((agent) => agent.sessionCount > 0).length,
        windowHours: hours,
        windowSince: since,
        activityRows: allRows.length,
        activityRowsTruncated: activityTruncated,
        rowLimit: DASHBOARD_SESSION_ROW_LIMIT,
        activeSessions,
        openAlerts: openAlerts.length,
        openAlertsTruncated,
      },
      agents: agentRows,
      alerts: openAlerts,
    });
  }

  function handleMetrics(url: URL): Response {
    const db = _db();
    const metricId = url.searchParams.get("id");
    const observations = readMetricObservations(db, Date.now(), metricId === null ? undefined : [metricId]);
    const metrics = observations.metrics;

    const openAlerts = enrichOpenAlerts(
      db,
      db
        .prepare(
          `
      SELECT ma.id as alertId, ma.metric_id as metricId, ma.alert_type as alertType,
             ma.message, ma.created_at as createdAt,
             m.name, m.type,
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

  async function handleMetricThreshold(req: Request, metricId: string): Promise<Response> {
    if (!metricId) return json({ error: "metricId required" }, 400);
    let body: { threshold?: number };
    try {
      body = (await req.json()) as { threshold?: number };
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    if (typeof body.threshold !== "number" || !Number.isFinite(body.threshold)) {
      return json({ error: "threshold (finite number) required" }, 400);
    }
    const existing = _db().prepare("SELECT id, owner, threshold FROM metrics WHERE id = ?").get(metricId) as
      { id: string; owner?: string | null; threshold: number | null } | undefined;
    if (!existing) return json({ error: "metric not found" }, 404);
    const result = await sendDaemonFrame(
      buildPublishFrame("metric.threshold_changed", {
        metricId,
        from: existing.threshold,
        to: body.threshold,
        metricOwner: existing.owner ?? "system:host",
      }),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, accepted: true, metric: metricId, from: existing.threshold, to: body.threshold });
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
    handleMetricThreshold,
    handleAlertResolve,
  };
}
