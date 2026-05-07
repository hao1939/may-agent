/**
 * Unix socket UI — streams AgentEvents as JSON lines, accepts commands.
 *
 * Design: docs/socket-protocol.md
 *
 * Usage:
 *   # Watch events:
 *   socat - UNIX-CONNECT:.state/instances/default/may.sock
 *
 *   # Send a command:
 *   echo '{"type":"steer","message":"Stop"}' | socat - UNIX-CONNECT:.state/instances/default/may.sock
 *
 *   # Interactive:
 *   socat READLINE UNIX-CONNECT:.state/instances/default/may.sock
 */

import { createServer, connect, type Server, type Socket } from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import type { EventBus, AgentEvent } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";

// ── Frame normalization ─────────────────────────────────────────────────
//
// Event-first rule: socket-local protocol is tiny (`subscribe`, `status`).
// Everything else is normalized to one bus event and emitted unchanged where
// practical. Legacy aliases stay here at the boundary.

const SOCKET_CONTROL_TYPES = new Set(["subscribe", "status"]);

export type SocketFrame =
  | { kind: "control"; command: "subscribe" | "status"; frame: Record<string, unknown> }
  | { kind: "event"; command: string; event: Record<string, unknown> }
  | { kind: "error"; command: unknown; message: string };

export function normalizeSocketFrame(frame: Record<string, unknown>): SocketFrame {
  const cmdType = frame.type;
  if (typeof cmdType !== "string" || !cmdType.trim()) {
    return { kind: "error", command: cmdType ?? null, message: `Missing or invalid event type: ${String(cmdType)}` };
  }

  if (SOCKET_CONTROL_TYPES.has(cmdType)) {
    return { kind: "control", command: cmdType as "subscribe" | "status", frame };
  }

  if (cmdType === "emit") {
    const eventName = frame.event;
    if (typeof eventName !== "string" || !eventName.trim()) {
      return { kind: "error", command: cmdType, message: "emit frame requires string field 'event'" };
    }
    const { type: _, event: __, ...rest } = frame;
    return { kind: "event", command: cmdType, event: { type: eventName, ...rest } };
  }

  let event: Record<string, unknown> = { ...frame };

  if (cmdType === "input") {
    if (!event.source) event.source = "socket";
    if (!event.message && event.content) event.message = event.content;
  } else if (cmdType === "fork") {
    event = {
      type: "fork",
      agent: frame.agent,
      task: frame.task ?? frame.message,
      opts: { ...(typeof frame.opts === "object" && frame.opts ? frame.opts : {}), source: "socket" },
    };
  } else if (cmdType === "message" && !event.task && event.content) {
    event.task = event.content;
  } else if (cmdType === "close") {
    event = { type: "shutdown" };
  } else if (cmdType === "cancel_task") {
    event = { type: "cancel_all" };
  } else if (cmdType === "reload_agents") {
    event = { type: "reload" };
  }

  return { kind: "event", command: cmdType, event };
}

export interface SocketUIOptions {
  socketPath: string;
  bus: EventBus;
  manager: SubagentManager;
  getSessionId: () => string;
  /** Agent name for the interface agent (included in welcome message). */
  agentName: string;
  /** Instance label (included in welcome message). */
  instance: string;
}

export interface SocketUI {
  close: () => void;
  clientCount: () => number;
}

/**
 * Check if a socket file has a live listener by attempting to connect.
 */
function isSocketAlive(socketPath: string): Promise<boolean> {
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

export async function attachSocketUI(opts: SocketUIOptions): Promise<SocketUI> {
  const { socketPath, bus, manager, getSessionId, agentName, instance } = opts;

  // If socket file exists, check whether it's live or stale
  if (existsSync(socketPath)) {
    const alive = await isSocketAlive(socketPath);
    if (alive) {
      // Another instance owns this socket — run without one
      bus.emit({
        type: "info",
        message: `[control] Socket ${socketPath} is owned by another instance. Running WITHOUT a control socket. Set INSTANCE=<name> to use a separate socket.`,
      });
      return {
        close: () => {},
        clientCount: () => 0,
      };
    }
    // Stale socket — clean up and take over
    unlinkSync(socketPath);
  }

  // Per-client state: session filter for subscribe command
  interface ClientState {
    socket: Socket;
    /** Session IDs this client is watching. null = firehose (all events). */
    filter: Set<string> | null;
    /** When true, auto-track the chat session from getSessionId() + children. */
    chatMode: boolean;
  }
  const clients = new Map<Socket, ClientState>();

  function shouldForward(client: ClientState, event: AgentEvent): boolean {
    if (!client.filter) return true; // firehose — no filter
    if ("sessionId" in event && typeof event.sessionId === "string") {
      return client.filter.has(event.sessionId);
    }
    // message.created to "human": skip for filtered clients (they pollute session-scoped streams).
    // Firehose clients already get them via the `return true` above.
    if (event.type === "message.created" && (event as any).to === "human") return false;
    // system events (log, info, prompt, eval, workflow) only in firehose
    return false;
  }

  function broadcast(event: AgentEvent): void {
    if (clients.size === 0) return;

    // Chat-mode clients: keep filter in sync with the current chat session
    const chatSid = getSessionId();
    for (const client of clients.values()) {
      if (client.chatMode) {
        if (chatSid) {
          if (!client.filter) client.filter = new Set();
          if (!client.filter.has(chatSid)) {
            client.filter.clear();
            client.filter.add(chatSid);
          }
        } else {
          // No active chat session (e.g., after /new) — clear filter
          // so the next session.start will be picked up
          if (client.filter) client.filter.clear();
        }
      }
    }

    // Auto-expand: when a session starts with a parentSessionId in a client's filter,
    // add the new session to that client's filter automatically.
    if (event.type === "session.start" && event.parentSessionId) {
      for (const client of clients.values()) {
        if (client.filter?.has(event.parentSessionId)) {
          client.filter.add(event.sessionId);
        }
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

  // Subscribe to all events
  bus.subscribe(broadcast);

  const server: Server = createServer((socket) => {
    clients.set(socket, { socket, filter: null, chatMode: false });

    // Welcome message with process metadata and current state (L6)
    const status = manager.status();
    socket.write(
      JSON.stringify({
        type: "connected",
        pid: process.pid,
        agent: agentName,
        instance,
        sessionId: getSessionId(),
        activeAgents: status
          .filter((s) => s.status === "running" || s.status === "idle")
          .map((s) => ({
            agent: s.agent,
            sessionId: s.sessionId,
            status: s.status,
            kind: s.kind,
            task: s.task.slice(0, 100),
          })),
      }) + "\n",
    );

    // Handle incoming commands
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let cmd: Record<string, unknown>;
        try {
          cmd = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          socket.write(JSON.stringify({ type: "error", message: `Invalid JSON: ${trimmed.slice(0, 100)}` }) + "\n");
          continue;
        }

        const normalized = normalizeSocketFrame(cmd);
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

        // Handle subscribe locally (socket-server concern, not bus command)
        if (normalized.kind === "control" && normalized.command === "subscribe") {
          const sessions = cmd.sessions as string[] | undefined;
          const client = clients.get(socket);
          if (client && Array.isArray(sessions)) {
            if (sessions.includes("*")) {
              client.filter = null; // firehose
              client.chatMode = false;
            } else if (sessions.includes("chat")) {
              // Chat mode: auto-track the active chat session + children
              client.chatMode = true;
              const chatSid = getSessionId();
              client.filter = chatSid ? new Set([chatSid]) : new Set();
            } else {
              client.filter = new Set(sessions);
              client.chatMode = false;
            }
            socket.write(JSON.stringify({ type: "ok", command: "subscribe" }) + "\n");
          } else {
            socket.write(
              JSON.stringify({ type: "error", command: "subscribe", message: "sessions must be an array" }) + "\n",
            );
          }
          continue;
        }

        // Handle status locally — return active sessions list to the requesting client
        if (normalized.kind === "control" && normalized.command === "status") {
          const statusList = manager.status();
          socket.write(
            JSON.stringify({
              type: "status",
              activeAgents: statusList
                .filter((s) => s.status === "running" || s.status === "idle")
                .map((s) => ({
                  agent: s.agent,
                  sessionId: s.sessionId,
                  status: s.status,
                  kind: s.kind,
                  task: s.task.slice(0, 100),
                })),
            }) + "\n",
          );
          continue;
        }
        if (normalized.kind !== "event") continue;

        // Ack acceptance before dispatch. The bus is synchronous and handlers
        // can be slow; socket ack means "accepted into event transport", not
        // "all handlers completed".
        socket.write(JSON.stringify({ type: "ok", command: normalized.command }) + "\n");
        setImmediate(() => {
          bus.emit(normalized.event as Parameters<typeof bus.emit>[0]);
        });
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
    });
    socket.on("error", () => {
      clients.delete(socket);
    });
  });

  server.listen(socketPath, () => {
    bus.emit({ type: "info", message: `[control] Listening on ${socketPath}` });
  });

  server.on("error", (err) => {
    bus.emit({ type: "info", message: `[control] Socket error: ${err.message}` });
  });

  server.on("close", () => {
    bus.emit({ type: "info", message: `[control] Socket server CLOSED` });
  });

  // Cleanup on process exit
  const cleanup = () => {
    try {
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    } catch {
      /* ignore */
    }
  };
  process.on("exit", cleanup);

  return {
    close: () => {
      for (const c of clients.keys()) c.destroy();
      clients.clear();
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    },
    clientCount: () => clients.size,
  };
}
