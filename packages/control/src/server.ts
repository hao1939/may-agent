import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import { normalizeSocketFrame } from "./protocol.js";

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
  describeProjectActions?: (projectId: string) => unknown[];
  invokeProjectAction?: (input: {
    projectId: string;
    actionId: string;
    params: unknown;
    idempotencyKey?: string;
  }) => { eventId: number; eventType: string };
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
  if (!client.filter) return true;
  const data = eventPayload(event);
  if (typeof data.sessionId === "string") return client.filter.has(data.sessionId);
  if (event.type === "message.created" && data.to === "human") return false;
  return false;
}

function eventPayload(event: ControlEvent): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? event.data as Record<string, unknown>
    : event;
}

export interface ControlSocketCoreOptions {
  getSessionId: () => string;
  getStatus: () => ControlStatusItem[];
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
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

    const data = eventPayload(event);
    if (event.type === "session.start" && typeof data.parentSessionId === "string" && typeof data.sessionId === "string") {
      for (const client of clients.values()) {
        if (client.filter?.has(data.parentSessionId)) client.filter.add(data.sessionId);
      }
    }

    const line = JSON.stringify(event) + "\n";
    let delivered = 0;
    for (const [sock, client] of clients) {
      if (!shouldForward(client, event)) continue;
      try {
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
    if (delivered > 0 && (event.type === "session.idle" || event.type === "session.end")) {
      onDelivered?.(event, delivered);
    }
  }

  const unsubscribe = subscribeEvents(broadcast);

  function attachClient(socket: Duplex): void {
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
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));

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
          const client = clients.get(socket);
          if (client && Array.isArray(sessions) && sessions.every((session) => typeof session === "string")) {
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
            client.subscribed = true;
            writeFrame(socket, { type: "ok", command: "subscribe" });
          } else {
            writeFrame(socket, {
              type: "error",
              command: "subscribe",
              message: "sessions must be an array of strings",
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
  const { socketPath, getSessionId, getStatus, emitEvent, subscribeEvents, onDelivered, onInfo, agentName, instance } = opts;
  mkdirSync(dirname(socketPath), { recursive: true });

  if (existsSync(socketPath)) {
    const alive = await isSocketAlive(socketPath);
    if (alive) {
      onInfo?.(`[control] Socket ${socketPath} is owned by another instance. Running WITHOUT a control socket. Set INSTANCE=<name> to use a separate socket.`);
      return { close: () => {}, clientCount: () => 0 };
    }
    unlinkSync(socketPath);
  }

  const core = createControlSocketCore({
    getSessionId,
    getStatus,
    emitEvent,
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
