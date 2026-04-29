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
try {
  setDefaultAutoSelectFamily(false);
} catch {
  /* noop — bun may not support */
}

export interface TelegramBotOptions {
  persistDir?: string;
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
  const { bus, manager: _manager, getSessionId } = opts;

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

  async function sendMessage(chatId: string, text: string, parseMode?: string, context?: { eventType?: string; agent?: string; sessionId?: string; projectId?: string; data?: string }): Promise<number | undefined> {
    // Split long messages
    const chunks = splitMessage(text, TELEGRAM_MAX_LENGTH);
    let lastMsgId: number | undefined;
    for (const chunk of chunks) {
      try {
        const result = await apiCall("sendMessage", {
          chat_id: chatId,
          text: chunk,
          ...(parseMode ? { parse_mode: parseMode } : {}),
        });
        lastMsgId = result?.message_id;
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
    // Store notification context for reply enrichment
    if (lastMsgId && context) {
      try {
        const { getDb } = await import("../../lib/requests.js");
        const db = getDb(opts.persistDir ?? ".state");
        db.run(
          "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [lastMsgId, context.eventType || null, context.agent || null, context.sessionId || null, context.projectId || null, context.data || null, Date.now()]
        );
      } catch { /* best-effort */ }
    }
    return lastMsgId;
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


  /** Unified outbound: all messages to user go through here.
   * Always stores context for reply enrichment. */
  function sendToUser(text: string, context?: { eventType?: string; agent?: string; sessionId?: string; projectId?: string; summary?: string }) {
    if (!pendingChatId) return;
    const ctx = {
      eventType: context?.eventType || "response",
      agent: context?.agent || opts.interfaceAgent,
      sessionId: context?.sessionId || getSessionId() || undefined,
      projectId: context?.projectId,
      data: JSON.stringify({ text: text.slice(0, 500), summary: context?.summary }),
    };
    sendMessage(pendingChatId, text, undefined, ctx).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[telegram] Send failed: ${msg}` });
    });
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

    // Context-enriched reply: if user replied to a notification, enrich their text
    let enrichedText = text;
    const replyToMsgId = msg.reply_to_message?.message_id;
    if (replyToMsgId) {
      try {
        const { getDb } = await import("../../lib/requests.js");
        const { existsSync, readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const db = getDb(opts.persistDir ?? ".state");
        const ctx = db.prepare("SELECT * FROM notification_messages WHERE telegram_msg_id = ?").get(replyToMsgId) as any;
        if (ctx) {
          const parts: string[] = [];
          parts.push(`[User replying to notification${ctx.agent ? ` from ${ctx.agent}` : ""}${ctx.project_id ? ` about project "${ctx.project_id}"` : ""}]`);
          if (ctx.data) {
            try {
              const data = JSON.parse(ctx.data);
              if (data.summary) parts.push(`Context: ${data.summary}`);
              if (data.text) parts.push(`Original notification: ${data.text}`);
            } catch {}
          }
          if (ctx.event_type) parts.push(`Event type: ${ctx.event_type}`);

          // Session context: if we have a sessionId, read the transcript summary
          if (ctx.session_id) {
            try {
              const persistDir = opts.persistDir ?? ".state";
              const paths = [
                join(persistDir, "sessions", ctx.session_id, "session-compact.jsonl"),
                join(persistDir, "sessions", "history", ctx.session_id, "session-compact.jsonl"),
              ];
              for (const p of paths) {
                if (existsSync(p)) {
                  const lines = readFileSync(p, "utf-8").split("\n").filter(Boolean);
                  if (lines.length > 0) {
                    // Extract first message (has compaction summary) and last assistant text
                    const first = JSON.parse(lines[0]);
                    const summary = first.content?.[0]?.text?.slice(0, 500) || "";
                    let lastAssistant = "";
                    for (let i = lines.length - 1; i >= 0; i--) {
                      try {
                        const msg = JSON.parse(lines[i]);
                        if (msg.role === "assistant" && msg.content) {
                          for (const c of msg.content) {
                            if (c.type === "text" && c.text?.trim()) {
                              lastAssistant = c.text.slice(0, 200);
                              break;
                            }
                          }
                          if (lastAssistant) break;
                        }
                      } catch {}
                    }
                    parts.push(`\nSession context (${lines.length} messages):`);
                    if (summary) parts.push(`  Summary: ${summary.slice(0, 300)}`);
                    if (lastAssistant) parts.push(`  Last action: ${lastAssistant}`);
                  }
                  break;
                }
              }
            } catch {}
          }

          parts.push("");
          parts.push(`User says: ${text}`);
          enrichedText = parts.join("\n");
          bus.emit({ type: "info", message: `[telegram] Enriched reply (ctx: ${ctx.event_type}/${ctx.agent}${ctx.session_id ? "/session" : ""})` });

          // Track reply for metric
          try {
            db.run("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?, ?, ?, ?, ?)",
              ["telegram.reply", "telegram", ctx.agent || "unknown", JSON.stringify({ enriched: true, hasSessionCtx: !!ctx.session_id, originalMsgId: replyToMsgId }), Date.now()]);
          } catch {}
        }
      } catch {}
    }

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

    // All input goes through the unified handler (enriched if reply)
    const finalMessage = replyToMsgId ? enrichedText : inputMessage;
    bus.emit({ type: "input", message: finalMessage, source: "telegram" } as any);
  }

  // ── Outbound: accumulate assistant text, send on turn end ────────

  let pendingText = "";
  let sentAnyText = false; // track if we ever responded to the user
  const pendingChatId: string | null = allowedChatIds[0] || null;

  // Track the chat session tree — only forward events from the active
  // chat session and its children (delegated sub-sessions).
  const watchedSessions = new Set<string>();

  const unsubBus = bus.subscribe((event: any) => {
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

    // ── Root chat session: accumulate text & flush on turn_end ──
    // Only stream text from the root chat session (May's direct conversation).
    // Child sessions (delegated coder, tech-lead, etc.) get ONE summary instead.
    if (event.type === "text" && "sessionId" in event && event.sessionId === chatSid) {
      pendingText += event.text;
    }

    if (event.type === "turn_end" && "sessionId" in event && event.sessionId === chatSid) {
      const hadText = pendingText.trim().length > 0;
      flushPendingText();

      // If no text was accumulated but errors occurred, notify user
      // (e.g., context overflow — LLM returned empty content, user gets silence)
      if (!hadText && event.errorCount && event.errorCount > 0) {
        // Log for metrics, don't bother the user — transient errors are normal
        bus.emit({ type: "info", message: `[telegram] Turn error: ${event.errorCount} error(s), no text produced (session: ${event.sessionId})` });
      }
    }

    // ── Child session completion: send ONE summary ──
    // When a child session in the watched tree ends, send a single
    // summary message instead of streaming all its individual turns.
    if (event.type === "session_end" && "sessionId" in event && event.sessionId !== chatSid) {
      if (pendingChatId) {
        const fp = event.finishParams as Record<string, unknown> | undefined;
        const summary = (fp?.summary as string) ?? (typeof event.outcome === "string" ? event.outcome.slice(0, 200) : "completed");
        const fpStatus = (fp?.status as string) ?? event.status;
        if (fpStatus === "failure" || fpStatus === "blocked") {
          sendToUser(`❌ ${String(event.agent)} BLOCKED: ${summary}`, { eventType: "blocked", agent: String(event.agent), sessionId: (event as any).sessionId, summary });
        } else {
          sendToUser(`✅ ${String(event.agent)}: ${summary}`, { eventType: "session_end", agent: String(event.agent), sessionId: (event as any).sessionId, summary });
        }
      }
    }

    // When the root chat session ends, check if we ever responded
    if (event.type === "session_end" && "sessionId" in event && event.sessionId === chatSid && pendingChatId) {
      if (event.error) {
        const errMsg = String(event.error).length > 200 ? String(event.error).slice(0, 200) + "…" : String(event.error);
        sendToUser(`❌ Couldn't process your message: ${errMsg}`, { eventType: "error", agent: event.agent, sessionId: event.sessionId, summary: errMsg });
      } else if (!sentAnyText) {
        sendToUser(`❌ Couldn't generate a response. Try again or rephrase.`, { eventType: "error", agent: event.agent, sessionId: event.sessionId });
      }
      sentAnyText = false; // reset for next session
    }

    // Notifications — only forward those from the interface agent (May).
    // Other agents' heartbeat briefs (bob, coach, etc.) are internal and
    // should NOT be pushed to the human's Telegram.
    if (event.type === "notification" && event.agent === opts.interfaceAgent) {
      if (pendingChatId) {
        sendToUser(`📋 ${String(event.text ?? "").slice(0, 4000)}`, { eventType: "notification", agent: String(event.agent ?? ""), sessionId: "sessionId" in event ? String(event.sessionId) : undefined, summary: String(event.text ?? "").slice(0, 200) });
      }
    }
  });

  function flushPendingText(): void {
    const text = pendingText.trim();
    pendingText = "";

    if (!text || !pendingChatId) return;

    sentAnyText = true;
    sendToUser(text);
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
      sendToUser(text, { eventType: "alert" });
    },
  };
}
