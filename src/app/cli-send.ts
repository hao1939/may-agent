/**
 * cli-message.ts -- Send a message to an agent from the command line.
 *
 * Usage:
 *   bun src/app/may.ts --send bob --message "do the thing"
 *   bun src/app/may.ts --send bob --message-file /tmp/brief.txt
 *   bun src/app/may.ts --send bob --message "review this" --artifact projects/may-agent.app/docs/3-proposals/foo.md
 *
 * Delivery:
 *   1. Uses the convention daemon socket path:
 *      <persistDir>/instances/<DAEMON_INSTANCE>/<DAEMON_AGENT>.sock
 *   2. Sends via socket as "@agent message" so May can delegate/monitor it
 *   3. Fails clearly if the daemon socket cannot accept the message
 *
 * Exits 0 on success, 1 on error.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { daemonSocketPath, sendAgentMessage } from "../../packages/control/src/client.js";


export interface SendOptions {
  agent: string;
  message: string;
  artifact?: string;
  persistDir: string;
  agentsRoot: string;
  source?: string;
}

export async function cliSend(opts: SendOptions): Promise<boolean> {
  const { agent, message, artifact, persistDir, agentsRoot: _agentsRoot, source } = opts;

  // Validate artifact exists if provided
  if (artifact) {
    // Check relative to project root (parent of persistDir typically)
    const absArtifact = resolve(process.cwd(), artifact);
    if (!existsSync(absArtifact) && !existsSync(artifact)) {
      console.error(`Error: artifact not found: ${artifact}`);
      process.exit(1);
    }
  }

  // Build the full message with artifact context
  let fullMessage = message;
  if (artifact) {
    fullMessage = `${message}\n\nArtifact: ${artifact}`;
  }

  const socketPath = daemonSocketPath(persistDir, {
    instance: process.env.DAEMON_INSTANCE || process.env.INSTANCE || "default",
    interfaceAgent: process.env.DAEMON_AGENT || process.env.AGENT || "may",
  });

  try {
    const result = await sendAgentMessage(socketPath, agent, fullMessage, source ?? "cli", { timeoutMs: 5000 });
    if (result.type === "ok") {
      console.log(`Sent to ${agent} via daemon socket (${socketPath})`);
      return true;
    }
    console.error(`Daemon socket returned ${result.type}: ${result.message ?? "unknown response"} (${socketPath})`);
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `Daemon socket delivery failed at ${socketPath}: ${msg}. ` +
      "Task was not delivered. Start the daemon or set DAEMON_INSTANCE/DAEMON_AGENT to the running daemon convention path.",
    );
    return false;
  }
}

/**
 * Parse --send CLI args from process.argv.
 * Returns null if --send is not present.
 */
export function parseSendArgs(argv: string[]): SendOptions | null {
  const sendIdx = argv.indexOf("--send");
  if (sendIdx === -1) return null;

  const agent = argv[sendIdx + 1];
  if (!agent || agent.startsWith("--")) {
    console.error("Error: --send requires an agent name. Usage: --send <agent> --message <text>");
    process.exit(1);
  }

  // Get message from --message or --message-file
  let message: string | undefined;
  const msgIdx = argv.indexOf("--message");
  if (msgIdx !== -1 && argv[msgIdx + 1]) {
    message = argv[msgIdx + 1];
  }
  const fileIdx = argv.indexOf("--message-file");
  if (fileIdx !== -1 && argv[fileIdx + 1]) {
    const filePath = argv[fileIdx + 1]!;
    if (!existsSync(filePath)) {
      console.error(`Error: message file not found: ${filePath}`);
      process.exit(1);
    }
    message = readFileSync(filePath, "utf-8").trim();
  }
  if (!message) {
    console.error("Error: --send requires --message <text> or --message-file <path>");
    process.exit(1);
  }

  // Optional --artifact
  let artifact: string | undefined;
  const artIdx = argv.indexOf("--artifact");
  if (artIdx !== -1 && argv[artIdx + 1]) {
    artifact = argv[artIdx + 1];
  }

  // These are resolved by the caller (may.ts) before passing in
  return {
    agent,
    message,
    artifact,
    persistDir: "", // filled by caller
    agentsRoot: "", // filled by caller
  };
}
