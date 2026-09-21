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

export type CompletedHumanActionDelivery = {
  appId: string;
  taskId: string;
  signature: string;
};

/**
 * Read only complete, destination-scoped action receipts. The complete marker is
 * stripped from partial multipart sends by the Telegram client, so a row's mere
 * existence is never delivery proof. An older Condition or approval anchor is
 * not enough: another action may have joined the same card since it was sent.
 */
export function hasCompletedHumanActionDelivery(
  persistDir: string,
  chatId: string,
  threadId: number | undefined,
  action: CompletedHumanActionDelivery,
): boolean {
  if (!chatId) return false;
  const expectedThread = threadId === undefined ? null : String(threadId);
  const row = getDb(persistDir)
    .prepare(
      `SELECT 1 FROM notification_messages AS messages
       WHERE chat_id = ? AND event_type IN ('task.human-action', 'task.watch')
         AND json_valid(data)
         AND coalesce(json_extract(data, '$.channelThreadId'), '') = coalesce(?, '')
         AND json_extract(data, '$.completedHumanAction.version') = 1
         AND json_extract(data, '$.completedHumanAction.appId') = ?
         AND json_extract(data, '$.completedHumanAction.taskId') = ?
         AND json_extract(data, '$.completedHumanAction.signature') = ?
         AND EXISTS (
           SELECT 1 FROM json_each(json_extract(messages.data, '$.taskRefs')) AS ref
           WHERE json_extract(ref.value, '$.appId') = ?
             AND json_extract(ref.value, '$.taskId') = ?
         )
       LIMIT 1`,
    )
    .get(
      chatId,
      expectedThread,
      action.appId,
      action.taskId,
      action.signature,
      action.appId,
      action.taskId,
    );
  return row !== null;
}
