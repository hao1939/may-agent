/**
 * OpenClaw UI — bridges may-agent events to OpenClaw's messaging channels.
 *
 * Outbound (May → Telegram/etc):
 *   Subscribes to bus events. Accumulates chat-channel assistant text.
 *   When the interface agent finishes a turn, sends the accumulated text
 *   via `openclaw message send`.
 *
 * Inbound (Telegram/etc → May):
 *   Watches an inbox file for new messages. When a line appears, it's
 *   sent to the runner as an input command.
 *
 * Configuration (env vars):
 *   OPENCLAW_CHANNEL  — channel to send to (default: "telegram")
 *   OPENCLAW_TARGET   — target user/chat ID (required for outbound)
 *   OPENCLAW_INBOX    — path to inbox file for inbound messages (optional)
 *   OPENCLAW_BIN      — path to openclaw binary (default: "openclaw")
 *
 * Inbox file protocol:
 *   Each line is a message. Lines are consumed (file is truncated) after reading.
 *   External tools (OpenClaw cron, scripts) append lines to this file.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, watchFile, unwatchFile } from "node:fs";
import { eventChannel, type EventBus } from "../event-bus.js";

export interface OpenClawUIOptions {
  bus: EventBus;
  /** Which agent name is the "interface" agent (for filtering chat events). */
  interfaceAgent: string;
}

export interface OpenClawUI {
  close: () => void;
}

export function attachOpenClawUI(opts: OpenClawUIOptions): OpenClawUI {
  const { bus, interfaceAgent } = opts;

  const channel = process.env.OPENCLAW_CHANNEL || "telegram";
  const target = process.env.OPENCLAW_TARGET || "";
  const inboxPath = process.env.OPENCLAW_INBOX || "";
  const openclawBin = process.env.OPENCLAW_BIN || "openclaw";

  if (!target) {
    console.log("[openclaw-ui] OPENCLAW_TARGET not set — outbound messages disabled");
  }

  // ── Outbound: accumulate assistant text, send on turn end ─────────

  let pendingText = "";

  bus.on((event) => {
    const ch = eventChannel(event);

    // Only relay the interface agent's chat-channel text
    if (event.type === "text" && ch === "chat" && event.agent === interfaceAgent) {
      pendingText += event.text;
    }

    // When interface agent's turn ends, flush accumulated text
    // We detect this via the "info" event from the runner that signals idle,
    // or more reliably via the prompt event (emitted when agent goes idle).
    if (event.type === "prompt" && ch === "chat") {
      flushPendingText();
    }
  });

  function flushPendingText(): void {
    const text = pendingText.trim();
    pendingText = "";

    if (!text || !target) return;

    // Truncate very long messages (Telegram limit is ~4096 chars)
    const maxLen = 3800;
    const truncated = text.length > maxLen
      ? text.slice(0, maxLen) + "\n\n…(truncated)"
      : text;

    sendToOpenClaw(truncated);
  }

  function sendToOpenClaw(message: string): void {
    try {
      // Use heredoc-style stdin to avoid shell escaping issues
      execSync(
        `${openclawBin} message send --action send --channel ${channel} --to ${target} -F - <<'OPENCLAW_EOF'\n${message}\nOPENCLAW_EOF`,
        {
          timeout: 30_000,
          stdio: ["pipe", "pipe", "pipe"],
          shell: "/bin/bash",
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[openclaw-ui] Send failed: ${msg}`);
    }
  }

  // ── Inbound: watch inbox file for new messages ────────────────────

  let inboxWatcherActive = false;

  if (inboxPath) {
    console.log(`[openclaw-ui] Watching inbox: ${inboxPath}`);

    // Ensure file exists
    if (!existsSync(inboxPath)) {
      writeFileSync(inboxPath, "", "utf-8");
    }

    watchFile(inboxPath, { interval: 2000 }, () => {
      drainInbox();
    });
    inboxWatcherActive = true;

    // Initial drain in case there are messages waiting
    drainInbox();
  }

  function drainInbox(): void {
    if (!inboxPath || !existsSync(inboxPath)) return;

    try {
      const content = readFileSync(inboxPath, "utf-8").trim();
      if (!content) return;

      // Truncate the file immediately to avoid re-processing
      writeFileSync(inboxPath, "", "utf-8");

      // Each line is a separate message
      const lines = content.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        console.log(`[openclaw-ui] Inbox: "${line.slice(0, 80)}"`);
        bus.command({ type: "input", message: line.trim() });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[openclaw-ui] Inbox read error: ${msg}`);
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  return {
    close: () => {
      if (inboxWatcherActive && inboxPath) {
        unwatchFile(inboxPath);
        inboxWatcherActive = false;
      }
    },
  };
}
