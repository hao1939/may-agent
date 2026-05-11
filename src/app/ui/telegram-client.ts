import { storeNotificationMessage } from "../../lib/db/notifications.js";

const TELEGRAM_MAX_LENGTH = 4096;

export interface TelegramSendContext {
  eventType?: string;
  agent?: string;
  sessionId?: string;
  projectId?: string;
  data?: string;
}

export interface TelegramClientOptions {
  token: string;
  persistDir: string;
  emitInfo: (message: string) => void;
  fetchImpl?: typeof fetch;
}

export interface TelegramClient {
  apiCall: (method: string, body?: Record<string, unknown>) => Promise<any>;
  sendMessage: (chatId: string, text: string, parseMode?: string, context?: TelegramSendContext) => Promise<number | undefined>;
}

export function createTelegramClient(opts: TelegramClientOptions): TelegramClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = `https://api.telegram.org/bot${opts.token}`;

  async function apiCall(method: string, body?: Record<string, unknown>): Promise<any> {
    const resp = await fetchImpl(`${baseUrl}/${method}`, {
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

  async function sendMessage(chatId: string, text: string, parseMode?: string, context?: TelegramSendContext): Promise<number | undefined> {
    const chunks = splitTelegramMessage(text, TELEGRAM_MAX_LENGTH);
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
        if (parseMode) {
          try {
            const result = await apiCall("sendMessage", { chat_id: chatId, text: chunk });
            lastMsgId = result?.message_id;
          } catch (retryErr) {
            opts.emitInfo(`[telegram] Send failed: ${errorMessage(retryErr)}`);
          }
        } else {
          opts.emitInfo(`[telegram] Send failed: ${errorMessage(err)}`);
        }
      }
    }

    if (lastMsgId && context) {
      try {
        storeNotificationMessage(opts.persistDir, {
          telegram_msg_id: lastMsgId,
          event_type: context.eventType || null,
          agent: context.agent || null,
          session_id: context.sessionId || null,
          project_id: context.projectId || null,
          data: context.data || null,
        });
      } catch {
        /* best-effort */
      }
    }
    return lastMsgId;
  }

  return { apiCall, sendMessage };
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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
