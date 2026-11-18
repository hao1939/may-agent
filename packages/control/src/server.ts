import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import {
  type EventInput,
  type EventReceipt,
  type EventView,
} from "./events.js";
import { normalizeSocketFrame } from "./protocol.js";

export type ControlEvent = Record<string, unknown> & { type: string };
export type ControlEmitResult = { eventId?: number };
export type ApprovalIngressAuthorization = {
  actor: { kind: "operator"; id: string };
  reference: string;
  evidence: Record<string, unknown>;
};

export interface ControlStatusItem {
  agent: string;
  sessionId: string;
  status: string;
  kind?: string;
  task: string;
}

export type ControlStatusSnapshot = { sessions: ControlStatusItem[]; activeWork: boolean };
export type ControlStatus = ControlStatusItem[] | ControlStatusSnapshot;

export interface AttachControlSocketOptions {
  socketPath: string;
  getStatus: () => ControlStatus;
  getDiagnostics?: () => Record<string, unknown>;
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  publishEvent?: (event: EventInput, approvalAuthorization?: ApprovalIngressAuthorization) => EventReceipt;
  getEvent?: (eventId: number) => EventView | undefined;
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
      kind: item.kind ?? "",
      task: item.task.slice(0, 100),
    }));
}

function statusFields(status: ControlStatus): Record<string, unknown> {
  return Array.isArray(status)
    ? { activeAgents: activeStatus(status) }
    : { activeAgents: activeStatus(status.sessions), activeWork: status.activeWork };
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
  getStatus: () => ControlStatus;
  getDiagnostics?: AttachControlSocketOptions["getDiagnostics"];
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  publishEvent?: AttachControlSocketOptions["publishEvent"];
  getEvent?: AttachControlSocketOptions["getEvent"];
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
    getStatus,
    emitEvent,
    publishEvent,
    getEvent,
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

  }

  const unsubscribe = subscribeEvents(broadcast);

  const controlHandlers: Record<string, (frame: Record<string, unknown>) => Record<string, unknown>> = {
    status: (frame) => {
      try {
        return {
          type: "status",
          ...statusFields(getStatus()),
          ...(frame.diagnostics === true ? { diagnostics: { ...runtimeDiagnostics(), ...opts.getDiagnostics?.() } } : {}),
        };
      } catch {
        throw new Error("Execution status unavailable");
      }
    },
    publish: (frame) => {
      const input = frame.event;
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("publish requires object field 'event'");
      }
      if (!publishEvent) throw new Error("Event publication is unavailable");
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
      const approvalAuthorization =
        (eventType === "project.approval.submitted" ||
          (eventType === "conversation.message.created" && frame.operatorId && eventData.approvalReply))
          ? {
              actor: {
                kind: "operator" as const,
                id: typeof frame.operatorId === "string" ? frame.operatorId.trim() : "",
              },
              reference:
                typeof frame.authorizationReference === "string" ? frame.authorizationReference.trim() : "",
              evidence:
                frame.authorizationEvidence &&
                typeof frame.authorizationEvidence === "object" &&
                !Array.isArray(frame.authorizationEvidence)
                  ? (frame.authorizationEvidence as Record<string, unknown>)
                  : {},
            }
          : undefined;
      return publishEvent(
        {
          type: eventType,
          ...(eventTarget ? { target: eventTarget } : {}),
          data: eventData,
          ...(typeof event.idempotencyKey === "string" && event.idempotencyKey.trim()
            ? { idempotencyKey: event.idempotencyKey.trim() }
            : {}),
        },
        approvalAuthorization,
      );
    },
    "event.get": (frame) => {
      const eventId = Number(frame.eventId);
      if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("eventId must be a positive integer");
      if (!getEvent) throw new Error("Event reads are unavailable");
      const event = getEvent(eventId);
      if (!event) throw new Error(`Event ${eventId} was not found`);
      return { event };
    },
  };

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
      subscribed: false,
    });
    const removeClient = () => clients.delete(socket);
    socket.on("close", removeClient);
    socket.on("error", removeClient);
    socket.on("end", removeClient);
    socket.on("finish", removeClient);

    let initialStatus: Record<string, unknown>;
    try {
      initialStatus = statusFields(getStatus());
    } catch {
      initialStatus = { statusError: "Execution status unavailable" };
    }
    writeFrame(socket, {
      type: "connected",
      pid: process.pid,
      agent: agentName,
      instance,
      sessionId: "",
      ...initialStatus,
    });

    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (data) => {
      buffer += data;
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
          if (client && Array.isArray(sessions) && sessions.every((session) => typeof session === "string")
            && frame.conversations === undefined && frame.taskApps === undefined && frame.task === undefined) {
            client.filter = sessions.includes("*") ? null : new Set(sessions);
            client.subscribed = true;
            writeFrame(socket, { type: "ok", command: "subscribe" });
          } else {
            writeFrame(socket, { type: "error", command: "subscribe",
              message: "sessions must be an array of strings; use HTTP /ws for Conversation and Task watches" });
          }
          continue;
        }

        if (normalized.kind === "control") {
          const handler = controlHandlers[normalized.command];
          if (handler) {
            try {
              const result = handler(frame);
              writeFrame(socket, {
                type: typeof result.type === "string" ? result.type : "ok",
                command: normalized.command,
                ...result,
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
    getStatus,
    getDiagnostics: opts.getDiagnostics,
    emitEvent,
    publishEvent,
    getEvent,
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
