import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { connect, type NetConnectOpts, type Socket } from "node:net";
import { join, resolve } from "node:path";
import type { Duplex } from "node:stream";

export interface SocketResponse {
  type: "ok" | "error" | "status";
  command?: string;
  message?: string;
  [key: string]: unknown;
}

export type SocketEndpoint = string | NetConnectOpts | (() => Duplex);

export function connectSocketEndpoint(endpoint: SocketEndpoint): Socket | Duplex {
  if (typeof endpoint === "function") return endpoint();
  return typeof endpoint === "string" ? connect(endpoint) : connect(endpoint);
}

export interface FindDaemonSocketOptions {
  agent?: string;
  preferRunning?: boolean;
}

export function findDaemonSocket(persistDir: string, opts: FindDaemonSocketOptions = {}): string | null {
  const agent = opts.agent ?? "may";
  const preferRunning = opts.preferRunning ?? true;
  const instancesDir = resolve(persistDir, "instances");
  if (!existsSync(instancesDir)) return null;

  const candidates: Array<{ path: string; running: boolean; instance: string; mtimeMs: number }> = [];
  try {
    for (const instance of readdirSync(instancesDir)) {
      const dir = join(instancesDir, instance);
      try {
        if (agent === "*" && instance.startsWith("job-")) continue;
        const files = readdirSync(dir);
        for (const file of files) {
          if (file !== `${agent}.sock` && !(agent === "*" && file.endsWith(".sock"))) continue;
          const socketPath = join(dir, file);
          if (!existsSync(socketPath)) continue;
          let mtimeMs = 0;
          try {
            const stat = statSync(socketPath);
            if (!stat.isSocket?.() && !stat.isFIFO?.()) continue;
            mtimeMs = stat.mtimeMs;
          } catch {
            continue;
          }
          let running = false;
          try {
            const identity = JSON.parse(readFileSync(join(dir, "identity.json"), "utf-8")) as { status?: string };
            running = identity.status === "running";
          } catch {
            running = false;
          }
          candidates.push({ path: socketPath, running, instance, mtimeMs });
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  const ranked = candidates.sort((a, b) => {
    const aDaemon = !a.instance.startsWith("job-");
    const bDaemon = !b.instance.startsWith("job-");
    if (agent === "*" && aDaemon !== bDaemon) return aDaemon ? -1 : 1;
    if (preferRunning && a.running !== b.running) return a.running ? -1 : 1;
    if (aDaemon !== bDaemon) return aDaemon ? -1 : 1;
    return b.mtimeMs - a.mtimeMs;
  });
  return ranked[0]?.path ?? null;
}

export function sendSocketCommand(
  socketPath: SocketEndpoint,
  command: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    const client = connectSocketEndpoint(socketPath);
    const timeoutMs = opts?.timeoutMs ?? 5000;
    const timeout = setTimeout(() => {
      client.destroy();
      settle(() => reject(new Error("Socket timeout")));
    }, timeoutMs);

    let sent = false;
    let buffer = "";

    client.on("connect", () => {
      client.write(JSON.stringify(command) + "\n");
      sent = true;
    });

    client.on("data", (data) => {
      if (!sent) return;
      buffer += data.toString();
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as SocketResponse;
          if (parsed.type === "ok" || parsed.type === "error" || parsed.type === command.type) {
            clearTimeout(timeout);
            client.destroy();
            if (parsed.type === "error") {
              settle(() => reject(new Error(parsed.message ?? "Socket command failed")));
            } else {
              settle(() => resolve(parsed));
            }
            return;
          }
        } catch {
          // Non-JSON line: ignore.
        }
      }
      buffer = lines[lines.length - 1];
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });

    client.on("close", () => {
      clearTimeout(timeout);
      if (sent) {
        settle(() => resolve({ type: "ok", command: command.type as string }));
      } else {
        settle(() => reject(new Error("Socket closed before command sent")));
      }
    });
  });
}

export interface SocketEvent {
  type: string;
  sessionId?: string;
  agent?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
}

export function waitForSocketEvent(
  socketPath: SocketEndpoint,
  eventType: string,
  opts?: { sessionId?: string; timeoutMs?: number },
): Promise<SocketEvent> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    const client = connectSocketEndpoint(socketPath);
    const timeoutMs = opts?.timeoutMs ?? 600_000;
    const timeout = setTimeout(() => {
      client.destroy();
      settle(() => reject(new Error(`Timeout waiting for ${eventType} (${timeoutMs}ms)`)));
    }, timeoutMs);

    let buffer = "";
    client.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as SocketEvent;
          if (event.type === eventType) {
            if (opts?.sessionId && event.sessionId !== opts.sessionId) continue;
            clearTimeout(timeout);
            client.destroy();
            settle(() => resolve(event));
            return;
          }
        } catch {
          // Non-JSON line: ignore.
        }
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });

    client.on("close", () => {
      clearTimeout(timeout);
      settle(() => reject(new Error("Socket closed before event received")));
    });
  });
}

export function emitDaemonEvent(
  endpoint: SocketEndpoint,
  eventType: string,
  data: Record<string, unknown> = {},
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendDaemonEvent(endpoint, { ...data, type: eventType }, opts);
}

export function sendDaemonEvent(
  endpoint: SocketEndpoint,
  event: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendSocketCommand(endpoint, event, opts);
}

export function sendDaemonInput(
  endpoint: SocketEndpoint,
  message: string,
  source = "control",
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendSocketCommand(endpoint, { type: "input", message, source }, opts);
}

export function sendAgentMessage(
  endpoint: SocketEndpoint,
  agent: string,
  message: string,
  source = "control",
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendDaemonInput(endpoint, `@${agent} ${message}`, source, opts);
}
