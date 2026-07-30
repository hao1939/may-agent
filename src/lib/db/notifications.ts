import { getDb } from "./connection.js";

export interface NotificationMessageRecord {
  telegram_msg_id: number;
  event_type: string | null;
  agent: string | null;
  session_id: string | null;
  project_id: string | null;
  data: string | null;
  sent_at: number;
}

export type TelegramConversationMessage = {
  telegramMsgId: number;
  direction: "inbound" | "outbound";
  agent?: string;
  text: string;
  traceId?: string;
  taskId?: string;
  sentAt: number;
};

export function storeNotificationMessage(
  persistDir: string,
  record: Omit<NotificationMessageRecord, "sent_at"> & { sent_at?: number },
): void {
  const db = getDb(persistDir);
  db.run(
    "INSERT OR REPLACE INTO notification_messages (telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      record.telegram_msg_id,
      record.event_type,
      record.agent,
      record.session_id,
      record.project_id,
      record.data,
      record.sent_at ?? Date.now(),
    ],
  );
}

export function getNotificationMessage(persistDir: string, telegramMsgId: number): NotificationMessageRecord | null {
  const db = getDb(persistDir);
  return db
    .prepare("SELECT * FROM notification_messages WHERE telegram_msg_id = ?")
    .get(telegramMsgId) as NotificationMessageRecord | null;
}

/**
 * Recover the newest human Telegram message attached to a request trace.
 *
 * Inbound and outbound Telegram messages share the existing transport index;
 * direction and trace links live in its JSON data so no second conversation
 * store is required.
 */
export function getLatestInboundNotificationMessage(
  persistDir: string,
  traceId: string,
): NotificationMessageRecord | null {
  const normalizedTraceId = traceId.trim();
  if (!normalizedTraceId) return null;
  try {
    const db = getDb(persistDir);
    return db
      .prepare(
        `SELECT *
         FROM notification_messages
         WHERE event_type = 'human.input.received'
           AND json_valid(data) = 1
           AND json_extract(data, '$.direction') = 'inbound'
           AND json_extract(data, '$.traceId') = ?
         ORDER BY sent_at DESC, telegram_msg_id DESC
         LIMIT 1`,
      )
      .get(normalizedTraceId) as NotificationMessageRecord | null;
  } catch {
    return null;
  }
}

/** Read a small, ordered conversation window for a fresh bounded May turn. */
export function getRecentTelegramConversationMessages(
  persistDir: string,
  conversationId: string,
  limit = 8,
): TelegramConversationMessage[] {
  const normalizedConversationId = conversationId.trim();
  if (!normalizedConversationId) return [];
  const boundedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  try {
    const db = getDb(persistDir);
    const rows = db
      .prepare(
        `SELECT telegram_msg_id, agent, data, sent_at
         FROM notification_messages
         WHERE json_valid(data) = 1
           AND json_extract(data, '$.conversationId') = ?
           AND json_extract(data, '$.direction') IN ('inbound', 'outbound')
         ORDER BY sent_at DESC, telegram_msg_id DESC
         LIMIT ?`,
      )
      .all(normalizedConversationId, boundedLimit) as Array<{
      telegram_msg_id: number;
      agent: string | null;
      data: string;
      sent_at: number;
    }>;
    return rows.reverse().flatMap((row) => {
      try {
        const data = JSON.parse(row.data) as Record<string, unknown>;
        const direction = data.direction === "inbound" ? "inbound" : "outbound";
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (!text) return [];
        return [
          {
            telegramMsgId: row.telegram_msg_id,
            direction,
            ...(row.agent ? { agent: row.agent } : {}),
            text,
            ...(typeof data.traceId === "string" ? { traceId: data.traceId } : {}),
            ...(typeof data.taskId === "string" ? { taskId: data.taskId } : {}),
            sentAt: row.sent_at,
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
