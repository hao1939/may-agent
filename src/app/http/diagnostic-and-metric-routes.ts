/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync } from "node:fs";
import { buildCanonicalEventEnvelope } from "../../../packages/control/src/event-envelope.js";
import { METRIC_LIST_LIMIT, readMetricObservations } from "../adapters/reporting/metric-observations.js";
import { eventDeliveryContract, getEventView, PUBLIC_EVENT_TYPES } from "../core/events/interface.js";
import { getAppInboxItem, listAppInboxHealth, listAppInboxItems, type AppInboxQuery } from "../core/state/app-inbox-store.js";
import { listConfiguredAgentNames } from "../loader/agent-discovery.js";
import { createQueryService } from "../../lib/query-service.js";
import { readWorkflowFacts } from "../../lib/workflow-facts.js";
import { addSessionTranscriptToEventGraph, buildEventGraph } from "./read-model/event-graph.js";
import { buildLoopTrace, type LoopTraceTarget } from "./read-model/loop-trace.js";
import { readProjectIngressIdentity } from "./project-metadata.js";
import type { SqliteDb } from "./read-model/state-db.js";
import {
  DASHBOARD_SESSION_ROW_LIMIT,
  HEARTBEAT_SESSION_PREDICATE,
  type DaemonFrameSender,
} from "./session-and-agent-routes.js";

const LIVE_VITAL_METRIC_IDS = [
  "runtime.daemon-heartbeat-stale",
  "agent.heartbeat-dark-count-2h",
  "agent.config-invalid-count-1h",
  "handler.success-rate",
  "session.error-rate-6h",
  "session.first-turn-error-count-1h",
  "session.empty-assistant-stop-count-1h",
  "session.planner-timeout-rate-6h",
  "message.delivery-failed-count-1h",
  "escalation.pending-count",
  "capability.zombie-session-count",
  "runtime.stale-running-session-count",
  "eval.llm-coverage-lag-h",
];
const DASHBOARD_ALERT_ROW_LIMIT = 20;

export function appInboxQueryFromUrl(url: URL): AppInboxQuery {
  const status = url.searchParams.get("status");
  if (status !== null && status !== "pending" && status !== "handling" && status !== "done") {
    throw new Error(`Invalid App inbox status: ${status}`);
  }
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100) || 100));
  return {
    appId: url.searchParams.get("appId") || undefined,
    status: status === null ? undefined : status,
    idempotencyKey: url.searchParams.get("idempotencyKey") || undefined,
    limit,
  };
}

export function buildPublishFrame(
  type: string,
  data: Record<string, unknown>,
  options: {
    target?: { appId?: string; taskId?: string; sessionId?: string };
    idempotencyKey?: string;
  } = {},
): Record<string, unknown> {
  return {
    type: "publish",
    event: {
      type,
      ...(options.target ? { target: options.target } : {}),
      data,
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    },
  };
}

export function buildEventIngressFrame(body: Record<string, unknown>): Record<string, unknown> {
  const envelope = buildCanonicalEventEnvelope(String(body.type ?? "").trim(), {
    ...body,
    source: "web-ui",
    owner: "system:host",
  });
  const data = envelope.data as Record<string, unknown>;
  const rawTarget =
    body.target && typeof body.target === "object" && !Array.isArray(body.target)
      ? (body.target as Record<string, unknown>)
      : {};
  const appId =
    (typeof rawTarget.appId === "string" && rawTarget.appId.trim()) ||
    (typeof rawTarget.project === "string" && rawTarget.project.trim()) ||
    undefined;
  const taskId =
    (typeof rawTarget.taskId === "string" && rawTarget.taskId.trim()) ||
    (typeof data.taskId === "string" && data.taskId.trim()) ||
    undefined;
  const sessionId =
    (typeof rawTarget.sessionId === "string" && rawTarget.sessionId.trim()) ||
    (typeof data.sessionId === "string" && data.sessionId.trim()) ||
    undefined;
  const target = {
    ...(appId ? { appId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
  const idempotencyKey =
    (typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()) ||
    (typeof data.idempotencyKey === "string" && data.idempotencyKey.trim()) ||
    undefined;
  delete data.idempotencyKey;
  return buildPublishFrame(String(envelope.type), data, {
    ...(Object.values(target).some(Boolean) ? { target } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
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

export function createDiagnosticAndMetricHandlers(options: {
  stateDir: string;
  agentsRoot: string;
  projectsRoot: string;
  getDb: () => SqliteDb;
  conventionSocketPath: () => string;
  isAllowedProjectPath: (path: string) => boolean;
  resolveProjectFile: (path: string) => string;
  readSessionTranscript: (sessionId: string) => Record<string, unknown> | null;
  sendDaemonFrame: DaemonFrameSender;
  json: (data: unknown, status?: number) => Response;
}) {
  const {
    stateDir,
    agentsRoot,
    projectsRoot,
    getDb,
    conventionSocketPath,
    isAllowedProjectPath,
    resolveProjectFile,
    readSessionTranscript,
    sendDaemonFrame,
    json,
  } = options;

  function handleLiveness(url?: URL): Response {
    const db = getDb();
    const now = Date.now();
    const rawHours = Number(url?.searchParams.get("hours"));
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(72, Math.max(1, rawHours)) : 4;
    const since = now - hours * 60 * 60 * 1000;
    const oneHour = now - 60 * 60 * 1000;
    const agents = listConfiguredAgentNames(agentsRoot, projectsRoot);
    const heartbeatCandidates = db
      .prepare(
        `SELECT sessionId, agent, status, kind, source, startedAt, endedAt
       FROM sessions
       WHERE startedAt > ?
         AND ${HEARTBEAT_SESSION_PREDICATE}
       ORDER BY startedAt DESC
       LIMIT ?`,
      )
      .all(since, DASHBOARD_SESSION_ROW_LIMIT + 1) as any[];
    const heartbeatRows = heartbeatCandidates.slice(0, DASHBOARD_SESSION_ROW_LIMIT).reverse();
    const heartbeatsTruncated = heartbeatCandidates.length > DASHBOARD_SESSION_ROW_LIMIT;
    const latestHeartbeatRows = db
      .prepare(
        `SELECT agent, status, startedAt AS lastHeartbeat, heartbeatCount
         FROM (
           SELECT agent, status, startedAt,
                  COUNT(*) OVER (PARTITION BY agent) AS heartbeatCount,
                  ROW_NUMBER() OVER (PARTITION BY agent ORDER BY startedAt DESC) AS recency
           FROM sessions
           WHERE startedAt > ? AND agent IS NOT NULL AND agent != ''
             AND ${HEARTBEAT_SESSION_PREDICATE}
         )
         WHERE recency = 1`,
      )
      .all(since) as Array<{
      agent: string;
      status: string;
      lastHeartbeat: number;
      heartbeatCount: number;
    }>;
    const heartbeatSummaryByAgent = new Map(latestHeartbeatRows.map((row) => [row.agent, row]));
    const heartbeatTotal = latestHeartbeatRows.reduce((total, row) => total + Number(row.heartbeatCount || 0), 0);

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

    const heartbeatIds = new Set(heartbeatRows.map((r) => r.sessionId));

    function classifyKind(row: any): string {
      if (heartbeatIds.has(row.sessionId)) return "heartbeat";
      const src = String(row.source || "").toLowerCase();
      if (row.projectId && String(row.projectId).trim() !== "") return "project";
      if (src === "workflow:project" || src.startsWith("workflow:project-")) return "project";
      if (row.kind === "chat") return "chat";
      if (src === "telegram" || src === "web" || src === "human" || src === "cli") return "chat";
      if (src.includes("chat") || src.includes("message")) return "chat";
      if (src.startsWith("workflow:")) return "workflow";
      return "other";
    }

    const byAgent = new Map<string, any[]>();
    for (const agent of agents) byAgent.set(agent, []);
    for (const row of allRows) {
      if (!byAgent.has(row.agent)) byAgent.set(row.agent, []);
      byAgent.get(row.agent)!.push({ ...row, category: classifyKind(row) });
    }

    const agentRows = [...byAgent.entries()]
      .map(([name, sessions]) => {
        const heartbeatSummary = heartbeatSummaryByAgent.get(name);
        const categoryCounts: Record<string, number> = { heartbeat: 0, project: 0, chat: 0, workflow: 0, other: 0 };
        for (const s of sessions) categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
        return {
          name,
          heartbeatCount: heartbeatSummary?.heartbeatCount ?? 0,
          sessionCount: sessions.length,
          categoryCounts,
          lastHeartbeat: heartbeatSummary?.lastHeartbeat ?? null,
          lastStatus: heartbeatSummary?.status ?? null,
          sessions,
        };
      })
      .sort((a, b) => (b.lastHeartbeat ?? 0) - (a.lastHeartbeat ?? 0));

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
    const metricOrder = new Map(LIVE_VITAL_METRIC_IDS.map((id, idx) => [id, idx]));
    const openAlertMetricIds = new Set(openAlerts.map((alert) => alert.metricId));
    const vitals = readMetricObservations(db, now, LIVE_VITAL_METRIC_IDS).metrics;
    const vitalMetrics = vitals
      .map((m) => {
        return {
          ...m,
          owner: m.owner || "system:host",
          updatedAt: m.observation?.measuredAt ?? null,
          breached: m.alertsDisabled ? false : m.thresholdBreached,
          alertOpen: openAlertMetricIds.has(m.id) ? true : openAlertsTruncated ? null : false,
        };
      })
      .sort((a, b) => (metricOrder.get(a.id) ?? 999) - (metricOrder.get(b.id) ?? 999));

    const messages = (
      db
        .prepare(
          `SELECT event_type, source, owner, data, timestamp
       FROM events
       WHERE event_type = 'message.created' AND timestamp > ?
       ORDER BY timestamp DESC
       LIMIT 20`,
        )
        .all(oneHour) as any[]
    ).map((row) => {
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

    const recentDecisions = (
      db
        .prepare(
          `SELECT sessionId, agent, task, status, startedAt, outcome
       FROM sessions
       WHERE startedAt > ?
         AND (
           ${HEARTBEAT_SESSION_PREDICATE}
         )
       ORDER BY startedAt DESC
       LIMIT 8`,
        )
        .all(since) as any[]
    ).map((row) => ({
      sessionId: row.sessionId,
      agent: row.agent,
      timestamp: row.startedAt,
      status: row.status,
      text: (row.outcome || row.task || "").replace(/^\[heartbeat\]\s*/i, "").slice(0, 220),
    }));

    return json({
      summary: {
        agentsConfigured: agents.length,
        agentsTotal: agents.length,
        heartbeatAgents4h: agentRows.filter((agent) => agent.lastHeartbeat).length,
        heartbeats4h: heartbeatTotal,
        windowHours: hours,
        windowSince: since,
        activityRows: allRows.length,
        activityRowsTruncated: activityTruncated,
        heartbeatRowsTruncated: heartbeatsTruncated,
        rowLimit: DASHBOARD_SESSION_ROW_LIMIT,
        activeSessions,
        openAlerts: openAlerts.length,
        openAlertsTruncated,
      },
      agents: agentRows,
      heartbeats: heartbeatRows,
      recentDecisions,
      messages,
      alerts: openAlerts,
      vitals: vitalMetrics,
    });
  }

  function handleStats(): Response {
    const db = getDb();
    const now = Date.now();
    const day = now - 86400000;
    const week = now - 7 * 86400000;
    const sess24h = db
      .prepare(
        `SELECT agent, COUNT(*) as cnt, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors, AVG(endedAt - startedAt) as avgMs FROM sessions WHERE startedAt > ? GROUP BY agent ORDER BY cnt DESC`,
      )
      .all(day);
    const req24h: unknown[] = [];
    const totalSess7d = (db.prepare("SELECT COUNT(*) as cnt FROM sessions WHERE startedAt > ?").get(week) as any).cnt;
    const humanReq7d = 0;
    return json({
      last24h: { sessions: sess24h, requests: req24h },
      last7d: { totalSessions: totalSess7d, humanRequests: humanReq7d },
      socketAvailable: existsSync(conventionSocketPath()),
      socketPath: conventionSocketPath(),
    });
  }

  function handleMetrics(url: URL): Response {
    const db = getDb();
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

    const snapshots = metrics
      .filter((m) => m.observation)
      .map((m) => ({
        metric_id: m.id,
        value: m.current,
        sample_size: m.sample_size,
        measured_at: m.measured_at,
        measured_by: m.measured_by,
        note: m.note,
      }));

    const recentSnapshots = db
      .prepare(
        `
      SELECT ms.metric_id, ms.value, ms.sample_size, ms.measured_at, ms.measured_by, ms.note
      FROM metric_snapshots ms ORDER BY ms.measured_at DESC LIMIT 50
    `,
      )
      .all() as any[];

    return new Response(
      JSON.stringify({
        metrics: metricsWithAlertState,
        generatedAt: observations.generatedAt,
        truncated: observations.truncated,
        latestSnapshots: snapshots,
        recentSnapshots,
        alerts: openAlerts.slice(0, METRIC_LIST_LIMIT),
        alertsTruncated,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  function handleAppInbox(url: URL): Response {
    try {
      const items = listAppInboxItems(getDb(), appInboxQueryFromUrl(url));
      return json({ items, count: items.length });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  function handleAppInboxHealth(url: URL): Response {
    try {
      const appId = url.searchParams.get("appId") || undefined;
      const generatedAt = Date.now();
      return json({ apps: listAppInboxHealth(getDb(), { appId, now: generatedAt }), generatedAt });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  function handleAppInboxItem(itemIdText: string): Response {
    const itemId = decodeURIComponent(itemIdText).trim();
    if (!itemId) return json({ error: "App inbox item id required" }, 400);
    const item = getAppInboxItem(getDb(), itemId);
    return item ? json(item) : json({ error: `App inbox item not found: ${itemId}` }, 404);
  }

  function handleEvents(url: URL): Response {
    const db = getDb();
    const query = createQueryService({ getDb: () => db });
    try {
      return json(
        query.events({
          owner: url.searchParams.get("owner") || undefined,
          type: url.searchParams.get("type") || undefined,
          limit: parseInt(url.searchParams.get("limit") || "100", 10),
        }).rows,
      );
    } catch {
      return json([]);
    }
  }

  function handleEventDeliveryHealth(url: URL): Response {
    const db = getDb();
    const query = createQueryService({ getDb: () => db });
    const now = Date.now();
    const lookbackMs =
      Math.max(1, Math.min(24 * 60 * 60_000, Number(url.searchParams.get("lookbackMs") || 6 * 60 * 60_000))) ||
      6 * 60 * 60_000;
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
    const since = now - lookbackMs;
    try {
      const eventSchema = db.prepare("PRAGMA table_info(events)").all() as Array<{ name?: string }>;
      const eventColumnsSet = new Set(eventSchema.map((row) => row.name).filter(Boolean));
      const pairTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event_pair_runs'")
        .get();
      if (!eventColumnsSet.has("delivery_status") || !eventColumnsSet.has("delivery_route") || !pairTable) {
        return json({
          now,
          since,
          lookbackMs,
          schemaReady: false,
          note: "event delivery schema is not migrated in this state database yet",
          unhandledEvents: [],
          overduePendingEvents: [],
          orphanPairs: [],
          overdueOpenPairs: [],
        });
      }
      return json({
        ...query.eventDeliveryHealth({ now, lookbackMs, limit }),
        lookbackMs,
        schemaReady: true,
      });
    } catch (error) {
      return json({
        now,
        since,
        lookbackMs,
        schemaReady: false,
        unhandledEvents: [],
        overduePendingEvents: [],
        orphanPairs: [],
        overdueOpenPairs: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleEventIngress(req: Request): Promise<Response> {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const type = typeof body.type === "string" ? body.type.trim() : "";
      if (!type) return json({ error: "type required" }, 400);
      if (!PUBLIC_EVENT_TYPES.has(type)) return json({ error: `Event type '${type}' is not admitted by HTTP` }, 400);
      const data =
        body.data && typeof body.data === "object" && !Array.isArray(body.data)
          ? (body.data as Record<string, unknown>)
          : {};
      const projectPath =
        typeof data.projectPath === "string"
          ? data.projectPath
          : typeof body.projectPath === "string"
            ? body.projectPath
            : "";

      let projectId = typeof data.projectId === "string" ? data.projectId : "";
      if (projectPath) {
        if (!isAllowedProjectPath(projectPath)) return json({ error: "Access denied" }, 403);
        const projectFile = resolveProjectFile(projectPath);
        if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);
        const identity = readProjectIngressIdentity(projectPath, projectFile);
        projectId = projectId || identity.projectId;
      }

      const trigger = await sendDaemonFrame(buildEventIngressFrame(body));
      if (!trigger.ok) return json({ ok: false, triggered: false, error: trigger.error }, 503);

      return json(
        {
          ok: true,
          triggered: true,
          eventType: trigger.eventType ?? type,
          eventId: trigger.eventId,
          delivery: trigger.delivery ?? "recorded",
          links: trigger.links ?? [],
          reason: typeof data.reason === "string" ? data.reason : null,
          projectId: projectId || null,
        },
        eventDeliveryContract(type) === "required" && trigger.delivery !== "accepted" ? 202 : 201,
      );
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  function handleEventView(eventIdText: string): Response {
    const eventId = Number(eventIdText);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) return json({ error: "event id must be positive" }, 400);
    const view = getEventView(getDb(), eventId);
    return view ? json(view) : json({ error: `Event ${eventId} not found` }, 404);
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

    return json({
      ...buildLoopTrace(getDb(), target),
      ...("workflowRunId" in target ? { workflowFacts: readWorkflowFacts(stateDir, target.workflowRunId) } : {}),
    });
  }

  function handleEventGraph(_url: URL, eventIdText: string): Response {
    const eventId = Number(eventIdText);
    if (!Number.isFinite(eventId)) return json({ error: "event id must be numeric" }, 400);
    let graph = buildEventGraph(getDb(), eventId);
    const sessionIds = [
      ...new Set(
        graph.nodes.map((node) => node.sessionId?.trim()).filter((sessionId): sessionId is string => !!sessionId),
      ),
    ];
    for (const sessionId of sessionIds) {
      const transcript = readSessionTranscript(sessionId);
      if (transcript) graph = addSessionTranscriptToEventGraph(graph, sessionId, transcript);
    }
    return json(graph);
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
    const existing = getDb()
      .prepare("SELECT id, owner, threshold FROM metrics WHERE id = ?")
      .get(metricId) as { id: string; owner?: string | null; threshold: number | null } | undefined;
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
    const existing = getDb()
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
    handleStats,
    handleMetrics,
    handleAppInbox,
    handleAppInboxHealth,
    handleAppInboxItem,
    handleEvents,
    handleEventDeliveryHealth,
    handleEventIngress,
    handleEventView,
    handleLoopTrace,
    handleEventGraph,
    handleMetricThreshold,
    handleAlertResolve,
  };
}
