#!/usr/bin/env bun
import { readWorkflowFacts } from "../../lib/workflow-facts.js";
import { interfaceBinding, type InterfaceBinding } from "@may-agent/control";
import { taskAttemptsQuery, readTaskAttempts } from "../adapters/reporting/task-attempts.js";
import { metricEvidenceQuery, readMetricEvidence } from "../adapters/reporting/metric-evidence.js";
/**
 * may-agent HTTP adapter — API, static WebUI, and dashboard websocket.
 *
 * Created by the daemon with its owning read and admission services.
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
import { createAgentRouteHandlers } from "./agent-routes.js";
import { createEventRouteHandlers } from "./event-routes.js";
import { createMetricAndKnowledgeRouteHandlers } from "./metric-knowledge-routes.js";
import {
  createProjectRouteHandlers,
} from "./project-routes.js";
import { createSessionRouteHandlers } from "./session-routes.js";
import { createTaskReadHandlers } from "./task-read-routes.js";
import { createTaskInputHandler, type TaskInputCommand } from "./task-input.js";
import { createTaskTranscriptHandler } from "./task-transcript.js";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { buildCanonicalEventEnvelope } from "../../../packages/control/src/event-envelope.js";
export { normalizeProjectPathForCompare } from "./project-metadata.js";
export { extractMarkdownSection, projectEventTargetForPath } from "./project-routes.js";
import { openStateDb, type SqliteDb } from "./read-model/state-db.js";
import { healthWindow, readWorkflowHealth, workflowHealthQuery } from "../adapters/reporting/workflow-health.js";
import { contextUsageQuery, readContextUsage } from "../adapters/reporting/context-usage.js";
import { observabilitySummaryQuery, readObservabilitySummary } from "../adapters/reporting/observability-summary.js";
import { readMetricHistory } from "../adapters/reporting/metric-observations.js";
import type { EventInput, EventReceipt } from "@may-agent/control/events";
import { findEventPublication, getEventView, type EventInterface } from "../core/events/interface.js";
import type { HumanTaskPage, HumanTaskView } from "../human-task-service.js";
import type { AppConversationResource } from "@may-agent/sdk/app";
import { createDaemonWebSocketTransport } from "../transport/websocket.js";
import type { ExecutionStatus } from "../core/reads/execution-status.js";

// ── Public API ───────────────────────────────────────────────────────────

export type DaemonHttpServices = {
  events: EventInterface;
  getStatus(): ExecutionStatus;
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
  /** Bound to the daemon owners; HTTP never proxies through the operator socket. */
  services: DaemonHttpServices;
}

type DaemonFrameResult = {
  ok: boolean;
  error?: string;
  eventId?: number;
  eventType?: string;
  delivery?: "recorded" | "accepted";
  links?: unknown[];
  approval?: EventReceipt["approval"];
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
  if (!services) throw new Error("HTTP requires in-process daemon services; use may-agent --socket --web");

  function _db(): SqliteDb {
    return openStateDb(join(STATE_DIR, "may.db"));
  }

  function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  async function sendDaemonFrame(frame: Record<string, unknown>): Promise<DaemonFrameResult> {
    if (frame.type === "publish" && frame.event && typeof frame.event === "object") {
      try {
        const event = frame.event as EventInput;
        const operatorId = typeof frame.operatorId === "string" ? frame.operatorId.trim() : "";
        if (event.type === "project.approval.submitted" && !operatorId) {
          throw new Error("operatorId must be a non-empty string");
        }
        const approvalAuthorization =
          (event.type === "project.approval.submitted" ||
            (event.type === "conversation.message.created" && operatorId && event.data.approvalReply))
            ? {
                actor: { kind: "operator" as const, id: operatorId },
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
    return { ok: false, error: "Expected a publish frame" };
  }

  async function daemonRead(frame: Record<string, unknown>): Promise<Record<string, unknown>> {
    {
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
          case "task.get": {
            const acceptedEvidence = frame.acceptedEvidence === true
              ? {
                  ...(typeof frame.evidenceLimit === "number" ? { limit: frame.evidenceLimit } : {}),
                  ...(typeof frame.evidenceCursor === "string" ? { cursor: frame.evidenceCursor } : {}),
                }
              : undefined;
            return {
              type: "ok",
              command: frame.type,
              task: services.getTask({
                ...Object.fromEntries(Object.entries(frame).filter(([key]) => key !== "type")),
                ...(acceptedEvidence ? { acceptedEvidence } : {}),
              }),
            };
          }
          default:
            return { type: "error", command: String(frame.type ?? "read"), message: "Unsupported direct read" };
        }
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        return {
          type: "error",
          command: String(frame.type ?? "read"),
          message: error instanceof Error ? error.message : String(error),
        };
      }
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
    const sources = ["web-ui", "control-socket"];
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
      {
        try {
          const receipt = services.events.publish(command.event, {
            source: "web-ui",
            inputSource: command.event.data.source,
          });
          return { type: "ok", command: "publish", ...receipt };
        } catch (error) {
          // In-process publication has no ambiguous transport state. Validation,
          // fencing, and idempotency failures are definitive rejections, just as
          // the compatibility socket reports them to this handler.
          const rejection = error instanceof Error ? error : new Error(String(error));
          Object.assign(rejection, { kind: "definitive" });
          throw rejection;
        }
      }
    },
  });
  const { handleSession, handleTranscript, handleRawLog } =
    createSessionRouteHandlers({
      stateDir: STATE_DIR,
      getDb: _db,
      json,
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
  } = createProjectRouteHandlers({
    projectRoot: PROJECT_ROOT,
    agentsRoot: AGENTS_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    platformUiContentTypeFor,
  });
  const { handleAgents, handleAgentAbout } = createAgentRouteHandlers({
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    readProjects,
  });
  function listLoadedAppsSafe(): ReadonlyArray<Record<string, unknown>> | null {
    try {
      const apps = services.listApps();
      return Array.isArray(apps) ? (apps as ReadonlyArray<Record<string, unknown>>) : null;
    } catch {
      return null;
    }
  }

  const { handleLiveness, handleMetrics, handleBrowse, handleKnowledgeSearch, handleAlertResolve } =
    createMetricAndKnowledgeRouteHandlers({
      agentsRoot: AGENTS_ROOT,
      sharedRoot: SHARED_ROOT,
      projectsRoot: PROJECTS_ROOT,
      getDb: _db,
      listLoadedApps: listLoadedAppsSafe,
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

  const directWebSocket = createDaemonWebSocketTransport({
    events: services.events, getStatus: () => services.getStatus(),
    agent: DAEMON_AGENT, instance: DAEMON_INSTANCE,
  });

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
      if (url.pathname === "/api/readiness") return json({ ready: true, checkedAt: Date.now(), transport: "in-process" });
      if (url.pathname === "/api/agents") return handleAgents();
      const aboutMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/about$/);
      if (aboutMatch) return handleAgentAbout(aboutMatch[1]);
      if (url.pathname === "/api/browse") return handleBrowse(url);
      if (url.pathname === "/api/knowledge/search") return handleKnowledgeSearch(url);
      if (url.pathname === "/api/metrics") return handleMetrics(url);
      if (url.pathname === "/api/observability") {
        if (req.method !== "GET") return json({ error: "GET required" }, 405);
        let query: ReturnType<typeof observabilitySummaryQuery>;
        try {
          query = observabilitySummaryQuery(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid observability filter" }, 400);
        }
        try {
          return json(
            readObservabilitySummary(_db(), {
              query,
              projectsRoot: PROJECTS_ROOT,
              stateDir: STATE_DIR,
              loadedApps: listLoadedAppsSafe(),
            }),
          );
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Observability read failed" }, 503);
        }
      }
      if (url.pathname === "/api/context-usage") {
        let query: ReturnType<typeof contextUsageQuery>;
        try {
          query = contextUsageQuery(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid usage filter" }, 400);
        }
        try {
          return json(readContextUsage(_db(), query));
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Context usage read failed" }, 503);
        }
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
      if (url.pathname === "/api/events/delivery-health") return handleEventDeliveryHealth(url);
      const eventViewMatch = url.pathname.match(/^\/api\/events\/(\d+)$/);
      if (eventViewMatch && req.method === "GET") return handleEventView(eventViewMatch[1]);
      if (url.pathname === "/api/events" && req.method === "POST") {
        const contentType = req.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
        if (contentType !== "application/json") return json({ error: "application/json required" }, 415);
        const origin = req.headers.get("origin");
        if (origin && origin !== url.origin) return json({ error: "Same-origin request required" }, 403);
        return handleEventIngress(req);
      }
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
      open: (ws: any) => directWebSocket.open(ws),
      message: (ws: any, msg: any) => directWebSocket.message(ws, String(msg)),
      close: (ws: any) => directWebSocket.close(ws),
    },
  });

  return { port: server.port, stop: (closeActiveConnections = false) => server.stop(closeActiveConnections) };
}
