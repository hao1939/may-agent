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
import { resolve } from "node:path";
import { EVENT_ROW_ID, type EventBus, type EventTrace } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";
import { readSessionMeta } from "../../lib/persistence.js";
import {
  getLatestInboundNotificationMessage,
  getNotificationMessage,
  storeNotificationMessage,
} from "../../lib/db/notifications.js";
import { buildTelegramReplyRoute, telegramConversationId } from "./telegram-reply-router.js";
import { createTelegramClient } from "./telegram-client.js";
import { attachTelegramOutbound } from "./telegram-outbound.js";
import { reviewHumanAttention } from "./human-attention-review.js";
import { normalizeEventOwner } from "../../../packages/control/src/event-envelope.js";

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
  const persistDir = opts.persistDir ?? ".state";

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
  function sendToUser(
    text: string,
    context?: {
      eventType?: string;
      agent?: string;
      sessionId?: string;
      projectId?: string;
      summary?: string;
      data?: Record<string, unknown>;
      replyToMessageId?: number;
      allowTraceReplyFallback?: boolean;
      conversationId?: string;
      traceId?: string;
      parentEventId?: number;
      taskId?: string;
    },
  ) {
    if (!pendingChatId) return;
    if (shouldSuppressProactive(text, context)) return;
    const data = { ...(context?.data ?? {}) };
    const latestInbound =
      context?.traceId && context.allowTraceReplyFallback !== false
        ? getLatestInboundNotificationMessage(persistDir, context.traceId)
        : null;
    const inboundData = parseJsonRecord(latestInbound?.data);
    const conversationId =
      context?.conversationId ??
      stringValue(inboundData?.conversationId) ??
      telegramConversationId(pendingChatId, null, opts.interfaceAgent);
    const priorConversationId = typeof data.conversationId === "string" ? data.conversationId : undefined;
    if (priorConversationId && priorConversationId !== conversationId && data.requestConversationId === undefined) {
      data.requestConversationId = priorConversationId;
    }
    data.conversationId = conversationId;
    data.direction = "outbound";
    if (context?.traceId) data.traceId = context.traceId;
    if (context?.parentEventId) data.parentEventId = context.parentEventId;
    if (context?.taskId) data.taskId = context.taskId;
    const durableReplyTarget = latestInbound?.telegram_msg_id;
    const replyToMessageId = context?.replyToMessageId ?? durableReplyTarget;
    if (replyToMessageId) data.replyToMsgId = replyToMessageId;
    const ctx = {
      eventType: context?.eventType || "response",
      agent: context?.agent || opts.interfaceAgent,
      sessionId: context?.sessionId || getSessionId() || undefined,
      projectId: context?.projectId,
      data: JSON.stringify({
        ...data,
        text: text.slice(0, 500),
        summary: context?.summary,
      }),
      replyToMessageId,
    };
    sendMessage(pendingChatId, text, undefined, ctx)
      .then((messageId) => {
        if (messageId) {
          bus.emit({
            type: "channel.delivery.completed",
            source: "telegram",
            owner: "agent:may",
            target: { human: true },
            data: {
              channel: "telegram",
              externalMessageId: messageId,
              sessionId: ctx.sessionId,
              resultEventType: ctx.eventType,
            },
            ...(context?.traceId
              ? {
                  trace: {
                    traceId: context.traceId,
                    ...(context.parentEventId ? { parentEventId: context.parentEventId } : {}),
                  },
                }
              : {}),
          } as any);
          return;
        }
        bus.emit({
          type: "channel.delivery.failed",
          source: "telegram",
          owner: "agent:may",
          target: { human: true },
          data: {
            channel: "telegram",
            sessionId: ctx.sessionId,
            resultEventType: ctx.eventType,
            reason: "Telegram send returned no message id",
          },
          ...(context?.traceId
            ? {
                trace: {
                  traceId: context.traceId,
                  ...(context.parentEventId ? { parentEventId: context.parentEventId } : {}),
                },
              }
            : {}),
        } as any);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({
          type: "channel.delivery.failed",
          source: "telegram",
          owner: "agent:may",
          target: { human: true },
          data: {
            channel: "telegram",
            sessionId: ctx.sessionId,
            resultEventType: ctx.eventType,
            reason: msg,
          },
          ...(context?.traceId
            ? {
                trace: {
                  traceId: context.traceId,
                  ...(context.parentEventId ? { parentEventId: context.parentEventId } : {}),
                },
              }
            : {}),
        } as any);
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

  function isApprovalReplyCandidate(context: { originalIssue?: unknown; expectedClosure?: unknown }): boolean {
    const originalIssue =
      context.originalIssue && typeof context.originalIssue === "object" && !Array.isArray(context.originalIssue)
        ? (context.originalIssue as Record<string, unknown>)
        : null;
    if (originalIssue?.eventType === "project.approval.requested") return true;
    return Array.isArray(context.expectedClosure) && context.expectedClosure.includes("project.approval.submitted");
  }

  function emitChatStart(
    message: string,
    source = "telegram",
    channelMessageId?: number,
    target?: { sessionId?: string; agent?: string; projectPath?: string },
    context?: Record<string, unknown>,
    chatId?: string,
    topicId?: string | number,
    conversationId?: string,
    replyToMsgId?: number,
  ): void {
    const receivedTrace = traceFromTelegramContext(context);
    const received = bus.emit({
      type: "human.input.received",
      source,
      owner: normalizeEventOwner(opts.interfaceAgent),
      data: {
        inputId: channelMessageId ? `telegram:${channelMessageId}` : undefined,
        actor: "human",
        text: message,
        conversation: {
          id: conversationId,
          channel: "telegram",
          channelThreadId: topicId === undefined ? undefined : String(topicId),
          channelMessageId,
          replyToInputId: replyToMsgId ? `telegram:${replyToMsgId}` : undefined,
        },
        target: target ?? { agent: opts.interfaceAgent },
        context,
      },
      ...(receivedTrace ? { trace: receivedTrace } : {}),
    } as any);

    if (!channelMessageId) return;
    const rowId = received[EVENT_ROW_ID];
    const traceId = receivedTrace?.traceId ?? (rowId ? `event:${rowId}` : undefined);
    const telegramReply = recordField(context, "telegramReply");
    try {
      storeNotificationMessage(persistDir, {
        telegram_msg_id: channelMessageId,
        event_type: "human.input.received",
        agent: opts.interfaceAgent,
        session_id: null,
        project_id: target?.projectPath ?? stringValue(telegramReply?.projectId) ?? null,
        data: JSON.stringify({
          direction: "inbound",
          conversationId,
          chatId,
          topicId: topicId ?? 0,
          replyToMsgId,
          traceId,
          parentEventId: receivedTrace?.parentEventId,
          sourceEventId: rowId,
          taskId: stringValue(telegramReply?.taskId),
          text: message.slice(0, 500),
        }),
      });
    } catch {
      /* best-effort transport index; canonical input is already durable */
    }
  }

  function emitSessionCancel(sessionId: string): void {
    bus.emit({
      type: "session.cancel.requested",
      source: "telegram",
      owner: normalizeEventOwner(opts.interfaceAgent),
      urgency: "high",
      data: { sessionId },
    } as any);
  }

  function emitCancelAll(): void {
    bus.emit({
      type: "session.cancel_all.requested",
      source: "telegram",
      owner: normalizeEventOwner(opts.interfaceAgent),
      urgency: "high",
      data: { reason: "human requested cancel all" },
    } as any);
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
    const topicId = msg.message_thread_id as number | undefined;
    const conversationId = telegramConversationId(chatIdStr, topicId, opts.interfaceAgent);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    // Reply context is structured on the event. Stored notification replies keep
    // the human text raw; the command router builds the internal work packet.
    let enrichedText = text;
    let inputTarget: { sessionId?: string; agent?: string; projectPath?: string } | undefined;
    let inputContext: Record<string, unknown> | undefined;
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
          const requestConversationId = route.context.conversationId;
          const telegramReply = {
            ...route.context,
            conversationId,
            ...(requestConversationId && requestConversationId !== conversationId ? { requestConversationId } : {}),
          };
          inputContext = {
            conversationId,
            telegramReply,
          };
          if (route.projectPath && isApprovalReplyCandidate(route.context)) {
            inputTarget = {
              agent: opts.interfaceAgent,
              projectPath: route.projectPath,
            };
          }
          bus.emit({ type: "info", message: route.infoMessage });

          bus.emit({
            type: "telegram.reply",
            source: "telegram",
            owner: normalizeEventOwner(route.owner),
            data: {
              enriched: true,
              hasSessionCtx: route.hasSessionCtx,
              originalMsgId: replyToMsgId,
              conversationId,
              originalIssue: route.context.originalIssue,
              expectedClosure: route.context.expectedClosure,
              actionHints: route.context.actionHints,
              notification: route.context.notification,
              shadowConversation: route.shadowConversation,
              target: {
                owner: route.owner,
                sessionId: route.sessionId ?? undefined,
                projectPath: route.projectPath ?? undefined,
              },
            },
          } as any);

          await sendMessage(chatIdStr, "Received. I attached your reply to the original request.", undefined, {
            eventType: "telegram.reply",
            agent: opts.interfaceAgent,
            sessionId: route.sessionId ?? undefined,
            projectId: route.projectPath ?? undefined,
            data: JSON.stringify({
              replyToMsgId,
              conversationId,
              requestConversationId,
              direction: "outbound",
              traceId: route.context.traceId,
              sourceEventId: route.context.sourceEventId,
              taskId: route.context.taskId,
              originalIssue: route.context.originalIssue,
              expectedClosure: route.context.expectedClosure,
              actionHints: route.context.actionHints,
              notification: route.context.notification,
            }),
            replyToMessageId: msg.message_id,
          });
        } else if (route.kind === "quote") {
          enrichedText = route.enrichedText;
          inputContext = {
            conversationId,
            telegramReply: {
              replyToMsgId,
              conversationId,
              fallback: "telegram-quote",
            },
          };
          bus.emit({ type: "info", message: route.infoMessage });
          bus.emit({
            type: "telegram.reply",
            source: "telegram",
            owner: normalizeEventOwner(opts.interfaceAgent),
            data: {
              enriched: true,
              hasDbCtx: false,
              fallback: "telegram-quote",
              originalMsgId: replyToMsgId,
              shadowConversation: route.shadowConversation,
            },
          } as any);
          await sendMessage(chatIdStr, "Received. I attached the quoted message and May is handling it.", undefined, {
            eventType: "telegram.reply",
            agent: opts.interfaceAgent,
            data: JSON.stringify({
              direction: "outbound",
              conversationId,
              replyToMsgId,
              fallback: "telegram-quote",
            }),
            replyToMessageId: msg.message_id,
          });
        } else {
          inputContext = {
            conversationId,
            telegramReply: {
              replyToMsgId,
              conversationId,
              fallback: "missing-context",
            },
          };
          bus.emit({ type: "info", message: route.infoMessage });
          bus.emit({
            type: "telegram.reply",
            source: "telegram",
            owner: normalizeEventOwner(opts.interfaceAgent),
            data: {
              enriched: false,
              reason: "context-not-found",
              originalMsgId: replyToMsgId,
              shadowConversation: route.shadowConversation,
            },
          } as any);
          await sendMessage(
            chatIdStr,
            "Received. I could not find the original message context, so May will handle it from your reply text.",
            undefined,
            {
              eventType: "telegram.reply",
              agent: opts.interfaceAgent,
              data: JSON.stringify({
                direction: "outbound",
                conversationId,
                replyToMsgId,
                fallback: "missing-context",
              }),
              replyToMessageId: msg.message_id,
            },
          );
        }
      } catch {}
    }

    if (await handleTelegramCommand(text, chatIdStr, msg, conversationId, topicId, replyToMsgId)) {
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
    emitChatStart(
      finalMessage,
      "telegram",
      msg.message_id,
      inputTarget,
      inputContext ?? { conversationId },
      chatIdStr,
      topicId,
      conversationId,
      replyToMsgId,
    );
  }

  async function handleTelegramCommand(
    text: string,
    chatIdStr: string,
    msg: any,
    conversationId: string,
    topicId?: number,
    replyToMsgId?: number,
  ): Promise<boolean> {
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
          "/steer <session> <message> — Explicitly steer one execution session\n" +
          "/reload — Reload agent configs\n" +
          "/help — Show this message\n\n" +
          "Prefix with @agent to run directly: @coder fix the bug",
        "Markdown",
      );
      return true;
    }

    if (command === "/cancel") {
      if (rest[0]?.toLowerCase() === "all") {
        emitCancelAll();
        return true;
      }

      const sessionId = outbound.getRootChatSessionId() || getSessionId();
      if (sessionId) {
        emitSessionCancel(sessionId);
      } else {
        emitCancelAll();
      }
      return true;
    }

    if (command === "/steer") {
      const [sessionId, ...messageParts] = rest;
      const steerText = messageParts.join(" ").trim();
      if (!sessionId || !steerText) {
        await sendMessage(chatIdStr, "Use: /steer <session> <message>", undefined, {
          eventType: "telegram.reply",
          agent: opts.interfaceAgent,
          data: JSON.stringify({ direction: "outbound", conversationId }),
          replyToMessageId: msg.message_id,
        });
        return true;
      }
      emitChatStart(
        steerText,
        "telegram",
        msg.message_id,
        { agent: opts.interfaceAgent, sessionId },
        { conversationId, explicitSessionControl: true },
        chatIdStr,
        topicId,
        conversationId,
        replyToMsgId,
      );
      await sendMessage(chatIdStr, `Received. I steered session ${sessionId}.`, undefined, {
        eventType: "telegram.reply",
        agent: opts.interfaceAgent,
        sessionId,
        data: JSON.stringify({ direction: "outbound", conversationId }),
        replyToMessageId: msg.message_id,
      });
      return true;
    }

    if (command === "/reload") {
      bus.emit({
        type: "runtime.reload.requested",
        source: "telegram",
        owner: normalizeEventOwner(opts.interfaceAgent),
        data: {},
      } as any);
      return true;
    }

    if (command === "/close") {
      bus.emit({
        type: "runtime.shutdown.requested",
        source: "telegram",
        owner: normalizeEventOwner(opts.interfaceAgent),
        urgency: "high",
        data: {},
      } as any);
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
    getSessionReplyContext: (sessionId) => readSessionMeta(persistDir, sessionId),
    sendToUser,
    reviewProactive: (candidate) => reviewHumanAttention(_manager, candidate, projectRoot),
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

function recordField(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return field && typeof field === "object" && !Array.isArray(field) ? (field as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function traceFromTelegramContext(context: Record<string, unknown> | undefined): EventTrace | undefined {
  const reply = recordField(context, "telegramReply");
  const traceId = stringValue(reply?.traceId);
  if (!traceId) return undefined;
  const parentEventId = positiveInteger(reply?.sourceEventId) ?? positiveInteger(reply?.parentEventId);
  return { traceId, ...(parentEventId ? { parentEventId } : {}) };
}

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
