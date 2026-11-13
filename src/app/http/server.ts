#!/usr/bin/env bun
/**
 * may-agent HTTP adapter — API, static WebUI, and dashboard websocket.
 *
 * Can run standalone: bun src/app/http/server.ts --state-dir .state --port 8080
 * Imported by app modes; serves project UI from PROJECTS_ROOT.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Duplex } from "node:stream";
import { interfaceBinding, type InterfaceBinding } from "@may-agent/control";
import {
  connectSocketEndpoint,
  daemonSocketPath,
  sendDaemonEvent,
  sendSocketCommand,
  SocketCommandError,
} from "@may-agent/control/client";
import type { EventInput } from "@may-agent/control/events";
import { contextUsageQuery, readContextUsage } from "../adapters/reporting/context-usage.js";
import { metricEvidenceQuery, readMetricEvidence } from "../adapters/reporting/metric-evidence.js";
import { readMetricHistory } from "../adapters/reporting/metric-observations.js";
import { readTaskAttempts, taskAttemptsQuery } from "../adapters/reporting/task-attempts.js";
import { healthWindow, readWorkflowHealth, workflowHealthQuery } from "../adapters/reporting/workflow-health.js";
import { findEventPublication, getEventView } from "../core/events/interface.js";
import {
  appInboxQueryFromUrl,
  buildEventIngressFrame,
  buildPublishFrame,
  createDiagnosticAndMetricHandlers,
} from "./diagnostic-and-metric-routes.js";
import { normalizeProjectPathForCompare } from "./project-metadata.js";
import {
  buildAppAdmissionCommand,
  createProjectHandlers,
  extractMarkdownSection,
  projectEventTargetForPath,
  sendAppInputWithRetry,
  sendProjectActionWithRetry,
} from "./project-routes.js";
import { openStateDb, type SqliteDb } from "./read-model/state-db.js";
import { createSessionAndAgentHandlers } from "./session-and-agent-routes.js";
import { createStaticAndKnowledgeHandlers, servePlatformUiRequest } from "./static-and-knowledge-routes.js";
import { createTaskInputHandler, type TaskInputCommand } from "./task-input.js";
import { createTaskReadHandlers } from "./task-read-routes.js";
import { createTaskTranscriptHandler } from "./task-transcript.js";

export {
  appInboxQueryFromUrl,
  buildAppAdmissionCommand,
  buildEventIngressFrame,
  buildPublishFrame,
  extractMarkdownSection,
  normalizeProjectPathForCompare,
  projectEventTargetForPath,
  sendAppInputWithRetry,
  sendProjectActionWithRetry,
  servePlatformUiRequest,
};

declare const Bun: {
  serve(opts: {
    port: number;
    hostname?: string;
    fetch(req: Request, server: any): Response | Promise<Response> | undefined;
    websocket: { open(ws: any): void; message(ws: any, msg: any): void; close(ws: any): void };
  }): { port: number };
};

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

export function startWebUI(opts: WebUIOptions): { port: number } {
  const STATE_DIR = opts.stateDir;
  const PORT = opts.port;
  const PROJECT_ROOT = process.env.PROJECT_ROOT || resolve(STATE_DIR, "..");
  const AGENTS_ROOT = process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents");
  const SHARED_ROOT = process.env.SHARED_ROOT || resolve(PROJECT_ROOT, "shared");
  const PROJECTS_ROOT = process.env.PROJECTS_ROOT || resolve(PROJECT_ROOT, "projects");
  const PLATFORM_UI_DIR = resolve(process.env.MAY_AGENT_UI_DIR?.trim() || join(PROJECTS_ROOT, "platform", "ui"));
  const DAEMON_INSTANCE = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "default";
  const humanInterface = opts.interface ?? interfaceBinding();
  const DAEMON_AGENT = humanInterface.agent;

  function _db(): SqliteDb {
    return openStateDb(join(STATE_DIR, "may.db"));
  }

  function conventionSocketPath(): string {
    return daemonSocketPath(STATE_DIR, {
      instance: DAEMON_INSTANCE,
      interfaceAgent: DAEMON_AGENT,
    });
  }

  function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  async function handleReadiness(): Promise<Response> {
    const readiness = await probeDaemonReadiness(conventionSocketPath());
    return json(readiness, readiness.ready ? 200 : 503);
  }

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

  const {
    appDirForName,
    isAllowedProjectPath,
    resolveProjectFile,
    readProjects,
    handleProjects,
    handleProjectJournal,
    handleProjectDiscussion,
    handleProjectContent,
    handleProjectArtifact,
    handleProjectDetail,
    handleProjectSessions,
    handleProjectComment,
    handleProjectActions,
    handleProjectActionInvoke,
  } = createProjectHandlers({
    stateDir: STATE_DIR,
    projectRoot: PROJECT_ROOT,
    agentsRoot: AGENTS_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    conventionSocketPath,
    json,
  });

  const { handleBrowse, handleKnowledgeSearch, serveProjectStatic, serveIndex } = createStaticAndKnowledgeHandlers({
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    platformUiDir: PLATFORM_UI_DIR,
    appDirForName,
    json,
  });

  const {
    readSessionTranscript,
    handleSession,
    handleSessionEval,
    handleTranscript,
    handleRawLog,
    handleSessionCancel,
    handleSessionMessage,
    handleAgents,
    handleAgentActivity,
    handleAgentTimeline,
    handleSystemHealth,
    handleAgentDetail,
    handleAgentAbout,
    handleAgentDefaultSession,
    handleAgentMessage,
  } = createSessionAndAgentHandlers({
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    humanInterface,
    getDb: _db,
    readProjects,
    sendDaemonFrame,
    buildPublishFrame,
    json,
  });

  const {
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
  } = createDiagnosticAndMetricHandlers({
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    conventionSocketPath,
    isAllowedProjectPath,
    resolveProjectFile,
    readSessionTranscript,
    sendDaemonFrame,
    json,
  });

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
        conventionSocketPath(),
        command,
        sendSocketCommand,
        () => confirmTaskInput(command),
      );
      return response as unknown as Record<string, unknown>;
    },
  });

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
      if (url.pathname === "/api/stats") return handleStats();
      if (url.pathname === "/api/agents") return handleAgents();
      if (url.pathname === "/api/agents/activity") return handleAgentActivity();
      if (url.pathname === "/api/agents/timeline") return handleAgentTimeline(url);
      if (url.pathname === "/api/agents/health") return handleSystemHealth();
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
        try {
          window = healthWindow(url.searchParams);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Invalid history window" }, 400);
        }
        return json(readMetricHistory(_db(), metricId, window));
      }
      const agentDetailMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/detail$/);
      if (agentDetailMatch) return handleAgentDetail(agentDetailMatch[1]);
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
