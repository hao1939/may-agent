import { createHash } from "node:crypto";
import type { AppConversationRequestUpdate } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { EventBus } from "../events/bus.js";
import { linkConversationTopicTask, readConversationTopic } from "./conversations.js";
import { applyConversationRequestUpdates } from "./conversation-requests.js";

/**
 * Record an App-judged outcome with its exact links and explanation.
 * The EventBus's required persistence subscriber uses this same SQLite connection,
 * so a failed explanation write rolls back Request updates too.
 */
export function recordConversationTaskOutcome(
  db: SqliteDb,
  bus: EventBus,
  input: {
    appId: string;
    conversationId: string;
    topicId: string;
    followUpId: string;
    text: string;
    taskRefs: Array<{ appId: string; taskId: string }>;
    requestUpdates?: AppConversationRequestUpdate[];
    now: number;
  },
): boolean {
  const { appId, conversationId, topicId, followUpId, text, taskRefs, requestUpdates, now } = input;
  return stateTransaction(db, () => {
    const topic = readConversationTopic(db, appId, conversationId, topicId);
    if (!topic) return false;
    // Request updates may reference links introduced by this same result.
    for (const ref of taskRefs) linkConversationTopicTask(db, topic.id, ref.appId, ref.taskId, now);
    if (requestUpdates !== undefined)
      applyConversationRequestUpdates(db, {
        appId,
        conversationId,
        topicId,
        updates: requestUpdates,
        updateKey: `task-result:${appId}:${followUpId}`,
        messageId: `result:${followUpId}`,
        now,
      });
    bus.emit({
      type: "conversation.message.created",
      source: "app-task-follow-up",
      owner: `app:${appId}`,
      data: {
        appId,
        conversationId,
        messageId: `result:${followUpId}`,
        author: { kind: "agent", id: appId },
        text,
        metadata: {
          requestId: followUpId,
          topicId,
          taskRefs,
          ...(taskRefs.length === 1 ? { followTask: taskRefs[0] } : {}),
        },
        idempotencyKey: `conversation-follow-up:${appId}:${followUpId}:${createHash("sha256")
          .update(text)
          .digest("hex")
          .slice(0, 16)}`,
      },
    });
    return true;
  });
}
