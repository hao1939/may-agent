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
  return db.prepare("SELECT * FROM notification_messages WHERE telegram_msg_id = ?").get(telegramMsgId) as NotificationMessageRecord | null;
}
