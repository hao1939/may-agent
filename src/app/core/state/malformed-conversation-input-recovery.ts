import { isDeepStrictEqual } from "node:util";
import type { AppInput, AppInputSource } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { canonicalAppEvent } from "../../canonical-app-event.js";
import type { AgentEvent } from "../events/bus.js";
import { preferredTriggerFromEvents } from "../tasks/app-task-reconciler.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import type { AppTaskTriggerEvent } from "../tasks/app-task-state.js";
import { getAppInboxItem, listAppInboxItems, type AppInboxItem } from "./app-inbox-store.js";
import { admitConversationTaskInput, conversationTaskExecutionId } from "./conversation-task-turns.js";

const FAILURE_REASON = "Offline recovery rejected malformed direct Conversation Task admission";

export type MalformedConversationInputRecoveryPlan = {
  quiesced: true;
  malformed: {
    appId: string;
    inputId: string;
    taskId: string;
    originEventId: number;
    idempotencyKey: string;
    taskAdmissionKey: string;
    source: AppInputSource;
    input: AppInput;
  };
  taskFence: {
    resourceVersion: number;
    generation: number;
    currentAttemptId: null;
  };
  recovery: {
    conversationId: string;
    idempotencyKey: string;
  };
};

export type MalformedConversationInputRecoveryResult = {
  status: "would-repair" | "repaired" | "already-repaired";
  malformedInputId: string;
  recoveredInputId?: string;
  taskId: string;
};

class DryRunRollback extends Error {
  constructor(readonly result: MalformedConversationInputRecoveryResult) {
    super("Dry-run rollback");
  }
}

function required(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} must be non-empty`);
  return value;
}

function triggerEvents(
  trigger: ReturnType<AppTaskContext["resourceStore"]["readTrigger"]> | undefined,
): AppTaskTriggerEvent[] {
  if (!trigger) return [];
  return trigger.events?.length ? trigger.events : [{ event: trigger.event, observedAt: trigger.observedAt }];
}

function exactInputEvent(entry: AppTaskTriggerEvent, plan: MalformedConversationInputRecoveryPlan): boolean {
  const event = canonicalAppEvent(entry.event as AgentEvent);
  const request =
    event.type === "app.task.requested"
      ? (event.data.request as { id?: unknown; source?: unknown; input?: unknown } | undefined)
      : undefined;
  return (
    event.type === "app.task.requested" &&
    event.data.idempotencyKey === plan.malformed.taskAdmissionKey &&
    request?.id === plan.malformed.inputId &&
    isDeepStrictEqual(request.source, plan.malformed.source) &&
    isDeepStrictEqual(request.input, plan.malformed.input)
  );
}

function isExactMalformedItem(
  item: AppInboxItem | null,
  plan: MalformedConversationInputRecoveryPlan,
): item is AppInboxItem {
  const malformed = plan.malformed;
  return Boolean(
    item &&
    item.id === malformed.inputId &&
    item.appId === malformed.appId &&
    item.targetTaskId === malformed.taskId &&
    item.originEventId === malformed.originEventId &&
    item.idempotencyKey === malformed.idempotencyKey &&
    item.taskAdmissionKey === malformed.taskAdmissionKey &&
    item.waitingOn?.kind === "task" &&
    item.waitingOn.id === malformed.taskId &&
    item.conversationId === undefined &&
    item.executionTaskId === undefined &&
    item.result === undefined &&
    item.lease === undefined &&
    item.source.kind === "system" &&
    isDeepStrictEqual(item.source, malformed.source) &&
    isDeepStrictEqual(item.input, malformed.input),
  );
}

function exactCompletedRepair(
  db: SqliteDb,
  context: AppTaskContext,
  plan: MalformedConversationInputRecoveryPlan,
): MalformedConversationInputRecoveryResult | null {
  const old = getAppInboxItem(db, plan.malformed.inputId);
  if (
    !isExactMalformedItem(old, plan) ||
    old.status !== "done" ||
    old.handling?.phase !== "failed" ||
    old.handling.reason !== FAILURE_REASON
  )
    return null;
  const corrected = listAppInboxItems(db, {
    appId: plan.malformed.appId,
    idempotencyKey: plan.recovery.idempotencyKey,
    limit: 1,
  })[0];
  if (
    !corrected ||
    corrected.conversationId !== plan.recovery.conversationId ||
    corrected.targetTaskId !== undefined ||
    corrected.originEventId !== plan.malformed.originEventId ||
    corrected.source.kind !== plan.malformed.source.kind ||
    corrected.source.id !== plan.malformed.source.id ||
    !isDeepStrictEqual(corrected.input, plan.malformed.input) ||
    corrected.executionTaskId !== plan.malformed.taskId ||
    corrected.taskAdmissionKey !== `conversation-input:${corrected.id}`
  )
    return null;
  const tree = context.resourceStore.readTaskContext({
    taskIds: [plan.malformed.taskId],
    admissionIds: [plan.malformed.taskAdmissionKey, corrected.taskAdmissionKey],
  });
  if (
    tree.appTaskAdmissions?.[plan.malformed.taskAdmissionKey] ||
    tree.resources?.[plan.malformed.taskId]?.status.inputWaits?.[plan.malformed.taskAdmissionKey] ||
    triggerEvents(tree.taskTriggers?.[plan.malformed.taskId]).some((entry) => exactInputEvent(entry, plan))
  )
    return null;
  const correctedAdmission = tree.appTaskAdmissions?.[corrected.taskAdmissionKey];
  if (correctedAdmission?.taskId !== plan.malformed.taskId) return null;
  return {
    status: "already-repaired",
    malformedInputId: old.id,
    recoveredInputId: corrected.id,
    taskId: plan.malformed.taskId,
  };
}

/**
 * Offline, one-input repair. The caller must stop the Host and workers first;
 * the exact no-attempt fence is checked again inside the write transaction.
 */
export function recoverMalformedConversationInput(
  context: AppTaskContext,
  plan: MalformedConversationInputRecoveryPlan,
  options: { dryRun?: boolean; now?: number } = {},
): MalformedConversationInputRecoveryResult {
  if (plan.quiesced !== true) throw new Error("Recovery requires an explicit quiesced Host acknowledgement");
  const { malformed, taskFence, recovery } = plan;
  for (const [field, value] of Object.entries({
    appId: malformed.appId,
    inputId: malformed.inputId,
    taskId: malformed.taskId,
    idempotencyKey: malformed.idempotencyKey,
    taskAdmissionKey: malformed.taskAdmissionKey,
    conversationId: recovery.conversationId,
    recoveryIdempotencyKey: recovery.idempotencyKey,
  }))
    required(value, field);
  if (context.resourceStore.appId !== malformed.appId) throw new Error("Recovery context belongs to another App");
  if (malformed.taskAdmissionKey !== `task:${malformed.inputId}`)
    throw new Error("Malformed admission key must be the exact input admission");
  if (recovery.idempotencyKey === malformed.idempotencyKey)
    throw new Error("Recovery requires a distinct idempotency key");
  if (!Number.isSafeInteger(malformed.originEventId) || malformed.originEventId < 1)
    throw new Error("Malformed origin event id must be a positive safe integer");
  if (
    !Number.isSafeInteger(taskFence.resourceVersion) ||
    taskFence.resourceVersion < 1 ||
    !Number.isSafeInteger(taskFence.generation) ||
    taskFence.generation < 1 ||
    taskFence.currentAttemptId !== null
  )
    throw new Error("Recovery requires an exact no-current-attempt Task fence");

  try {
    return stateTransaction(context.resourceStore.db, () => {
      const completed = exactCompletedRepair(context.resourceStore.db, context, plan);
      if (completed) return completed;
      if (
        listAppInboxItems(context.resourceStore.db, {
          appId: malformed.appId,
          idempotencyKey: recovery.idempotencyKey,
          limit: 1,
        }).length
      )
        throw new Error("Recovery idempotency key is already used by different input");

      const item = getAppInboxItem(context.resourceStore.db, malformed.inputId);
      if (!isExactMalformedItem(item, plan) || item.status !== "handling")
        throw new Error("Malformed inbox tuple is stale or mismatched");
      const task = context.resourceStore.readTask(malformed.taskId);
      if (
        !task ||
        task.metadata.resourceVersion !== taskFence.resourceVersion ||
        task.metadata.generation !== taskFence.generation ||
        task.status.currentAttemptId !== undefined
      )
        throw new Error("Conversation Task fence is stale or an attempt is current");
      if (conversationTaskExecutionId(context, malformed.appId, recovery.conversationId) !== malformed.taskId)
        throw new Error("Recovery target is not the current Conversation Task lineage");
      const admission = context.resourceStore.readTaskContext({
        taskIds: [],
        admissionIds: [malformed.taskAdmissionKey],
      }).appTaskAdmissions?.[malformed.taskAdmissionKey];
      if (
        !admission ||
        admission.taskId !== malformed.taskId ||
        admission.taskGeneration !== taskFence.generation ||
        admission.resultAttemptId !== undefined
      )
        throw new Error("Malformed Task admission is stale, mismatched, or already accepted");
      const trigger = context.resourceStore.readTrigger(malformed.taskId);
      const events = triggerEvents(trigger);
      const matching = events.filter((entry) => exactInputEvent(entry, plan));
      if (matching.length !== 1) throw new Error("Malformed executable trigger is missing or ambiguous");

      const now = options.now ?? Date.now();
      const remaining = events.filter((entry) => !exactInputEvent(entry, plan));
      const repairedTask = structuredClone(task);
      repairedTask.metadata.resourceVersion += 1;
      delete repairedTask.status.inputWaits?.[malformed.taskAdmissionKey];
      if (repairedTask.status.inputWaits && Object.keys(repairedTask.status.inputWaits).length === 0)
        delete repairedTask.status.inputWaits;
      repairedTask.status.updatedAt = new Date(now).toISOString();
      const repairedTrigger =
        trigger && remaining.length
          ? {
              ...trigger,
              resourceVersion: trigger.resourceVersion + 1,
              events: remaining,
              event: preferredTriggerFromEvents(remaining, repairedTask.spec.agent ?? context.agent),
              observedAt: remaining.at(-1)!.observedAt,
            }
          : undefined;
      const row = context.resourceStore.db
        .prepare("SELECT next_check_at FROM app_tasks WHERE app_id = ? AND task_id = ?")
        .get(malformed.appId, malformed.taskId);
      const committed = context.resourceStore.commit({
        fences: [
          {
            taskId: malformed.taskId,
            resourceVersion: taskFence.resourceVersion,
            generation: taskFence.generation,
            currentAttemptId: null,
          },
        ],
        tasks: [
          {
            resource: repairedTask,
            trigger: repairedTrigger,
            ready: remaining.length > 0,
            nextCheckAt: typeof row?.next_check_at === "number" ? row.next_check_at : null,
          },
        ],
        deleteAdmissionIds: [malformed.taskAdmissionKey],
      });
      if (!committed) throw new Error("Conversation Task fence changed during recovery");

      const terminal = context.resourceStore.db
        .prepare(
          `UPDATE app_inbox_items SET status = 'done', handling = ?, result = NULL,
         available_at = NULL, review_at = NULL, lease_owner = NULL, lease_expires_at = NULL,
         completed_at = ?, changed_at = ?, updated_at = ?
         WHERE id = ? AND app_id = ? AND status = 'handling' AND origin_event_id = ?
           AND target_task_id = ? AND task_admission_key = ? AND result IS NULL`,
        )
        .run(
          JSON.stringify({ phase: "failed", reason: FAILURE_REASON }),
          now,
          now,
          now,
          malformed.inputId,
          malformed.appId,
          malformed.originEventId,
          malformed.taskId,
          malformed.taskAdmissionKey,
        );
      if (terminal.changes !== 1) throw new Error("Malformed inbox tuple changed during recovery");

      const recovered = admitConversationTaskInput(context, {
        appId: malformed.appId,
        conversationId: recovery.conversationId,
        source: structuredClone(malformed.source),
        input: structuredClone(malformed.input),
        originEventId: malformed.originEventId,
        idempotencyKey: recovery.idempotencyKey,
        intent: structuredClone(repairedTask.spec),
        now,
      });
      if (recovered.taskId !== malformed.taskId) throw new Error("Recovery resolved a different Conversation Task");
      const result: MalformedConversationInputRecoveryResult = {
        status: "repaired",
        malformedInputId: item.id,
        recoveredInputId: recovered.item.id,
        taskId: recovered.taskId,
      };
      if (options.dryRun) throw new DryRunRollback({ ...result, status: "would-repair" });
      return result;
    });
  } catch (error) {
    if (error instanceof DryRunRollback) return error.result;
    throw error;
  }
}
