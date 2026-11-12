/**
 * Telegram Bot transport adapter for May.
 *
 * Uses the Telegram Bot API directly via fetch (no external dependencies).
 * Focused purely on provider polling, authentication, message/callback
 * ingestion, and outbound delivery, delegating presentation formatting to
 * `telegram-format.ts` and surface session/command state to `telegram-surface.ts`.
 *
 * Configuration (env vars):
 *   TELEGRAM_BOT_TOKEN    — Bot token from @BotFather (required to enable)
 *   TELEGRAM_CHAT_ID      — Allowed chat ID(s), comma-separated (required for security)
 *   TELEGRAM_APPROVER_ID  — Optional sender ID(s) allowed to authorize proposals
 */

import { setDefaultAutoSelectFamily } from "node:net";
import type { EventInput, EventReceipt } from "@may-agent/control/events";
import type { EventBus } from "../core/events/bus.js";
import { getNotificationMessage, storeNotificationMessage } from "../../lib/db/notifications.js";
import { log } from "../../lib/log.js";
import {
  TaskReferenceError,
  type HumanConditionAnchor as TelegramHumanConditionAnchor,
  type HumanTaskService,
} from "../human-task-service.js";
import { createTelegramClient } from "./telegram-client.js";
import {
  primaryConversationId,
  renderTelegramApps,
  renderTelegramConversationMessage,
  renderTelegramTask,
  renderTelegramTasks,
  renderTelegramTodos,
  renderTelegramTopic,
  renderTelegramTopics,
  singleTaskReference,
  taskPresentationRevision,
  taskReferences,
  telegramConversationInputEvent,
  type TelegramApprovalAnchor,
} from "./telegram-format.js";
import {
  createTelegramSurfaceController,
  surfaceKey,
  type TelegramInboundReplyContext,
} from "./telegram-surface.js";

export {
  primaryConversationId,
  renderTelegramApps,
  renderTelegramConversationMessage,
  renderTelegramTask,
  renderTelegramTasks,
  renderTelegramTodos,
  renderTelegramTopic,
  renderTelegramTopics,
  taskPresentationRevision,
  telegramConversationInputEvent,
  type TelegramApprovalAnchor,
};

// Non-text content in https://core.telegram.org/bots/api#message (reviewed 2026-09-12).
// Also acknowledge explicit user shares/Web App data; passive service notices stay quiet.
// Keep this provider list current when adding Telegram content support, not another work route.
const TELEGRAM_CONTENT_FIELDS = [
  "animation",
  "audio",
  "document",
  "live_photo",
  "paid_media",
  "photo",
  "sticker",
  "story",
  "video",
  "video_note",
  "voice",
  "caption",
  "checklist",
  "contact",
  "dice",
  "game",
  "poll",
  "venue",
  "location",
  "rich_message",
  "invoice",
  "giveaway",
  "giveaway_winners",
  "passport_data",
  "users_shared",
  "chat_shared",
  "web_app_data",
] as const;

function hasTelegramContent(message: Record<string, unknown>): boolean {
  return TELEGRAM_CONTENT_FIELDS.some((field) => message[field] != null);
}

function telegramMessageText(message: any): string {
  const text = message?.text ?? message?.caption ?? "";
  return typeof text === "string" ? text.trim() : "";
}

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
  interfaceAgent: string;
  conversationAppId?: string;
  conversationId?: string;
  humanTasks: Pick<HumanTaskService, "getTask" | "listApps" | "listTasks">;
  publishEvent: (
    input: EventInput,
    approvalAuthorization?: {
      actor: { kind: "human"; id: string };
      reference: string;
      evidence: Record<string, unknown>;
    },
  ) => EventReceipt;
}

export interface TelegramBot {
  close: () => void;
}

export function attachTelegramBot(opts: TelegramBotOptions): TelegramBot {
  const { bus } = opts;

  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const allowedChatIds = (process.env.TELEGRAM_CHAT_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  // Approval is narrower than conversation access. When unset, Telegram remains
  // conversational and cannot authorize a mutation.
  const allowedApproverIds = (process.env.TELEGRAM_APPROVER_ID || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const persistDir = opts.persistDir ?? ".state";

  if (!token) {
    bus.emit({ type: "info", message: "[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled" });
    return { close: () => {} };
  }

  if (allowedChatIds.length === 0) {
    bus.emit({
      type: "info",
      message: "[telegram] TELEGRAM_CHAT_ID not set — bot disabled (security: must specify allowed chat IDs)",
    });
    return { close: () => {} };
  }

  const conversationAppId = opts.conversationAppId?.trim() || "";
  if (!conversationAppId) throw new Error("Telegram requires CONVERSATION_APP");
  const sharedConversationId = opts.conversationId ?? primaryConversationId(conversationAppId);

  bus.emit({ type: "info", message: `[telegram] Bot enabled (${allowedChatIds.length} allowed chat(s))` });
  let running = true;
  let offset = 0;

  const telegramClient = createTelegramClient({
    token,
    persistDir,
    emitInfo: (message) => bus.emit({ type: "info", message }),
  });
  const { apiCall, sendMessage } = telegramClient;

  const isAllowed = (chatId: number | undefined): boolean =>
    chatId !== undefined && allowedChatIds.includes(String(chatId));

  const surfaceController = createTelegramSurfaceController({
    persistDir,
    bus,
    interfaceAgent: opts.interfaceAgent,
    conversationAppId,
    sharedConversationId,
    allowedChatIds,
    allowedApproverIds,
    humanTasks: opts.humanTasks,
    publishEvent: opts.publishEvent,
    transport: {
      isRunning: () => running,
      sendMessage,
      async clearReplyMarkup(chatId: string, messageId: number) {
        try {
          await apiCall("editMessageReplyMarkup", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: [] },
          });
        } catch (error) {
          log("warn", `[telegram] Could not clear turn button: ${String(error)}`);
        }
      },
    },
    onInboundRecorded(entry) {
      try {
        storeNotificationMessage(persistDir, {
          chat_id: entry.chatId,
          telegram_msg_id: entry.messageId,
          event_type: "conversation.message.created",
          agent: opts.interfaceAgent,
          session_id: null,
          project_id: null,
          data: JSON.stringify({
            direction: "inbound",
            conversationId: entry.conversationId,
            chatId: entry.chatId,
            topicId: entry.topicId ?? 0,
            replyToMsgId: entry.replyToMsgId,
            traceId: entry.eventId ? `event:${entry.eventId}` : undefined,
            sourceEventId: entry.eventId,
            text: entry.text.slice(0, 500),
          }),
        });
      } catch {
        /* best-effort transport index; canonical input is already durable */
      }
    },
  });

  function extractInboundReplyContext(chatIdStr: string, replyToMsg: any): TelegramInboundReplyContext | undefined {
    const replyToMsgId = replyToMsg?.message_id;
    if (!replyToMsgId) return undefined;
    let replyToSourceId: string;
    let replyTopicId: string | undefined;
    let replyTask: { appId: string; taskId: string } | undefined;
    let replyApprovalAnchor: TelegramApprovalAnchor | null = null;
    let replyHumanCondition: TelegramHumanConditionAnchor | null = null;
    try {
      const notification = getNotificationMessage(persistDir, chatIdStr, replyToMsgId);
      const data = notification?.data ? (JSON.parse(notification.data) as Record<string, unknown>) : undefined;
      replyTask = singleTaskReference(data?.followTask ? [data.followTask] : data?.taskRefs);
      replyTopicId = typeof data?.topicId === "string" ? data.topicId : undefined;
      replyApprovalAnchor =
        data?.approvalAnchor && typeof data.approvalAnchor === "object" && !Array.isArray(data.approvalAnchor)
          ? (data.approvalAnchor as TelegramApprovalAnchor)
          : null;
      replyHumanCondition =
        data?.humanCondition && typeof data.humanCondition === "object" && !Array.isArray(data.humanCondition)
          ? (data.humanCondition as TelegramHumanConditionAnchor)
          : null;
      replyToSourceId =
        typeof data?.conversationMessageId === "string" && data.conversationMessageId.trim()
          ? data.conversationMessageId.trim()
          : `telegram:${chatIdStr}:${replyToMsgId}`;
    } catch {
      replyToSourceId = `telegram:${chatIdStr}:${replyToMsgId}`;
    }
    return {
      replyToMsgId,
      quotedText: telegramMessageText(replyToMsg).slice(0, 2_000),
      replyToSourceId,
      replyTopicId,
      replyTask,
      replyApprovalAnchor,
      replyHumanCondition,
    };
  }

  function handleCallback(query: any): void {
    if (typeof query.data === "string" && query.data.startsWith("stop:")) {
      const chatId = query.message?.chat?.id;
      const outcome = surfaceController.handleTurnStopCallback({
        chatId,
        topicId: query.message?.message_thread_id,
        messageId: query.message?.message_id,
        data: query.data,
        isAllowed: isAllowed(chatId),
      });
      void apiCall("answerCallbackQuery", {
        callback_query_id: query.id,
        text: outcome.text.slice(0, 200),
      }).catch((error) => log("warn", `[telegram] Could not acknowledge Stop: ${String(error)}`));
      if (outcome.admissionFailure) throw outcome.admissionFailure;
      return;
    }

    const chatId = String(query.message?.chat?.id ?? "");
    let text = "This control is unavailable. Ask May for the current status.";
    if (!isAllowed(query.message?.chat?.id)) text = "Unauthorized.";
    else if (/^task:(details(?::\d+)?|follow)$/.test(query.data)) {
      const stored = getNotificationMessage(persistDir, chatId, query.message?.message_id);
      let data: Record<string, unknown> | undefined;
      try {
        data = JSON.parse(stored?.data ?? "null") ?? undefined;
      } catch {
        /* legacy facts */
      }
      const indexedDetails = /^task:details:(\d+)$/.exec(query.data);
      const refs = taskReferences(data?.followTask ? [data.followTask] : data?.taskRefs);
      const target = indexedDetails ? refs[Number(indexedDetails[1])] : singleTaskReference(refs);
      if (target && opts.humanTasks.getTask(target)) {
        surfaceController.handleCommand(
          query.data === "task:follow" ? "/watch linked" : "/task linked",
          chatId,
          query.message?.message_id,
          query.message?.message_thread_id,
          { task: target, topicId: typeof data?.topicId === "string" ? data.topicId : undefined },
        );
        text =
          query.data === "task:follow" ? "Showing this Task. Other work is unchanged." : "Showing current details.";
      }
    }
    void apiCall("answerCallbackQuery", { callback_query_id: query.id, text }).catch((error) =>
      log("warn", `[telegram] Could not acknowledge control: ${String(error)}`),
    );
  }

  function handleMessage(msg: any): void {
    const chatId = msg.chat?.id;
    const text = msg.text?.trim();

    if (!chatId) return;

    if (!isAllowed(chatId)) {
      bus.emit({ type: "info", message: `[telegram] Rejected message from unauthorized chat ${chatId}` });
      void sendMessage(String(chatId), "⛔ Unauthorized. This bot is private.");
      return;
    }

    if (!text) {
      if (hasTelegramContent(msg)) {
        void sendMessage(
          String(chatId),
          "I can't read this attachment yet. Please paste the question or error text.",
          undefined,
          {
            replyToMessageId: msg.message_id,
            messageThreadId: msg.message_thread_id,
          },
        );
      }
      return;
    }

    const chatIdStr = String(chatId);
    const topicId = msg.message_thread_id as number | undefined;
    const surface = surfaceKey(chatIdStr, topicId);

    if (!text.startsWith("/")) {
      const senderId = String(msg.from?.id ?? "");
      surfaceController.handleConversationTurn({
        text,
        chatIdStr,
        messageId: msg.message_id,
        topicId,
        senderId,
        resolveReply: () => extractInboundReplyContext(chatIdStr, msg.reply_to_message),
      });
      return;
    }

    surfaceController.registerSurface(chatIdStr, topicId);
    surfaceController.queueConversationRefresh();
    bus.emit({ type: "info", message: `[telegram] ← ${text.slice(0, 80)}` });
    try {
      surfaceController.handleCommand(text, chatIdStr, msg.message_id, topicId);
    } catch (error) {
      if (!(error instanceof TaskReferenceError)) throw error;
      surfaceController.queueCommandDelivery(surface, () =>
        sendMessage(chatIdStr, `${error.message}. Ask May to find the work, or use /tasks.`, undefined, {
          replyToMessageId: msg.message_id,
          messageThreadId: topicId,
        }),
      );
    }
  }

  async function pollLoop(): Promise<void> {
    bus.emit({
      type: "info",
      message: `[telegram] Bot started (polling). Allowed chats: ${allowedChatIds.join(", ")}`,
    });

    try {
      const me = await apiCall("getMe");
      if (!running) return;
      bus.emit({ type: "info", message: `[telegram] Bot: @${me.username} (${me.first_name})` });
      surfaceController.registerInitialSurfaces(allowedChatIds);
    } catch (err) {
      if (!running) return;
      const msg = err instanceof Error ? err.message : String(err);
      bus.emit({ type: "info", message: `[telegram] Failed to connect: ${msg}` });
      return;
    }

    while (running) {
      try {
        const updates = await apiCall("getUpdates", {
          offset,
          timeout: 30,
          allowed_updates: ["message", "callback_query"],
        });
        if (!running) break;

        if (Array.isArray(updates)) {
          for (const update of updates) {
            if (update.callback_query) {
              handleCallback(update.callback_query);
            }
            if (update.message) {
              handleMessage(update.message);
            }
            offset = update.update_id + 1;
          }
        }
      } catch (err) {
        if (!running) break;
        const msg = err instanceof Error ? err.message : String(err);
        bus.emit({ type: "info", message: `[telegram] Poll error: ${msg}` });
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  pollLoop().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    bus.emit({ type: "info", message: `[telegram] Poll loop crashed: ${msg}` });
  });

  return {
    close: () => {
      running = false;
      telegramClient.close();
      surfaceController.close();
    },
  };
}
