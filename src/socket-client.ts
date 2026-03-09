/**
 * Socket client — command sender and event listener for detached agents.
 *
 * Connects to a Unix domain socket, writes a JSON command, reads the
 * server's ack response, and disconnects. Used for steer/cancel on
 * detached sub-agents whose socket path is recorded in identity.json.
 *
 * Also provides waitForSocketEvent() for blocking on detached session
 * completion (used by `waitFor` on detached sessions).
 *
 * Design: agents/may/workspace/detached-subagent-design.md
 */

import { connect } from "node:net";

export interface SocketResponse {
  type: "ok" | "error";
  command?: string;
  message?: string;
}

export function sendSocketCommand(
  socketPath: string,
  command: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const client = connect(socketPath);
    const timeoutMs = opts?.timeoutMs ?? 5000;
    const timeout = setTimeout(() => {
      client.destroy();
      settle(() => reject(new Error("Socket timeout")));
    }, timeoutMs);

    // Track whether we've sent the command yet
    let sent = false;
    let buffer = "";

    client.on("connect", () => {
      client.write(JSON.stringify(command) + "\n");
      sent = true;
    });

    client.on("data", (data) => {
      if (!sent) return; // Ignore welcome message race (shouldn't happen)
      buffer += data.toString();
      // Look for first complete line after our command was sent.
      // Skip the welcome message (type: "connected") and broadcast events.
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as SocketResponse;
          // The response to our command has type "ok" or "error"
          if (parsed.type === "ok" || parsed.type === "error") {
            clearTimeout(timeout);
            client.destroy();
            if (parsed.type === "error") {
              settle(() => reject(new Error(parsed.message ?? "Socket command failed")));
            } else {
              settle(() => resolve(parsed));
            }
            return;
          }
          // Otherwise it's a broadcast event (text, info, connected, etc.) — skip
        } catch {
          // Non-JSON line — skip
        }
      }
      // Keep the incomplete last line in buffer
      buffer = lines[lines.length - 1];
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });

    client.on("close", () => {
      clearTimeout(timeout);
      // If we connected and sent but never got an ack, treat as success
      // (old server without ack support, or response lost)
      if (sent) {
        settle(() => resolve({ type: "ok", command: command.type as string }));
      } else {
        settle(() => reject(new Error("Socket closed before command sent")));
      }
    });
  });
}

/** Event shape from the socket — a superset including all RunnerEvent types. */
export interface SocketEvent {
  type: string;
  sessionId?: string;
  agent?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Connect to a Unix socket and wait for a specific event type.
 * Resolves with the matching event. Rejects on timeout or socket error.
 *
 * Used primarily to wait for "session_end" or "info" events from
 * detached sub-agent processes. The socket server broadcasts all
 * RunnerEvents as JSON lines.
 *
 * @param socketPath - Path to the Unix domain socket
 * @param eventType - Event type to wait for (e.g. "session_end")
 * @param opts.sessionId - Optional: only match events with this sessionId
 * @param opts.timeoutMs - Timeout in ms (default: 600_000 = 10 minutes)
 */
export function waitForSocketEvent(
  socketPath: string,
  eventType: string,
  opts?: { sessionId?: string; timeoutMs?: number },
): Promise<SocketEvent> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const client = connect(socketPath);
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
            // If sessionId filter is provided, only match that session
            if (opts?.sessionId && event.sessionId !== opts.sessionId) continue;
            clearTimeout(timeout);
            client.destroy();
            settle(() => resolve(event));
            return;
          }
        } catch {
          // Non-JSON line — skip
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

