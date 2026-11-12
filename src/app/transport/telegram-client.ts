import type { AppConversationMessage } from "@may-agent/sdk";
import { EVENT_RECORD_ONLY, type EventBus } from "../core/events/bus.js";
import type { HumanConditionAnchor } from "../human-task-service.js";
import {
  getNotificationMessage,
  hasCompletedHumanActionDelivery,
  storeNotificationMessage,
  type CompletedHumanActionDelivery,
} from "../../lib/db/notifications.js";
import {
  conversationDeliveryId,
  prepareConversationDelivery,
  readConversationDelivery,
  settleConversationDelivery,
  type ConversationDelivery,
} from "../../lib/db/telegram-conversation-deliveries.js";
import { log } from "../../lib/log.js";
import {
  renderTelegramConversationMessage,
  singleTaskReference,
  taskButtons,
  taskReferences,
  type TelegramApprovalAnchor,
} from "./telegram-format.js";

const TELEGRAM_MAX_LENGTH = 4096;
const REQUEST_TIMEOUT_MS = 15_000;
// getUpdates asks Telegram to wait up to 30 seconds before replying.
const POLL_TIMEOUT_MS = 45_000;

export function telegramThreadId(value?: string): number | undefined {
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

function plainTextFormattingFallback(text: string, parseMode: string): string {
  if (parseMode.toUpperCase() !== "HTML") return text;
  return text
    .replace(/<\/?(?:b|strong|i|em|u|ins|s|strike|del|code|pre)>/gi, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

function withoutCompleteDeliveryAuthority(data: string | undefined): string | undefined {
  if (!data) return data;
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return data;
    const {
      approvalAnchor: _approvalAnchor,
      humanCondition: _humanCondition,
      completedHumanAction: _completedHumanAction,
      completedHumanActions: _completedHumanActions,
      ...ordinary
    } = parsed as Record<string, unknown>;
    return JSON.stringify(ordinary);
  } catch {
    // Generic notification metadata remains useful even when it is opaque. It
    // cannot grant authority because adapters require a parsed exact anchor.
    return data;
  }
}

class TelegramApiError extends Error {
  constructor(
    method: string,
    readonly code: number,
    readonly description: string,
  ) {
    super(`Telegram API ${method}: ${description}`);
  }
}

function confirmedRejection(error: unknown): boolean {
  // Server failures can follow an accepted side effect; only a definite client
  // rejection permits retrying a complete message without a provider receipt.
  return error instanceof TelegramApiError && error.code >= 400 && error.code < 500;
}

export interface TelegramSendContext {
  eventType?: string;
  agent?: string;
  sessionId?: string;
  projectId?: string;
  data?: string;
  /** Persist reply authority only after every chunk was delivered, on the final chunk. */
  bindToCompleteDelivery?: boolean;
  /** Required delivery state may not be replaced by best-effort notification indexing. */
  onDelivery?: (outcome: {
    state: "delivered" | "failed" | "uncertain";
    reason?: string;
    externalMessageId?: number;
  }) => void;
  replyToMessageId?: number;
  messageThreadId?: number;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
}

export interface TelegramReplyLookup {
  replyToSourceId: string;
  replyTopicId?: string;
  replyTask?: { appId: string; taskId: string };
  replyApprovalAnchor: TelegramApprovalAnchor | null;
  replyHumanCondition: HumanConditionAnchor | null;
  taskRefs: Array<{ appId: string; taskId: string }>;
}

export interface TelegramClientOptions {
  token: string;
  persistDir: string;
  emitInfo: (message: string) => void;
  bus?: EventBus;
  conversationAppId?: string;
  sharedConversationId?: string;
  interfaceAgent?: string;
  fetchImpl?: typeof fetch;
}

export interface TelegramClient {
  close: () => void;
  apiCall: (method: string, body?: Record<string, unknown>) => Promise<any>;
  sendMessage: (
    chatId: string,
    text: string,
    parseMode?: string,
    context?: TelegramSendContext,
  ) => Promise<number | undefined>;
  /** Look up stored reply/button correlation metadata for a Telegram message ID. */
  readMessageContext: (chatId: string, messageId: number | undefined) => TelegramReplyLookup;
  /** Best-effort inbound message receipt index for reply chain correlation. */
  recordInboundMessage: (input: {
    chatId: string;
    messageId: number;
    topicId?: number;
    conversationId: string;
    replyToMsgId?: number;
    eventId?: number;
    text: string;
  }) => void;
  /** Check whether an exact human-action card has already been completely delivered to a destination. */
  hasDeliveredHumanAction: (
    chatId: string,
    threadId: number | undefined,
    action: CompletedHumanActionDelivery,
  ) => boolean;
  /** Check whether a conversation message has a confirmed delivery receipt (or is not an addressed delivery). */
  isConversationMessageDelivered: (message: AppConversationMessage, renderedCache: ReadonlySet<string>) => boolean;
  /** Capture startup conversation messages so historical addressed answers are not replayed automatically. */
  captureStartupMessages: (
    messages: AppConversationMessage[],
    rememberRendered: (messageId: string) => void,
  ) => void;
  /** Deliver one conversation message with outbox claim/settlement and rendered-cache tracking. */
  deliverConversationMessage: (
    message: AppConversationMessage,
    fallbackChatId: string | null,
    renderedCache: ReadonlySet<string>,
    rememberRendered: (messageId: string) => void,
  ) => Promise<{ status: "skipped" | "delivered" | "halted"; targetChatId?: string; topicId?: number }>;
}

export function createTelegramClient(opts: TelegramClientOptions): TelegramClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = `https://api.telegram.org/bot${opts.token}`;
  const pending = new Set<AbortController>();
  const historicalDeliveries = new Set<string>();
  let startupCaptured = false;
  let closed = false;

  async function apiCall(method: string, body?: Record<string, unknown>): Promise<any> {
    if (closed) throw new Error("Telegram client is closed");
    const controller = new AbortController();
    pending.add(controller);
    const deadline = setTimeout(
      () => {
        controller.abort(new DOMException("Telegram request timed out", "TimeoutError"));
      },
      method === "getUpdates" ? POLL_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
    );
    deadline.unref();
    try {
      const resp = await fetchImpl(`${baseUrl}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = (await resp.json()) as any;
      if (!data.ok) {
        throw new TelegramApiError(method, data.error_code, data.description || "unknown error");
      }
      return data.result;
    } finally {
      clearTimeout(deadline);
      pending.delete(controller);
    }
  }

  async function sendMessage(
    chatId: string,
    text: string,
    parseMode?: string,
    context?: TelegramSendContext,
  ): Promise<number | undefined> {
    const chunks = splitTelegramMessage(text, TELEGRAM_MAX_LENGTH);
    let lastMsgId: number | undefined;
    const sentMsgIds: number[] = [];
    let complete = true;
    let uncertain = false;
    let failureReason: string | undefined;
    for (const chunk of chunks) {
      if (closed) {
        complete = false;
        break;
      }
      const replyParams = context?.replyToMessageId
        ? { reply_parameters: { message_id: context.replyToMessageId, allow_sending_without_reply: true } }
        : {};
      const threadParams = context?.messageThreadId ? { message_thread_id: context.messageThreadId } : {};
      const markup = context?.replyMarkup ? { reply_markup: context.replyMarkup } : {};
      try {
        const result = await apiCall("sendMessage", {
          chat_id: chatId,
          text: chunk,
          ...(parseMode ? { parse_mode: parseMode } : {}),
          ...markup,
          ...threadParams,
          ...replyParams,
        });
        const messageId = result?.message_id;
        if (Number.isSafeInteger(messageId) && messageId > 0) {
          lastMsgId = messageId;
          sentMsgIds.push(messageId);
        } else {
          complete = false;
          uncertain = true;
        }
      } catch (err) {
        if (
          !closed &&
          parseMode &&
          err instanceof TelegramApiError &&
          err.code === 400 &&
          /can't parse entities|can't find end of the entity|unsupported start tag/i.test(err.description)
        ) {
          try {
            const result = await apiCall("sendMessage", {
              chat_id: chatId,
              text: plainTextFormattingFallback(chunk, parseMode),
              ...markup,
              ...threadParams,
              ...replyParams,
            });
            const messageId = result?.message_id;
            if (Number.isSafeInteger(messageId) && messageId > 0) {
              lastMsgId = messageId;
              sentMsgIds.push(messageId);
            } else {
              complete = false;
              uncertain = true;
            }
          } catch (retryErr) {
            complete = false;
            uncertain ||= !confirmedRejection(retryErr);
            failureReason = errorMessage(retryErr);
            opts.emitInfo(`[telegram] Send failed: ${errorMessage(retryErr)}`);
          }
        } else {
          complete = false;
          uncertain ||= !confirmedRejection(err);
          failureReason = errorMessage(err);
          opts.emitInfo(`[telegram] Send failed: ${errorMessage(err)}`);
        }
      }
    }

    if (context) {
      const fullyDelivered = complete && sentMsgIds.length === chunks.length;
      for (const telegramMsgId of sentMsgIds) {
        const completeDelivery =
          Boolean(context.bindToCompleteDelivery) && fullyDelivered && telegramMsgId === sentMsgIds.at(-1);
        const storedData = completeDelivery ? context.data : withoutCompleteDeliveryAuthority(context.data);
        try {
          storeNotificationMessage(opts.persistDir, {
            chat_id: chatId,
            telegram_msg_id: telegramMsgId,
            event_type: context.eventType || null,
            agent: context.agent || null,
            session_id: context.sessionId || null,
            project_id: context.projectId || null,
            data: notificationDataForChat(storedData, chatId, context.messageThreadId),
          });
        } catch {
          /* best-effort */
        }
      }
    }
    const fullyDelivered = complete && sentMsgIds.length === chunks.length;
    context?.onDelivery?.(
      fullyDelivered
        ? { state: "delivered", externalMessageId: lastMsgId }
        : {
            state: uncertain || sentMsgIds.length > 0 ? "uncertain" : "failed",
            reason: failureReason ?? "The complete message was not confirmed delivered.",
          },
    );
    return complete && sentMsgIds.length === chunks.length ? lastMsgId : undefined;
  }

  function readMessageContext(chatId: string, messageId: number | undefined): TelegramReplyLookup {
    const defaultSourceId = `telegram:${chatId}:${messageId ?? 0}`;
    if (!messageId) {
      return {
        replyToSourceId: defaultSourceId,
        replyApprovalAnchor: null,
        replyHumanCondition: null,
        taskRefs: [],
      };
    }
    try {
      const notification = getNotificationMessage(opts.persistDir, chatId, messageId);
      const data = notification?.data ? (JSON.parse(notification.data) as Record<string, unknown>) : undefined;
      const rawRefs = data?.followTask ? [data.followTask] : data?.taskRefs;
      const refs = taskReferences(rawRefs);
      return {
        replyToSourceId:
          typeof data?.conversationMessageId === "string" && data.conversationMessageId.trim()
            ? data.conversationMessageId.trim()
            : defaultSourceId,
        replyTopicId: typeof data?.topicId === "string" ? data.topicId : undefined,
        replyTask: singleTaskReference(rawRefs),
        replyApprovalAnchor:
          data?.approvalAnchor && typeof data.approvalAnchor === "object" && !Array.isArray(data.approvalAnchor)
            ? (data.approvalAnchor as TelegramApprovalAnchor)
            : null,
        replyHumanCondition:
          data?.humanCondition && typeof data.humanCondition === "object" && !Array.isArray(data.humanCondition)
            ? (data.humanCondition as HumanConditionAnchor)
            : null,
        taskRefs: refs,
      };
    } catch {
      return {
        replyToSourceId: defaultSourceId,
        replyApprovalAnchor: null,
        replyHumanCondition: null,
        taskRefs: [],
      };
    }
  }

  function recordInboundMessage(input: {
    chatId: string;
    messageId: number;
    topicId?: number;
    conversationId: string;
    replyToMsgId?: number;
    eventId?: number;
    text: string;
  }): void {
    try {
      storeNotificationMessage(opts.persistDir, {
        chat_id: input.chatId,
        telegram_msg_id: input.messageId,
        event_type: "conversation.message.created",
        agent: opts.interfaceAgent ?? null,
        session_id: null,
        project_id: null,
        data: JSON.stringify({
          direction: "inbound",
          conversationId: input.conversationId,
          chatId: input.chatId,
          topicId: input.topicId ?? 0,
          replyToMsgId: input.replyToMsgId,
          traceId: input.eventId ? `event:${input.eventId}` : undefined,
          sourceEventId: input.eventId,
          text: input.text.slice(0, 500),
        }),
      });
    } catch {
      /* best-effort transport index; canonical input is already durable */
    }
  }

  function addressedConversationDelivery(message: AppConversationMessage): ConversationDelivery | undefined {
    if (
      !opts.conversationAppId ||
      !opts.sharedConversationId ||
      message.author.kind !== "agent" ||
      message.metadata?.channel !== "telegram" ||
      !message.metadata.channelTargetId ||
      !message.metadata.requestId
    )
      return undefined;
    return {
      appId: opts.conversationAppId,
      conversationId: opts.sharedConversationId,
      messageId: message.id,
      chatId: message.metadata.channelTargetId,
      threadId: telegramThreadId(message.metadata.channelThreadId),
      text: renderTelegramConversationMessage(message),
    };
  }

  function reportConversationDelivery(
    message: AppConversationMessage,
    delivery: ConversationDelivery,
    state: string,
    error?: unknown,
  ): void {
    const conversationAppId = opts.conversationAppId ?? "";
    const sharedConversationId = opts.sharedConversationId ?? "";
    const status = state === "failed" ? "failed" : "uncertain";
    const operationId = conversationDeliveryId(delivery);
    const identity = {
      appId: conversationAppId,
      conversationId: sharedConversationId,
      requestId: message.metadata?.requestId,
      conversationMessageId: message.id,
      deliveryOperationId: operationId,
      to: delivery.chatId,
      channelThreadId: message.metadata?.channelThreadId,
    };
    const context = JSON.stringify(identity);
    if (error !== undefined) {
      log(
        "warn",
        `[telegram] Conversation answer delivery failed ${context}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      opts.bus?.emit({
        [EVENT_RECORD_ONLY]: true,
        type: "message.delivery_failed",
        source: "telegram",
        owner: `app:${conversationAppId}`,
        data: {
          from: conversationAppId,
          ...identity,
          content: message.text.slice(0, 500),
          reason:
            status === "failed"
              ? "Telegram rejected the answer before any chunk was delivered; the existing answer remains available for delivery."
              : "No complete Telegram delivery outcome is available; verify the caller receipt before resending the existing answer.",
          deliveryStatus: status,
          idempotencyKey: `telegram-conversation-delivery:${operationId}:${status}`,
        },
      });
    } catch (reportingError) {
      log(
        "warn",
        `[telegram] Delivery diagnostic not persisted ${context}: ${reportingError instanceof Error ? reportingError.message : String(reportingError)}`,
      );
    }
  }

  function captureStartupMessages(
    messages: AppConversationMessage[],
    rememberRendered: (messageId: string) => void,
  ): void {
    if (startupCaptured) return;
    for (const message of messages) {
      const delivery = addressedConversationDelivery(message);
      if (delivery) historicalDeliveries.add(conversationDeliveryId(delivery));
      else rememberRendered(message.id);
    }
    startupCaptured = true;
  }

  function isConversationMessageDelivered(
    message: AppConversationMessage,
    renderedCache: ReadonlySet<string>,
  ): boolean {
    const delivery = addressedConversationDelivery(message);
    return delivery
      ? readConversationDelivery(opts.persistDir, conversationDeliveryId(delivery))?.state === "delivered"
      : renderedCache.has(message.id);
  }

  async function deliverConversationMessage(
    message: AppConversationMessage,
    fallbackChatId: string | null,
    renderedCache: ReadonlySet<string>,
    rememberRendered: (messageId: string) => void,
  ): Promise<{ status: "skipped" | "delivered" | "halted"; targetChatId?: string; topicId?: number }> {
    const delivery = addressedConversationDelivery(message);
    if (!delivery && renderedCache.has(message.id)) return { status: "skipped" };
    if (
      message.metadata?.channel === "telegram" &&
      (message.author.kind === "human" || message.author.kind === "command")
    ) {
      rememberRendered(message.id);
      return { status: "skipped" };
    }
    const targetChatId = message.metadata?.channelTargetId ?? fallbackChatId;
    if (!targetChatId) return { status: "halted" };
    const topicId = telegramThreadId(message.metadata?.channelThreadId);
    const operationId = delivery ? conversationDeliveryId(delivery) : undefined;
    let delivered: number | undefined;
    try {
      if (delivery) {
        const decision = prepareConversationDelivery(
          opts.persistDir,
          delivery,
          historicalDeliveries.has(operationId!) ? "historical" : "fresh",
        );
        if (decision.kind === "retained") {
          if (decision.state !== "delivered") reportConversationDelivery(message, delivery, decision.state);
          return { status: "skipped" };
        }
      }
      delivered = await sendMessage(targetChatId, renderTelegramConversationMessage(message), undefined, {
        eventType: "conversation.mirror",
        agent: message.author.kind === "agent" ? opts.interfaceAgent : message.author.id,
        messageThreadId: topicId,
        ...(operationId
          ? {
              onDelivery: (outcome) => {
                settleConversationDelivery(opts.persistDir, operationId, outcome);
                if (outcome.state !== "delivered") reportConversationDelivery(message, delivery!, outcome.state);
              },
            }
          : {}),
        ...(message.metadata?.channelMessageId ? { replyToMessageId: message.metadata.channelMessageId } : {}),
        replyMarkup: taskButtons(
          message.metadata?.followTask ? [message.metadata.followTask] : message.metadata?.taskRefs,
        ),
        data: JSON.stringify({
          direction: "mirror",
          conversationId: opts.sharedConversationId,
          conversationMessageId: message.id,
          sourceChannel: message.metadata?.channel,
          text: message.text.slice(0, 500),
          taskRefs: message.metadata?.followTask ? [message.metadata.followTask] : message.metadata?.taskRefs,
          topicId: message.metadata?.topicId,
        }),
      });
    } catch (error) {
      if (!delivery) throw error;
      reportConversationDelivery(message, delivery, "uncertain", error);
      return { status: "skipped" };
    }
    if (closed) return { status: "halted" };
    if (!delivered) {
      return { status: delivery ? "skipped" : "halted" };
    }
    if (!delivery) rememberRendered(message.id);
    return { status: "delivered", targetChatId, topicId };
  }

  return {
    apiCall,
    sendMessage,
    readMessageContext,
    recordInboundMessage,
    hasDeliveredHumanAction: (chatId, threadId, action) =>
      hasCompletedHumanActionDelivery(opts.persistDir, chatId, threadId, action),
    isConversationMessageDelivered,
    captureStartupMessages,
    deliverConversationMessage,
    close() {
      closed = true;
      for (const controller of pending) controller.abort();
    },
  };
}

export function splitTelegramMessage(text: string, maxLen = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) {
      splitAt = remaining.lastIndexOf(" ", maxLen);
    }
    if (splitAt < maxLen * 0.5) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

function notificationDataForChat(data: string | undefined, chatId: string, topicId?: number): string {
  if (!data)
    return JSON.stringify({
      channelTargetId: chatId,
      ...(topicId === undefined ? {} : { channelThreadId: String(topicId) }),
    });
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify({
        ...(parsed as Record<string, unknown>),
        channelTargetId: chatId,
        ...(topicId === undefined ? {} : { channelThreadId: String(topicId) }),
      });
    }
  } catch {
    // Preserve non-JSON legacy context below.
  }
  return data;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
