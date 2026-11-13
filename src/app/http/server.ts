#!/usr/bin/env bun
import { listConfiguredAgentNames, listRuntimeAgentDirectories } from "../loader/agent-discovery.js";
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
import { createTaskReadHandlers } from "./task-read-routes.js";
import { createTaskInputHandler, type TaskInputCommand } from "./task-input.js";
import { createTaskTranscriptHandler } from "./task-transcript.js";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import type { Duplex } from "node:stream";
import { createQueryService } from "../../lib/query-service.js";
import { metricThresholdBreached } from "../../lib/metrics.js";
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
import { normalizeProjectPathForCompare, projectPathIdentity, readProjectIngressIdentity, readProjectMetadata } from "./project-metadata.js";
export { normalizeProjectPathForCompare } from "./project-metadata.js";
import { openStateDb, type SqliteDb } from "./read-model/state-db.js";
import { ChatPublicationConflict, readChatPublication } from "./read-model/chat-publication.js";
import { buildLoopTrace, type LoopTraceTarget } from "./read-model/loop-trace.js";
import { readWorkflowFacts } from "../../lib/workflow-facts.js";
import { healthWindow, readWorkflowHealth, workflowHealthQuery } from "../adapters/reporting/workflow-health.js";
import { contextUsageQuery, readContextUsage } from "../adapters/reporting/context-usage.js";
import { METRIC_LIST_LIMIT, readMetricHistory, readMetricObservations } from "../adapters/reporting/metric-observations.js";
import { addSessionTranscriptToEventGraph, buildEventGraph } from "./read-model/event-graph.js";
import { resolveRuntimeAgentDirectory } from "../loader/agent-discovery.js";
import { getAppInboxItem, listAppInboxHealth, listAppInboxItems, type AppInboxQuery } from "../core/state/app-inbox-store.js";
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
// New heartbeat sessions carry source='heartbeat'. The remaining clauses are
// read-only compatibility for sessions persisted before typed classification.
const HEARTBEAT_SESSION_PREDICATE = `(
  source = 'heartbeat'
  OR source LIKE 'workflow:%heartbeat%'
  OR task LIKE '[heartbeat]%'
  OR task LIKE 'You are %waking up for your heartbeat.%'
)`;

export interface WebUIOptions {
  interface?: InterfaceBinding;
  stateDir: string;
  port: number;
  hostname?: string;
}

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

export function buildAppAdmissionCommand(input: {
  projectPath: string;
  projectId: string;
  comment: string;
  idempotencyKey: string;
}): Record<string, unknown> & { type: "app.input.admit"; idempotencyKey: string } {
  return {
    type: "app.input.admit",
    appId: input.projectId,
    input: {
      kind: "message",
      data: {
        message: input.comment,
        context: {
          intent: "project-comment",
          projectId: input.projectId,
          projectPath: input.projectPath,
        },
      },
    },
    source: { kind: "human", id: `web-ui:${input.idempotencyKey}` },
    conversationId: `web-ui:project:${input.projectId}`,
    channel: "web-ui",
    idempotencyKey: input.idempotencyKey,
  };
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

type DurableControlReceipt = { eventId: number; eventType: string };
type RetrySafeControlCommand = Record<string, unknown> & { type: string; idempotencyKey: string };
type ConfirmDurableControl = (
  idempotencyKey: string,
) => DurableControlReceipt | undefined | Promise<DurableControlReceipt | undefined>;

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

export function extractMarkdownSection(body: string, headings: string | string[]): string | null {
  const wanted = new Set((Array.isArray(headings) ? headings : [headings]).map((h) => h.trim().toLowerCase()));
  const lines = body.split(/\r?\n/);
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!match) continue;
    const heading = match[1].trim().toLowerCase();
    const matched = [...wanted].some(
      (name) => heading === name || heading.startsWith(`${name} `) || heading.startsWith(`${name} (`),
    );
    if (matched) {
      start = i + 1;
      break;
    }
  }

  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const section = lines.slice(start, end).join("\n").trim();
  return section || null;
}

export function projectEventTargetForPath(path: string, fallbackProjectId: string): string {
  const normalized = normalizeProjectPathForCompare(path);
  const projectName = normalized.split("/").filter(Boolean)[1] ?? "";
  return projectName.endsWith(".app") ? projectName.slice(0, -".app".length) : fallbackProjectId;
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

  function projectNameFromPath(path: string): string {
    return projectPathIdentity(path).name;
  }

  function readProject(path: string, filePath = resolveProjectFile(path)) {
    return readProjectMetadata(path, filePath);
  }

  function isAllowedProjectPath(path: string): boolean {
    const normalized = normalizeProjectPathForCompare(path);
    return (
      /^projects\/[^/]+(?:\/.*)?$/.test(normalized) || /^[^/]+\/workspace\/projects\/[^/]+(?:\/.*)?$/.test(normalized)
    );
  }

  function projectPathCandidates(path: string): string[] {
    const normalized = normalizeProjectPathForCompare(path);
    const clean = normalized.replace(/\/project\.md$/, "").replace(/\/$/, "");
    const name = projectNameFromPath(clean);
    const candidates = path.includes("workspace/projects/")
      ? [resolve(PROJECT_ROOT, path), resolve(PROJECT_ROOT, clean)]
      : [resolve(PROJECT_ROOT, clean), resolve(PROJECT_ROOT, path)];
    if (name) {
      candidates.push(resolve(PROJECTS_ROOT, name));
    }
    return [...new Set(candidates)];
  }

  function resolveProjectDir(path: string): string {
    const candidates = projectPathCandidates(path);
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  function appDirForName(name: string): string | null {
    if (!name) return null;
    const appDir = resolve(PROJECTS_ROOT, `${name.replace(/\.app$/, "")}.app`);
    return existsSync(appDir) ? appDir : null;
  }

  function appDirForPath(path: string): string | null {
    return appDirForName(projectNameFromPath(path));
  }

  function projectAppId(path: string, appDir: string): string {
    try {
      return readProjectIngressIdentity(path, resolve(appDir, "project.json")).name.replace(/\.app$/, "");
    } catch {
      return projectNameFromPath(path);
    }
  }

  function resolveProjectFile(path: string): string {
    if (path.endsWith(".md")) {
      const dir = resolveProjectDir(path.replace(/\/project\.md$/, ""));
      const projectFile = resolve(dir, "project.md");
      if (existsSync(projectFile)) return projectFile;
      const appDir = appDirForPath(path);
      if (appDir) {
        const appProjectFile = resolve(appDir, "project.md");
        if (existsSync(appProjectFile)) return appProjectFile;
        return resolve(appDir, "project.json");
      }
      return projectFile;
    }
    const projectDir = resolveProjectDir(path);
    const projectFile = resolve(projectDir, "project.md");
    if (existsSync(projectFile)) return projectFile;
    const projectJson = resolve(projectDir, "project.json");
    if (existsSync(projectJson)) return projectJson;
    const appDir = appDirForPath(path);
    if (appDir) {
      const appProjectFile = resolve(appDir, "project.md");
      if (existsSync(appProjectFile)) return appProjectFile;
      return resolve(appDir, "project.json");
    }
    return projectFile;
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
    return json({ session, children });
  }

  function resolveSessionJsonl(sessionId: string): { path: string; source: string } | null {
    const path = join(STATE_DIR, "sessions", sessionId, "session.jsonl");
    if (existsSync(path)) return { path, source: ".state/sessions/" + sessionId + "/session.jsonl" };
    return null;
  }

  function resolveSessionEval(
    sessionId: string,
  ): { path: string; source: string; session: { path: string; source: string } } | null {
    const session = resolveSessionJsonl(sessionId);
    if (!session) return null;
    return {
      path: session.path.replace(/session\.jsonl$/, "session.eval.jsonl"),
      source: session.source.replace(/session\.jsonl$/, "session.eval.jsonl"),
      session,
    };
  }

  function readEvalRows(evalPath: string): unknown[] {
    if (!existsSync(evalPath)) return [];
    return readFileSync(evalPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { parseError: true, raw: line };
        }
      });
  }

  function handleSessionEval(sessionId: string): Response {
    const resolved = resolveSessionEval(sessionId);
    if (!resolved) return json({ error: "Session not found" }, 404);
    return json({
      sessionId,
      source: resolved.source,
      exists: existsSync(resolved.path),
      rows: readEvalRows(resolved.path),
    });
  }

  function readSessionTranscript(sessionId: string): Record<string, unknown> | null {
    const resolved = resolveSessionJsonl(sessionId);
    if (!resolved) return null;
    const rawLines = readFileSync(resolved.path, "utf-8").split("\n");
    const messages: unknown[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;
      const rawLine = i + 1;
      try {
        const entry = JSON.parse(line);
        const role = String(entry.role || "").toLowerCase();
        if (role === "user") {
          const text = Array.isArray(entry.content)
            ? entry.content.map((b: any) => b.text || "").join("")
            : typeof entry.content === "string"
              ? entry.content
              : "";
          // Skip session context injection (buildSessionContext output)
          if (text && !text.startsWith("# Session Context"))
            messages.push({ role: "user", text, rawLine, rawSource: resolved.source });
        } else if (role === "assistant") {
          const blocks = Array.isArray(entry.content) ? entry.content : [];
          const text = blocks
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text || "")
            .join("");
          const toolCalls = blocks
            .map((b: any, blockIndex: number) => ({ block: b, blockIndex }))
            .filter(({ block }: any) => block.type === "tool_use" || block.type === "toolCall")
            .map(({ block, blockIndex }: any) => ({
              id: block.id,
              tool: block.name,
              args: block.input ?? block.arguments ?? {},
              rawLine,
              rawSource: resolved.source,
              rawBlockIndex: blockIndex,
            }));
          if (text || toolCalls.length) {
            const msg: Record<string, unknown> = {
              role: "assistant",
              text,
              toolCalls,
              rawLine,
              rawSource: resolved.source,
            };
            if (entry.api) msg.api = entry.api;
            if (entry.model) msg.model = entry.model;
            if (entry.provider) msg.provider = entry.provider;
            if (entry.usage) msg.usage = entry.usage;
            if (entry.stopReason) msg.stopReason = entry.stopReason;
            if (entry.timestamp) msg.timestamp = entry.timestamp;
            if (entry.responseId) msg.responseId = entry.responseId;
            messages.push(msg);
          }
        } else if (role === "tool_result" || role === "toolresult") {
          const content = Array.isArray(entry.content)
            ? entry.content
                .map((b: any) => b.text || "")
                .join("")
                .slice(0, 2000)
            : typeof entry.content === "string"
              ? entry.content.slice(0, 2000)
              : "";
          messages.push({
            role: "tool_result",
            toolCallId: entry.toolCallId,
            toolName: entry.toolName,
            content,
            isError: entry.isError,
            timestamp: entry.timestamp,
            rawLine,
            rawSource: resolved.source,
          });
        }
      } catch {}
    }
    return { sessionId, source: resolved.source, messageCount: messages.length, messages };
  }

  function handleTranscript(sessionId: string): Response {
    const transcript = readSessionTranscript(sessionId);
    return transcript ? json(transcript) : json({ error: "Transcript not found" }, 404);
  }

  function handleRawLog(sessionId: string, url: URL): Response {
    const resolved = resolveSessionJsonl(sessionId);
    if (!resolved) return json({ error: "Transcript not found" }, 404);
    const lineNo = Number(url.searchParams.get("line") || "");
    if (!Number.isInteger(lineNo) || lineNo < 1) return json({ error: "line must be a positive integer" }, 400);
    const rawLines = readFileSync(resolved.path, "utf-8").split("\n");
    const raw = rawLines[lineNo - 1];
    if (!raw) return json({ error: "line not found" }, 404);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {}
    return json({ sessionId, source: resolved.source, line: lineNo, raw, parsed });
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

  function htmlEscape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function isInsideProjectsRoot(path: string): boolean {
    const rel = relative(PROJECTS_ROOT, path);
    return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  }

  function projectStaticPathFromUrl(pathname: string): string | null {
    const raw = pathname === "/projects" ? "" : pathname.replace(/^\/projects\/?/, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  function serveFile(path: string): Response {
    return new Response(readFileSync(path), {
      headers: {
        "Content-Type": platformUiContentTypeFor(path),
        "Cache-Control": "no-cache",
      },
    });
  }

  function serveProjectDirectory(path: string, urlPath: string): Response {
    const indexPath = join(path, "index.html");
    if (existsSync(indexPath) && statSync(indexPath).isFile()) return serveFile(indexPath);

    const normalizedUrlPath = urlPath.endsWith("/") ? urlPath : `${urlPath}/`;
    const rel = relative(PROJECTS_ROOT, path);
    const title = rel ? `/projects/${rel}` : "/projects";
    const parent = rel ? `<li><a href="${htmlEscape(normalizedUrlPath)}../">../</a></li>` : "";
    const entries = readdirSync(path)
      .map((name) => {
        const fullPath = join(path, name);
        const stat = statSync(fullPath);
        return { name, isDir: stat.isDirectory(), size: stat.size };
      })
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    const rows = entries
      .map((entry) => {
        const href = `${normalizedUrlPath}${encodeURIComponent(entry.name)}${entry.isDir ? "/" : ""}`;
        const label = `${entry.name}${entry.isDir ? "/" : ""}`;
        const meta = entry.isDir ? "dir" : `${entry.size} bytes`;
        return `<li><a href="${htmlEscape(href)}">${htmlEscape(label)}</a> <span>${htmlEscape(meta)}</span></li>`;
      })
      .join("\n");
    return new Response(
      `<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
<style>body{font:14px system-ui,sans-serif;margin:32px;line-height:1.5}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}ul{list-style:none;padding:0}li{padding:4px 0;border-bottom:1px solid #eee}span{color:#666;margin-left:12px;font-size:12px}</style>
</head><body><h1>${htmlEscape(title)}</h1><ul>${parent}${rows}</ul></body></html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      },
    );
  }

  function serveProjectStatic(pathname: string): Response {
    const relPath = projectStaticPathFromUrl(pathname);
    if (relPath === null) return new Response("Bad path", { status: 400 });
    let absPath = resolve(PROJECTS_ROOT, relPath);
    if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    if (!existsSync(absPath)) {
      const parts = relPath.split("/").filter(Boolean);
      const [name, area, ...rest] = parts;
      const appDir = appDirForName(name);
      if (appDir && area === "ui") {
        absPath = resolve(appDir, "ui", ...rest);
      } else if (appDir && area === "kanban") {
        absPath = resolve(appDir, "ui", "kanban", ...rest);
      }
      if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    }
    if (!existsSync(absPath)) return new Response("Not found", { status: 404 });
    const stat = statSync(absPath);
    if (stat.isDirectory()) return serveProjectDirectory(absPath, pathname);
    if (stat.isFile()) return serveFile(absPath);
    return new Response("Not found", { status: 404 });
  }

  function serveIndex(): Response {
    const platformUi = resolve(PLATFORM_UI_DIR, "index.html");
    if (existsSync(platformUi)) return serveFile(platformUi);
    return serveProjectStatic("/projects");
  }

  function readProjects() {
    const projects: Array<{ path: string; project: ReturnType<typeof readProject>; updatedAt: number }> = [];
    const scan = (dir: string, prefix: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const path = `${prefix}/${entry.name}`;
        const markdown = join(dir, entry.name, "project.md");
        const file = existsSync(markdown) ? markdown : join(dir, entry.name, "project.json");
        try { projects.push({ path, project: readProject(path, file), updatedAt: statSync(file).mtimeMs }); }
        catch { /* Missing or unreadable metadata is not a project record. */ }
      }
    };
    try {
      scan(PROJECTS_ROOT, "projects");
      if (existsSync(AGENTS_ROOT)) {
        for (const entry of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "shared") continue;
          scan(join(AGENTS_ROOT, entry.name, "workspace", "projects"), `agents/${entry.name}/workspace/projects`);
        }
      }
    } catch { /* Retain readable records if a discovery root becomes unavailable. */ }
    return projects;
  }

  function handleProjects(): Response {
    return json(readProjects().map(({ path, project, updatedAt }) => {
      const { content, field } = project;
      const msX = (content.match(/^- \[x\]/gim) || []).length;
      const msO = (content.match(/^- \[ \]/gm) || []).length;
      return {
        name: field("id") || project.name,
        path,
        owner: project.owner,
        status: field("status") || "unknown",
        priority: field("priority"),
        iteration: parseInt(field("iteration") || "0", 10),
        health: field("health"),
        type: field("type") || null,
        formatErrors: project.formatErrors,
        milestonesDone: msX,
        milestonesTotal: msX + msO,
        metrics: (() => {
          const mIdx = content.indexOf("## Metrics\n");
          if (mIdx === -1) return [];
          const after = content.slice(mIdx + "## Metrics\n".length);
          const ns = after.indexOf("\n## ");
          const section = (ns === -1 ? after : after.slice(0, ns)).trim();
          const ids = section
            .split("\n")
            .filter((l: string) => l.startsWith("- "))
            .map((l: string) => {
              const m = l.match(/^- `?(\S+?)`?:/);
              const t = l.match(/target\s*([<>]=?\s*)?(\d[\d.]*%?)/);
              return m ? { id: m[1].replace(/`/g, ""), target: t ? (t[1] || "") + t[2] : null } : null;
            })
            .filter(Boolean) as Array<{ id: string; target: string | null }>;
          if (ids.length === 0) return [];
          try {
            const db = _db();
            return ids.map(({ id, target }) => {
              const row = db.prepare("SELECT current, threshold, alert_op FROM metrics WHERE id = ?").get(id) as any;
              const current = row?.current ?? null;
              const threshold = row?.threshold;
              const breached =
                threshold != null && current != null && metricThresholdBreached(row);
              return { id, current, target, breached };
            });
          } catch {
            return ids.map(({ id, target }) => ({ id, current: null, target, breached: false }));
          }
        })(),
        updatedAt,
      };
    }));
  }

  function handleProjectJournal(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    const journalPath = resolve(resolveProjectDir(path), "journal.md");
    try {
      return json({ content: readFileSync(journalPath, "utf-8") });
    } catch {
      return json({ content: "(No journal found)" });
    }
  }

  function handleProjectDiscussion(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    const discPath = resolve(resolveProjectDir(path), "discussion.md");
    try {
      return json({ content: readFileSync(discPath, "utf-8") });
    } catch {
      return json({ content: "(No discussion yet)" });
    }
  }

  function handleProjectContent(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    const filePath = resolveProjectFile(path);
    try {
      const content = readFileSync(filePath, "utf-8");
      return json({ content });
    } catch {
      return json({ content: "(No project file found)" });
    }
  }

  function handleProjectArtifact(url: URL): Response {
    const path = url.searchParams.get("path");
    const file = url.searchParams.get("file");
    if (!path) return json({ error: "path required" }, 400);
    if (!file) return json({ error: "file required" }, 400);
    if (path.endsWith(".md")) return json({ error: "artifact reads require a project directory path" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    if (file.startsWith("/") || file.includes("\0") || file.split(/[\\/]+/).includes("..")) {
      return json({ error: "invalid file path" }, 400);
    }

    const projectDir = resolveProjectDir(path);
    const artifactPath = resolve(projectDir, file);
    if (artifactPath !== projectDir && !artifactPath.startsWith(`${projectDir}/`)) {
      return json({ error: "Access denied" }, 403);
    }

    try {
      const content = readFileSync(artifactPath, "utf-8");
      return json({ content });
    } catch {
      return json({ error: "Artifact not found" }, 404);
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
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    const filePath = resolveProjectFile(path);
    if (!existsSync(filePath)) return json({ error: "not found" }, 404);

    let project: ReturnType<typeof readProject>;
    let stat: { mtimeMs: number; ctimeMs: number };
    try {
      project = readProject(path, filePath);
      stat = statSync(filePath);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
    const { body, frontmatter, owner, name: projectName, projectId, projectIds } = project;
    const jsonProject = project.isJson ? project.data : null;

    // Extract common summary sections (everything until the next "##").
    const goal =
      jsonProject && typeof jsonProject.goal === "string" ? jsonProject.goal : extractMarkdownSection(body, "Goal");
    const currentState = jsonProject
      ? typeof jsonProject.currentState === "string"
        ? jsonProject.currentState
        : jsonProject.currentState && typeof jsonProject.currentState === "object" && "summary" in jsonProject.currentState
          && typeof jsonProject.currentState.summary === "string"
          ? jsonProject.currentState.summary
          : null
      : extractMarkdownSection(body, "Current State");

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
      ownedMetrics = db
        .prepare(`SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE project = ?`)
        .all(projectName) as any[];
      if (cited.size > 0) {
        const placeholders = [...cited].map(() => "?").join(",");
        citedMetricsResolved = db
          .prepare(
            `SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE id IN (${placeholders})`,
          )
          .all(...[...cited]) as any[];
      }
    } catch {
      /* tolerate missing column */
    }

    // Recent sessions for this project. Two-tier:
    //   tier 1: rows tagged with projectId (canonical)
    //   tier 2: rows whose task mentions the project name (best-effort)
    const recentSessions: Array<Record<string, unknown>> = [];
    let sessionCount = 0;
    let mentionCount = 0;
    try {
      const tagged = db
        .prepare(
          `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE projectId IN (${projectIds.map(() => "?").join(",")}) ORDER BY startedAt DESC LIMIT 10`,
        )
        .all(...projectIds) as any[];
      for (const r of tagged) recentSessions.push({ ...r, link: "tagged" });
      const cnt = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE projectId IN (${projectIds.map(() => "?").join(",")})`).get(...projectIds) as any;
      sessionCount = cnt?.c ?? 0;
      // Tier 2 — only if tagged is short.
      if (tagged.length < 10 && projectName.length >= 6) {
        const seen = new Set(tagged.map((t) => t.sessionId));
        const mentions = db
          .prepare(
            `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ? ORDER BY startedAt DESC LIMIT 10`,
          )
          .all(`%${projectName}%`) as any[];
        for (const r of mentions) {
          if (!seen.has(r.sessionId)) recentSessions.push({ ...r, link: "mention" });
        }
        const mcnt = db
          .prepare(`SELECT COUNT(*) as c FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ?`)
          .get(`%${projectName}%`) as any;
        mentionCount = mcnt?.c ?? 0;
      }
    } catch {
      /* skip */
    }

    return json({
      path,
      name: projectName,
      owner,
      projectId,
      frontmatter,
      status: project.field("status"),
      iteration: Number(project.field("iteration") || 0),
      priority: project.field("priority"),
      type: project.field("type"),
      workflow: project.field("workflow"),
      goal,
      currentState,
      milestonesTotal,
      milestonesDone,
      citedMetrics: [...cited],
      ownedMetrics,
      citedMetricsResolved,
      sessionCount,
      mentionCount,
      recentSessions,
      app: (() => {
        const appDir = appDirForPath(path);
        if (!appDir) return null;
        return {
          appId: projectAppId(path, appDir),
          appDirName: appDir.split("/").pop(),
          hasUi: existsSync(resolve(appDir, "ui", "index.html")),
        };
      })(),
      updatedAt: stat ? Math.floor(stat.mtimeMs) : null,
      createdAt: stat ? Math.floor(stat.ctimeMs) : null,
    });
  }

  function handleProjectSessions(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    // Canonical projectId is owner/name, even for shared path.
    let project: Pick<ReturnType<typeof projectPathIdentity>, "name" | "projectIds">;
    try { project = readProject(path); }
    catch { project = projectPathIdentity(path); }
    const { name, projectIds } = project;

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
      const tagged = db
        .prepare(
          `SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE projectId IN (${projectIds.map(() => "?").join(",")}) ORDER BY startedAt DESC LIMIT 50`,
        )
        .all(...projectIds) as any[];
      for (const r of tagged) sessions.push({ ...r, link: "tagged" });
      // Tier 2: only if tagged is short, look for task mentions. Cap the
      // scan so big DBs don't get slow; project names are typically distinctive
      // (e.g. 'evaluator-low-quality-rate-calibration') so LIKE %name% is safe.
      if (tagged.length < 20 && name.length >= 6) {
        const seen = new Set(tagged.map((t) => t.sessionId));
        const mentions = db
          .prepare(
            "SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ? ORDER BY startedAt DESC LIMIT 30",
          )
          .all(`%${name}%`) as any[];
        for (const r of mentions) {
          if (!seen.has(r.sessionId)) sessions.push({ ...r, link: "mention" });
        }
      }
    } catch {
      /* projectId column may not exist */
    }

    if (sessions.length > 0) return json(sessions);

    // Final fallback: scan workflow run files (legacy path).
    const searchPaths = [path, path.replace(/^agents\//, "")];
    for (const dir of [join(STATE_DIR, "workflow-runs"), join(STATE_DIR, "workflows")]) {
      try {
        for (const f of readdirSync(dir)) {
          try {
            const run = JSON.parse(readFileSync(join(dir, f), "utf-8"));
            if (searchPaths.some((sp) => run.task?.includes(sp))) {
              for (const step of run.steps ?? []) {
                if (step.sessionId)
                  sessions.push({
                    sessionId: step.sessionId,
                    agent: step.agent,
                    status: step.status,
                    startedAt: step.startedAt,
                    task: step.task?.slice(0, 80),
                    link: "workflow-file",
                  });
              }
            }
          } catch {
            /* skip corrupted files */
          }
        }
      } catch {
        /* dir may not exist */
      }
    }
    return json(sessions);
  }

  async function handleProjectComment(req: Request): Promise<Response> {
    try {
      const body = (await req.json()) as {
        path?: string;
        projectId?: string;
        comment?: string;
        idempotencyKey?: string;
      };
      const path = body.path ?? (body.projectId ? `projects/${body.projectId.replace(/\.app$/, "")}` : undefined);
      const { comment } = body;
      if (!path || !comment) return json({ error: "path and comment required" }, 400);
      if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);

      const projectFile = resolveProjectFile(path);
      if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);
      const identity = readProjectIngressIdentity(path, projectFile);
      const projectId = projectEventTargetForPath(path, identity.projectId);
      const idempotencyKey = body.idempotencyKey?.trim() || `web-project-${randomUUID()}`;
      const command = buildAppAdmissionCommand({ projectPath: path, projectId, comment, idempotencyKey });
      try {
        const admitted = await sendAppInputWithRetry(conventionSocketPath(), command, sendSocketCommand, (key) => {
          const eventId = findEventPublication(
            _db(),
            {
              type: "app.input.requested",
              target: { appId: projectId },
              idempotencyKey: key,
              data: {
                input: command.input,
                conversationId: command.conversationId,
                channel: command.channel,
              },
            },
            { source: "control-socket", inputSource: { kind: "human", id: `web-ui:${key}` } },
          );
          return eventId ? { eventId, eventType: "app.input.requested" } : undefined;
        });
        return json(
          {
            ok: true,
            triggered: true,
            eventType: String(admitted.eventType ?? "app.input.requested"),
            eventId: Number(admitted.eventId) || undefined,
            projectId,
          },
          202,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, triggered: false, error: message }, 503);
      }
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  async function handleProjectActions(projectIdText: string): Promise<Response> {
    const projectId = decodeURIComponent(projectIdText)
      .trim()
      .replace(/\.app$/, "");
    if (!projectId) return json({ error: "projectId required" }, 400);
    try {
      const response = await sendSocketCommand(
        conventionSocketPath(),
        { type: "project.actions.describe", projectId },
        { timeoutMs: 2000 },
      );
      return json({ projectId, actions: Array.isArray(response.actions) ? response.actions : [] });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
  }

  function handleAppInbox(url: URL): Response {
    try {
      const items = listAppInboxItems(_db(), appInboxQueryFromUrl(url));
      return json({ items, count: items.length });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  function handleAppInboxHealth(url: URL): Response {
    try {
      const appId = url.searchParams.get("appId") || undefined;
      const generatedAt = Date.now();
      return json({ apps: listAppInboxHealth(_db(), { appId, now: generatedAt }), generatedAt });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  }

  function handleAppInboxItem(itemIdText: string): Response {
    const itemId = decodeURIComponent(itemIdText).trim();
    if (!itemId) return json({ error: "App inbox item id required" }, 400);
    const item = getAppInboxItem(_db(), itemId);
    return item ? json(item) : json({ error: `App inbox item not found: ${itemId}` }, 404);
  }

  async function handleProjectActionInvoke(
    req: Request,
    projectIdText: string,
    actionIdText: string,
  ): Promise<Response> {
    const projectId = decodeURIComponent(projectIdText)
      .trim()
      .replace(/\.app$/, "");
    const actionId = decodeURIComponent(actionIdText).trim();
    if (!projectId || !actionId) return json({ error: "projectId and actionId required" }, 400);
    try {
      const body = (await req.json().catch(() => ({}))) as {
        input?: unknown;
        params?: unknown;
        idempotencyKey?: string;
      };
      const idempotencyKey = body.idempotencyKey?.trim() || `web-action-${randomUUID()}`;
      const response = await sendProjectActionWithRetry(
        conventionSocketPath(),
        {
          type: "project.action.invoke",
          projectId,
          actionId,
          params: body.input ?? body.params ?? {},
          idempotencyKey,
        },
        sendSocketCommand,
        (key) => {
          const row = _db()
            .prepare(
              `SELECT id, event_type
               FROM events
               WHERE idempotency_key = ? AND project_id = ?
               ORDER BY id
               LIMIT 1`,
            )
            .get(key, projectId) as { id?: unknown; event_type?: unknown } | undefined;
          const eventId = Number(row?.id);
          const eventType = typeof row?.event_type === "string" ? row.event_type : "";
          return Number.isInteger(eventId) && eventId > 0 && eventType ? { eventId, eventType } : undefined;
        },
      );
      return json(
        {
          projectId,
          actionId,
          eventId: response.eventId,
          eventType: response.eventType,
        },
        202,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.startsWith("Invalid input") ? 400 : 503;
      return json({ error: message }, status);
    }
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

  function handleEventGraph(_url: URL, eventIdText: string): Response {
    const eventId = Number(eventIdText);
    if (!Number.isFinite(eventId)) return json({ error: "event id must be numeric" }, 400);
    let graph = buildEventGraph(_db(), eventId);
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

  const { handleApps, handleConversationRead, handleHumanTaskRead, handleAppTasks, handleAppTask } =
    createTaskReadHandlers({ daemonRead, json });
  const handleTaskTranscript = createTaskTranscriptHandler({ daemonRead, json, stateDir: STATE_DIR });
  function confirmTaskInput(
    command: TaskInputCommand,
  ): { eventId: number; eventType: string; delivery: "accepted" } | undefined {
    const db = _db();
    const eventId = findEventPublication(
      db,
      {
        type: "app.input.requested",
        target: { appId: String(command.appId) },
        idempotencyKey: command.idempotencyKey,
        data: { input: command.input, targetTaskId: command.targetTaskId, channel: command.channel },
      },
      { source: "control-socket", inputSource: command.source },
    );
    if (!eventId || getEventView(db, eventId)?.delivery.state !== "accepted") return undefined;
    return { eventId, eventType: "app.input.requested", delivery: "accepted" };
  }
  const handleTaskInput = createTaskInputHandler({
    daemonRead,
    json,
    confirm: confirmTaskInput,
    admit: async (command) => {
      const response = await sendAppInputWithRetry(
        conventionSocketPath(), command, sendSocketCommand, () => confirmTaskInput(command),
      );
      return response as unknown as Record<string, unknown>;
    },
  });

  async function handleSessionCancel(sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const result = await sendDaemonFrame(buildPublishFrame("session.cancel.requested", {}, { target: { sessionId } }));
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId });
  }

  async function handleSessionMessage(req: Request, sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    let body: { content?: string };
    try {
      body = (await req.json()) as { content?: string };
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    // The daemon validates ownership and steers only live sessions.
    // New work for an ended execution must go through its owning Task.
    const result = await sendDaemonFrame(
      buildPublishFrame("session.steer.requested", { message: content, channel: "web-ui" }, { target: { sessionId } }),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId, deliveredAt: Date.now() });
  }

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

      // 1. Discover agents from agents/ filesystem AND project-local agents (source of truth: agent.json).
      const agents: Array<Record<string, unknown>> = [];
      const seenAgentNames = new Set<string>();

      for (const entry of listRuntimeAgentDirectories(AGENTS_ROOT, PROJECTS_ROOT)) {
        let cfg: Record<string, any>;
        try { cfg = JSON.parse(readFileSync(join(entry.dir, "agent.json"), "utf8")); }
        catch { continue; }
        if (cfg.disabled) continue;
        const name = cfg.name || entry.name;
        if (seenAgentNames.has(name)) continue;
        seenAgentNames.add(name);
        agents.push({ name, description: cfg.description || "", domain: cfg.domain || "",
          model: cfg.model || "", toolCount: Array.isArray(cfg.tools) ? cfg.tools.length : 0 });
      }

      // 2. Per-agent session/metric rollups (single query each, indexed on agent).
      for (const a of agents) {
        const name = a.name as string;

        // Sessions in 4h, partitioned into heartbeat vs other.
        const sess4h = db
          .prepare(
            `
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN ${HEARTBEAT_SESSION_PREDICATE} THEN 1 ELSE 0 END) as heartbeats,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND startedAt >= ?
        `,
          )
          .get(name, fourHourAgo) as any;
        a.sessions4h = sess4h?.total ?? 0;
        a.heartbeats4h = sess4h?.heartbeats ?? 0;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = sess4h?.errors ?? 0;

        // Sessions in 24h (for context).
        const sess24h =
          (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)
            ?.c ?? 0;
        a.sessions24h = sess24h;

        // Owned metrics + breaches.
        const mets = db
          .prepare(
            `
          SELECT id, current, threshold, alert_op FROM metrics WHERE owner = ?
        `,
          )
          .all(name) as Array<{
          id: string;
          current: number | null;
          threshold: number | null;
          alert_op: string | null;
        }>;
        a.metricCount = mets.length;
        a.metricBreached = mets.filter((m) => {
          if (m.threshold == null || m.current == null) return false;
          return metricThresholdBreached({ current: m.current, threshold: m.threshold, alert_op: m.alert_op });
        }).length;
      }

      // 3. Count the same metadata records shown by the Projects page.
      const projByOwner: Record<string, { active: number; total: number }> = {};
      const hidden = new Set(["done", "complete", "closed", "waiting", "blocked", "paused"]);
      for (const { project } of readProjects()) {
        const owner = project.owner.replace(/^agent:/, "");
        const counts = projByOwner[owner] ??= { active: 0, total: 0 };
        counts.total += 1;
        if (!hidden.has(project.field("status") ?? "unknown")) counts.active += 1;
      }
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
   *   1. shared/common-sense.md         (shared defaults, every agent)
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
    // Includes commonly-named convention files; agent decides when to read them.
    const otherCandidates = ["DOMAIN.md", "heartbeat.md", "context.md", "TOOLS.md", "LESSONS.md"];
    for (const f of otherCandidates) {
      const file = readFile(join(agentDir, f), f, "on-disk only");
      if (file) otherFiles.push(file);
    }

    return json({ name: agentName, agentJson, promptFiles, otherFiles });
  }

  function handleAgentDefaultSession(agentName: string, requestId?: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    if (requestId !== undefined && (!requestId || requestId.length > 256))
      return json({ error: "invalid requestId" }, 400);
    try {
      const db = _db();
      // Resolve the agent's chat session — only human-initiated conversations,
      // not workflows, heartbeats, or fork-spawned task sessions.
      const row = db
        .prepare(
          `
        SELECT sessionId, status, startedAt, kind, requestId, substr(task, 1, 200) as task
        FROM sessions
        WHERE agent = ?
          AND (kind = 'chat' OR (? IS NULL AND source IN ('telegram', 'web-ui', 'web', 'cli')))
          AND (? IS NULL OR requestId = ?)
        ORDER BY startedAt DESC
        LIMIT 1
      `,
        )
        .get(agentName, requestId ?? null, requestId ?? null, requestId ?? null) as
        | {
            sessionId: string;
            status: string;
            startedAt: number;
            kind: string | null;
            requestId: string | null;
            task: string;
          }
        | undefined;
      if (!row) return json({ agent: agentName, sessionId: null });
      return json({
        agent: agentName,
        sessionId: row.sessionId,
        status: row.status,
        startedAt: row.startedAt,
        kind: row.kind,
        requestId: row.requestId,
        task: row.task,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  /**
   * Interface-agent input always uses the installation's Conversation binding.
   * Other agents keep direct session chat:
   *   1. resolve default session (most-recent non-throwaway)
   *   2. if a session exists, forward to /api/sessions/:id/message which
   *      uses the existing steering admission policy; ended attempts do not resume.
   *   3. if no session exists yet, spawn a fresh one with the message as
   *      the task. Admission precedes creation; a supplied requestId selects
   *      the exact chat through the request-scoped default-session read.
   *
   * The response is {ok:true, sessionId, deliveredAt}, with requestId on a
   * correlated fresh-chat admission. A lookup failure cannot start new work.
   */
  async function handleAgentMessage(req: Request, agentName: string, url?: URL): Promise<Response> {
    if (!agentName) return json({ error: "agent required" }, 400);
    let body: { content?: string; requestId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    if (
      body.requestId !== undefined &&
      (typeof body.requestId !== "string" || !body.requestId.trim() || body.requestId.length > 256)
    ) {
      return json({ error: "invalid requestId" }, 400);
    }
    const requestId = body.requestId?.trim();
    const forceNew = url?.searchParams.get("new") === "true";

    if (agentName === humanInterface.agent) {
      if (!humanInterface.appId) return json({ error: "No Conversation App is configured" }, 503);
      const result = await sendDaemonFrame(buildPublishFrame(
        "app.input.requested",
        {
          input: { kind: "message", data: { message: content, context: { forceNew } } },
          channel: "web-ui",
          conversationId: humanInterface.conversationId,
        },
        { target: { appId: humanInterface.appId } },
      ));
      if (!result.ok) return json({ error: result.error }, 503);
      return json({ ok: true, agent: agentName, sessionId: null, deliveredAt: Date.now(), spawned: true });
    }

    // Recover the immutable publication before resolving a mutable default.
    // Accepted steering stays confirmed even if that session has since ended.
    if (requestId) {
      let saved;
      try {
        saved = readChatPublication(_db(), { agent: agentName, content, requestId, forceNew });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, error instanceof ChatPublicationConflict ? 409 : 500);
      }
      if (saved) {
        if (!saved.accepted) {
          const result = await sendDaemonFrame({ type: "publish", event: saved.input });
          if (!result.ok) return json({ error: result.error }, 503);
        }
        return json({ ok: true, agent: agentName, sessionId: saved.input.target?.sessionId ?? null,
          deliveredAt: Date.now(), spawned: saved.input.type === "chat.start.requested", requestId });
      }
    }
    // A session alone cannot reconstruct the original publication after its
    // event has disappeared. Report missing evidence instead of starting again.
    if (requestId) {
      const correlated = handleAgentDefaultSession(agentName, requestId);
      if (!correlated.ok) return correlated;
      if ((await correlated.json()).sessionId) return json({ error: "Original chat publication unavailable" }, 500);
    }
    if (!forceNew) {
      const resolveResp = handleAgentDefaultSession(agentName);
      if (!resolveResp.ok) return resolveResp;
      const resolved = (await resolveResp.json()) as { agent: string; sessionId: string | null };
      if (resolved.sessionId) {
        const result = await sendDaemonFrame(
          buildPublishFrame(
            "session.steer.requested",
            { message: content, channel: "web-ui" },
            { target: { sessionId: resolved.sessionId }, idempotencyKey: requestId },
          ),
        );
        if (!result.ok) return json({ error: result.error }, 503);
        return json({
          ok: true,
          agent: agentName,
          sessionId: resolved.sessionId,
          deliveredAt: Date.now(),
          spawned: false,
        });
      }
    }

    // No prior session — request a create-or-bind chat start from the daemon.
    const result = await sendDaemonFrame(
      buildPublishFrame(
        "chat.start.requested",
        {
          agent: agentName,
          message: content,
          channel: "web-ui",
          forceNew,
          ...(requestId ? { requestId } : {}),
        },
        { idempotencyKey: requestId },
      ),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({
      ok: true,
      agent: agentName,
      sessionId: null,
      deliveredAt: Date.now(),
      spawned: true,
      ...(requestId ? { requestId } : {}),
    });
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
      if (url.pathname === "/api/projects/journal") return handleProjectJournal(url);
      if (url.pathname === "/api/projects/discussion") return handleProjectDiscussion(url);
      if (url.pathname === "/api/projects/sessions") return handleProjectSessions(url);
      if (url.pathname === "/api/projects/comment" && req.method === "POST") return handleProjectComment(req);
      if (url.pathname === "/api/app-inbox" && req.method === "GET") return handleAppInbox(url);
      if (url.pathname === "/api/app-inbox/health" && req.method === "GET") return handleAppInboxHealth(url);
      const appInboxItemMatch = url.pathname.match(/^\/api\/app-inbox\/([^/]+)$/);
      if (appInboxItemMatch && req.method === "GET") return handleAppInboxItem(appInboxItemMatch[1]);
      const projectActionInvokeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/actions\/([^/]+)$/);
      if (projectActionInvokeMatch && req.method === "POST") {
        return handleProjectActionInvoke(req, projectActionInvokeMatch[1], projectActionInvokeMatch[2]);
      }
      const projectActionsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/actions$/);
      if (projectActionsMatch && req.method === "GET") return handleProjectActions(projectActionsMatch[1]);
      if (url.pathname === "/api/events/delivery-health") return handleEventDeliveryHealth(url);
      const eventGraphMatch = url.pathname.match(/^\/api\/events\/(\d+)\/graph$/);
      if (eventGraphMatch) return handleEventGraph(url, eventGraphMatch[1]);
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
      const evalMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/eval$/);
      if (evalMatch && req.method === "GET") return handleSessionEval(evalMatch[1]);

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
