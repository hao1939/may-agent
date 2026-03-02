/**
 * Unix socket UI — streams RunnerEvents as JSON lines, accepts RunnerCommands.
 *
 * Usage:
 *   # Watch events:
 *   socat - UNIX-CONNECT:/home/example-user/may-agent/.state/may.sock
 *
 *   # Send a steer command:
 *   echo '{"type":"steer","message":"Stop modifying tools.ts"}' | socat - UNIX-CONNECT:/home/example-user/may-agent/.state/may.sock
 *
 *   # Interactive (read + write):
 *   socat READLINE UNIX-CONNECT:/home/example-user/may-agent/.state/may.sock
 */

import { createServer, type Server, type Socket } from "node:net";
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

export function attachSocketUI(opts: SocketUIOptions): SocketUI {
  const { socketPath, bus, manager, getSessionId } = opts;
  const clients = new Set<Socket>();

  // Clean up stale socket file
  if (existsSync(socketPath)) {
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

  // Cleanup on process exit
  const cleanup = () => {
    try {
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    } catch { /* ignore */ }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

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
