/**
 * Unix socket UI — streams RunnerEvents as JSON lines, accepts RunnerCommands.
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
import type { EventBus, RunnerEvent } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";

// ── Valid command types (for validation) ────────────────────────────────

const VALID_COMMAND_TYPES = new Set([
  "steer",
  "cancel",
  "cancel_all",
  "cancel_task",
  "close",
  "status",
  "input",
  "run",
  "reload_agents",
  "restart",
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
  const clients = new Set<Socket>();

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

  function broadcast(event: RunnerEvent): void {
    if (clients.size === 0) return;
    const line = JSON.stringify(event) + "\n";
    for (const client of clients) {
      try {
        client.write(line);
      } catch {
        clients.delete(client);
      }
    }
  }

  // Subscribe to all events
  bus.on(broadcast);

  const server: Server = createServer((socket) => {
    clients.add(socket);

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

        // Dispatch and propagate handler result (L5)
        const result = bus.command(cmd as Parameters<typeof bus.command>[0]);
        if (result && !result.ok) {
          socket.write(
            JSON.stringify({
              type: "error",
              command: cmdType,
              message: result.message ?? "Command failed",
            }) + "\n",
          );
        } else {
          socket.write(JSON.stringify({ type: "ok", command: cmdType }) + "\n");
        }
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
      for (const c of clients) c.destroy();
      clients.clear();
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    },
    clientCount: () => clients.size,
  };
}
