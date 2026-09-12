import { getDb } from "./connection.js";

export interface NotificationMessageRecord {
  chat_id: string;
  telegram_msg_id: number;
  event_type: string | null;
  agent: string | null;
  session_id: string | null;
  project_id: string | null;
  data: string | null;
  sent_at: number;
}

export function storeNotificationMessage(
  persistDir: string,
  record: Omit<NotificationMessageRecord, "sent_at"> & { sent_at?: number },
): void {
  const db = getDb(persistDir);
  db.run(
    "INSERT OR REPLACE INTO notification_messages (chat_id, telegram_msg_id, event_type, agent, session_id, project_id, data, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      record.chat_id,
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

export function getNotificationMessage(
  persistDir: string,
  chatId: string,
  telegramMsgId: number,
): NotificationMessageRecord | null {
  if (!chatId) return null; // Unscoped legacy facts are never reply context.
  const db = getDb(persistDir);
  return db
    .prepare("SELECT * FROM notification_messages WHERE chat_id = ? AND telegram_msg_id = ?")
    .get(chatId, telegramMsgId) as NotificationMessageRecord | null;
}
