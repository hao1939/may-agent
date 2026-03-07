/**
 * Socket client — command sender for detached agents.
 *
 * Connects to a Unix domain socket, writes a JSON command, reads the
 * server's ack response, and disconnects. Used for steer/cancel on
 * detached sub-agents whose socket path is recorded in identity.json.
 *
 * Design: docs/socket-protocol.md
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
