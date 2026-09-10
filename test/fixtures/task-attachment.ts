import type { AppTaskAttacher } from "../../src/app/app-inbox-host.js";
import { waitAppInboxClaim, wakeAppInboxItem } from "../../src/app/app-inbox-store.js";
import { linkConversationTopicTask } from "../../src/app/conversations/store.js";
import type { SqliteDb } from "../../src/lib/db.js";

/** Inbox-only tests fake Task storage; state and runtime tests use the real operation. */
export function fakeTaskAttacher(
  db: SqliteDb,
  resolve: (input: Parameters<AppTaskAttacher>[0]) => Promise<{ taskId: string; ready?: boolean }>,
): AppTaskAttacher {
  return async (input) => {
    const result = await resolve(input);
    if (!input.claim) return result;
    if (!waitAppInboxClaim(db, input.claim, { kind: "task", id: result.taskId }, { now: input.now })) {
      throw new Error("claim is stale");
    }
    if (input.claim.item.topicId) {
      linkConversationTopicTask(db, input.claim.item.topicId, input.appId, result.taskId, input.now);
    }
    if (result.ready) wakeAppInboxItem(db, input.claim.item.id, input.now);
    return result;
  };
}
