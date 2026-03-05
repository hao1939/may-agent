/**
 * Unix socket UI — streams RunnerEvents as JSON lines, accepts RunnerCommands.
 *
 * Usage:
 *   # Watch events:
 *   socat - UNIX-CONNECT:.state/may.sock
 *
 *   # Send a command:
 *   echo '{"type":"steer","message":"Stop"}' | socat - UNIX-CONNECT:.state/may.sock
 *
 *   # Interactive:
 *   socat READLINE UNIX-CONNECT:.state/may.sock
 */

import { createServer, connect, type Server, type Socket } from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import type { EventBus, RunnerEvent } from "./event-bus.js";
import type { SubagentManager } from "../src/index.js";

export interface SocketUIOptions {
  socketPath: string;
  bus: EventBus;
  manager: SubagentManager;
  getSessionId: () => string;
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
  const { socketPath, bus, manager, getSessionId } = opts;
  const clients = new Set<Socket>();

  // If socket file exists, check whether it's live or stale
  if (existsSync(socketPath)) {
    const alive = await isSocketAlive(socketPath);
    if (alive) {
      // Another instance owns this socket — run without one
      console.error(`[control] Socket ${socketPath} is owned by another instance.`);
      console.error(`[control] This instance will run WITHOUT a control socket.`);
      console.error(`[control] Set INSTANCE=<name> to use a separate socket.`);
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

    // Welcome message with current state
    const status = manager.status();
    const running = status.filter((s) => s.status === "running");
    socket.write(JSON.stringify({
      type: "connected",
      maySession: getSessionId(),
      activeAgents: running.map((s) => ({
        agent: s.agent,
        sessionId: s.sessionId,
        task: s.task.slice(0, 100),
      })),
    }) + "\n");

    // Handle incoming commands
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const cmd = JSON.parse(trimmed);
          bus.command(cmd);
          socket.write(JSON.stringify({ type: "ok", command: cmd.type }) + "\n");
        } catch {
          socket.write(JSON.stringify({ type: "error", message: `Invalid JSON: ${trimmed.slice(0, 100)}` }) + "\n");
        }
      }
    });

    socket.on("close", () => { clients.delete(socket); });
    socket.on("error", () => { clients.delete(socket); });
  });

  server.listen(socketPath, () => {
    console.log(`[control] Listening on ${socketPath}`);
  });

  server.on("error", (err) => {
    console.error(`[control] Socket error: ${err.message}`);
  });

  server.on("close", () => {
    console.error(`[control] Socket server CLOSED`);
  });

  // Cleanup on process exit
  const cleanup = () => {
    try {
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    } catch { /* ignore */ }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

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
