import { storeNotificationMessage } from "../../lib/db/notifications.js";

const TELEGRAM_MAX_LENGTH = 4096;
const REQUEST_TIMEOUT_MS = 15_000;
// getUpdates asks Telegram to wait up to 30 seconds before replying.
const POLL_TIMEOUT_MS = 45_000;

class TelegramApiError extends Error {
  constructor(
    method: string,
    readonly code: number,
    readonly description: string,
  ) {
    super(`Telegram API ${method}: ${description}`);
  }
}

export interface TelegramSendContext {
  eventType?: string;
  agent?: string;
  sessionId?: string;
  projectId?: string;
  data?: string;
  replyToMessageId?: number;
  messageThreadId?: number;
  replyMarkup?: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
}

export interface TelegramClientOptions {
  token: string;
  persistDir: string;
  emitInfo: (message: string) => void;
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
}

export function createTelegramClient(opts: TelegramClientOptions): TelegramClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = `https://api.telegram.org/bot${opts.token}`;
  const pending = new Set<AbortController>();
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
        lastMsgId = result?.message_id;
        if (lastMsgId) sentMsgIds.push(lastMsgId);
        else complete = false;
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
              text: chunk,
              ...markup,
              ...threadParams,
              ...replyParams,
            });
            lastMsgId = result?.message_id;
            if (lastMsgId) sentMsgIds.push(lastMsgId);
            else complete = false;
          } catch (retryErr) {
            complete = false;
            opts.emitInfo(`[telegram] Send failed: ${errorMessage(retryErr)}`);
          }
        } else {
          complete = false;
          opts.emitInfo(`[telegram] Send failed: ${errorMessage(err)}`);
        }
      }
    }

    if (context) {
      for (const telegramMsgId of sentMsgIds) {
        try {
          storeNotificationMessage(opts.persistDir, {
            chat_id: chatId,
            telegram_msg_id: telegramMsgId,
            event_type: context.eventType || null,
            agent: context.agent || null,
            session_id: context.sessionId || null,
            project_id: context.projectId || null,
            data: notificationDataForChat(context.data, chatId, context.messageThreadId),
          });
        } catch {
          /* best-effort */
        }
      }
    }
    return complete && sentMsgIds.length === chunks.length ? lastMsgId : undefined;
  }

  return {
    apiCall,
    sendMessage,
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
