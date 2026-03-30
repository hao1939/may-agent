/**
 * Telegram Bot UI — native Telegram bot integration for May.
 *
 * Uses the Telegram Bot API directly via fetch (no external dependencies).
 * Long-polling for incoming messages, sends responses on turn completion.
 *
 * Configuration (env vars):
 *   TELEGRAM_BOT_TOKEN  — Bot token from @BotFather (required to enable)
 *   TELEGRAM_CHAT_ID    — Allowed chat ID(s), comma-separated (required for security)
 *
 * Features:
 *   - Incoming messages → manager.steer/followUp with source "human-telegram"
 *   - Assistant responses streamed back as Telegram messages
 *   - Long messages split at 4096 char Telegram limit
 *   - /status, /cancel, /jobs commands
 *   - Authentication: only accepts messages from allowed chat IDs
 */

import { setDefaultAutoSelectFamily } from "node:net";
import { type EventBus } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";

// Force IPv4 for fetch — Node 22's undici tries IPv6 first which times out
// on some networks (e.g., when IPv6 to api.telegram.org is unreachable).
try { setDefaultAutoSelectFamily(false); } catch { /* noop — bun may not support */ }

export interface TelegramBotOptions {
  bus: EventBus;
  manager: SubagentManager;
  getSessionId: () => string;
  interfaceAgent: string;
}

export interface TelegramBot {
  close: () => void;
  /** Send a proactive alert to the primary chat (first allowed chat ID). */
  sendAlert: (text: string) => void;
}

const TELEGRAM_MAX_LENGTH = 4096;

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus, manager, getSessionId } = opts;

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const allowedChatIds = (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!token) {
    bus.emit({ type: "info", message: "[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled" });
    return { close: () => {}, sendAlert: () => {} };
  }

  if (allowedChatIds.length === 0) {
    bus.emit({
      type: "info",
      message: "[telegram] TELEGRAM_CHAT_ID not set — bot disabled (security: must specify allowed chat IDs)",
    });
    return { close: () => {}, sendAlert: () => {} };
  }

  const baseUrl = `https://api.telegram.org/bot${token}`;
  bus.emit({ type: "info", message: `[telegram] Bot enabled (${allowedChatIds.length} allowed chat(s))` });
  let running = true;
  let offset = 0;

  // ── Telegram API helpers ─────────────────────────────────────────

  async function apiCall(method: string, body?: Record<string, unknown>): Promise<any> {
    const resp = await fetch(`${baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await resp.json()) as any;
    if (!data.ok) {
      throw new Error(`Telegram API ${method}: ${data.description || "unknown error"}`);
    }
    return data.result;
  }

  async function sendMessage(chatId: string, text: string, parseMode?: string): Promise<void> {
    // Split long messages
    const chunks = splitMessage(text, TELEGRAM_MAX_LENGTH);
    for (const chunk of chunks) {
      try {
        await apiCall("sendMessage", {
          chat_id: chatId,
          text: chunk,
          ...(parseMode ? { parse_mode: parseMode } : {}),
        });
      } catch (err) {
        // If markdown parsing fails, retry without parse_mode
        if (parseMode) {
          try {
            await apiCall("sendMessage", { chat_id: chatId, text: chunk });
          } catch (retryErr) {
            const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            bus.emit({ type: "info", message: `[telegram] Send failed: ${msg}` });
          }
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          bus.emit({ type: "info", message: `[telegram] Send failed: ${msg}` });
        }
      }
    }
  }

  function splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a newline near the limit
      let splitAt = remaining.lastIndexOf("\n", maxLen);
      if (splitAt < maxLen * 0.5) {
        // No good newline break, try space
        splitAt = remaining.lastIndexOf(" ", maxLen);
      }
      if (splitAt < maxLen * 0.5) {
        // Force split at limit
        splitAt = maxLen;
      }

      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }

    return chunks;
  }

  // ── Incoming message handling ────────────────────────────────────

  function isAllowed(chatId: number): boolean {
    return allowedChatIds.includes(String(chatId));
  }

  async function handleMessage(msg: any): Promise<void> {
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!chatId || !text) return;

    if (!isAllowed(chatId)) {
      bus.emit({ type: "info", message: `[telegram] Rejected message from unauthorized chat ${chatId}` });
      await sendMessage(String(chatId), "⛔ Unauthorized. This bot is private.");
      return;
    }

    const chatIdStr = String(chatId);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    // Map /commands to unified input commands, pass everything else as regular input
    let inputMessage = text;
    if (text.startsWith("/")) {
      const cmdMap: Record<string, string> = {
        "/cancel": "cancel",
        "/status": "status",
        "/reload": "reload",
        "/close": "close",
        "/agents": "status", // status shows agents
      };
      const [cmd, ...rest] = text.split(/\s+/);
      if (cmd === "/start" || cmd === "/help") {
        await sendMessage(
          chatIdStr,
          "🤖 *May Agent Bot*\n\n" +
            "Send any message to interact with May.\n\n" +
            "*Commands:*\n" +
            "/status — Show active sessions\n" +
            "/cancel — Cancel current task\n" +
            "/reload — Reload agent configs\n" +
            "/help — Show this message\n\n" +
            "Prefix with @agent to run directly: @coder fix the bug",
          "Markdown",
        );
        return;
      }
      const mapped = cmdMap[cmd!];
      if (mapped) {
        inputMessage = rest.length > 0 ? `${mapped} ${rest.join(" ")}` : mapped;
      } else {
        // Unknown /command — strip the slash and send as regular input
        inputMessage = text.slice(1);
      }
    }

    // All input goes through the unified handler
    bus.command({ type: "input", message: inputMessage, source: "telegram" });
  }

  // ── Outbound: accumulate assistant text, send on turn end ────────

  let pendingText = "";
  const pendingChatId: string | null = allowedChatIds[0] || null;

  // Track the chat session tree — only forward events from the active
  // chat session and its children (delegated sub-sessions).
  const watchedSessions = new Set<string>();

  const unsubBus = bus.on((event) => {
    const chatSid = getSessionId();

    // Keep the watched set in sync with the current chat session
    if (chatSid && !watchedSessions.has(chatSid)) {
      watchedSessions.clear();
      watchedSessions.add(chatSid);
    }

    // Auto-expand: child sessions inherit from parent (same as socket.ts)
    if (event.type === "session_start" && event.parentSessionId && watchedSessions.has(event.parentSessionId)) {
      watchedSessions.add(event.sessionId);
    }

    // Session-scoped events: only forward if in our watched set
    if ("sessionId" in event && typeof event.sessionId === "string") {
      if (!watchedSessions.has(event.sessionId)) return;
    }

    // Accumulate text from the chat session tree
    if (event.type === "text" && "sessionId" in event) {
      pendingText += event.text;
    }

    // When a turn ends in the chat session tree, flush
    if (event.type === "turn_end" && "sessionId" in event) {
      flushPendingText();
    }

    // Notifications (heartbeat briefs, alerts) → push immediately
    if (event.type === "notification") {
      if (pendingChatId) {
        sendMessage(pendingChatId, `📋 ${event.agent}: ${event.text}`).catch(() => {});
      }
    }

    // Backward compat: prompt event still flushes (during migration)
    if (event.type === "prompt") {
      flushPendingText();
    }
  });

  function flushPendingText(): void {
    const text = pendingText.trim();
    pendingText = "";

    if (!text || !pendingChatId) return;

    // Send async, don't block
    sendMessage(pendingChatId, text).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[telegram] Flush send failed: ${msg}` });
    });
  }

  // ── Long-polling loop ───────────────────────────────────────────

  async function pollLoop(): Promise<void> {
    bus.emit({
      type: "info",
      message: `[telegram] Bot started (polling). Allowed chats: ${allowedChatIds.join(", ")}`,
    });

    // Verify token
    try {
      const me = await apiCall("getMe");
      bus.emit({ type: "info", message: `[telegram] Bot: @${me.username} (${me.first_name})` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[telegram] Failed to connect: ${msg}` });
      return;
    }

    while (running) {
      try {
        const updates = await apiCall("getUpdates", {
          offset,
          timeout: 30,
          allowed_updates: ["message"],
        });

        if (Array.isArray(updates)) {
          for (const update of updates) {
            offset = update.update_id + 1;
            if (update.message) {
              // Fire and forget — don't let one bad message block polling
              handleMessage(update.message).catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                bus.emit({ type: "info", message: `[telegram] Message handler error: ${msg}` });
              });
            }
          }
        }
      } catch (err) {
        if (!running) break;
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[telegram] Poll error: ${msg}` });
        // Back off on error
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  // Start polling in background
  pollLoop().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[telegram] Poll loop crashed: ${msg}` });
  });

  // ── Cleanup ─────────────────────────────────────────────────────

  return {
    close: () => {
      running = false;
      unsubBus();
    },
    sendAlert: (text: string) => {
      if (!pendingChatId) return;
      sendMessage(pendingChatId, text).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[telegram] Alert send failed: ${msg}` });
      });
    },
  };
}
