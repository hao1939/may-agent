import { createHash } from "node:crypto";
import type { SqliteDb } from "../../lib/db.js";
import type { EventBus } from "../core/events/bus.js";
import { listHumanAppInboxItemsWaitingOnTask, type AppInboxItem } from "../app-inbox-store.js";

/** The frontend's conventional follow-up Task must not wake itself through its Topic links. */
export function isConversationFollowUpTask(
  conversationAppId: string,
  appId: string,
  taskId: string,
): boolean {
  return appId === conversationAppId && taskId === "conversation/follow-up";
}

export function oneItemPerConversationTask(items: AppInboxItem[]): AppInboxItem[] {
  const selected = new Map<string, AppInboxItem>();
  for (const item of items) {
    if (!item.conversationId || item.waitingOn?.kind !== "task") continue;
    const key = `${item.conversationId}\0${item.appId}\0${item.waitingOn.id}`;
    // Prefer the request that first linked this Conversation to the Task.
    // Later focused human turns steer the same Task; they are not additional
    // owners of its public output stream. Oldest-first order is the fallback
    // for Tasks that predate this Conversation.
    const current = selected.get(key);
    if (!current || (current.targetTaskId && !item.targetTaskId)) selected.set(key, item);
  }
  return [...selected.values()];
}

/** Publish waiting status for the selected conversation App, preserving existing message identities. */
export function publishConversationTaskWaiting(
  db: SqliteDb,
  bus: EventBus,
  { appId, taskId, generation, summary }: { appId: string; taskId: string; generation: unknown; summary: string },
): void {
  const statusIdentity = `${generation ?? "?"}:${createHash("sha256")
    .update(`waiting\0${summary}`)
    .digest("hex")
    .slice(0, 16)}`;
  for (const item of oneItemPerConversationTask(listHumanAppInboxItemsWaitingOnTask(db, appId, taskId))) {
    const idempotencyKey = `conversation-task-status:${item.conversationId}:${appId}:${taskId}:${statusIdentity}:waiting`;
    bus.emit({
      type: "conversation.message.created",
      source: "app-inbox",
      owner: `app:${appId}`,
      data: {
        appId,
        conversationId: item.conversationId!,
        author: { kind: "agent", id: appId },
        text: summary || "I’m continuing this as a Task and it is waiting for new evidence.",
        metadata: {
          channel: item.channel,
          channelTargetId: item.channelTargetId,
          channelThreadId: item.channelThreadId,
          requestId: item.id,
          taskRefs: [{ appId, taskId }],
        },
        idempotencyKey,
      },
    });
  }
}
