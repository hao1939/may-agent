import { existsSync, unlinkSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import type { Duplex } from "node:stream";
import { normalizeSocketFrame } from "./protocol.js";

export type ControlEvent = Record<string, unknown> & { type: string };

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
  emitEvent: (event: ControlEvent) => void;
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
  chatMode: boolean;
}

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
  emitEvent: (event: ControlEvent) => void;
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  agentName: string;
  instance: string;
}

export function createControlSocketCore(opts: ControlSocketCoreOptions): {
  attachClient: (socket: Duplex) => void;
  close: () => void;
  clientCount: () => number;
} {
  const { getSessionId, getStatus, emitEvent, subscribeEvents, agentName, instance } = opts;
  const clients = new Map<Duplex, ClientState>();
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
    for (const [sock, client] of clients) {
      if (!shouldForward(client, event)) continue;
      try {
        sock.write(line);
      } catch {
        clients.delete(sock);
      }
    }
  }

  const unsubscribe = subscribeEvents(broadcast);

  function attachClient(socket: Duplex): void {
    clients.set(socket, { socket, filter: null, chatMode: false });

    socket.write(
      JSON.stringify({
        type: "connected",
        pid: process.pid,
        agent: agentName,
        instance,
        sessionId: getSessionId(),
        activeAgents: socketStatus(getStatus(), getSessionId(), agentName),
      }) + "\n",
    );

    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          socket.write(JSON.stringify({ type: "error", message: `Invalid JSON: ${trimmed.slice(0, 100)}` }) + "\n");
          continue;
        }

        const normalized = normalizeSocketFrame(frame);
        if (normalized.kind === "error") {
          socket.write(
            JSON.stringify({
              type: "error",
              command: normalized.command ?? null,
              message: normalized.message,
            }) + "\n",
          );
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "subscribe") {
          const sessions = frame.sessions as string[] | undefined;
          const client = clients.get(socket);
          if (client && Array.isArray(sessions)) {
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
            socket.write(JSON.stringify({ type: "ok", command: "subscribe" }) + "\n");
          } else {
            socket.write(JSON.stringify({ type: "error", command: "subscribe", message: "sessions must be an array" }) + "\n");
          }
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "status") {
          socket.write(JSON.stringify({ type: "status", activeAgents: socketStatus(getStatus(), getSessionId(), agentName) }) + "\n");
          continue;
        }

        if (normalized.kind !== "event") continue;
        socket.write(JSON.stringify({ type: "ok", command: normalized.command }) + "\n");
        setImmediate(() => emitEvent(normalized.event as ControlEvent));
      }
    });

    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
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
  const { socketPath, getSessionId, getStatus, emitEvent, subscribeEvents, onInfo, agentName, instance } = opts;

  if (existsSync(socketPath)) {
    const alive = await isSocketAlive(socketPath);
    if (alive) {
      onInfo?.(`[control] Socket ${socketPath} is owned by another instance. Running WITHOUT a control socket. Set INSTANCE=<name> to use a separate socket.`);
      return { close: () => {}, clientCount: () => 0 };
    }
    unlinkSync(socketPath);
  }

  const core = createControlSocketCore({ getSessionId, getStatus, emitEvent, subscribeEvents, agentName, instance });
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
      onInfo?.(`[control] Listening on ${socketPath}`);
      resolve();
    });
  });

  return {
    close: () => {
      process.off("exit", cleanup);
      core.close();
      cleanup();
    },
    clientCount: () => core.clientCount(),
  };
}
