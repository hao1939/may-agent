#!/usr/bin/env bun
import { readWorkflowFacts } from "../../lib/workflow-facts.js";
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
  }): { port: number; stop(closeActiveConnections?: boolean): void };
};
import { randomUUID } from "node:crypto";
import { createAgentRouteHandlers } from "./agent-routes.js";
import { createEventRouteHandlers } from "./event-routes.js";
import { createMetricAndKnowledgeRouteHandlers } from "./metric-knowledge-routes.js";
import { createProjectRouteHandlers, type ConfirmDurableControl } from "./project-routes.js";
import { createSessionRouteHandlers } from "./session-routes.js";
import { createTaskReadHandlers } from "./task-read-routes.js";
import { createTaskInputHandler, type TaskInputCommand } from "./task-input.js";
import { createTaskTranscriptHandler } from "./task-transcript.js";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import type { Duplex } from "node:stream";
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
export { normalizeProjectPathForCompare } from "./project-metadata.js";
export { buildAppAdmissionCommand, extractMarkdownSection, projectEventTargetForPath } from "./project-routes.js";
import { openStateDb, type SqliteDb } from "./read-model/state-db.js";
import { healthWindow, readWorkflowHealth, workflowHealthQuery } from "../adapters/reporting/workflow-health.js";
import { contextUsageQuery, readContextUsage } from "../adapters/reporting/context-usage.js";
import { readMetricHistory } from "../adapters/reporting/metric-observations.js";
import type { EventInput } from "@may-agent/control/events";
import { findEventPublication, getEventView, type EventInterface } from "../core/events/interface.js";
import type { HumanTaskPage, HumanTaskView } from "../human-task-service.js";
import type { AppConversationResource } from "@may-agent/sdk/app";
import { createDaemonWebSocketTransport } from "../transport/websocket.js";

// ── Public API ───────────────────────────────────────────────────────────

export type DaemonHttpServices = {
  events: EventInterface;
  getStatus(): unknown;
  getAppConversation(appId: string, conversationId: string, options?: { limit?: number }): AppConversationResource;
  listApps(appId?: string): unknown[];
  listTasks(options?: Record<string, unknown>): HumanTaskPage;
  getTask(input: Record<string, unknown>): HumanTaskView | null;
};

export interface WebUIOptions {
  interface?: InterfaceBinding;
  stateDir: string;
  port: number;
  hostname?: string;
  /** Present in the daemon. Omitted only by the bounded standalone compatibility server. */
  services?: DaemonHttpServices;
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
  const operatorId =
    typeof body.operatorId === "string"
      ? body.operatorId
      : typeof data.operatorId === "string"
        ? data.operatorId
        : undefined;
  const authorizationReference =
    typeof body.authorizationReference === "string"
      ? body.authorizationReference
      : typeof data.authorizationReference === "string"
        ? data.authorizationReference
        : undefined;
  const authorizationEvidenceValue = body.authorizationEvidence ?? data.authorizationEvidence;
  const authorizationEvidence =
    authorizationEvidenceValue &&
    typeof authorizationEvidenceValue === "object" &&
    !Array.isArray(authorizationEvidenceValue)
      ? authorizationEvidenceValue
      : undefined;
  delete data.idempotencyKey;
  delete data.operatorId;
  delete data.authorizationReference;
  delete data.authorizationEvidence;
  return {
    ...buildPublishFrame(String(envelope.type), data, {
      ...(Object.values(target).some(Boolean) ? { target } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    }),
    ...(operatorId ? { operatorId } : {}),
    ...(authorizationReference ? { authorizationReference } : {}),
    ...(authorizationEvidence ? { authorizationEvidence } : {}),
  };
}

export async function sendDaemonFrameWithRetry(
  socketPath: string,
  frame: Record<string, unknown>,
  send: typeof sendDaemonEvent = sendDaemonEvent,
  confirm?: (
    idempotencyKey: string,
    frame: Record<string, unknown>,
  ) => number | undefined | Promise<number | undefined>,
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

type RetrySafeControlCommand = Record<string, unknown> & {
  type: string;
  idempotencyKey?: string;
  event?: { idempotencyKey?: string; [key: string]: unknown };
};

async function sendRetrySafeControlCommand(
  endpoint: SocketEndpoint,
  command: RetrySafeControlCommand,
  send: typeof sendSocketCommand,
  confirm: ConfirmDurableControl | undefined,
  exhaustedMessage: string,
): Promise<SocketResponse> {
  const idempotencyKey = command.idempotencyKey ?? command.event?.idempotencyKey ?? "";
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
      const durable = idempotencyKey ? await confirm?.(idempotencyKey) : undefined;
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

export async function sendAppInputWithRetry(
  endpoint: SocketEndpoint,
  command: RetrySafeControlCommand,
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
  const hasSurface = last === "tasks";
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

export function startWebUI(opts: WebUIOptions): { port: number; stop(closeActiveConnections?: boolean): void } {
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
  const services = opts.services;

  function _db(): SqliteDb {
    return openStateDb(join(STATE_DIR, "may.db"));
  }

  function conventionSocketPath(): string {
    return daemonSocketPath(STATE_DIR, {
      instance: DAEMON_INSTANCE,
      interfaceAgent: DAEMON_AGENT,
    });
  }

  async function handleReadiness(): Promise<Response> {
    if (services) return json({ ready: true, checkedAt: Date.now(), transport: "in-process" });
    const readiness = await probeDaemonReadiness(conventionSocketPath());
    return json(readiness, readiness.ready ? 200 : 503);
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
    if (services && frame.type === "publish" && frame.event && typeof frame.event === "object") {
      try {
        const event = frame.event as EventInput;
        const approvalAuthorization =
          (event.type === "project.approval.submitted" ||
            (event.type === "conversation.message.created" && frame.operatorId && event.data.approvalReply))
            ? {
                actor: { kind: "operator" as const, id: String(frame.operatorId).trim() },
                reference: typeof frame.authorizationReference === "string" ? frame.authorizationReference.trim() : "",
                evidence:
                  frame.authorizationEvidence &&
                  typeof frame.authorizationEvidence === "object" &&
                  !Array.isArray(frame.authorizationEvidence)
                    ? (frame.authorizationEvidence as Record<string, unknown>)
                    : {},
              }
            : undefined;
        const receipt = services.events.publish(event, {
          source: "web-ui",
          inputSource: { kind: "human", id: "web-ui" },
          ...(approvalAuthorization ? { approvalAuthorization } : {}),
        });
        return { ok: true, ...receipt };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    const socketPath = conventionSocketPath();
    return sendDaemonFrameWithRetry(socketPath, frame, sendDaemonEvent, (_key, durableFrame) => {
      if (durableFrame.type !== "publish") return undefined;
      return findEventPublication(_db(), durableFrame.event as EventInput, { source: "control-socket" });
    });
  }

  async function daemonRead(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (services) {
      try {
        switch (frame.type) {
          case "status":
            return { type: "status", command: "status", status: services.getStatus() };
          case "apps.list":
            return {
              type: "ok",
              command: frame.type,
              apps: services.listApps(typeof frame.appId === "string" ? frame.appId : undefined),
            };
          case "app.conversation.get":
            return {
              type: "ok",
              command: frame.type,
              conversation: services.getAppConversation(String(frame.appId), String(frame.conversationId), {
                limit: typeof frame.limit === "number" ? frame.limit : 30,
              }),
            };
          case "tasks.list":
            return { type: "ok", command: frame.type, tasks: services.listTasks(frame) };
          case "task.get":
            return { type: "ok", command: frame.type, task: services.getTask(frame) };
          default:
            return { type: "error", command: String(frame.type ?? "read"), message: "Unsupported direct read" };
        }
      } catch (error) {
        return {
          type: "error",
          command: String(frame.type ?? "read"),
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }
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
    const event = { type: "app.input.requested", target: { appId }, idempotencyKey, data } as const;
    // Receipt identity includes transport provenance. Direct daemon HTTP writes
    // use web-ui; the standalone compatibility binding historically used the
    // control socket. Check only those exact owners so accepted requests from
    // either path remain replayable after the Task changes or closes.
    const sources = services ? ["web-ui", "control-socket"] : ["control-socket"];
    for (const source of sources) {
      const eventId = findEventPublication(db, event, { source, inputSource });
      if (eventId && getEventView(db, eventId)?.delivery.state === "accepted")
        return { eventId, eventType: "app.input.requested", delivery: "accepted" };
    }
    return undefined;
  }
  const { handleApps, handleConversationRead, handleHumanTaskRead } = createTaskReadHandlers({ daemonRead, json });
  const handleTaskTranscript = createTaskTranscriptHandler({ daemonRead, json, stateDir: STATE_DIR });
  const confirmTaskInput = (command: TaskInputCommand) => {
    const data = {
      input: command.event.data.input,
      targetTaskId: command.event.data.targetTaskId,
      channel: command.event.data.channel,
    };
    const confirm = (data: Record<string, unknown>) =>
      confirmAcceptedAppInput(
        command.event.target.appId,
        command.event.idempotencyKey,
        data,
        command.event.data.source,
      );
    // The old envelope still includes the exact generation in domain context.
    // Only confirm an accepted receipt; never publish new unfenced input.
    return confirm({ ...data, targetTaskGeneration: command.event.data.targetTaskGeneration }) ?? confirm(data);
  };
  const handleTaskInput = createTaskInputHandler({
    daemonRead,
    json,
    confirm: confirmTaskInput,
    admit: async (command) => {
      if (services) {
        const receipt = services.events.publish(command.event, {
          source: "web-ui",
          inputSource: command.event.data.source,
        });
        return { type: "ok", command: "publish", ...receipt };
      }
      return (await sendAppInputWithRetry(conventionSocketPath(), command, sendSocketCommand, () =>
        confirmTaskInput(command),
      )) as unknown as Record<string, unknown>;
    },
  });
  const { handleSession, handleTranscript, handleRawLog, handleSessionCancel, handleSessionMessage } =
    createSessionRouteHandlers({
      stateDir: STATE_DIR,
      getDb: _db,
      json,
      sendDaemonFrame,
      buildPublishFrame,
    });
  const {
    isAllowedProjectPath,
    resolveProjectFile,
    serveProjectStatic,
    readProjects,
    handleProjects,
    handleProjectContent,
    handleProjectDetail,
    handleProjectSessions,
    handleProjectComment,
  } = createProjectRouteHandlers({
    projectRoot: PROJECT_ROOT,
    agentsRoot: AGENTS_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    conventionSocketPath,
    platformUiContentTypeFor,
    sendAppInputWithRetry,
    confirmAcceptedAppInput,
  });
  const { handleAgents, handleAgentAbout, handleAgentDefaultSession, handleAgentMessage } = createAgentRouteHandlers({
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
  const { handleLiveness, handleMetrics, handleBrowse, handleKnowledgeSearch, handleAlertResolve } =
    createMetricAndKnowledgeRouteHandlers({
      agentsRoot: AGENTS_ROOT,
      sharedRoot: SHARED_ROOT,
      projectsRoot: PROJECTS_ROOT,
      getDb: _db,
      json,
      sendDaemonFrame,
      buildPublishFrame,
    });
  const { handleEvents, handleEventDeliveryHealth, handleEventIngress, handleEventView } = createEventRouteHandlers({
    getDb: _db,
    json,
    isAllowedProjectPath,
    resolveProjectFile,
    sendDaemonFrame,
    buildEventIngressFrame,
  });

  // ── WebSocket wakes ──────────────────────────────────────────────────

  const wsToUnix = new Map<any, Duplex>();
  const directWebSocket = services
    ? createDaemonWebSocketTransport({ events: services.events, agent: DAEMON_AGENT, instance: DAEMON_INSTANCE })
    : null;

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
          if (event.type === "ok" && event.command === "subscribe") {
            ws.send(JSON.stringify({ type: "subscribed" }));
            continue;
          }
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

  // ── Server ───────────────────────────────────────────────────────────

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
      if (defaultSessionMatch)
        return handleAgentDefaultSession(defaultSessionMatch[1], url.searchParams.get("requestId")?.trim());
      const aboutMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/about$/);
      if (aboutMatch) return handleAgentAbout(aboutMatch[1]);
      if (url.pathname === "/api/browse") return handleBrowse(url);
      if (url.pathname === "/api/knowledge/search") return handleKnowledgeSearch(url);
      if (url.pathname === "/api/metrics") return handleMetrics(url);
      if (url.pathname === "/api/context-usage") {
        let query: ReturnType<typeof contextUsageQuery>;
        try {
          query = contextUsageQuery(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid usage filter" }, 400);
        }
        return json(readContextUsage(_db(), query));
      }
      if (url.pathname === "/api/task-attempts") {
        if (req.method !== "GET") return json({ error: "GET required" }, 405);
        let query: ReturnType<typeof taskAttemptsQuery>;
        try {
          query = taskAttemptsQuery(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid attempt filter" }, 400);
        }
        return json(readTaskAttempts(_db(), query));
      }
      const workflowFactsMatch = url.pathname.match(/^\/api\/workflow-runs\/([^/]+)$/);
      if (workflowFactsMatch && req.method === "GET") {
        let workflowRunId: string;
        try {
          workflowRunId = decodeURIComponent(workflowFactsMatch[1]);
        } catch {
          return json({ error: "Invalid workflowRunId" }, 400);
        }
        return json({ workflowRunId, workflowFacts: readWorkflowFacts(STATE_DIR, workflowRunId) });
      }
      if (url.pathname === "/api/workflow-health") {
        let query: ReturnType<typeof workflowHealthQuery>;
        try {
          query = workflowHealthQuery(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid workflow filter" }, 400);
        }
        return json(readWorkflowHealth(_db(), query));
      }
      if (url.pathname === "/api/projects") return handleProjects();
      if (url.pathname === "/api/apps")
        return req.method === "GET" ? handleApps(url) : json({ error: "GET required" }, 405);
      if (url.pathname === "/api/projects/content") return handleProjectContent(url);
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
      if (url.pathname === "/api/events/delivery-health") return handleEventDeliveryHealth(url);
      const eventViewMatch = url.pathname.match(/^\/api\/events\/(\d+)$/);
      if (eventViewMatch && req.method === "GET") return handleEventView(eventViewMatch[1]);
      if (url.pathname === "/api/events" && req.method === "POST") return handleEventIngress(req);
      if (url.pathname === "/api/events") return handleEvents(url);
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
        try {
          window = healthWindow(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid history window" }, 400);
        }
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
        const alertResolveMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)\/resolve$/);
        if (alertResolveMatch) return handleAlertResolve(req, alertResolveMatch[1]);
      }

      const platformUiResponse = servePlatformUiRequest(req, PLATFORM_UI_DIR);
      if (platformUiResponse) return platformUiResponse;
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html"))
        return serveProjectStatic("/projects");
      if (req.method === "GET" && (url.pathname === "/projects" || url.pathname.startsWith("/projects/")))
        return serveProjectStatic(url.pathname);
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws: any) {
        if (directWebSocket) directWebSocket.open(ws);
        else proxyWebSocket(ws);
      },
      message(ws: any, msg: any) {
        if (directWebSocket) directWebSocket.message(ws, msg);
        else {
          const unix = wsToUnix.get(ws);
          if (unix && typeof msg === "string" && msg.trim()) unix.write(msg.trim() + "\n");
        }
      },
      close(ws: any) {
        directWebSocket?.close(ws);
        const unix = wsToUnix.get(ws);
        if (unix) {
          unix.destroy();
          wsToUnix.delete(ws);
        }
      },
    },
  });

  return { port: server.port, stop: (closeActiveConnections = false) => server.stop(closeActiveConnections) };
}

// ── Standalone mode ──────────────────────────────────────────────────────

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
