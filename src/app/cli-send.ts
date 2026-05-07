/**
 * cli-message.ts -- Send a message to an agent from the command line.
 *
 * Usage:
 *   bun src/app/may.ts --send bob --message "do the thing"
 *   bun src/app/may.ts --send bob --message-file /tmp/brief.txt
 *   bun src/app/may.ts --send bob --message "review this" --artifact docs/design/foo.md
 *
 * Delivery:
 *   1. Tracks the request in the SQLite DB (always)
 *   2. Finds a live socket (scans .state/instances/ for may.sock)
 *   3. Sends via socket as "@agent message" so May can delegate/monitor it
 *   4. If no socket found, task is still tracked in DB and will appear in next heartbeat
 *
 * Exits 0 on success, 1 on error.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { sendSocketCommand } from "../lib/socket-client.js";


export interface SendOptions {
  agent: string;
  message: string;
  artifact?: string;
  persistDir: string;
  agentsRoot: string;
  source?: string;
}

/**
 * Find a live socket by scanning instance directories.
 * Returns the first socket path that exists, or null.
 */
function findSocket(persistDir: string): string | null {
  const instancesDir = resolve(persistDir, "instances");
  if (!existsSync(instancesDir)) return null;

  try {
    const dirs = readdirSync(instancesDir);
    for (const dir of dirs) {
      const sockPath = resolve(instancesDir, dir, "may.sock");
      if (existsSync(sockPath)) {
        try {
          // Check if it's actually a socket (not a stale file)
          const stat = statSync(sockPath);
          if (stat.isSocket?.() || stat.isFIFO?.()) return sockPath;
          // On some systems isSocket() isn't reliable, try anyway
          return sockPath;
        } catch {
          continue;
        }
      }
    }
  } catch {
    // Can't read instances dir
  }
  return null;
}

export async function cliSend(opts: SendOptions): Promise<void> {
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

  // Try socket delivery first — chatSession.handleInput will track in DB
  const socketPath = findSocket(persistDir);
  if (socketPath) {
    try {
      // Use @agent prefix so ChatSession routes it correctly
      const socketMessage = `@${agent} ${fullMessage}`;
      const result = await sendSocketCommand(socketPath, {
        type: "input",
        message: socketMessage,
        source: source ?? "cli",
      });

      if (result.type === "ok") {
        console.log(`Sent to ${agent} via socket (${socketPath})`);
        return;
      }
      // Socket returned error — fall through to DB-only tracking
      console.error(`Socket returned error: ${result.message}. Task tracked in DB, will appear in next heartbeat.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Socket delivery failed: ${msg}. Task tracked in DB, will appear in next heartbeat.`);
    }
  }

  // No socket or socket failed — message will appear in next heartbeat
  if (!socketPath) {
    console.log(`No live socket found. Task will appear in ${agent}'s next heartbeat.`);
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
