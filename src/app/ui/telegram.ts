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
 *   - Incoming messages → daemon events with source "telegram"
 *   - Assistant responses streamed back as Telegram messages
 *   - Long messages split at 4096 char Telegram limit
 *   - /status, /cancel, /jobs commands
 *   - Authentication: only accepts messages from allowed chat IDs
 */

import { setDefaultAutoSelectFamily } from "node:net";
import { resolve, join } from "node:path";
import { type EventBus } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";
import { getNotificationMessage, storeNotificationMessage } from "../../lib/db/notifications.js";
import {
  buildNotificationReplyText,
  buildTelegramQuoteReplyText,
  extractProjectPath,
  normalizeProjectPath,
  readSessionReplyContext,
} from "./telegram-reply-router.js";

// Force IPv4 for fetch — Node 22's undici tries IPv6 first which times out
// on some networks (e.g., when IPv6 to api.telegram.org is unreachable).
try {
  setDefaultAutoSelectFamily(false);
} catch {
  /* noop — bun may not support */
}

export interface TelegramBotOptions {
  persistDir?: string;
  projectRoot?: string;
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
const PROACTIVE_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus, manager: _manager, getSessionId } = opts;

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const projectRoot = opts.projectRoot ?? process.env.PROJECT_ROOT ?? resolve(opts.persistDir ?? ".state", "..");
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
  const proactiveDedupe = new Map<string, { lastSentAt: number; suppressed: number }>();

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
            const result = await apiCall("sendMessage", { chat_id: chatId, text: chunk });
            lastMsgId = result?.message_id;
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
        storeNotificationMessage(opts.persistDir ?? ".state", {
          telegram_msg_id: lastMsgId,
          event_type: context.eventType || null,
          agent: context.agent || null,
          session_id: context.sessionId || null,
          project_id: context.projectId || null,
          data: context.data || null,
        });
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
    if (shouldSuppressProactive(text, context)) return;
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

  function shouldSuppressProactive(text: string, context?: { eventType?: string; agent?: string }): boolean {
    if (context?.eventType !== "message.created" && context?.eventType !== "alert") return false;

    const now = Date.now();
    const key = [
      context.eventType,
      context.agent ?? opts.interfaceAgent,
      text.replace(/\s+/g, " ").trim().slice(0, 1000),
    ].join("\n");

    for (const [existingKey, value] of proactiveDedupe) {
      if (now - value.lastSentAt > PROACTIVE_DEDUPE_WINDOW_MS) proactiveDedupe.delete(existingKey);
    }

    const existing = proactiveDedupe.get(key);
    if (existing && now - existing.lastSentAt < PROACTIVE_DEDUPE_WINDOW_MS) {
      existing.suppressed++;
      if (existing.suppressed === 1 || existing.suppressed % 100 === 0) {
        bus.emit({
          type: "info",
          message: `[telegram] Suppressed duplicate ${context.eventType} (${existing.suppressed}x): ${text.slice(0, 120)}`,
        });
      }
      return true;
    }

    proactiveDedupe.set(key, { lastSentAt: now, suppressed: 0 });
    return false;
  }

  async function emitProjectComment(projectPath: string, comment: string): Promise<boolean> {
    const normalized = normalizeProjectPath(projectPath, projectRoot);
    if (!normalized) return false;

    const { existsSync } = await import("node:fs");
    const projectDir = join(projectRoot, normalized);
    const projectFile = join(projectDir, "project.md");
    if (!existsSync(projectFile)) {
      bus.emit({ type: "info", message: `[telegram] Project reply target not found: ${normalized}` });
      return false;
    }

    bus.emit({
      type: "project.comment.created",
      source: "telegram",
      projectPath: normalized,
      comment: comment.trim(),
      author: "hao",
    } as any);
    bus.emit({ type: "info", message: `[telegram] Project comment event emitted: ${normalized}` });
    return true;
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
    const replyToMsg = msg.reply_to_message;
    const replyToMsgId = replyToMsg?.message_id;
    if (replyToMsgId) {
      try {
        const ctx = getNotificationMessage(opts.persistDir ?? ".state", replyToMsgId);
        if (ctx) {
          const projectPath = normalizeProjectPath(ctx.project_id, projectRoot);
          if (projectPath && await emitProjectComment(projectPath, text)) {
            bus.emit({ type: "telegram.reply", source: "telegram", owner: ctx.agent || "unknown", enriched: true, projectPath, delivery: "project-comment", originalMsgId: replyToMsgId } as any);
            await sendMessage(chatIdStr, `Comment sent to ${projectPath}. Resuming the project now.`, undefined, {
              eventType: "project.comment",
              agent: ctx.agent || opts.interfaceAgent,
              projectId: projectPath,
              data: JSON.stringify({ replyToMsgId }),
            });
            return;
          }

          const sessionContext = ctx.session_id
            ? readSessionReplyContext(opts.persistDir ?? ".state", String(ctx.session_id))
            : [];

          enrichedText = buildNotificationReplyText({ ctx, text, sessionContext });
          bus.emit({ type: "info", message: `[telegram] Enriched reply (ctx: ${ctx.event_type}/${ctx.agent}${ctx.session_id ? "/session" : ""})` });

          // Track reply for metric
          bus.emit({ type: "telegram.reply", source: "telegram", owner: ctx.agent || "unknown", enriched: true, hasSessionCtx: !!ctx.session_id, originalMsgId: replyToMsgId } as any);
          if (ctx.session_id) {
            if (await handleTelegramCommand(text, chatIdStr, String(ctx.session_id))) {
              return;
            }
            bus.emit({
              type: "steer",
              sessionId: String(ctx.session_id),
              message: enrichedText,
              source: "telegram",
            } as any);
            await sendMessage(chatIdStr, `Reply sent to session ${ctx.session_id}.`, undefined, {
              eventType: "telegram.reply",
              agent: ctx.agent || opts.interfaceAgent,
              sessionId: String(ctx.session_id),
              data: JSON.stringify({ replyToMsgId }),
            });
            return;
          }
        } else {
          const quoted = telegramMessageText(replyToMsg);
          if (quoted) {
            enrichedText = buildTelegramQuoteReplyText(text, quoted);
            bus.emit({ type: "info", message: `[telegram] Enriched reply from Telegram quote (msg ${replyToMsgId})` });
            bus.emit({ type: "telegram.reply", source: "telegram", owner: opts.interfaceAgent, enriched: true, hasDbCtx: false, fallback: "telegram-quote", originalMsgId: replyToMsgId } as any);
          } else {
            bus.emit({ type: "info", message: `[telegram] Reply context missing for msg ${replyToMsgId}` });
            bus.emit({ type: "telegram.reply", source: "telegram", owner: opts.interfaceAgent, enriched: false, reason: "context-not-found", originalMsgId: replyToMsgId } as any);
          }
        }
      } catch {}
    }

    if (await handleTelegramCommand(text, chatIdStr)) {
      return;
    }

    // Map remaining /commands to unified input commands, pass everything else as regular input
    let inputMessage = text;
    if (text.startsWith("/")) {
      const cmdMap: Record<string, string> = {
        "/status": "status",
        "/agents": "status", // status shows agents
      };
      const [cmd, ...rest] = text.split(/\s+/);
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

  async function handleTelegramCommand(text: string, chatIdStr: string, targetSessionId?: string): Promise<boolean> {
    if (!text.startsWith("/")) return false;

    const [cmd = "", ...rest] = text.split(/\s+/);
    const command = cmd.split("@")[0];

    if (command === "/start" || command === "/help") {
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
      return true;
    }

    if (command === "/cancel") {
      if (rest[0]?.toLowerCase() === "all") {
        bus.emit({ type: "cancel_all", source: "telegram" } as any);
        return true;
      }

      const sessionId = targetSessionId || rootChatSessionId || getSessionId();
      if (sessionId) {
        bus.emit({ type: "session.cancel.requested", sessionId, source: "telegram" } as any);
      } else {
        bus.emit({ type: "cancel_all", source: "telegram" } as any);
      }
      return true;
    }

    if (command === "/reload") {
      bus.emit({ type: "reload", source: "telegram" } as any);
      return true;
    }

    if (command === "/close") {
      bus.emit({ type: "shutdown", source: "telegram" } as any);
      return true;
    }

    return false;
  }

  // ── Outbound: session-scoped assistant responses ─────────────────

  const pendingChatId: string | null = allowedChatIds[0] || null;

  // Track the chat session tree — only forward events from the active
  // chat session and its children (delegated sub-sessions).
  let rootChatSessionId: string | null = null;
  const watchedSessions = new Set<string>();
  const outboundBySession = new Map<string, { pendingText: string; sentAnyText: boolean; sentText: string }>();

  const unsubBus = bus.subscribe((event: any) => {
    // Root chat session starts define the Telegram response turn. Do not
    // depend on getSessionId() later: restarts/cancellations can clear it
    // before session.end arrives.
    if (event.type === "session.start" && event.sessionId && isRootChatSession(event)) {
      rootChatSessionId = event.sessionId;
      watchedSessions.clear();
      watchedSessions.add(event.sessionId);
      outboundBySession.set(event.sessionId, { pendingText: "", sentAnyText: false, sentText: "" });
    }

    // Auto-expand: child sessions inherit from parent (same as socket.ts)
    if (event.type === "session.start" && event.parentSessionId && watchedSessions.has(event.parentSessionId)) {
      watchedSessions.add(event.sessionId);
    }

    // Session-scoped events: only forward if in our watched set
    if ("sessionId" in event && typeof event.sessionId === "string") {
      if (!watchedSessions.has(event.sessionId)) return;
    }

    const rootSid = rootChatSessionId;

    // ── Root chat session: send assistant text as it becomes available ──
    // Only stream text from the root chat session (May's direct conversation).
    // Child sessions (delegated coder, tech-lead, etc.) get ONE summary instead.
    if (event.type === "text" && "sessionId" in event && event.sessionId === rootSid) {
      const state = sessionState(event.sessionId);
      state.pendingText += event.text;
      flushPendingText(event.sessionId);
    }

    if (event.type === "turn_end" && "sessionId" in event && event.sessionId === rootSid) {
      const state = sessionState(event.sessionId);
      const hadText = state.pendingText.trim().length > 0 || state.sentAnyText;
      flushPendingText(event.sessionId);

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
    if (event.type === "session.end" && "sessionId" in event && event.sessionId !== rootSid) {
      if (pendingChatId) {
        const fp = event.finishParams as Record<string, unknown> | undefined;
        const summary = (fp?.summary as string) ?? (typeof event.outcome === "string" ? event.outcome.slice(0, 200) : "completed");
        const fpStatus = (fp?.status as string) ?? event.status;
        if (fpStatus === "failure" || fpStatus === "blocked") {
          sendToUser(`❌ ${String(event.agent)} BLOCKED: ${summary}`, { eventType: "blocked", agent: String(event.agent), sessionId: (event as any).sessionId, summary });
        } else {
          sendToUser(`✅ ${String(event.agent)}: ${summary}`, { eventType: "session.end", agent: String(event.agent), sessionId: (event as any).sessionId, summary });
        }
      }
    }

    // When the root chat session ends, check if we ever responded
    if (event.type === "session.end" && "sessionId" in event && event.sessionId === rootSid && pendingChatId) {
      const state = sessionState(event.sessionId);
      flushPendingText(event.sessionId);
      if (event.error) {
        const errMsg = String(event.error).length > 200 ? String(event.error).slice(0, 200) + "…" : String(event.error);
        sendToUser(`❌ Couldn't process your message: ${errMsg}`, { eventType: "error", agent: event.agent, sessionId: event.sessionId, summary: errMsg });
      } else {
        const summary = String(event.summary ?? "").trim();
        if (summary && shouldSendSummary(event.sessionId, summary)) {
          sendToUser(summary, { eventType: "session.end", agent: event.agent, sessionId: event.sessionId, summary });
          state.sentAnyText = true;
          state.sentText += "\n" + summary;
        } else if (!state.sentAnyText) {
          sendToUser(`❌ Couldn't generate a response. Try again or rephrase.`, { eventType: "error", agent: event.agent, sessionId: event.sessionId });
        }
      }
      rootChatSessionId = null;
      watchedSessions.clear();
      outboundBySession.delete(event.sessionId);
    }

    // Human-directed messages — forward to Telegram when from the interface agent.
    if (event.type === "message.created" && (event as any).to === "human" && (event as any).from === opts.interfaceAgent) {
      if (pendingChatId) {
        const content = String((event as any).content ?? "").slice(0, 4000);
        const projectId = normalizeProjectPath((event as any).projectPath ?? (event as any).projectId, projectRoot) ?? extractProjectPath(content, projectRoot) ?? undefined;
        sendToUser(`📋 ${content}`, { eventType: "message.created", agent: String((event as any).from ?? ""), sessionId: "sessionId" in event ? String((event as any).sessionId) : undefined, projectId, summary: content.slice(0, 200) });
      }
    }
  });

  function sessionState(sessionId: string): { pendingText: string; sentAnyText: boolean; sentText: string } {
    let state = outboundBySession.get(sessionId);
    if (!state) {
      state = { pendingText: "", sentAnyText: false, sentText: "" };
      outboundBySession.set(sessionId, state);
    }
    return state;
  }

  function flushPendingText(sessionId: string): void {
    const state = sessionState(sessionId);
    const text = state.pendingText.trim();
    state.pendingText = "";

    if (!text || !pendingChatId) return;

    state.sentAnyText = true;
    state.sentText += "\n" + text;
    sendToUser(text, { eventType: "response", agent: opts.interfaceAgent, sessionId });
  }

  function shouldSendSummary(sessionId: string, summary: string): boolean {
    const sent = normalizeForCompare(sessionState(sessionId).sentText);
    const candidate = normalizeForCompare(summary);
    if (!candidate) return false;
    if (!sent) return true;
    return !sent.includes(candidate) && !candidate.includes(sent);
  }

  function normalizeForCompare(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  function isRootChatSession(event: any): boolean {
    if (event.parentSessionId) return false;
    if (event.agent !== opts.interfaceAgent) return false;
    if (event.kind && event.kind !== "chat") return false;
    return event.source === "telegram" || event.sessionId === getSessionId();
  }

  function telegramMessageText(message: any): string {
    const text = message?.text ?? message?.caption ?? "";
    return typeof text === "string" ? text.trim() : "";
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
