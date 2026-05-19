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
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { type EventBus } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";
import { getNotificationMessage } from "../../lib/db/notifications.js";
import {
  buildTelegramReplyRoute,
  normalizeProjectPath,
} from "./telegram-reply-router.js";
import { createTelegramClient } from "./telegram-client.js";
import { attachTelegramOutbound } from "./telegram-outbound.js";

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

function eventOwner(owner: unknown): string {
  if (typeof owner !== "string" || !owner.trim()) return "agent:may";
  const value = owner.trim();
  if (value.startsWith("agent:") || value.startsWith("human:")) return value;
  if (value.toLowerCase() === "human") return "human:operator";
  return `agent:${value}`;
}

function projectOwner(projectRoot: string, projectPath: string): string {
  try {
    const content = readFileSync(join(projectRoot, projectPath, "project.md"), "utf-8");
    const match = content.match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m);
    if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* best-effort owner lookup */
  }
  return "may";
}

export interface TelegramBot {
  close: () => void;
  /** Send a proactive alert to the primary chat (first allowed chat ID). */
  sendAlert: (text: string) => void;
}

const PROACTIVE_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus, manager: _manager, getSessionId } = opts;

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const projectRoot = opts.projectRoot ?? process.env.PROJECT_ROOT ?? resolve(opts.persistDir ?? ".state", "..");
  const allowedChatIds = (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const pendingChatId: string | null = allowedChatIds[0] || null;

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

  bus.emit({ type: "info", message: `[telegram] Bot enabled (${allowedChatIds.length} allowed chat(s))` });
  let running = true;
  let offset = 0;
  const proactiveDedupe = new Map<string, { lastSentAt: number; suppressed: number }>();
  const telegramClient = createTelegramClient({
    token,
    persistDir: opts.persistDir ?? ".state",
    emitInfo: (message) => bus.emit({ type: "info", message }),
  });
  const { apiCall, sendMessage } = telegramClient;

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

    const projectDir = join(projectRoot, normalized);
    const projectFile = join(projectDir, "project.md");
    if (!existsSync(projectFile)) {
      bus.emit({ type: "info", message: `[telegram] Project reply target not found: ${normalized}` });
      return false;
    }

    bus.emit({
      type: "project.comment.created",
      source: "telegram",
      owner: eventOwner(projectOwner(projectRoot, normalized)),
      data: {
        projectPath: normalized,
        comment: comment.trim(),
        author: "hao",
      },
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
        const route = buildTelegramReplyRoute({
          text,
          replyToMsgId,
          ctx,
          quotedText: telegramMessageText(replyToMsg),
          projectRoot,
          persistDir: opts.persistDir ?? ".state",
          interfaceAgent: opts.interfaceAgent,
        });

        if (route.kind === "notification") {
          if (route.projectPath && await emitProjectComment(route.projectPath, text)) {
            bus.emit({
              type: "telegram.reply",
              source: "telegram",
              owner: eventOwner(route.owner),
              data: {
                enriched: true,
                projectPath: route.projectPath,
                delivery: "project-comment",
                originalMsgId: replyToMsgId,
              },
            } as any);
            await sendMessage(chatIdStr, `Comment sent to ${route.projectPath}. Resuming the project now.`, undefined, {
              eventType: "project.comment",
              agent: route.owner || opts.interfaceAgent,
              projectId: route.projectPath,
              data: JSON.stringify({ replyToMsgId }),
            });
            return;
          }

          enrichedText = route.enrichedText;
          bus.emit({ type: "info", message: route.infoMessage });

          // Track reply for metric
          bus.emit({
            type: "telegram.reply",
            source: "telegram",
            owner: eventOwner(route.owner),
            data: {
              enriched: true,
              hasSessionCtx: route.hasSessionCtx,
              originalMsgId: replyToMsgId,
            },
          } as any);
          if (route.sessionId) {
            if (await handleTelegramCommand(text, chatIdStr, route.sessionId)) {
              return;
            }
            bus.emit({
              type: "steer",
              sessionId: route.sessionId,
              message: enrichedText,
              source: "telegram",
            } as any);
            await sendMessage(chatIdStr, `Reply sent to session ${route.sessionId}.`, undefined, {
              eventType: "telegram.reply",
              agent: route.owner || opts.interfaceAgent,
              sessionId: route.sessionId,
              data: JSON.stringify({ replyToMsgId }),
            });
            return;
          }
        } else if (route.kind === "quote") {
          enrichedText = route.enrichedText;
          bus.emit({ type: "info", message: route.infoMessage });
          bus.emit({
            type: "telegram.reply",
            source: "telegram",
            owner: eventOwner(opts.interfaceAgent),
            data: {
              enriched: true,
              hasDbCtx: false,
              fallback: "telegram-quote",
              originalMsgId: replyToMsgId,
            },
          } as any);
        } else {
          bus.emit({ type: "info", message: route.infoMessage });
          bus.emit({
            type: "telegram.reply",
            source: "telegram",
            owner: eventOwner(opts.interfaceAgent),
            data: {
              enriched: false,
              reason: "context-not-found",
              originalMsgId: replyToMsgId,
            },
          } as any);
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

      const sessionId = targetSessionId || outbound.getRootChatSessionId() || getSessionId();
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

  const outbound = attachTelegramOutbound({
    bus,
    interfaceAgent: opts.interfaceAgent,
    projectRoot,
    pendingChatId,
    getSessionId,
    sendToUser,
  });

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
      outbound.close();
    },
    sendAlert: outbound.sendAlert,
  };
}
