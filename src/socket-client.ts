/**
 * Socket client — fire-and-forget command sender for detached agents.
 *
 * Connects to a Unix domain socket, writes a JSON command, and disconnects.
 * Used for steer/cancel on detached sub-agents whose socket path is
 * recorded in their instance identity.json.
 *
 * Design: agents/shared/detached-subagent-design.md (Phase 2)
 */

import { connect } from "node:net";

export function sendSocketCommand(
  socketPath: string,
  command: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
    const client = connect(socketPath);
    const timeout = setTimeout(() => {
      client.destroy();
      settle(() => reject(new Error("Socket timeout")));
    }, opts?.timeoutMs ?? 5000);

    client.on("connect", () => {
      client.write(JSON.stringify(command) + "\n");
      clearTimeout(timeout);
      client.destroy();
      settle(() => resolve());
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });
  });
}
