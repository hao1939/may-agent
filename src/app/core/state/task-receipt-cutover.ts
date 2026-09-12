import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { appTaskSpecHash } from "../tasks/app-task-reconciler.js";
import type { AppTaskAttempt, AppTaskResource } from "../tasks/app-task-state.js";
import type { AppTaskContext, TaskCompletionReceipt } from "../tasks/app-task-store.js";
import type { AppTaskResourceMutation } from "./app-task-resource-store.js";

function receiptAttempt(receipt: TaskCompletionReceipt): AppTaskAttempt {
  return {
    metadata: {
      id: `receipt:${createHash("sha256")
        .update(JSON.stringify([receipt.metadata.id, receipt.metadata.generation, receipt.specHash]))
        .digest("hex")}`,
      resourceVersion: 1,
    },
    taskId: receipt.metadata.id,
    taskGeneration: receipt.metadata.generation,
    specHash: receipt.specHash,
    owner: receipt.owner,
    handler: receipt.handler,
    runtimeId: "retired:task-receipt",
    state: "completed",
    reason: "Accepted outcome imported from its historical completion receipt; not a new execution",
    summary: receipt.summary,
    startedAt: receipt.completedAt,
    finishedAt: receipt.completedAt,
    workspace: receipt.workspace,
    acceptedResult: {
      state: "converged",
      summary: receipt.summary,
      response: receipt.response,
      result: receipt.result,
      evidence: receipt.evidence,
      acceptanceBasis: receipt.acceptanceBasis,
    },
  };
}

/** Offline conversion of historical completion receipts, not a runtime repair loop.
 * Keep the original receipts (including compacted-history digests) unchanged.
 * Import an explicitly historical outcome rather than guessing an execution ID.
 * Old failures, waits and Conversation inputs have separate cutover work.
 */
export function migrateTaskCompletionReceipts(config: AppTaskContext, input: { oldRuntimeStopped: boolean }) {
  if (!input.oldRuntimeStopped)
    throw new Error("Task receipt cutover requires the old Host and all workers to be stopped");
  const store = config.resourceStore;
  return stateTransaction(store.db, () => {
    const tree = store.readSnapshot();
    const now = new Date().toISOString();
    const mutation: AppTaskResourceMutation = {
      fences: [],
      expectMissingTaskIds: [],
      tasks: [],
      attempts: [],
      cancellations: [],
      admissions: [],
    };
    let imported = 0;
    let closed = 0;
    for (const receipt of Object.values(tree.receipts ?? {})) {
      const taskId = receipt.metadata.id;
      const attempt = receiptAttempt(receipt);
      const prior = tree.attempts?.[attempt.metadata.id];
      if (prior) {
        // Identity is stable across replay, but never overwrite conflicting history.
        if (!isDeepStrictEqual(prior, JSON.parse(JSON.stringify(attempt))))
          throw new Error(`Imported completion receipt changed for Task ${taskId}`);
        continue;
      }
      const current = tree.resources?.[taskId];
      if (current) {
        mutation.fences.push({ taskId, resourceVersion: current.metadata.resourceVersion });
        if (
          current.metadata.generation < receipt.metadata.generation ||
          (current.metadata.generation === receipt.metadata.generation &&
            appTaskSpecHash({ id: taskId, ...current.spec }, receipt.owner) !== receipt.specHash)
        )
          throw new Error(`Completion receipt conflicts with the retained Task ${taskId}`);
      } else mutation.expectMissingTaskIds!.push(taskId);

      mutation.attempts!.push(attempt);
      imported++;
      for (const [key, admission] of Object.entries(tree.appTaskAdmissions ?? {})) {
        if (
          admission.taskId !== taskId ||
          admission.taskGeneration !== receipt.metadata.generation ||
          admission.specHash !== receipt.specHash ||
          admission.resultAttemptId
        )
          continue;
        mutation.admissions!.push({ taskId: key, value: { ...admission, resultAttemptId: attempt.metadata.id } });
      }
      // A receipt for an older generation is history, never authority to close
      // revised work. Existing human/owner closure remains unchanged as well.
      if (tree.cancellations?.[taskId] || (current && current.metadata.generation > receipt.metadata.generation))
        continue;
      const resource: AppTaskResource = current ?? {
        metadata: { ...receipt.metadata },
        spec: {
          parentId: receipt.parentId,
          outcome: receipt.outcome,
          acceptance: receipt.acceptance,
          owner: receipt.owner,
          // Receipt-only history no longer has a complete executable spec.
          // This inert projection is closed before it becomes visible.
          mode: "achieve",
          workflow: receipt.workflow,
          executor: receipt.executor,
          input: receipt.input,
          priority: receipt.priority,
        },
        status: { phase: "converged", observedGeneration: receipt.metadata.generation, updatedAt: receipt.completedAt },
      };
      resource.metadata.resourceVersion++;
      resource.status = {
        ...resource.status,
        phase: "converged",
        observedGeneration: receipt.metadata.generation,
        observedAttemptId: attempt.metadata.id,
        currentAttemptId: undefined,
        executionRetryAt: undefined,
        freshHumanInput: undefined,
        conditionIds: [],
        inputWaits: undefined,
        summary: receipt.summary,
        response: receipt.response,
        result: receipt.result,
        evidence: receipt.evidence,
        updatedAt: receipt.completedAt,
      };
      // A stale duplicate may still have an old claim. Preserve its evidence,
      // invalidate that claim, and never allow it to replace accepted history.
      for (const old of Object.values(tree.attempts ?? {})) {
        if (old.taskId !== taskId || old.state !== "running") continue;
        mutation.attempts!.push({
          ...old,
          metadata: { ...old.metadata, resourceVersion: old.metadata.resourceVersion + 1 },
          state: "interrupted",
          lease: undefined,
          finishedAt: now,
          failureReason: "completion-receipt-cutover",
          summary: "Historical completion already exists; obsolete claim fenced during offline cutover",
        });
      }
      mutation.tasks!.push({ resource, ready: false });
      mutation.cancellations!.push({
        kind: "closed",
        appId: store.appId,
        taskId,
        generation: resource.metadata.generation,
        resourceVersion: resource.metadata.resourceVersion,
        acceptedResultAttemptId: attempt.metadata.id,
        outcome: receipt.outcome,
        reason: "Already completed under the previous lifecycle",
        summary: receipt.summary,
        response: receipt.response,
        result: receipt.result,
        evidence: receipt.evidence,
        cancelledAt: receipt.completedAt,
        decidedBy: { kind: "app-policy" },
      });
      closed++;
    }
    if (imported && !store.commit(mutation)) throw new Error("Task receipt cutover lost its resource fence");
    return { imported, closed, linkedInputs: mutation.admissions!.length };
  });
}
