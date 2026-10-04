/**
 * cli-send.ts -- Send a message to an agent from the command line.
 *
 * Usage:
 *   bun src/app/may.ts --send worker --message "do the thing"
 *   bun src/app/may.ts --send worker --message-file /tmp/brief.txt
 *   bun src/app/may.ts --send worker --message "review this" --artifact /path/to/proposal.md
 *
 * Delivery:
 *   1. Receives the CLI-selected binding and convention daemon socket path:
 *      <persistDir>/instances/<DAEMON_INSTANCE>/<interface-agent>.sock
 *   2. Requires App admission for the interface agent; other agents use direct chat
 *   3. Fails clearly if the daemon socket cannot accept the message
 *
 * Exits 0 on success, 1 on error.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { sendAgentMessage, type InterfaceBinding } from "@may-agent/control/client";


interface SendMessage {
  agent: string;
  message: string;
  artifact?: string;
  source?: string;
}

export interface SendOptions extends SendMessage {
  socketPath: string;
  interface: InterfaceBinding;
}

export async function cliSend(opts: SendOptions): Promise<boolean> {
  const { agent, message, artifact, socketPath, source } = opts;

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

  try {
    const result = await sendAgentMessage(socketPath, agent, fullMessage, source ?? "cli", {
      timeoutMs: 5000,
      interface: opts.interface,
    });
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
      "Input was not delivered. Check the destination binding and the running daemon's instance and agent selection.",
    );
    return false;
  }
}

/**
 * Parse --send CLI args from process.argv.
 * Returns null if --send is not present.
 */
export function parseSendArgs(argv: string[]): SendMessage | null {
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

  return {
    agent,
    message,
    artifact,
  };
}
