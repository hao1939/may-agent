import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import { normalizeSocketFrame, type EventInput, type EventReceipt } from "./protocol.js";
import { isTaskDerivedViewWake, taskUpdateIdentity } from "./task-wake.js";

export type ControlEvent = Record<string, unknown> & { type: string };
export type ControlEmitResult = { eventId?: number };

export interface ControlStatusItem {
  agent: string;
  sessionId: string;
  status: string;
  kind: string;
  task: string;
}

export interface AttachControlSocketOptions {
  socketPath: string;
  getSessionId: () => string;
  getStatus: () => ControlStatusItem[];
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  publishEvent?: (event: EventInput) => EventReceipt;
  getEvent?: (eventId: number) => unknown;
  describeProjectActions?: (projectId: string) => unknown[];
  admitAppInput?: (input: {
    appId: string;
    targetTaskId?: string;
    input: Record<string, unknown>;
    source: Record<string, unknown>;
    conversationId?: string;
    conversationSequence?: number;
    channel?: string;
    channelTargetId?: string;
    channelThreadId?: string;
    channelMessageId?: number;
    replyToSourceId?: string;
    idempotencyKey: string;
  }) => {
    eventId: number;
    eventType: string;
  };
  getAppConversation?: (
    appId: string,
    conversationId: string,
    options?: { limit?: number; topicId?: string; topicLimit?: number; topicCursor?: string },
  ) => unknown;
  listAppTasks?: (appId: string, options?: { status?: string[]; limit?: number; cursor?: string }) => unknown;
  getAppTask?: (appId: string, taskId: string) => unknown;
  resolveAppTask?: (appId: string, event: Record<string, unknown>) => unknown;
  listApps?: (appId?: string) => unknown;
  listTasks?: (options?: {
    appId?: string;
    includeDone?: boolean;
    humanActionOnly?: boolean;
    status?: string[];
    limit?: number;
    cursor?: string;
  }) => unknown;
  getTask?: (input: { ref?: string; appId?: string; taskId?: string }) => unknown;
  invokeProjectAction?: (input: { projectId: string; actionId: string; params: unknown; idempotencyKey?: string }) => {
    eventId: number;
    eventType: string;
  };
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  onInfo?: (message: string) => void;
  /** Interface agent label, kept for compatibility with existing welcome frames. */
  agentName: string;
  /** Daemon instance label. The socket is shared by the whole instance. */
  instance: string;
}

export interface ControlSocket {
  close: () => void;
  clientCount: () => number;
}

interface ClientState {
  socket: Duplex;
  filter: Set<string> | null;
  conversations: Set<string>;
  taskApps: Set<string>;
  task: { appId: string; taskId: string } | null;
  chatMode: boolean;
  subscribed: boolean;
}

export const CONTROL_SOCKET_LIMITS = {
  maxFrameBytes: 1_048_576,
  maxIncompleteBufferBytes: 1_048_576,
  maxOutboundBufferBytes: 1_048_576,
  maxConnections: 64,
  maxErrorPreviewBytes: 160,
} as const;

export function isSocketAlive(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = connect(socketPath);
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 1000);
    client.on("connect", () => {
      clearTimeout(timer);
      client.destroy();
      resolve(true);
    });
    client.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function activeStatus(status: ControlStatusItem[]): ControlStatusItem[] {
  return status
    .filter((item) => item.status === "running" || item.status === "idle")
    .map((item) => ({
      agent: item.agent,
      sessionId: item.sessionId,
      status: item.status,
      kind: item.kind,
      task: item.task.slice(0, 100),
    }));
}

function exactRuntimeControl(text: unknown): "runtime.reload.requested" | "runtime.restart.requested" | null {
  if (typeof text !== "string") return null;
  switch (text.trim().toLowerCase()) {
    case "/reload":
      return "runtime.reload.requested";
    case "/restart":
      return "runtime.restart.requested";
    default:
      return null;
  }
}

function exactMayInputControl(appId: string, input: unknown): ReturnType<typeof exactRuntimeControl> {
  if (appId !== "may" || !input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (record.kind !== "message" || !record.data || typeof record.data !== "object" || Array.isArray(record.data)) {
    return null;
  }
  return exactRuntimeControl((record.data as Record<string, unknown>).message);
}

function socketStatus(status: ControlStatusItem[], currentSessionId: string, agentName: string): ControlStatusItem[] {
  const active = activeStatus(status);
  if (currentSessionId && !active.some((item) => item.sessionId === currentSessionId)) {
    active.push({
      agent: agentName,
      sessionId: currentSessionId,
      status: "ready",
      kind: "chat",
      task: "May chat",
    });
  }
  return active;
}

function runtimeDiagnostics(): Record<string, unknown> {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    pid: process.pid,
    uptimeSeconds: process.uptime(),
    cpu: {
      userMicros: cpu.user,
      systemMicros: cpu.system,
    },
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
  };
}

function shouldForward(client: ClientState, event: ControlEvent): boolean {
  if (!client.subscribed) return false;
  const data = eventPayload(event);
  // Runtime control results are correlated by requestId in the initiating
  // adapter rather than by an agent session.
  if (event.type === "runtime.reload.finished") return true;
  if (event.type === "conversation.updated") {
    return typeof data.conversationId === "string" && client.conversations.has(data.conversationId);
  }
  if (!client.filter) return true;
  if (typeof data.sessionId === "string") return client.filter.has(data.sessionId);
  if (event.type === "message.created" && data.to === "human") return false;
  return false;
}

function eventPayload(event: ControlEvent): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as Record<string, unknown>)
    : event;
}

export interface ControlSocketCoreOptions {
  getSessionId: () => string;
  getStatus: () => ControlStatusItem[];
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  publishEvent?: AttachControlSocketOptions["publishEvent"];
  getEvent?: AttachControlSocketOptions["getEvent"];
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
  admitAppInput?: AttachControlSocketOptions["admitAppInput"];
  getAppConversation?: AttachControlSocketOptions["getAppConversation"];
  listAppTasks?: AttachControlSocketOptions["listAppTasks"];
  getAppTask?: AttachControlSocketOptions["getAppTask"];
  resolveAppTask?: AttachControlSocketOptions["resolveAppTask"];
  listApps?: AttachControlSocketOptions["listApps"];
  listTasks?: AttachControlSocketOptions["listTasks"];
  getTask?: AttachControlSocketOptions["getTask"];
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  agentName: string;
  instance: string;
}

export function createControlSocketCore(opts: ControlSocketCoreOptions): {
  attachClient: (socket: Duplex) => void;
  close: () => void;
  clientCount: () => number;
} {
  const {
    getSessionId,
    getStatus,
    emitEvent,
    publishEvent,
    getEvent,
    admitAppInput,
    getAppConversation,
    listAppTasks,
    getAppTask,
    resolveAppTask,
    listApps,
    listTasks,
    getTask,
    describeProjectActions,
    invokeProjectAction,
    subscribeEvents,
    agentName,
    instance,
  } = opts;
  const clients = new Map<Duplex, ClientState>();
  function writeFrame(socket: Duplex, frame: Record<string, unknown>): boolean {
    if (socket.writableLength > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
      clients.delete(socket);
      socket.destroy(new Error("Control socket outbound buffer limit exceeded"));
      return false;
    }
    const writable = socket.write(JSON.stringify(frame) + "\n");
    if (!writable && socket.writableLength > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
      clients.delete(socket);
      socket.destroy(new Error("Control socket client is too slow"));
      return false;
    }
    return true;
  }

  function broadcast(event: ControlEvent): void {
    const data = eventPayload(event);
    if (clients.size === 0) return;

    const chatSid = getSessionId();
    for (const client of clients.values()) {
      if (!client.chatMode) continue;
      if (chatSid) {
        if (!client.filter) client.filter = new Set();
        if (!client.filter.has(chatSid)) {
          client.filter.clear();
          client.filter.add(chatSid);
        }
      } else if (client.filter) {
        client.filter.clear();
      }
    }

    if (
      event.type === "session.start" &&
      typeof data.parentSessionId === "string" &&
      typeof data.sessionId === "string"
    ) {
      for (const client of clients.values()) {
        if (client.filter?.has(data.parentSessionId)) client.filter.add(data.sessionId);
      }
    }

    let line: string | undefined;
    for (const [sock, client] of clients) {
      if (!shouldForward(client, event)) continue;
      try {
        line ??= JSON.stringify(event) + "\n";
        if (sock.writableLength + Buffer.byteLength(line) > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
          clients.delete(sock);
          sock.destroy(new Error("Control socket client is too slow"));
          continue;
        }
        sock.write(line);
      } catch {
        clients.delete(sock);
      }
    }

    const wake = taskUpdateIdentity(event);
    if (!wake) return;
    const derivedViewWake = isTaskDerivedViewWake(event);
    let wakeLine: string | undefined;
    for (const [sock, client] of clients) {
      if (
        !client.subscribed ||
        !(
          (client.task?.appId === wake.appId && client.task.taskId === wake.taskId) ||
          (derivedViewWake && client.taskApps.has(wake.appId))
        )
      ) {
        continue;
      }
      try {
        wakeLine ??= `${JSON.stringify({ type: "app.task.updated", data: wake })}\n`;
        if (sock.writableLength + Buffer.byteLength(wakeLine) > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
          clients.delete(sock);
          sock.destroy(new Error("Control socket client is too slow"));
          continue;
        }
        sock.write(wakeLine);
      } catch {
        clients.delete(sock);
      }
    }
  }

  const unsubscribe = subscribeEvents(broadcast);

  function attachClient(socket: Duplex): void {
    for (const [clientSocket] of clients) {
      if (clientSocket.destroyed || clientSocket.readableEnded || clientSocket.writableEnded) {
        clients.delete(clientSocket);
      }
    }
    if (clients.size >= CONTROL_SOCKET_LIMITS.maxConnections) {
      writeFrame(socket, {
        type: "error",
        command: null,
        message: "Control socket connection limit exceeded",
      });
      socket.end();
      return;
    }
    clients.set(socket, {
      socket,
      filter: null,
      conversations: new Set(),
      taskApps: new Set(),
      task: null,
      chatMode: false,
      subscribed: false,
    });
    const removeClient = () => clients.delete(socket);
    socket.on("close", removeClient);
    socket.on("error", removeClient);
    socket.on("end", removeClient);
    socket.on("finish", removeClient);

    writeFrame(socket, {
      type: "connected",
      pid: process.pid,
      agent: agentName,
      instance,
      sessionId: getSessionId(),
      activeAgents: socketStatus(getStatus(), getSessionId(), agentName),
    });

    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      if (Buffer.byteLength(buffer) > CONTROL_SOCKET_LIMITS.maxIncompleteBufferBytes) {
        writeFrame(socket, { type: "error", command: null, message: "Incomplete control socket frame is too large" });
        socket.destroy();
        return;
      }

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (Buffer.byteLength(trimmed) > CONTROL_SOCKET_LIMITS.maxFrameBytes) {
          writeFrame(socket, { type: "error", command: null, message: "Control socket frame is too large" });
          continue;
        }

        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          writeFrame(socket, {
            type: "error",
            command: null,
            message: `Invalid JSON: ${trimmed.slice(0, CONTROL_SOCKET_LIMITS.maxErrorPreviewBytes)}`,
          });
          continue;
        }

        const normalized = normalizeSocketFrame(frame);
        if (normalized.kind === "error") {
          writeFrame(socket, {
            type: "error",
            command: normalized.command ?? null,
            message: normalized.message,
          });
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "subscribe") {
          const sessions = frame.sessions;
          const conversations = frame.conversations;
          const taskApps = frame.taskApps;
          const task = frame.task;
          const client = clients.get(socket);
          if (
            client &&
            Array.isArray(sessions) &&
            sessions.every((session) => typeof session === "string") &&
            (conversations === undefined ||
              (Array.isArray(conversations) && conversations.every((id) => typeof id === "string" && id.trim()))) &&
            (taskApps === undefined ||
              (Array.isArray(taskApps) && taskApps.every((id) => typeof id === "string" && id.trim()))) &&
            (task === undefined ||
              task === null ||
              (typeof task === "object" &&
                !Array.isArray(task) &&
                typeof (task as Record<string, unknown>).appId === "string" &&
                Boolean(String((task as Record<string, unknown>).appId).trim()) &&
                typeof (task as Record<string, unknown>).taskId === "string" &&
                Boolean(String((task as Record<string, unknown>).taskId).trim())))
          ) {
            if (sessions.includes("*")) {
              client.filter = null;
              client.chatMode = false;
            } else if (sessions.includes("chat")) {
              client.chatMode = true;
              const chatSid = getSessionId();
              client.filter = chatSid ? new Set([chatSid]) : new Set();
            } else {
              client.filter = new Set(sessions);
              client.chatMode = false;
            }
            client.conversations = new Set(
              Array.isArray(conversations) ? conversations.map((id) => String(id).trim()) : [],
            );
            client.taskApps = new Set(
              Array.isArray(taskApps)
                ? taskApps.map((id) =>
                    String(id)
                      .trim()
                      .replace(/\.app$/, ""),
                  )
                : [],
            );
            client.task =
              task && typeof task === "object" && !Array.isArray(task)
                ? {
                    appId: String((task as Record<string, unknown>).appId)
                      .trim()
                      .replace(/\.app$/, ""),
                    taskId: String((task as Record<string, unknown>).taskId).trim(),
                  }
                : null;
            client.subscribed = true;
            writeFrame(socket, { type: "ok", command: "subscribe" });
          } else {
            writeFrame(socket, {
              type: "error",
              command: "subscribe",
              message:
                !Array.isArray(sessions) || !sessions.every((session) => typeof session === "string")
                  ? "sessions must be an array of strings"
                  : conversations !== undefined &&
                      (!Array.isArray(conversations) ||
                        !conversations.every((id) => typeof id === "string" && id.trim()))
                    ? "conversations must be an array of non-empty strings"
                    : taskApps !== undefined &&
                        (!Array.isArray(taskApps) || !taskApps.every((id) => typeof id === "string" && id.trim()))
                      ? "taskApps must be an array of non-empty strings"
                      : task !== undefined &&
                          task !== null &&
                          (typeof task !== "object" ||
                            Array.isArray(task) ||
                            typeof (task as Record<string, unknown>).appId !== "string" ||
                            typeof (task as Record<string, unknown>).taskId !== "string")
                        ? "task must contain non-empty appId and taskId strings"
                        : "invalid subscription",
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "status") {
          writeFrame(socket, {
            type: "status",
            command: "status",
            activeAgents: socketStatus(getStatus(), getSessionId(), agentName),
            ...(frame.diagnostics === true ? { diagnostics: runtimeDiagnostics() } : {}),
          });
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "publish") {
          const input = frame.event;
          if (!input || typeof input !== "object" || Array.isArray(input) || !publishEvent) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message:
                !input || typeof input !== "object" || Array.isArray(input)
                  ? "publish requires object field 'event'"
                  : "Event publication is unavailable",
            });
            continue;
          }
          try {
            const event = input as Record<string, unknown>;
            const eventType = typeof event.type === "string" ? event.type.trim() : "";
            const data = event.data;
            const target = event.target;
            if (!eventType) throw new Error("Event type is required");
            if (!data || typeof data !== "object" || Array.isArray(data)) {
              throw new Error("Event data must be an object");
            }
            if (target !== undefined && (!target || typeof target !== "object" || Array.isArray(target))) {
              throw new Error("Event target must be an object");
            }
            const eventData = data as Record<string, unknown>;
            const eventTarget = target as EventInput["target"] | undefined;
            const author = eventData.author;
            const runtimeControl =
              eventType === "conversation.message.created" &&
              eventTarget?.appId === "may" &&
              author &&
              typeof author === "object" &&
              !Array.isArray(author) &&
              (author as Record<string, unknown>).kind === "human"
                ? exactRuntimeControl(eventData.text)
                : null;
            const receipt = publishEvent({
              type: runtimeControl ?? eventType,
              ...(runtimeControl ? {} : eventTarget ? { target: eventTarget } : {}),
              data: runtimeControl ? { reason: "human control command" } : eventData,
              ...(typeof event.idempotencyKey === "string" && event.idempotencyKey.trim()
                ? { idempotencyKey: event.idempotencyKey.trim() }
                : {}),
            });
            writeFrame(socket, { type: "ok", command: normalized.command, ...receipt });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "event.get") {
          const eventId = Number(frame.eventId);
          if (!Number.isSafeInteger(eventId) || eventId <= 0 || !getEvent) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message:
                !Number.isSafeInteger(eventId) || eventId <= 0
                  ? "eventId must be a positive integer"
                  : "Event reads are unavailable",
            });
            continue;
          }
          try {
            const event = getEvent(eventId);
            if (!event) throw new Error(`Event ${eventId} was not found`);
            writeFrame(socket, { type: "ok", command: normalized.command, event });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "app.input.admit") {
          const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
          const input = frame.input;
          const source = frame.source;
          const idempotencyKey = typeof frame.idempotencyKey === "string" ? frame.idempotencyKey.trim() : "";
          if (
            !appId ||
            !input ||
            typeof input !== "object" ||
            Array.isArray(input) ||
            !source ||
            typeof source !== "object" ||
            Array.isArray(source) ||
            !idempotencyKey ||
            !admitAppInput
          ) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !appId
                ? "appId is required"
                : !input || typeof input !== "object" || Array.isArray(input)
                  ? "input must be an object"
                  : !source || typeof source !== "object" || Array.isArray(source)
                    ? "source must be an object"
                    : !idempotencyKey
                      ? "idempotencyKey is required"
                      : "App input admission is unavailable",
            });
            continue;
          }
          try {
            const runtimeControl = exactMayInputControl(appId, input);
            if (runtimeControl) {
              if (!publishEvent) throw new Error("Event publication is unavailable");
              const receipt = publishEvent({
                type: runtimeControl,
                data: { reason: "human control command" },
                idempotencyKey,
              });
              writeFrame(socket, { type: "ok", command: normalized.command, appId, ...receipt });
              continue;
            }
            const result = admitAppInput({
              appId,
              input: input as Record<string, unknown>,
              source: source as Record<string, unknown>,
              ...(typeof frame.targetTaskId === "string" && frame.targetTaskId.trim()
                ? { targetTaskId: frame.targetTaskId.trim() }
                : {}),
              ...(typeof frame.conversationId === "string" && frame.conversationId.trim()
                ? { conversationId: frame.conversationId.trim() }
                : {}),
              ...(typeof frame.conversationSequence === "number"
                ? { conversationSequence: frame.conversationSequence }
                : {}),
              ...(typeof frame.channel === "string" && frame.channel.trim() ? { channel: frame.channel.trim() } : {}),
              ...(typeof frame.channelTargetId === "string" && frame.channelTargetId.trim()
                ? { channelTargetId: frame.channelTargetId.trim() }
                : {}),
              ...(typeof frame.channelThreadId === "string" && frame.channelThreadId.trim()
                ? { channelThreadId: frame.channelThreadId.trim() }
                : {}),
              ...(typeof frame.channelMessageId === "number" ? { channelMessageId: frame.channelMessageId } : {}),
              ...(typeof frame.replyToSourceId === "string" && frame.replyToSourceId.trim()
                ? { replyToSourceId: frame.replyToSourceId.trim() }
                : {}),
              idempotencyKey,
            });
            writeFrame(socket, { type: "ok", command: normalized.command, appId, ...result });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "app.conversation.get") {
          const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
          const conversationId = typeof frame.conversationId === "string" ? frame.conversationId.trim() : "";
          const limit = frame.limit === undefined ? undefined : Number(frame.limit);
          const topicId = typeof frame.topicId === "string" ? frame.topicId.trim() : "";
          const topicCursor = typeof frame.topicCursor === "string" ? frame.topicCursor.trim() : "";
          const topicLimit = frame.topicLimit === undefined ? undefined : Number(frame.topicLimit);
          if (!appId || !conversationId || !getAppConversation) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !appId
                ? "appId is required"
                : !conversationId
                  ? "conversationId is required"
                  : "App conversation reads are unavailable",
            });
            continue;
          }
          try {
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              appId,
              conversationId,
              conversation: getAppConversation(appId, conversationId, {
                limit,
                ...(topicId ? { topicId } : {}),
                ...(topicCursor ? { topicCursor } : {}),
                ...(topicLimit === undefined ? {} : { topicLimit }),
              }),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "app.tasks.list") {
          const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
          if (!appId || !listAppTasks) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !appId ? "appId is required" : "App Task reads are unavailable",
            });
            continue;
          }
          try {
            if (
              frame.status !== undefined &&
              (!Array.isArray(frame.status) ||
                !frame.status.every((value) => typeof value === "string" && Boolean(value.trim())))
            ) {
              throw new Error("status must be an array of non-empty strings");
            }
            const status = frame.status as string[] | undefined;
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              appId,
              tasks: listAppTasks(appId, {
                ...(status ? { status } : {}),
                ...(frame.limit === undefined ? {} : { limit: Number(frame.limit) }),
                ...(typeof frame.cursor === "string" && frame.cursor.trim() ? { cursor: frame.cursor.trim() } : {}),
              }),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "app.task.get") {
          const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
          const taskId = typeof frame.taskId === "string" ? frame.taskId.trim() : "";
          if (!appId || !taskId || !getAppTask) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !appId ? "appId is required" : !taskId ? "taskId is required" : "App Task reads are unavailable",
            });
            continue;
          }
          try {
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              appId,
              taskId,
              task: getAppTask(appId, taskId),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "app.task.retry") {
          const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
          const taskId = typeof frame.taskId === "string" ? frame.taskId.trim() : "";
          const expectedGeneration = frame.expectedGeneration;
          if (
            !appId ||
            !taskId ||
            typeof expectedGeneration !== "number" ||
            !Number.isSafeInteger(expectedGeneration) ||
            expectedGeneration < 1 ||
            !publishEvent ||
            !getTask
          ) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !appId
                ? "appId is required"
                : !taskId
                  ? "taskId is required"
                  : typeof expectedGeneration !== "number" ||
                      !Number.isSafeInteger(expectedGeneration) ||
                      expectedGeneration < 1
                    ? "expectedGeneration must be a positive integer"
                    : "App Task retry is unavailable",
            });
            continue;
          }
          try {
            const task = getTask({ appId, taskId }) as Record<string, unknown> | null;
            if (!task) throw new Error(`Task ${appId}/${taskId} was not found`);
            if (task.generation !== expectedGeneration) {
              throw new Error(
                `Task ${appId}/${taskId} generation changed: expected ${expectedGeneration}, current ${String(task.generation)}`,
              );
            }
            if (!Number.isSafeInteger(task.resourceVersion) || Number(task.resourceVersion) < 1) {
              throw new Error(`Task ${appId}/${taskId} has no valid resource version`);
            }
            const receipt = publishEvent({
              type: "app.task.retry.requested",
              target: { appId, taskId },
              data: {
                expectedGeneration,
                expectedResourceVersion: Number(task.resourceVersion),
              },
              idempotencyKey: `app-task-retry:${appId}:${taskId}:${expectedGeneration}:${Number(task.resourceVersion)}`,
            });
            if (receipt.delivery !== "accepted") {
              throw new Error(`Task ${appId}/${taskId} retry was recorded but not accepted; read the Task and retry`);
            }
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              receipt,
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "app.task.resolve") {
          const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
          const event = frame.event;
          if (!appId || !event || typeof event !== "object" || Array.isArray(event) || !resolveAppTask) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !appId
                ? "appId is required"
                : !event || typeof event !== "object" || Array.isArray(event)
                  ? "event must be an object"
                  : "installed App Task resolution is unavailable",
            });
            continue;
          }
          try {
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              ...(resolveAppTask(appId, event as Record<string, unknown>) as Record<string, unknown>),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "apps.list") {
          if (!listApps) {
            writeFrame(socket, { type: "error", command: normalized.command, message: "App reads are unavailable" });
            continue;
          }
          try {
            const appId = typeof frame.appId === "string" && frame.appId.trim() ? frame.appId.trim() : undefined;
            writeFrame(socket, { type: "ok", command: normalized.command, apps: listApps(appId) });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "tasks.list") {
          if (!listTasks) {
            writeFrame(socket, { type: "error", command: normalized.command, message: "Task reads are unavailable" });
            continue;
          }
          try {
            if (
              frame.status !== undefined &&
              (!Array.isArray(frame.status) ||
                !frame.status.every((value) => typeof value === "string" && Boolean(value.trim())))
            ) {
              throw new Error("status must be an array of non-empty strings");
            }
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              tasks: listTasks({
                ...(typeof frame.appId === "string" && frame.appId.trim() ? { appId: frame.appId.trim() } : {}),
                ...(frame.includeDone === true ? { includeDone: true } : {}),
                ...(frame.humanActionOnly === true ? { humanActionOnly: true } : {}),
                ...(Array.isArray(frame.status) ? { status: frame.status as string[] } : {}),
                ...(frame.limit === undefined ? {} : { limit: Number(frame.limit) }),
                ...(typeof frame.cursor === "string" && frame.cursor.trim() ? { cursor: frame.cursor.trim() } : {}),
              }),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "task.get") {
          if (!getTask) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: "Task reads are unavailable",
            });
            continue;
          }
          try {
            const input = {
              ...(typeof frame.ref === "string" && frame.ref.trim() ? { ref: frame.ref.trim() } : {}),
              ...(typeof frame.appId === "string" && frame.appId.trim() ? { appId: frame.appId.trim() } : {}),
              ...(typeof frame.taskId === "string" && frame.taskId.trim() ? { taskId: frame.taskId.trim() } : {}),
              ...(typeof frame.reason === "string" && frame.reason.trim() ? { reason: frame.reason.trim() } : {}),
            };
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              task: getTask(input),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "task.cancel") {
          if (!getTask || !publishEvent) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: "Task cancellation is unavailable",
            });
            continue;
          }
          try {
            const input = {
              ...(typeof frame.ref === "string" && frame.ref.trim() ? { ref: frame.ref.trim() } : {}),
              ...(typeof frame.appId === "string" && frame.appId.trim() ? { appId: frame.appId.trim() } : {}),
              ...(typeof frame.taskId === "string" && frame.taskId.trim() ? { taskId: frame.taskId.trim() } : {}),
            };
            const task = getTask(input) as Record<string, unknown> | null;
            if (!task) throw new Error("Task was not found");
            const appId = typeof task.appId === "string" ? task.appId.trim() : "";
            const taskId = typeof task.taskId === "string" ? task.taskId.trim() : "";
            const generation = Number(task.generation);
            const resourceVersion = Number(task.resourceVersion);
            if (!appId || !taskId || !Number.isSafeInteger(generation) || !Number.isSafeInteger(resourceVersion)) {
              throw new Error("Task has no exact mutable resource identity");
            }
            const reason =
              typeof frame.reason === "string" && frame.reason.trim()
                ? frame.reason.trim()
                : "human requested cancellation";
            const receipt = publishEvent({
              type: "app.task.cancel.requested",
              target: { appId, taskId },
              data: {
                expectedGeneration: generation,
                expectedResourceVersion: resourceVersion,
                reason,
              },
              idempotencyKey: `app-task-cancel:${appId}:${taskId}:${generation}:${resourceVersion}`,
            });
            if (receipt.delivery !== "accepted") {
              throw new Error(
                `Task ${appId}/${taskId} cancellation was recorded but not accepted; read the Task and retry`,
              );
            }
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              receipt,
              task: getTask({ appId, taskId }),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "project.actions.describe") {
          const projectId = typeof frame.projectId === "string" ? frame.projectId.trim() : "";
          if (!projectId || !describeProjectActions) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !projectId ? "projectId is required" : "project action discovery is unavailable",
            });
            continue;
          }
          try {
            writeFrame(socket, {
              type: "ok",
              command: normalized.command,
              projectId,
              actions: describeProjectActions(projectId),
            });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "project.action.invoke") {
          const projectId = typeof frame.projectId === "string" ? frame.projectId.trim() : "";
          const actionId = typeof frame.actionId === "string" ? frame.actionId.trim() : "";
          if (!projectId || !actionId || !invokeProjectAction) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: !projectId
                ? "projectId is required"
                : !actionId
                  ? "actionId is required"
                  : "project action invocation is unavailable",
            });
            continue;
          }
          try {
            const result = invokeProjectAction({
              projectId,
              actionId,
              params: frame.params ?? {},
              ...(typeof frame.idempotencyKey === "string" && frame.idempotencyKey.trim()
                ? { idempotencyKey: frame.idempotencyKey.trim() }
                : {}),
            });
            writeFrame(socket, { type: "ok", command: normalized.command, projectId, actionId, ...result });
          } catch (error) {
            writeFrame(socket, {
              type: "error",
              command: normalized.command,
              message: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        if (normalized.kind !== "event") continue;
        try {
          const result = emitEvent(normalized.event as ControlEvent);
          const eventId = Number(result?.eventId);
          if (!Number.isInteger(eventId) || eventId <= 0) {
            throw new Error(`Event ${normalized.command} was not durably persisted`);
          }
          writeFrame(socket, { type: "ok", command: normalized.command, eventId });
        } catch (error) {
          writeFrame(socket, {
            type: "error",
            command: normalized.command,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }

  return {
    attachClient,
    close: () => {
      unsubscribe();
      for (const client of clients.keys()) client.destroy();
      clients.clear();
    },
    clientCount: () => clients.size,
  };
}

export async function attachControlSocket(opts: AttachControlSocketOptions): Promise<ControlSocket> {
  const {
    socketPath,
    getSessionId,
    getStatus,
    emitEvent,
    publishEvent,
    getEvent,
    subscribeEvents,
    onInfo,
    agentName,
    instance,
  } = opts;
  mkdirSync(dirname(socketPath), { recursive: true });

  if (existsSync(socketPath)) {
    const alive = await isSocketAlive(socketPath);
    if (alive) {
      const message = `[control] Socket ${socketPath} already has a live owner. Refusing to start without control-socket ownership; use a different INSTANCE for a separate daemon.`;
      onInfo?.(message);
      throw new Error(message);
    }
    unlinkSync(socketPath);
  }

  const core = createControlSocketCore({
    getSessionId,
    getStatus,
    emitEvent,
    publishEvent,
    getEvent,
    admitAppInput: opts.admitAppInput,
    getAppConversation: opts.getAppConversation,
    listAppTasks: opts.listAppTasks,
    getAppTask: opts.getAppTask,
    resolveAppTask: opts.resolveAppTask,
    listApps: opts.listApps,
    listTasks: opts.listTasks,
    getTask: opts.getTask,
    describeProjectActions: opts.describeProjectActions,
    invokeProjectAction: opts.invokeProjectAction,
    subscribeEvents,
    agentName,
    instance,
  });
  const server: Server = createServer((socket) => core.attachClient(socket));

  server.on("close", () => {
    onInfo?.("[control] Socket server CLOSED");
  });

  const cleanup = () => {
    try {
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    } catch {
      // ignore
    }
  };
  process.on("exit", cleanup);

  try {
    await new Promise<void>((resolve, reject) => {
      const onListenError = (err: Error) => {
        onInfo?.(`[control] Socket error: ${err.message}`);
        reject(err);
      };
      server.once("error", onListenError);
      server.listen(socketPath, () => {
        server.off("error", onListenError);
        server.on("error", (err) => {
          onInfo?.(`[control] Socket error: ${err.message}`);
        });
        try {
          chmodSync(socketPath, 0o600);
          onInfo?.(`[control] Listening on ${socketPath}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    process.off("exit", cleanup);
    core.close();
    cleanup();
    throw error;
  }

  return {
    close: () => {
      process.off("exit", cleanup);
      core.close();
      cleanup();
    },
    clientCount: () => core.clientCount(),
  };
}
