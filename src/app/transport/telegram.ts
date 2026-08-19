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
import type { AppConversationMessage, AppWorkView } from "@may-agent/sdk";
import { EVENT_ROW_ID, type AgentEvent, type EventBus, type EventTrace } from "../event-bus.js";
import type { SubagentManager } from "../../lib/index.js";
import { readSessionMeta } from "../../lib/persistence.js";
import { getDb } from "../../lib/requests.js";
import {
  getLatestInboundNotificationMessage,
  getNotificationMessage,
  hasDeliveredNotificationKey,
  isApprovalNotificationResolved,
  storeNotificationMessage,
} from "../../lib/db/notifications.js";
import { buildTelegramReplyRoute, primaryConversationId } from "./telegram-reply-router.js";
import { readAppConversationResource } from "../app-inbox-store.js";
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
  interfaceAgent: string;
}

export interface TelegramBot {
  close: () => void;
  /** Send a proactive alert to the primary chat (first allowed chat ID). */
  sendAlert: (text: string) => void;
}

const PROACTIVE_DEDUPE_WINDOW_MS = 60 * 60 * 1000;

function workStateLabel(state: unknown): string {
  const labels: Record<string, string> = {
    queued: "Queued",
    working: "Working",
    analyzing: "Analyzing",
    waiting: "Waiting",
    ready: "Ready",
    done: "Done",
  };
  return typeof state === "string" ? (labels[state] ?? "Working") : "Working";
}

function renderTelegramWorkList(work: AppWorkView[], all: boolean): string {
  const title = all ? "All work (newest first):" : "Active work:";
  if (work.length === 0) return `${title} nothing.`;
  return [
    title,
    ...work.flatMap((item, index) => {
      const result = item.result?.response?.trim() || item.result?.summary?.trim();
      const baseline = item.startedAt ?? item.createdAt;
      const changed = item.changedAt > baseline ? ` · changed ${formatWorkAge(item.changedAt)}` : "";
      return [
        `${index + 1}. ${item.message} — ${workStateLabel(item.state)} · ${formatWorkAge(baseline)}${changed}`,
        ...(item.progress ? [`   ${item.progress}`] : []),
        ...(result ? [`   Result: ${result}`] : []),
      ];
    }),
  ].join("\n");
}

function renderTelegramWorkDetail(item: AppWorkView, index: number): string {
  const result = item.result?.response?.trim() || item.result?.summary?.trim();
  const executor = formatWorkRef(item.executor);
  const dependency = formatWorkRef(item.dependency);
  return [
    `Work ${index + 1}:`,
    `Request: ${item.message}`,
    `Status: ${workStateLabel(item.state)}`,
    ...(item.progress ? [`Progress: ${item.progress}`] : []),
    ...(result ? [`Result:\n${result}`] : []),
    `Created: ${formatWorkTime(item.createdAt)}`,
    ...(item.startedAt === undefined ? [] : [`Started: ${formatWorkTime(item.startedAt)}`]),
    `Changed: ${formatWorkTime(item.changedAt)}`,
    ...(executor ? [`Execution: ${executor}`] : []),
    ...(dependency ? [`Waiting on: ${dependency}`] : []),
  ].join("\n");
}

function formatWorkTime(value: number): string {
  return new Date(value).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function formatWorkAge(value: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - value) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function formatWorkRef(ref: AppWorkView["executor"]): string | undefined {
  return ref ? `${ref.kind}:${ref.id}` : undefined;
}

function renderTelegramConversationMessage(message: AppConversationMessage): string {
  const channel = message.metadata?.channel?.trim() || "another surface";
  if (channel === "telegram" && message.author.kind === "agent") return message.text;
  const surface = channel === "may-console" ? "Console" : channel;
  const speaker =
    message.author.kind === "human"
      ? "You"
      : message.author.kind === "agent"
        ? "May"
        : message.author.kind === "command"
          ? "View"
          : "Tool";
  return `${surface} · ${speaker}\n${message.text}`;
}

export function telegramMayInputEvent(input: {
  message: string;
  chatId: string;
  messageId: number;
  conversationId: string;
  topicId?: string | number;
  replyToMessageId?: number;
  context?: Record<string, unknown>;
  trace?: EventTrace;
}): AgentEvent {
  const sourceId = `telegram:${input.chatId}:${input.messageId}`;
  return {
    type: "conversation.message.created",
    source: "telegram",
    owner: "app:may",
    data: {
      appId: "may",
      conversationId: input.conversationId,
      author: { kind: "human", id: sourceId },
      text: input.message,
      ...(input.context ? { context: input.context } : {}),
      ...(input.replyToMessageId === undefined
        ? {}
        : { replyTo: `telegram:${input.chatId}:${input.replyToMessageId}` }),
      metadata: {
        channel: "telegram",
        channelTargetId: input.chatId,
        ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
        channelMessageId: input.messageId,
      },
      idempotencyKey: sourceId,
    },
    ...(input.trace ? { trace: input.trace } : {}),
  };
}

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus, manager: _manager } = opts;

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
  const lastWorkBySurface = new Map<string, AppWorkView[]>();
  const sharedConversationId = primaryConversationId(opts.interfaceAgent);
  const renderedConversationMessages = new Set<string>();
  try {
    for (const message of readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
      limit: 200,
    }).messages) {
      renderedConversationMessages.add(message.id);
    }
  } catch {
    // The Conversation may not be available until App runtime startup finishes.
  }
  let conversationSync = Promise.resolve();

  async function syncConversation(): Promise<void> {
    const messages = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, sharedConversationId, {
      limit: 200,
    }).messages;
    for (const message of messages) {
      if (renderedConversationMessages.has(message.id)) continue;
      if (message.metadata?.channel === "telegram" && message.author.kind !== "agent") {
        renderedConversationMessages.add(message.id);
        continue;
      }
      const targetChatId = message.metadata?.channelTargetId ?? pendingChatId;
      if (!targetChatId) return;
      const threadId = message.metadata?.channelThreadId;
      const delivered = await sendMessage(targetChatId, renderTelegramConversationMessage(message), undefined, {
        eventType: "conversation.mirror",
        agent: message.author.kind === "agent" ? opts.interfaceAgent : message.author.id,
        ...(threadId && /^[1-9]\d*$/.test(threadId) ? { messageThreadId: Number(threadId) } : {}),
        ...(message.metadata?.channelMessageId ? { replyToMessageId: message.metadata.channelMessageId } : {}),
        data: JSON.stringify({
          direction: "mirror",
          conversationId: sharedConversationId,
          conversationMessageId: message.id,
          sourceChannel: message.metadata?.channel,
          text: message.text.slice(0, 500),
        }),
      });
      if (!delivered) return;
      renderedConversationMessages.add(message.id);
    }
  }

  function queueConversationSync(): void {
    conversationSync = conversationSync
      .then(() => (running ? syncConversation() : undefined))
      .catch((error) => {
        bus.emit({
          type: "info",
          message: `[telegram] Conversation sync failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      });
  }

  const unsubscribeConversation = bus.subscribe((event: any) => {
    if (event.type !== "conversation.updated") return;
    const data = event && typeof event.data === "object" && event.data ? event.data : {};
    if (data.appId === opts.interfaceAgent && data.conversationId === sharedConversationId) queueConversationSync();
  });

  function recordConversationMessage(input: {
    conversationId: string;
    text: string;
    command: string;
    messageId: number;
    topicId?: number;
    chatId?: string;
    transient?: boolean;
    requestIds?: string[];
  }): void {
    bus.emit({
      type: "conversation.message.created",
      source: "telegram",
      owner: `app:${opts.interfaceAgent}`,
      data: {
        appId: opts.interfaceAgent,
        conversationId: input.conversationId,
        author: { kind: "command", id: "telegram" },
        text: input.text,
        ...(input.transient ? { transient: true } : {}),
        metadata: {
          channel: "telegram",
          ...(input.topicId === undefined ? {} : { channelThreadId: String(input.topicId) }),
          channelMessageId: input.messageId,
          command: input.command,
          ...(input.requestIds?.length ? { requestIds: input.requestIds } : {}),
        },
        idempotencyKey: `telegram:${input.chatId ?? "unknown"}:conversation:${input.messageId}:${input.command}`,
      },
    });
  }

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
      channelTargetId?: string;
      channelThreadId?: string;
      replyToMessageId?: number;
      allowTraceReplyFallback?: boolean;
      conversationId?: string;
      traceId?: string;
      parentEventId?: number;
      taskId?: string;
    },
  ) {
    if (shouldSuppressProactive(text, context)) return;
    const data = { ...(context?.data ?? {}) };
    const latestInbound =
      context?.traceId && context.allowTraceReplyFallback !== false
        ? getLatestInboundNotificationMessage(persistDir, context.traceId)
        : null;
    const inboundData = parseJsonRecord(latestInbound?.data);
    const channelTargetId =
      context?.channelTargetId ??
      stringValue(data.channelTargetId) ??
      stringValue(inboundData?.chatId) ??
      pendingChatId;
    if (!channelTargetId) return;
    const rawThreadId =
      context?.channelThreadId ?? stringValue(data.channelThreadId) ?? stringValue(inboundData?.topicId);
    const messageThreadId = rawThreadId && /^[1-9]\d*$/.test(rawThreadId) ? Number(rawThreadId) : undefined;
    const conversationId =
      context?.conversationId ?? stringValue(inboundData?.conversationId) ?? primaryConversationId(opts.interfaceAgent);
    const priorConversationId = typeof data.conversationId === "string" ? data.conversationId : undefined;
    if (priorConversationId && priorConversationId !== conversationId && data.requestConversationId === undefined) {
      data.requestConversationId = priorConversationId;
    }
    data.conversationId = conversationId;
    data.channelTargetId = channelTargetId;
    if (rawThreadId) data.channelThreadId = rawThreadId;
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
      sessionId: context?.sessionId,
      projectId: context?.projectId,
      data: JSON.stringify({
        ...data,
        text: text.slice(0, 500),
        summary: context?.summary,
      }),
      replyToMessageId,
      messageThreadId,
    };
    const sourceEventId =
      typeof data.sourceEventId === "number" && Number.isInteger(data.sourceEventId) && data.sourceEventId > 0
        ? data.sourceEventId
        : undefined;
    const deliveryIdentity = {
      ...(typeof data.operationId === "string" ? { operationId: data.operationId } : {}),
      ...(typeof data.appInboxItemId === "string" ? { appInboxItemId: data.appInboxItemId } : {}),
      ...(typeof data.appInboxRequestId === "string" ? { appInboxRequestId: data.appInboxRequestId } : {}),
    };
    sendMessage(channelTargetId, text, undefined, ctx)
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
              ...deliveryIdentity,
              ...(sourceEventId ? { sourceEventId } : {}),
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
            ...deliveryIdentity,
            ...(sourceEventId ? { sourceEventId } : {}),
            certainty: "uncertain",
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
            ...deliveryIdentity,
            ...(sourceEventId ? { sourceEventId } : {}),
            certainty: "uncertain",
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
    if (context?.explicitSessionControl === true && target?.sessionId) {
      bus.emit({
        type: "session.steer.requested",
        source,
        owner: normalizeEventOwner(opts.interfaceAgent),
        data: { sessionId: target.sessionId, message, context },
        ...(receivedTrace ? { trace: receivedTrace } : {}),
      });
      return;
    }
    if (!channelMessageId || !chatId || !conversationId) return;
    const received = bus.emit(
      telegramMayInputEvent({
        message,
        chatId,
        messageId: channelMessageId,
        conversationId,
        topicId,
        replyToMessageId: replyToMsgId,
        context: {
          ...(context ?? {}),
          ...(target ? { suggestedTarget: target } : {}),
        },
        trace: receivedTrace,
      }),
    );

    const rowId = received[EVENT_ROW_ID];
    const traceId = receivedTrace?.traceId ?? (rowId ? `event:${rowId}` : undefined);
    const telegramReply = recordField(context, "telegramReply");
    try {
      storeNotificationMessage(persistDir, {
        telegram_msg_id: channelMessageId,
        event_type: "conversation.message.created",
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
    const conversationId = primaryConversationId(opts.interfaceAgent);
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });

    // Keep the human text authoritative and attach provider reply context as
    // evidence on the same May request.
    let enrichedText = text;
    let inputTarget: { sessionId?: string; agent?: string; projectPath?: string } | undefined;
    let inputContext: Record<string, unknown> | undefined;
    const replyToMsg = msg.reply_to_message;
    const replyToMsgId = replyToMsg?.message_id;
    if (replyToMsgId) {
      try {
        const candidate = getNotificationMessage(opts.persistDir ?? ".state", replyToMsgId);
        const candidateData = parseJsonRecord(candidate?.data);
        const candidateChatId = stringValue(candidateData?.chatId) ?? stringValue(candidateData?.channelTargetId);
        const ctx = candidateChatId && candidateChatId !== chatIdStr ? null : candidate;
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
        }
      } catch {}
    }

    if (await handleTelegramCommand(text, chatIdStr, msg, conversationId, topicId, replyToMsgId)) {
      return;
    }

    // Every ordinary turn becomes one durable May request.
    const finalMessage = replyToMsgId ? enrichedText : text;
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

    if (command === "/work") {
      const surface = `${chatIdStr}:${topicId ?? 0}`;
      const argument = rest.join(" ").trim().toLowerCase();
      let rendered: string;
      let renderedRequestIds: string[] = [];
      if (!argument || argument === "all") {
        const all = argument === "all";
        const work =
          readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
            limit: all ? 100 : 50,
            allWork: all,
          }).work ?? [];
        lastWorkBySurface.set(surface, work);
        renderedRequestIds = work.map((item) => item.requestId);
        rendered = renderTelegramWorkList(work, all);
      } else if (/^[1-9]\d*$/.test(argument)) {
        const index = Number(argument) - 1;
        const selected = lastWorkBySurface.get(surface)?.[index];
        if (!selected) {
          rendered = `No work item ${argument}. Use /work or /work all to refresh the list.`;
        } else {
          const refreshed = readAppConversationResource(getDb(persistDir), opts.interfaceAgent, conversationId, {
            limit: 1,
            allWork: true,
            workRequestId: selected.requestId,
          }).work?.[0];
          rendered = refreshed
            ? renderTelegramWorkDetail(refreshed, index)
            : `Work ${argument} was not found. Use /work all to refresh the list.`;
          if (refreshed) renderedRequestIds = [refreshed.requestId];
        }
      } else {
        rendered = "Use: /work, /work all, or /work <number>";
      }
      const deliveredMessageId = await sendMessage(chatIdStr, rendered, undefined, {
        eventType: "telegram.reply",
        agent: opts.interfaceAgent,
        data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
        replyToMessageId: msg.message_id,
        messageThreadId: topicId,
      });
      if (deliveredMessageId) {
        recordConversationMessage({
          conversationId,
          text: rendered,
          command: text,
          messageId: deliveredMessageId,
          chatId: chatIdStr,
          topicId,
          requestIds: renderedRequestIds,
        });
      }
      return true;
    }

    if (command === "/start" || command === "/help") {
      await sendMessage(
        chatIdStr,
        "🤖 *May Agent Bot*\n\n" +
          "Send any message to interact with May.\n\n" +
          "*Commands:*\n" +
          "/work — Show active work (`/work all` for history)\n" +
          "/status — Show active sessions\n" +
          "/cancel <session>|all — Cancel an explicit target\n" +
          "/steer <session> <message> — Explicitly steer one execution session\n" +
          "/reload — Reload agent configs\n" +
          "/help — Show this message",
        "Markdown",
        { messageThreadId: topicId },
      );
      return true;
    }

    if (command === "/status" || command === "/agents") {
      const sessions = _manager.status();
      const rendered =
        sessions.length === 0
          ? "No active sessions."
          : [
              "Active sessions:",
              ...sessions.map(
                (session) =>
                  `• ${session.agent} · ${session.status} · ${session.sessionId.slice(0, 12)}${
                    session.task ? `\n  ${session.task.replace(/\s+/g, " ").trim().slice(0, 120)}` : ""
                  }`,
              ),
            ].join("\n");
      const deliveredMessageId = await sendMessage(chatIdStr, rendered, undefined, {
        eventType: "telegram.reply",
        agent: opts.interfaceAgent,
        data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
        replyToMessageId: msg.message_id,
        messageThreadId: topicId,
      });
      if (deliveredMessageId) {
        recordConversationMessage({
          conversationId,
          text: rendered,
          command: text,
          messageId: deliveredMessageId,
          chatId: chatIdStr,
          topicId,
        });
      }
      return true;
    }

    if (command === "/cancel") {
      if (rest[0]?.toLowerCase() === "all") {
        emitCancelAll();
        return true;
      }

      const sessionId = rest[0]?.trim();
      if (!sessionId) {
        await sendMessage(chatIdStr, "Use: /cancel <session> or /cancel all", undefined, {
          eventType: "telegram.reply",
          agent: opts.interfaceAgent,
          data: JSON.stringify({ direction: "outbound", conversationId }),
          replyToMessageId: msg.message_id,
          messageThreadId: topicId,
        });
        return true;
      }
      emitSessionCancel(sessionId);
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
          messageThreadId: topicId,
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
        messageThreadId: topicId,
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

    await sendMessage(chatIdStr, `Unknown command: ${command}. Use /help to see available commands.`, undefined, {
      eventType: "telegram.reply",
      agent: opts.interfaceAgent,
      data: JSON.stringify({ direction: "outbound", conversationId, command: text }),
      replyToMessageId: msg.message_id,
      messageThreadId: topicId,
    });
    return true;
  }

  // ── Outbound: session-scoped assistant responses ─────────────────

  const outbound = attachTelegramOutbound({
    bus,
    interfaceAgent: opts.interfaceAgent,
    projectRoot,
    pendingChatId,
    getSessionReplyContext: (sessionId) => readSessionMeta(persistDir, sessionId),
    hasDeliveredNotificationKey: (key) => hasDeliveredNotificationKey(persistDir, key),
    isApprovalResolved: (identity) => isApprovalNotificationResolved(persistDir, identity),
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
      unsubscribeConversation();
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
