#!/usr/bin/env bun
import { listConfiguredAgentNames } from "../loader/agent-discovery.js";
import { interfaceBinding, type InterfaceBinding } from "@may-agent/control";
import { taskAttemptsQuery, readTaskAttempts } from "../adapters/reporting/task-attempts.js";
import { metricEvidenceQuery, readMetricEvidence } from "../adapters/reporting/metric-evidence.js";
/**
 * may-agent HTTP adapter — API, static WebUI, and dashboard websocket.
 *
 * Can run standalone: bun src/app/http/server.ts --state-dir .state --port 8080
 * Imported by app modes; serves project UI from PROJECTS_ROOT.
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
import { randomUUID } from "node:crypto";
import { createAgentRouteHandlers, HEARTBEAT_SESSION_PREDICATE } from "./agent-routes.js";
import { createProjectRouteHandlers, type ConfirmDurableControl } from "./project-routes.js";
import { createSessionRouteHandlers } from "./session-routes.js";
import { createTaskReadHandlers } from "./task-read-routes.js";
import { createTaskInputHandler, type TaskInputCommand } from "./task-input.js";
import { createTaskTranscriptHandler } from "./task-transcript.js";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import type { Duplex } from "node:stream";
import { createQueryService } from "../../lib/query-service.js";
import {
  connectSocketEndpoint,
  daemonSocketPath,
  sendDaemonEvent,
  sendSocketCommand,
  SocketCommandError,
  type SocketEndpoint,
  type SocketResponse,
} from "@may-agent/control/client";
import { buildCanonicalEventEnvelope } from "../../../packages/control/src/event-envelope.js";
import { readProjectIngressIdentity } from "./project-metadata.js";
export { normalizeProjectPathForCompare } from "./project-metadata.js";
export { buildAppAdmissionCommand, extractMarkdownSection, projectEventTargetForPath } from "./project-routes.js";
import { openStateDb, type SqliteDb } from "./read-model/state-db.js";
import { buildLoopTrace, type LoopTraceTarget } from "./read-model/loop-trace.js";
import { readWorkflowFacts } from "../../lib/workflow-facts.js";
import { healthWindow, readWorkflowHealth, workflowHealthQuery } from "../adapters/reporting/workflow-health.js";
import { contextUsageQuery, readContextUsage } from "../adapters/reporting/context-usage.js";
import { METRIC_LIST_LIMIT, readMetricHistory, readMetricObservations } from "../adapters/reporting/metric-observations.js";
import type { EventInput } from "@may-agent/control/events";
import { eventDeliveryContract, findEventPublication, getEventView, PUBLIC_EVENT_TYPES } from "../core/events/interface.js";

// ── Public API ────────────────────────────────────────────────────────

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
const DASHBOARD_SESSION_ROW_LIMIT = 2_000;
const DASHBOARD_ALERT_ROW_LIMIT = 20;

export interface WebUIOptions {
  interface?: InterfaceBinding;
  stateDir: string;
  port: number;
  hostname?: string;
}

type DaemonFrameResult = {
  ok: boolean;
  error?: string;
  eventId?: number;
  eventType?: string;
  delivery?: "recorded" | "accepted";
  links?: unknown[];
};

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

export async function sendDaemonFrameWithRetry(
  socketPath: string,
  frame: Record<string, unknown>,
  send: typeof sendDaemonEvent = sendDaemonEvent,
  confirm?: (idempotencyKey: string, frame: Record<string, unknown>) => number | undefined | Promise<number | undefined>,
): Promise<DaemonFrameResult> {
  const publishEvent =
    frame.type === "publish" && frame.event && typeof frame.event === "object" && !Array.isArray(frame.event)
      ? (frame.event as Record<string, unknown>)
      : null;
  const originalData = publishEvent
    ? publishEvent.data && typeof publishEvent.data === "object" && !Array.isArray(publishEvent.data)
      ? (publishEvent.data as Record<string, unknown>)
      : {}
    : frame.data && typeof frame.data === "object" && !Array.isArray(frame.data)
      ? (frame.data as Record<string, unknown>)
      : {};
  const idempotencyKey =
    typeof publishEvent?.idempotencyKey === "string" && publishEvent.idempotencyKey.trim()
      ? publishEvent.idempotencyKey.trim()
      : typeof originalData.idempotencyKey === "string" && originalData.idempotencyKey.trim()
        ? originalData.idempotencyKey.trim()
        : `web-${randomUUID()}`;
  const durableFrame = publishEvent
    ? { ...frame, event: { ...publishEvent, data: { ...originalData }, idempotencyKey } }
    : { ...frame, data: { ...originalData, idempotencyKey } };

  for (const timeoutMs of [2_000, 5_000]) {
    try {
      const response = await send(socketPath, durableFrame, { timeoutMs });
      const eventId = Number(response.eventId);
      return {
        ok: true,
        ...(Number.isInteger(eventId) && eventId > 0 ? { eventId } : {}),
        ...(typeof response.eventType === "string" ? { eventType: response.eventType } : {}),
        ...(response.delivery === "recorded" || response.delivery === "accepted"
          ? { delivery: response.delivery }
          : {}),
        ...(Array.isArray(response.links) ? { links: response.links } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const outcomeMayBeDurable = message === "Socket timeout" || message.includes("outcome unknown");
      if (timeoutMs === 2_000 && outcomeMayBeDurable) continue;
      if (outcomeMayBeDurable && confirm) {
        const eventId = Number(await confirm(idempotencyKey, durableFrame));
        if (Number.isInteger(eventId) && eventId > 0) {
          return { ok: true, eventId };
        }
      }
      return {
        ok: false,
        error: `daemon socket delivery failed at ${socketPath}: ${message}`,
      };
    }
  }

  return {
    ok: false,
    error: `daemon socket delivery failed at ${socketPath}: acknowledgement unavailable`,
  };
}

type RetrySafeControlCommand = Record<string, unknown> & { type: string; idempotencyKey: string };

async function sendRetrySafeControlCommand(
  endpoint: SocketEndpoint,
  command: RetrySafeControlCommand,
  send: typeof sendSocketCommand,
  confirm: ConfirmDurableControl | undefined,
  exhaustedMessage: string,
): Promise<SocketResponse> {
  for (const timeoutMs of [2_000, 10_000]) {
    try {
      return await send(endpoint, command, { timeoutMs });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const kind =
        error && typeof error === "object" && "kind" in error ? (error as { kind?: unknown }).kind : undefined;
      const outcomeMayBeDurable =
        kind === "post-send-unknown" || message === "Socket timeout" || message.includes("outcome unknown");
      if (!outcomeMayBeDurable) throw error;
      if (timeoutMs === 2_000) continue;
      const durable = await confirm?.(command.idempotencyKey);
      if (durable) {
        return {
          type: "ok",
          command: command.type,
          eventId: durable.eventId,
          eventType: durable.eventType,
        };
      }
      throw error;
    }
  }
  throw new Error(exhaustedMessage);
}

export async function sendProjectActionWithRetry(
  endpoint: SocketEndpoint,
  command: {
    type: "project.action.invoke";
    projectId: string;
    actionId: string;
    params: unknown;
    idempotencyKey: string;
  },
  send: typeof sendSocketCommand = sendSocketCommand,
  confirm?: ConfirmDurableControl,
): Promise<SocketResponse> {
  return sendRetrySafeControlCommand(endpoint, command, send, confirm, "Project action retry exhausted");
}

export async function sendAppInputWithRetry(
  endpoint: SocketEndpoint,
  command: Record<string, unknown> & { type: "app.input.admit"; idempotencyKey: string },
  send: typeof sendSocketCommand = sendSocketCommand,
  confirm?: ConfirmDurableControl,
): Promise<SocketResponse> {
  return sendRetrySafeControlCommand(endpoint, command, send, confirm, "App input retry exhausted");
}

export type DaemonReadiness = {
  ready: boolean;
  socketPath: string;
  checkedAt: number;
  error?: string;
};

/** Actively prove the daemon can answer control traffic; a socket file alone may be stale. */
export async function probeDaemonReadiness(
  socketPath: string,
  send: typeof sendSocketCommand = sendSocketCommand,
  timeoutMs = 5_000,
): Promise<DaemonReadiness> {
  const checkedAt = Date.now();
  try {
    const response = await send(socketPath, { type: "status" }, { timeoutMs });
    if (response.type !== "status" || response.command !== "status") {
      throw new Error("daemon returned an unexpected status response");
    }
    return { ready: true, socketPath, checkedAt };
  } catch (error) {
    return {
      ready: false,
      socketPath,
      checkedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function platformUiContentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function servePlatformUiFile(req: Request, path: string): Response {
  const stat = statSync(path);
  const etag = `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
  const headers = {
    "Content-Type": platformUiContentTypeFor(path),
    "Cache-Control": "public, no-cache",
    ETag: etag,
  };
  if (
    req.headers
      .get("if-none-match")
      ?.split(",")
      .map((value) => value.trim())
      .includes(etag)
  ) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(readFileSync(path), {
    headers,
  });
}

function isPlatformUiAppRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/index.html") return true;
  if (/^\/(events|agents|metrics|knowledge|terminal|sessions)(?:\/.*)?$/.test(pathname)) return true;
  if (pathname === "/projects") return true;
  if (!pathname.startsWith("/projects/")) return false;
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const last = parts[parts.length - 1];
  const hasSurface = last === "tasks" || last === "functions";
  const idParts = hasSurface ? parts.slice(0, -1) : parts;
  if (!hasSurface && idParts.length === 2) {
    if (["ui", "kanban"].includes(idParts[1])) return false;
    if (/\.[a-z0-9]+$/i.test(idParts[1])) return false;
  }
  return idParts.length === 1 || idParts.length === 2;
}

export function servePlatformUiRequest(req: Request, platformUiDir: string): Response | null {
  const url = new URL(req.url);
  if (req.method !== "GET") return null;

  if (isPlatformUiAppRoute(url.pathname)) {
    const indexPath = resolve(platformUiDir, "index.html");
    return existsSync(indexPath) && statSync(indexPath).isFile() ? servePlatformUiFile(req, indexPath) : null;
  }

  // Top-level platform UI assets: index.html uses relative paths like
  // `styles.css`, `app.js`, `pages/projects.js`. Map those to
  // the selected UI directory. Restricted to known static
  // extensions so /api/foo never falls through to this branch.
  if (!/^\/([\w\-.]+\/)*[\w\-.]+\.(css|js|map|svg|png|jpg|jpeg|gif|webp|ico)$/.test(url.pathname)) {
    return null;
  }

  const assetPath = resolve(platformUiDir, url.pathname.replace(/^\//, ""));
  const rel = relative(platformUiDir, assetPath);
  const inside = rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  if (inside && existsSync(assetPath) && statSync(assetPath).isFile()) return servePlatformUiFile(req, assetPath);
  return null;
}

export function startWebUI(opts: WebUIOptions): { port: number } {
  const STATE_DIR = opts.stateDir;
  const PORT = opts.port;
  const PROJECT_ROOT = process.env.PROJECT_ROOT || resolve(STATE_DIR, "..");
  const AGENTS_ROOT = process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents");
  const SHARED_ROOT = process.env.SHARED_ROOT || resolve(PROJECT_ROOT, "shared");
  const PROJECTS_ROOT = process.env.PROJECTS_ROOT || resolve(PROJECT_ROOT, "projects");
  // Development can serve source assets without changing App discovery or deployment.
  const PLATFORM_UI_DIR = resolve(process.env.MAY_AGENT_UI_DIR?.trim() || join(PROJECTS_ROOT, "platform", "ui"));
  const DAEMON_INSTANCE = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "default";
  const humanInterface = opts.interface ?? interfaceBinding();
  const DAEMON_AGENT = humanInterface.agent;

  function _db(): SqliteDb {
    return openStateDb(join(STATE_DIR, "may.db"));
  }

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
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(72, Math.max(1, rawHours)) : 4;
    const since = now - hours * 60 * 60 * 1000;
    const oneHour = now - 60 * 60 * 1000;
    const agents = listConfiguredAgents();
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

    // All sessions in the selected window (not just heartbeats). The
    // timeline shows everything an agent did so the operator sees real
    // activity distribution, not only the cron tick. Each session is
    // classified into a 'category' bucket which maps to a color in the
    // frontend.
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
      // project. Catches aftermath, triage, orchestrator, and goal-driver.
      if (src.startsWith("workflow:")) return "workflow";
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
        // NOTE: keep `*4h` field names even though the window is now
        // operator-selectable — they're consumed elsewhere as the
        // "heartbeat coverage in window" signal, and the window default
        // is still 4h. Use `windowHours` for accurate labeling.
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

  async function handleReadiness(): Promise<Response> {
    const readiness = await probeDaemonReadiness(conventionSocketPath());
    return json(readiness, readiness.ready ? 200 : 503);
  }

  // ── Knowledge API ──────────────────────────────────────────────────

  // ── Browse API: generic file/directory browser for knowledge base ──
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

    const snapshots = metrics.filter((m) => m.observation).map((m) => ({
      metric_id: m.id, value: m.current, sample_size: m.sample_size,
      measured_at: m.measured_at, measured_by: m.measured_by, note: m.note,
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

  function handleEvents(url: URL): Response {
    const db = _db();
    const query = createQueryService({ getDb: () => db });
    try {
      // Keep the legacy row-array shape; shared limits are 1..500, default 100.
      return json(
        query.events({
          owner: url.searchParams.get("owner") || undefined,
          type: url.searchParams.get("type") || undefined,
          limit: parseInt(url.searchParams.get("limit") || "100", 10),
        }).rows,
      );
    } catch {
      return json([]); // table may not exist yet
    }
  }

  function handleEventDeliveryHealth(url: URL): Response {
    const db = _db();
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
    // Trusted operator diagnostic view, intentionally broader than POST ingress.
    // Consumers needing Task results must reread the exact canonical resource.
    const eventId = Number(eventIdText);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) return json({ error: "event id must be positive" }, 400);
    const view = getEventView(_db(), eventId);
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
      ...buildLoopTrace(_db(), target),
      ...("workflowRunId" in target ? { workflowFacts: readWorkflowFacts(STATE_DIR, target.workflowRunId) } : {}),
    });
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

  async function sendDaemonFrame(frame: Record<string, unknown>): Promise<DaemonFrameResult> {
    const socketPath = conventionSocketPath();
    return sendDaemonFrameWithRetry(socketPath, frame, sendDaemonEvent, (_key, durableFrame) => {
      if (durableFrame.type !== "publish") return undefined;
      return findEventPublication(_db(), durableFrame.event as EventInput, { source: "control-socket" });
    });
  }

  async function daemonRead(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      return await sendDaemonEvent(conventionSocketPath(), frame, { timeoutMs: 2_000 });
    } catch (error) {
      if (error instanceof SocketCommandError && error.kind === "definitive") {
        return { type: "error", message: error.message };
      }
      throw new Error(`Daemon read unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function confirmAcceptedAppInput(
    appId: string,
    idempotencyKey: string,
    data: Record<string, unknown>,
    inputSource: { kind: "human"; id: string },
  ): { eventId: number; eventType: "app.input.requested"; delivery: "accepted" } | undefined {
    const db = _db();
    const eventId = findEventPublication(
      db,
      { type: "app.input.requested", target: { appId }, idempotencyKey, data },
      { source: "control-socket", inputSource },
    );
    if (!eventId || getEventView(db, eventId)?.delivery.state !== "accepted") return undefined;
    return { eventId, eventType: "app.input.requested", delivery: "accepted" };
  }
  const { handleApps, handleConversationRead, handleHumanTaskRead, handleAppTasks, handleAppTask } =
    createTaskReadHandlers({ daemonRead, json });
  const handleTaskTranscript = createTaskTranscriptHandler({ daemonRead, json, stateDir: STATE_DIR });
  const confirmTaskInput = (command: TaskInputCommand) =>
    confirmAcceptedAppInput(
      String(command.appId),
      command.idempotencyKey,
      { input: command.input, targetTaskId: command.targetTaskId, channel: command.channel },
      command.source,
    );
  const handleTaskInput = createTaskInputHandler({
    daemonRead,
    json,
    confirm: confirmTaskInput,
    admit: async (command) =>
      (await sendAppInputWithRetry(conventionSocketPath(), command, sendSocketCommand, () =>
        confirmTaskInput(command),
      )) as unknown as Record<string, unknown>,
  });
  const {
    handleSession,
    handleTranscript,
    handleRawLog,
    handleSessionCancel,
    handleSessionMessage,
  } = createSessionRouteHandlers({
    stateDir: STATE_DIR,
    getDb: _db,
    json,
    sendDaemonFrame,
    buildPublishFrame,
  });
  const {
    isAllowedProjectPath,
    resolveProjectFile,
    serveIndex,
    serveProjectStatic,
    readProjects,
    handleProjects,
    handleProjectContent,
    handleProjectArtifact,
    handleProjectDetail,
    handleProjectSessions,
    handleProjectComment,
    handleProjectActions,
    handleProjectActionInvoke,
  } = createProjectRouteHandlers({
    stateDir: STATE_DIR,
    projectRoot: PROJECT_ROOT,
    agentsRoot: AGENTS_ROOT,
    projectsRoot: PROJECTS_ROOT,
    platformUiDir: PLATFORM_UI_DIR,
    getDb: _db,
    json,
    conventionSocketPath,
    platformUiContentTypeFor,
    sendAppInputWithRetry,
    sendProjectActionWithRetry,
    confirmAcceptedAppInput,
  });
  const {
    handleAgents,
    handleAgentAbout,
    handleAgentDefaultSession,
    handleAgentMessage,
  } = createAgentRouteHandlers({
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    humanInterface,
    getDb: _db,
    json,
    readProjects,
    sendDaemonFrame,
    buildPublishFrame,
  });

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
    unix.setEncoding("utf8");
    wsToUnix.set(ws, unix);
    let buffer = "";
    unix.on("data", (chunk: string) => {
      buffer += chunk;
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
    hostname: opts.hostname?.trim() || "0.0.0.0",
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (server.upgrade(req, { data: { kind: "events" } })) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      if (url.pathname === "/api/liveness") return handleLiveness(url);
      if (url.pathname === "/api/interface") return json(humanInterface);
      if (url.pathname === "/api/readiness") return handleReadiness();
      if (url.pathname === "/api/agents") return handleAgents();
      const defaultSessionMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/default-session$/);
      if (defaultSessionMatch) return handleAgentDefaultSession(defaultSessionMatch[1], url.searchParams.get("requestId")?.trim());
      const aboutMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/about$/);
      if (aboutMatch) return handleAgentAbout(aboutMatch[1]);
      if (url.pathname === "/api/browse") return handleBrowse(url);
      if (url.pathname === "/api/knowledge/search") return handleKnowledgeSearch(url);
      if (url.pathname === "/api/metrics") return handleMetrics(url);
      if (url.pathname === "/api/context-usage") {
        let query: ReturnType<typeof contextUsageQuery>;
        try { query = contextUsageQuery(url.searchParams); }
        catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid usage filter" }, 400); }
        return json(readContextUsage(_db(), query));
      }
      if (url.pathname === "/api/task-attempts") {
        if (req.method !== "GET") return json({ error: "GET required" }, 405);
        let query: ReturnType<typeof taskAttemptsQuery>;
        try { query = taskAttemptsQuery(url.searchParams); }
        catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid attempt filter" }, 400); }
        return json(readTaskAttempts(_db(), query));
      }
      if (url.pathname === "/api/workflow-health") {
        let query: ReturnType<typeof workflowHealthQuery>;
        try { query = workflowHealthQuery(url.searchParams); }
        catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid workflow filter" }, 400); }
        return json(readWorkflowHealth(_db(), query));
      }
      if (url.pathname === "/api/projects") return handleProjects();
      if (url.pathname === "/api/apps")
        return req.method === "GET" ? handleApps() : json({ error: "GET required" }, 405);
      const appTaskMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/tasks\/(.+)$/);
      if (appTaskMatch && req.method === "GET") {
        return handleAppTask(url, decodeURIComponent(appTaskMatch[1]), decodeURIComponent(appTaskMatch[2]));
      }
      const appTasksMatch = url.pathname.match(/^\/api\/apps\/([^/]+)\/tasks$/);
      if (appTasksMatch && req.method === "GET") return handleAppTasks(url, decodeURIComponent(appTasksMatch[1]));
      if (url.pathname === "/api/projects/content") return handleProjectContent(url);
      if (url.pathname === "/api/projects/artifact") return handleProjectArtifact(url);
      if (url.pathname === "/api/conversation" && req.method === "GET") return handleConversationRead(url);
      if (url.pathname === "/api/task/transcript")
        return req.method === "GET" ? handleTaskTranscript(url) : json({ error: "GET required" }, 405);
      if (url.pathname === "/api/task/input")
        return req.method === "POST" ? handleTaskInput(req) : json({ error: "POST required" }, 405);
      if (url.pathname === "/api/tasks" || url.pathname === "/api/task") {
        return req.method === "GET" ? handleHumanTaskRead(url) : json({ error: "GET required" }, 405);
      }
      if (url.pathname === "/api/projects/detail") return handleProjectDetail(url);
      if (url.pathname === "/api/projects/sessions") return handleProjectSessions(url);
      if (url.pathname === "/api/projects/comment" && req.method === "POST") return handleProjectComment(req);
      const projectActionInvokeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/actions\/([^/]+)$/);
      if (projectActionInvokeMatch && req.method === "POST") {
        return handleProjectActionInvoke(req, projectActionInvokeMatch[1], projectActionInvokeMatch[2]);
      }
      const projectActionsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/actions$/);
      if (projectActionsMatch && req.method === "GET") return handleProjectActions(projectActionsMatch[1]);
      if (url.pathname === "/api/events/delivery-health") return handleEventDeliveryHealth(url);
      const eventTraceMatch = url.pathname.match(/^\/api\/events\/(\d+)\/trace$/);
      if (eventTraceMatch) {
        const traceUrl = new URL(url);
        traceUrl.pathname = "/api/loop-trace";
        traceUrl.search = `?eventId=${eventTraceMatch[1]}`;
        return handleLoopTrace(traceUrl);
      }
      const eventViewMatch = url.pathname.match(/^\/api\/events\/(\d+)$/);
      if (eventViewMatch && req.method === "GET") return handleEventView(eventViewMatch[1]);
      if (url.pathname === "/api/events" && req.method === "POST") return handleEventIngress(req);
      if (url.pathname === "/api/events") return handleEvents(url);
      if (url.pathname === "/api/loop-trace") return handleLoopTrace(url);
      const metricEvidenceMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/evidence$/);
      if (metricEvidenceMatch) {
        if (req.method !== "GET") return json({ error: "GET required" }, 405);
        let query: ReturnType<typeof metricEvidenceQuery>;
        try {
          query = metricEvidenceQuery(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid metric evidence window" }, 400);
        }
        return json(readMetricEvidence(_db(), decodeURIComponent(metricEvidenceMatch[1]), query));
      }
      const metricHistoryMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/history$/);
      if (metricHistoryMatch) {
        const metricId = decodeURIComponent(metricHistoryMatch[1]);
        let window: ReturnType<typeof healthWindow>;
        try { window = healthWindow(url.searchParams); }
        catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid history window" }, 400); }
        return json(readMetricHistory(_db(), metricId, window));
      }
      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch) return handleSession(sessionMatch[1]);
      const transcriptMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/transcript$/);
      if (transcriptMatch) return handleTranscript(transcriptMatch[1]);
      const rawLogMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/raw-log$/);
      if (rawLogMatch) return handleRawLog(rawLogMatch[1], url);

      // ── Steering verbs (POST) ───────────────────────────────────────
      if (req.method === "POST") {
        const sessionCancelMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/cancel$/);
        if (sessionCancelMatch) return handleSessionCancel(sessionCancelMatch[1]);
        const sessionMessageMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/message$/);
        if (sessionMessageMatch) return handleSessionMessage(req, sessionMessageMatch[1]);
        const agentMessageMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
        if (agentMessageMatch) return handleAgentMessage(req, agentMessageMatch[1], url);
        const thresholdMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/threshold$/);
        if (thresholdMatch) return handleMetricThreshold(req, decodeURIComponent(thresholdMatch[1]));
        const alertResolveMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)\/resolve$/);
        if (alertResolveMatch) return handleAlertResolve(req, alertResolveMatch[1]);
      }

      const platformUiResponse = servePlatformUiRequest(req, PLATFORM_UI_DIR);
      if (platformUiResponse) return platformUiResponse;
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return serveIndex();
      if (req.method === "GET" && (url.pathname === "/projects" || url.pathname.startsWith("/projects/")))
        return serveProjectStatic(url.pathname);
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

export function runWebUIServerFromCli(argv: string[] = process.argv): void {
  // When run as compiled binary, argv is [binary, --state-dir, path, ...]
  // When run via bun, argv is [bun, web.ts, --state-dir, path, ...]
  // getArg works for both since it searches the full argv.
  const getArg = (name: string, fallback: string) => {
    const idx = argv.indexOf(name);
    return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const stateDir = resolve(getArg("--state-dir", ".state"));
  const port = parseInt(getArg("--port", "8080"), 10);
  const hostname = getArg("--host", process.env.WEB_HOST || "0.0.0.0");
  if (!existsSync(stateDir)) {
    console.error(`State directory not found: ${stateDir}`);
    process.exit(1);
  }
  console.log(`may-agent web UI\n  state: ${stateDir}\n  port:  ${port}`);
  const { port: actualPort } = startWebUI({ stateDir, port, hostname });
  console.log(`  url:   http://localhost:${actualPort}`);
}

if ((import.meta as ImportMeta & { main?: boolean }).main && process.argv.includes("--state-dir")) {
  runWebUIServerFromCli();
}
