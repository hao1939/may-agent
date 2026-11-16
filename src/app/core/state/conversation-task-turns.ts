import type { TaskIntent } from "@may-agent/sdk/app";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { stopAppTaskAttempt } from "../tasks/app-task-reconciler.js";
import { readTaskInputs } from "../tasks/app-task-inputs.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import {
  createAppInboxItem,
  getAppInboxItem,
  hasConversationExecutionTask,
  reuseAppInboxSubmission,
  type AppTurnTarget,
  type CreateAppInboxItem,
} from "./app-inbox-store.js";
import { conversationTaskId, conversationTaskSuccessorId } from "./conversation-identity.js";
import { admitTaskInput } from "./inbox.js";
export { conversationTaskId } from "./conversation-identity.js";

function conversationTaskLineage(
  config: AppTaskContext,
  appId: string,
  conversationId: string,
): { taskId: string; predecessorTaskId?: string } {
  const first = conversationTaskId(appId, conversationId);
  let taskId = first;
  let predecessorTaskId: string | undefined;
  let ordinal = 1;
  while (config.resourceStore.isCancelled(taskId)) {
    predecessorTaskId = taskId;
    taskId = conversationTaskSuccessorId(appId, conversationId, ++ordinal);
  }
  return { taskId, ...(predecessorTaskId ? { predecessorTaskId } : {}) };
}

export function conversationTaskExecutionId(
  config: AppTaskContext,
  appId: string,
  conversationId: string,
): string {
  return conversationTaskLineage(config, appId, conversationId).taskId;
}

/** Conventional execution intent, shared by admission and offline cutover. */
export function conversationTaskIntent(config: AppTaskContext): Omit<TaskIntent, "id"> {
  const root = config.resourceStore.rootTaskId();
  if (!root) throw new Error("Conversation App has no structural root");
  return {
    parentId: root,
    executor: "agent",
    outcome: "Handle this Conversation's admitted input and return useful outcomes to the human",
    acceptance: ["Address the considered input and preserve unresolved accepted Requests"],
  };
}

export function isConversationTask(config: AppTaskContext, taskId: string): boolean {
  return hasConversationExecutionTask(config.resourceStore.db, config.resourceStore.appId, taskId);
}

/** Stop exactly the input considered by this Turn. Newer input remains pending. */
export function stopConversationTaskTurn(config: AppTaskContext, target: AppTurnTarget, now = Date.now()) {
  if (
    target.appId !== config.resourceStore.appId ||
    !Number.isSafeInteger(target.expectedRevision) ||
    target.expectedRevision < 1
  )
    throw new Error("Conversation Turn stop is stale or mismatched");
  const taskId = conversationTaskLineage(config, target.appId, target.conversationId).taskId;
  const reason = "Human stopped this turn";
  return stateTransaction(config.resourceStore.db, () => {
    const attempt = config.resourceStore.readAttempt(target.turnId);
    const inputs = attempt ? readTaskInputs(config, {
      taskId, generation: target.expectedRevision,
      events: attempt.events ?? [], continuedInputKeys: attempt.continuedInputKeys,
    }) : [];
    const items = inputs.filter(({ key }) => key.startsWith("conversation-input:")).map((input) => {
      const item = getAppInboxItem(config.resourceStore.db, input.id);
      if (!item || item.taskAdmissionKey !== input.key || item.executionTaskId !== taskId ||
        item.conversationId !== target.conversationId || item.appId !== target.appId)
        throw new Error("Stopped input does not belong to the Conversation");
      return item;
    });
    const result = stopAppTaskAttempt(config, {
      taskId,
      attemptId: target.turnId,
      expectedGeneration: target.expectedRevision,
      reason,
      // Stopping the human Turn does not withdraw independently admitted work.
      retainInputKeys: inputs.filter(({ key }) => !key.startsWith("conversation-input:")).map(({ key }) => key),
    });
    if (result.changed) {
      const responseItem = items.filter((item) => item.source.kind === "human").at(-1) ?? items.at(-1);
      for (const item of items) {
        config.resourceStore.db.run(
          `UPDATE app_inbox_items SET status = 'done', handling = ?, result = ?, available_at = NULL,
           completed_at = ?, changed_at = ?, updated_at = ? WHERE id = ?`,
          [
            JSON.stringify({ phase: "stopped", reason }),
            item.id === responseItem?.id
              ? JSON.stringify({
                  summary: reason,
                  response:
                    "Stopped this turn. The ask remains unresolved; already admitted background Tasks continue.",
                })
              : null,
            now,
            now,
            now,
            item.id,
          ],
        );
      }
    }
    return { ...result, taskId };
  });
}

/** Retain unfunded demand; the exact Task link and admission share a savepoint. */
export function admitConversationTaskInput(
  config: AppTaskContext,
  input: CreateAppInboxItem & {
    conversationId: string;
    intent: Omit<TaskIntent, "id">;
    /** The loaded App's declaration; absent means all input is conversational. */
    conversationInputKinds?: readonly string[];
  },
) {
  const db = config.resourceStore.db;
  return stateTransaction(db, () => {
    if (input.appId !== config.resourceStore.appId) throw new Error("Conversation belongs to another App");
    if (!input.conversationId.trim()) throw new Error("Conversation identity is required");
    const replay = reuseAppInboxSubmission(db, input);
    const prior = replay?.item;
    if (replay?.item.status === "done") {
      return {
        ...replay,
        taskId: replay.item.executionTaskId ?? conversationTaskId(input.appId, input.conversationId),
      };
    }
    if (input.source.kind === "human" && input.conversationSequence === undefined) {
      const latest = db
        .prepare(
          "SELECT MAX(conversation_seq) AS sequence FROM app_inbox_items WHERE app_id = ? AND conversation_id = ?",
        )
        .get(input.appId, input.conversationId);
      input = { ...input, conversationSequence: prior?.conversationSequence ?? Number(latest?.sequence ?? 0) + 1 };
    }
    const lineage = prior?.executionTaskId
      ? { taskId: prior.executionTaskId, predecessorTaskId: undefined }
      : conversationTaskLineage(config, input.appId, input.conversationId);
    const { taskId, predecessorTaskId } = lineage;
    if (predecessorTaskId && !config.resourceStore.readTask(taskId) && input.source.kind !== "human") {
      throw new Error("A terminal Conversation requires fresh human input before system feedback can continue it");
    }
    const created = replay ?? createAppInboxItem(db, input);
    const item = created.item;
    const admissionKey = `conversation-input:${item.id}`;
    // This trusted ingress identity distinguishes retained, unstarted demand
    // from a legacy worker even after an explicit funding wake clears its hold.
    db.prepare("UPDATE app_inbox_items SET task_admission_key = ? WHERE id = ? AND task_admission_key IS NOT ?")
      .run(admissionKey, item.id, admissionKey);
    return stateTransaction(db, () => {
        // Bind the saved input before shared admission checks executor compatibility.
        // The surrounding transaction rolls back this link if admission fails.
        db.run(
          `UPDATE app_inbox_items SET execution_task_id = ?, task_admission_key = ?,
          available_at = NULL, handling = NULL WHERE id = ?`,
          [taskId, admissionKey, item.id],
        );
        const observed = admitTaskInput(config, {
          appId: input.appId,
          attachment: config.resourceStore.readTask(taskId)
            ? { kind: "existing", taskId }
            : {
                kind: "desired",
                intent: {
                  ...input.intent,
                  id: taskId,
                  ...(predecessorTaskId
                    ? {
                        input: {
                          ...input.intent.input,
                          conversationLineage: { appId: input.appId, conversationId: input.conversationId, predecessorTaskId },
                        },
                      }
                    : {}),
                },
              },
          idempotencyKey: admissionKey,
          inputContext: { id: item.id, source: item.source, input: item.input },
        });
        return { item: getAppInboxItem(db, item.id)!, taskId: observed.taskId, created: created.created };
      });
  });
}
