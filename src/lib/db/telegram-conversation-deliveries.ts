import { createHash } from "node:crypto";
import { getDb } from "./connection.js";

export type ConversationDelivery = {
  appId: string;
  conversationId: string;
  messageId: string;
  chatId: string;
  threadId?: number;
  text: string;
};

export type ConversationDeliveryOutcome = {
  state: "delivered" | "failed" | "uncertain";
  reason?: string;
  externalMessageId?: number;
};

/** Includes destination and rendered content so a changed answer is not an old receipt. */
export function conversationDeliveryId(delivery: ConversationDelivery): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        delivery.appId,
        delivery.conversationId,
        delivery.messageId,
        delivery.chatId,
        delivery.threadId ?? null,
        delivery.text,
      ]),
    )
    .digest("hex");
}

export function readConversationDelivery(persistDir: string, operationId: string) {
  return getDb(persistDir)
    .prepare("SELECT state, reason, external_message_id FROM telegram_conversation_deliveries WHERE operation_id = ?")
    .get(operationId) as {
    state: "sending" | ConversationDeliveryOutcome["state"];
    reason: string | null;
    external_message_id: number | null;
  } | null;
}

/** Commit before provider I/O; concurrent or restarted adapters cannot claim the same send. */
export function claimConversationDelivery(persistDir: string, delivery: ConversationDelivery): boolean {
  const db = getDb(persistDir);
  const operationId = conversationDeliveryId(delivery);
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO telegram_conversation_deliveries
     (operation_id, app_id, conversation_id, message_id, chat_id, thread_id, state, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'sending', ?)`,
    )
    .run(
      operationId,
      delivery.appId,
      delivery.conversationId,
      delivery.messageId,
      delivery.chatId,
      delivery.threadId ?? null,
      Date.now(),
    );
  if (inserted.changes) return true;
  // Only a confirmed rejection before any chunk was delivered is safe to retry.
  return (
    db
      .prepare(
        `UPDATE telegram_conversation_deliveries SET state = 'sending', reason = NULL, updated_at = ?
     WHERE operation_id = ? AND state = 'failed'`,
      )
      .run(Date.now(), operationId).changes === 1
  );
}

export function settleConversationDelivery(
  persistDir: string,
  operationId: string,
  outcome: ConversationDeliveryOutcome,
): void {
  const updated = getDb(persistDir)
    .prepare(
      `UPDATE telegram_conversation_deliveries SET state = ?, reason = ?, external_message_id = ?, updated_at = ?
     WHERE operation_id = ? AND state = 'sending'`,
    )
    .run(outcome.state, outcome.reason ?? null, outcome.externalMessageId ?? null, Date.now(), operationId);
  if (updated.changes !== 1) throw new Error("Conversation delivery no longer has the sending claim");
}

/** Legacy or interrupted sends need owner evidence, never automatic historical replay. */
export function retainUncertainConversationDelivery(persistDir: string, delivery: ConversationDelivery): void {
  const db = getDb(persistDir);
  const operationId = conversationDeliveryId(delivery);
  const reason = "No complete delivery outcome is available; verify the caller receipt before resending.";
  db.prepare(
    `INSERT OR IGNORE INTO telegram_conversation_deliveries
     (operation_id, app_id, conversation_id, message_id, chat_id, thread_id, state, reason, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'uncertain', ?, ?)`,
  ).run(
    operationId,
    delivery.appId,
    delivery.conversationId,
    delivery.messageId,
    delivery.chatId,
    delivery.threadId ?? null,
    reason,
    Date.now(),
  );
  // A sending row may belong to another live adapter. Keep its ownership; reads
  // expose that incomplete outcome without taking over or releasing its claim.
}
