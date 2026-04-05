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

// ── Valid command types (for validation) ────────────────────────────────

const VALID_COMMAND_TYPES = new Set([
  "steer",
  "cancel",
  "cancel_all",
  "cancel_task",
  "close",
  "subscribe",
  "status",
  "input",
  "fork",
  "message",
  "reload_agents",
  "reload",
  "restart",
  "resume",
]);

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
    // notification events always forwarded to filtered clients
    if (event.type === "notification") return true;
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
          // so the next session_start will be picked up
          if (client.filter) client.filter.clear();
        }
      }
    }

    // Auto-expand: when a session starts with a parentSessionId in a client's filter,
    // add the new session to that client's filter automatically.
    if (event.type === "session_start" && event.parentSessionId) {
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

        // Validate command type (L4)
        const cmdType = cmd.type;
        if (typeof cmdType !== "string" || !VALID_COMMAND_TYPES.has(cmdType)) {
          socket.write(
            JSON.stringify({
              type: "error",
              command: cmdType ?? null,
              message: `Unknown command type: ${String(cmdType)}`,
            }) + "\n",
          );
          continue;
        }

        // Inject source for input commands from socket (if not already set)
        if (cmdType === "input" && !cmd.source) {
          cmd.source = "socket";
        }
        // Normalize "content" → "message" for input commands (common mistake)
        if (cmdType === "input" && !cmd.message && cmd.content) {
          cmd.message = cmd.content;
        }

        // Handle subscribe locally (socket-server concern, not bus command)
        if (cmdType === "subscribe") {
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
        if (cmdType === "status") {
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

        // Normalize and emit to bus — single path for all commands
        // Socket-only aliases: run → fork, close → shutdown, cancel_task → cancel, reload_agents → reload
        let busEvent: Record<string, unknown> = { ...cmd };
        if (cmdType === "fork") {
          busEvent = { type: "fork", agent: cmd.agent, task: cmd.message, opts: { source: "socket" } };
        } else if (cmdType === "fork") {
          busEvent = { type: "fork", agent: cmd.agent, task: cmd.task ?? cmd.message, opts: { source: "socket" } };
        } else if (cmdType === "close") {
          busEvent = { type: "shutdown" };
        } else if (cmdType === "cancel_task") {
          busEvent = { type: "cancel_all" };
        } else if (cmdType === "reload_agents") {
          busEvent = { type: "reload" };
        }

        bus.emit(busEvent as Parameters<typeof bus.emit>[0]);
        socket.write(JSON.stringify({ type: "ok", command: cmdType }) + "\n");
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
