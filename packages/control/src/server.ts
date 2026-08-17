import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import { normalizeSocketFrame, type EventInput, type EventReceipt } from "./protocol.js";

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
    input: Record<string, unknown>;
    source: Record<string, unknown>;
    conversationId?: string;
    conversationSequence?: number;
    channel?: string;
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
    options?: { limit?: number; allWork?: boolean; workRequestId?: string },
  ) => unknown;
  invokeProjectAction?: (input: { projectId: string; actionId: string; params: unknown; idempotencyKey?: string }) => {
    eventId: number;
    eventType: string;
  };
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  onDelivered?: (event: ControlEvent, clientCount: number) => void;
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
  chatMode: boolean;
  subscribed: boolean;
  deliveryChannel?: string;
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

function shouldForward(client: ClientState, event: ControlEvent): boolean {
  if (!client.subscribed) return false;
  const data = eventPayload(event);
  if (event.type === "app.response.delivery.requested") {
    return typeof data.channel === "string" && client.deliveryChannel === data.channel;
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
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  onDelivered?: (event: ControlEvent, clientCount: number) => void;
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
    describeProjectActions,
    invokeProjectAction,
    subscribeEvents,
    onDelivered,
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
    const socketDelivery =
      event.type === "app.response.delivery.requested" &&
      typeof data.channel === "string" &&
      [...clients.values()].some((client) => client.deliveryChannel === data.channel);
    if (clients.size === 0) {
      if (event.type === "app.response.delivery.requested" && data.channel === "may-console") {
        onDelivered?.(event, 0);
      }
      return;
    }

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
    let delivered = 0;
    for (const [sock, client] of clients) {
      if (!shouldForward(client, event)) continue;
      try {
        line ??= JSON.stringify(event) + "\n";
        if (sock.writableLength + Buffer.byteLength(line) > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
          clients.delete(sock);
          sock.destroy(new Error("Control socket client is too slow"));
          continue;
        }
        if (sock.write(line)) delivered++;
        else if (sock.writableLength <= CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) delivered++;
      } catch {
        clients.delete(sock);
      }
    }
    if (
      (event.type === "app.response.delivery.requested" &&
        delivered === 0 &&
        (socketDelivery || data.channel === "may-console")) ||
      (delivered > 0 && (event.type === "session.idle" || event.type === "session.end"))
    ) {
      onDelivered?.(event, delivered);
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
    clients.set(socket, { socket, filter: null, chatMode: false, subscribed: false });
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
          const deliveryChannel = frame.deliveryChannel;
          const client = clients.get(socket);
          if (
            client &&
            Array.isArray(sessions) &&
            sessions.every((session) => typeof session === "string") &&
            (deliveryChannel === undefined || (typeof deliveryChannel === "string" && deliveryChannel.trim()))
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
            client.deliveryChannel = typeof deliveryChannel === "string" ? deliveryChannel.trim() : undefined;
            client.subscribed = true;
            writeFrame(socket, { type: "ok", command: "subscribe" });
          } else {
            writeFrame(socket, {
              type: "error",
              command: "subscribe",
              message:
                !Array.isArray(sessions) || !sessions.every((session) => typeof session === "string")
                  ? "sessions must be an array of strings"
                  : "deliveryChannel must be a non-empty string",
            });
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "status") {
          writeFrame(socket, {
            type: "status",
            command: "status",
            activeAgents: socketStatus(getStatus(), getSessionId(), agentName),
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
            const receipt = publishEvent({
              type: eventType,
              ...(target ? { target: target as EventInput["target"] } : {}),
              data: data as Record<string, unknown>,
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
            const result = admitAppInput({
              appId,
              input: input as Record<string, unknown>,
              source: source as Record<string, unknown>,
              ...(typeof frame.conversationId === "string" && frame.conversationId.trim()
                ? { conversationId: frame.conversationId.trim() }
                : {}),
              ...(typeof frame.conversationSequence === "number"
                ? { conversationSequence: frame.conversationSequence }
                : {}),
              ...(typeof frame.channel === "string" && frame.channel.trim() ? { channel: frame.channel.trim() } : {}),
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
          const workRequestId = typeof frame.workRequestId === "string" ? frame.workRequestId.trim() : undefined;
          const allWork = frame.allWork === true;
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
              conversation: getAppConversation(appId, conversationId, { limit, workRequestId, allWork }),
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
    onDelivered,
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
    describeProjectActions: opts.describeProjectActions,
    invokeProjectAction: opts.invokeProjectAction,
    subscribeEvents,
    onDelivered,
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
