import { createHash } from "node:crypto";
import { admitTaskChanges, type TaskChanges, type TaskChangeReceipt, type Condition } from "@may-agent/sdk";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { appTaskConfig, type AppTaskRuntimeDescriptor } from "./runtime-definition.js";
import type { AppTaskRuntimeOptions } from "./runtime-options.js";
import {
  applyRunningTaskChanges,
  assertAppTaskClaimCurrent,
  readTaskChangeInputKeys,
  type AppTaskClaim,
} from "./app-task-reconciler.js";
import {
  admitTaskAppRequests,
  mergeTaskConditions,
  linkedTaskAppDependencyConditions,
  resolveTaskRequestCondition,
} from "./dependency-admission.js";

function changeKey(value: unknown): string {
  const encoded = JSON.stringify(value, (_key, entry: unknown) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
      : entry,
  );
  return createHash("sha256").update(encoded).digest("hex");
}

/** Read the admitted state for cleanup planning, then roll back before any publication. */
export function previewTaskChanges<T>(
  input: Omit<Parameters<typeof applyTaskChanges>[0], "settle">,
  read: () => T,
): T {
  const rollback = new Error("Task change preview completed");
  let result!: T;
  try {
    applyTaskChanges({
      ...input,
      settle: () => {
        result = read();
        // Throw inside admission so SQL, receipts and after-commit effects roll back.
        throw rollback;
      },
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}

/** One admission path for tool calls and final declarations. Dispatch follows durable caller bookkeeping. */
export function applyTaskChanges(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  changes: TaskChanges;
  acceptedLiveEventIds?: number[];
  /** Final settlement joins admission atomically; immediate calls omit it. */
  settle?: (receipt: TaskChangeReceipt) => void;
}): TaskChangeReceipt {
  const admitted = admitTaskChanges(input.changes);
  if (!admitted.ok) throw new Error(admitted.error);
  const changes = admitted.changes;
  const config = appTaskConfig(input.descriptor);
  const publications: Array<() => void> = [];
  const receipt = stateTransaction(config.resourceStore.db, () => {
    const receipt = admit();
    input.settle?.(receipt);
    return receipt;
  });
  function admit(): TaskChangeReceipt {
    assertAppTaskClaimCurrent(config, input.claim);
    if (!changes.requests?.length && !changes.conditions?.length && !changes.actions?.length)
      return { requests: [], conditionIds: [], actionsApplied: [] };
    const inputKeys = readTaskChangeInputKeys(config, input.claim, changes.inputKeys, input.acceptedLiveEventIds);
    const key = changeKey({
      requests: changes.requests ?? [],
      conditions: changes.conditions ?? [],
      actions: changes.actions ?? [],
      inputKeys,
    });
    const previous = config.resourceStore.readTaskChangeReceipt(input.claim.taskId, input.claim.generation, key);
    if (previous) return previous;
    const conditions = changes.conditions ?? [];
    for (const action of changes.actions ?? []) {
      const problem = input.descriptor.app.tasks?.validateAction?.(action);
      if (problem) throw new Error(problem);
    }
    for (const condition of conditions) {
      if (!("requestId" in condition)) {
        const problem = input.descriptor.app.tasks?.validateCondition?.(condition);
        if (problem) throw new Error(problem);
      }
    }
    const explicit = mergeTaskConditions(
      conditions.filter((condition): condition is Condition => !("requestId" in condition)),
    );
    const linked = linkedTaskAppDependencyConditions(config, input.claim.taskId);
    mergeTaskConditions([...linked.all, ...explicit], new Set(linked.all.map(({ id }) => id)));
    const submitted = admitTaskAppRequests({
      ...input,
      requests: changes.requests ?? [],
      existingConditions: linked.unfinished,
      deferPublication: (publish) => publications.push(publish),
    });
    const references = conditions.flatMap((condition) =>
      "requestId" in condition
        ? [submitted.get(condition.requestId) ?? resolveTaskRequestCondition(config, input.claim, condition.requestId)]
        : [],
    );
    const declaredIds = new Set([...references, ...explicit].map(({ id }) => id));
    const resolved = mergeTaskConditions(
      [...references, ...linked.all, ...explicit],
      new Set([...references, ...linked.all].map(({ id }) => id)),
    ).filter(({ id }) => declaredIds.has(id));
    const retired = new Set(
      (changes.actions ?? []).flatMap((action) =>
        action.kind === "retire-condition" ? [action.conditionId] : [],
      ),
    );
    if (resolved.some(({ id }) => retired.has(id)))
      throw new Error("Task changes cannot retire and redeclare the same Condition");
    const actions: NonNullable<TaskChanges["actions"]> = [];
    const actionReceiptKeys: string[] = [];
    const replayedActions: string[] = [];
    for (const action of changes.actions ?? []) {
      const actionKey = changeKey({ action });
      const saved = config.resourceStore.readTaskChangeReceipt(input.claim.taskId, input.claim.generation, actionKey);
      if (saved) replayedActions.push(...saved.actionsApplied);
      else {
        actions.push(action);
        actionReceiptKeys.push(actionKey);
      }
    }
    return applyRunningTaskChanges(config, input.claim, {
      operationKey: key,
      actionReceiptKeys,
      replayedActions,
      requests: [...submitted].map(([id, condition]) => ({ id, requestId: condition.subject.slice("id:".length) })),
      conditions: resolved,
      actions,
      inputKeys,
      facts: changes.facts,
      acceptedLiveEventIds: input.acceptedLiveEventIds,
    });
  }
  for (const publish of publications) publish();
  for (const action of admitted.changes.actions ?? []) {
    if (action.kind === "unblock-task")
      input.opts.bus.emit({
        type: "app.task.ready",
        source: "app-task-changes",
        owner: `app:${input.descriptor.id}`,
        target: { appId: input.descriptor.id, taskId: action.taskId },
        data: { appId: input.descriptor.id, taskId: action.taskId },
      });
  }
  return receipt;
}
