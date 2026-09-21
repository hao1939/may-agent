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
  humanCondition?: { taskGeneration: number; conditionId: string; conditionGeneration: number };
  approvalAnchor?: unknown;
};

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Read only complete, destination-scoped action receipts. The complete marker is
 * stripped from partial multipart sends by the Telegram client, so a row's mere
 * existence is never delivery proof.
 */
export function hasCompletedHumanActionDelivery(
  persistDir: string,
  chatId: string,
  threadId: number | undefined,
  action: CompletedHumanActionDelivery,
): boolean {
  if (!chatId) return false;
  const expectedThread = threadId === undefined ? null : String(threadId);
  const rows = getDb(persistDir)
    .prepare(
      `SELECT data FROM notification_messages
       WHERE chat_id = ? AND event_type IN ('task.human-action', 'task.watch')
         AND json_extract(CASE WHEN json_valid(data) THEN data END, '$.taskRefs[0].appId') = ?
         AND json_extract(CASE WHEN json_valid(data) THEN data END, '$.taskRefs[0].taskId') = ?
         AND coalesce(json_extract(CASE WHEN json_valid(data) THEN data END, '$.channelThreadId'), '') = coalesce(?, '')
       ORDER BY sent_at DESC
       LIMIT 20`,
    )
    .all(chatId, action.appId, action.taskId, expectedThread) as Array<{ data?: string | null }>;
  for (const row of rows) {
    let data: Record<string, unknown>;
    try {
      const parsed = JSON.parse(row.data ?? "null");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      data = parsed as Record<string, unknown>;
    } catch {
      continue;
    }
    const receipt = data.completedHumanAction;
    if (
      receipt &&
      typeof receipt === "object" &&
      !Array.isArray(receipt) &&
      (receipt as Record<string, unknown>).version === 1 &&
      (receipt as Record<string, unknown>).appId === action.appId &&
      (receipt as Record<string, unknown>).taskId === action.taskId &&
      (receipt as Record<string, unknown>).signature === action.signature
    ) {
      return true;
    }
    // Compatibility for already-sent one-Task cards: complete-delivery
    // authority proves the exact immutable Condition/candidate anchor. Unknown
    // legacy rows and text-only records stay eligible for another notification.
    const refs = data.taskRefs;
    if (!Array.isArray(refs) || refs.length !== 1) continue;
    if (action.humanCondition && sameJsonValue(data.humanCondition, action.humanCondition)) return true;
    if (action.approvalAnchor && sameJsonValue(data.approvalAnchor, action.approvalAnchor)) return true;
  }
  return false;
}
