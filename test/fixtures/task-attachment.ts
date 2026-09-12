import type { AppTaskAttacher } from "../../src/app/core/inbox/app-inbox-host.js";
import { linkTaskInput } from "../../src/app/core/state/inbox.js";
import { linkConversationTopicTask } from "../../src/app/core/state/conversations.js";
import { linkConversationRequestTask } from "../../src/app/core/state/conversation-requests.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
import type { SqliteDb } from "../../src/lib/db.js";

/** Routing tests fake the Task executor; admission tests use the real Task store. */
export function fakeTaskAttacher(
  db: SqliteDb,
  resolve: (input: Parameters<AppTaskAttacher>[0]) => { taskId: string },
): AppTaskAttacher {
  return (input) =>
    stateTransaction(db, () => {
      input.authorize?.();
      const result = resolve(input);
      if (input.inboxInputId) linkTaskInput(db, input.inboxInputId, result.taskId, input.idempotencyKey, input.now);
      if (input.topicId) linkConversationTopicTask(db, input.topicId, input.appId, result.taskId, input.now);
      if (input.requestLink)
        linkConversationRequestTask(db, {
          ...input.requestLink,
          taskRef: { appId: input.appId, taskId: result.taskId },
        });
      return result;
    });
}
