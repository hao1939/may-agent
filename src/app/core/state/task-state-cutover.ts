import { isDeepStrictEqual } from "node:util";
import { stateTransaction } from "../../../lib/db/transaction.js";
import {
  appTaskSpecHash,
  appendTaskTriggerEvent,
  preferredTriggerFromEvents,
  readAppTaskAgent,
} from "../tasks/app-task-reconciler.js";
import { taskInputAdmissionKeys } from "../tasks/app-task-inputs.js";
import { taskExecutionRetryDelay, type AppTaskAttempt, type AppTaskTriggerEvent } from "../tasks/app-task-state.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import type { AppTaskResourceMutation } from "./app-task-resource-store.js";
import { getAppInboxItem } from "./app-inbox-store.js";

function attemptEvents(attempt: AppTaskAttempt): AppTaskTriggerEvent[] {
  return attempt.events ?? (attempt.trigger ? [{ event: attempt.trigger, observedAt: attempt.startedAt }] : []);
}

/** Offline continuation of retained Task state. Run receipt import first.
 * No saved decision is executed again; only original input/evidence is restored.
 * Missing or conflicting acceptance identity aborts the transaction rather than
 * binding an old caller to an unrelated latest answer.
 */
export function migrateOpenTaskState(config: AppTaskContext, input: { oldRuntimeStopped: boolean; now?: number }) {
  if (!input.oldRuntimeStopped)
    throw new Error("Task state cutover requires the old Host and all workers to be stopped");
  const store = config.resourceStore;
  return stateTransaction(store.db, () => {
    const tree = store.readSnapshot();
    const now = input.now ?? Date.now();
    const stamp = new Date(now).toISOString();
    const mutation: AppTaskResourceMutation = { fences: [], tasks: [], attempts: [], admissions: [], conditions: [] };
    let outcomes = 0;
    let continued = 0;
    let workerStops = 0;
    for (const resource of Object.values(tree.resources ?? {})) {
      const taskId = resource.metadata.id;
      const closure = tree.cancellations?.[taskId];
      const selfStop = closure?.kind === undefined && closure?.decidedBy?.kind === "app" ? closure : undefined;
      if (closure && !selfStop) continue;
      if (tree.receipts?.[taskId]?.metadata.generation === resource.metadata.generation)
        throw new Error(`Import completion receipt before open Task state: ${taskId}`);
      const original = structuredClone(resource);
      const attempts = Object.values(tree.attempts ?? {})
        .filter((attempt) => attempt.taskId === taskId && attempt.taskGeneration === resource.metadata.generation)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.metadata.id.localeCompare(b.metadata.id));
      const originalAttempts = new Map(attempts.map((attempt) => [attempt.metadata.id, structuredClone(attempt)]));
      const latest = attempts.at(-1);
      const observed = attempts.find((attempt) => attempt.metadata.id === resource.status.observedAttemptId);
      // Human Stop is Turn-scoped and must remain quiet, even during an upgrade.
      if (resource.status.phase === "attention" && latest?.failureReason === "owner-stopped") continue;
      const pending = tree.taskTriggers?.[taskId];
      const pendingEvents =
        pending?.events ?? (pending ? [{ event: pending.event, observedAt: pending.observedAt }] : []);
      const restored: AppTaskTriggerEvent[] = [];
      const events = [...attempts.flatMap(attemptEvents), ...pendingEvents];
      const admissions = Object.entries(tree.appTaskAdmissions ?? {}).filter(
        ([, admission]) => admission.taskId === taskId && admission.taskGeneration === resource.metadata.generation,
      );
      const originalAdmissions = new Map(admissions.map(([key, admission]) => [key, structuredClone(admission)]));
      const newInputs = new Set<string>();
      for (const [key, admission] of admissions) {
        if (admission.inputEvent || admission.resultAttemptId) continue;
        const source = events.find((entry) => taskInputAdmissionKeys([entry]).includes(key));
        if (!source) throw new Error(`Original input is missing for Task ${taskId}, admission ${key}`);
        admission.inputEvent = structuredClone(source.event);
        newInputs.add(key);
      }

      const retainedOutcome = resource.status.phase === "converged" || resource.status.phase === "waiting";
      if (
        retainedOutcome &&
        !observed?.acceptedResult &&
        (observed || resource.status.summary || resource.status.result)
      ) {
        if (
          !observed ||
          observed.state !== "completed" ||
          !resource.status.summary ||
          observed.specHash !== appTaskSpecHash({ id: taskId, ...resource.spec }, observed.owner)
        )
          throw new Error(`Accepted attempt is missing or conflicts with Task ${taskId}`);
        observed.acceptedResult = {
          state: resource.status.phase === "converged" ? "converged" : "waiting",
          summary: resource.status.summary,
          response: resource.status.response,
          result: resource.status.result,
          evidence: resource.status.evidence ?? [],
        };
        outcomes++;
      }
      if (selfStop) {
        const actor = selfStop.decidedBy!;
        const attempt =
          actor.kind === "app"
            ? attempts.find((entry) => entry.metadata.id === actor.attemptId && entry.owner === actor.agent)
            : undefined;
        if (!attempt || selfStop.generation !== resource.metadata.generation || attempt.acceptedResult)
          throw new Error(`Worker stop evidence conflicts with Task ${taskId}`);
        attempt.retiredCancellation = structuredClone(selfStop);
        attempt.acceptedResult = {
          state: "stopped",
          summary: selfStop.reason,
          response: selfStop.response,
          result: selfStop.result,
          evidence: selfStop.evidence ?? [],
        };
        resource.status.observedAttemptId = attempt.metadata.id;
        // This deletion exists only inside offline cutover. The normal state
        // service deliberately has no operation to reopen a closed Task.
        store.db
          .prepare("DELETE FROM app_task_cancellations WHERE app_id = ? AND task_id = ?")
          .run(store.appId, taskId);
        workerStops++;
      }
      const handoff =
        resource.status.phase === "attention" &&
        latest?.handler.startsWith("workflow:") &&
        (latest.failureReason === "needs-agent" || latest.failureReason === "needs-owner");
      const redo =
        selfStop || resource.status.phase === "running" || (resource.status.phase === "attention" && !handoff);
      if (redo || handoff) {
        const stoppedAttemptId = selfStop?.decidedBy?.kind === "app" ? selfStop.decidedBy.attemptId : undefined;
        const unfinished =
          attempts.find((attempt) => attempt.metadata.id === (original.status.currentAttemptId ?? stoppedAttemptId)) ??
          latest;
        if (unfinished) restored.push(...attemptEvents(unfinished));
      }
      if (redo) {
        for (const attempt of attempts) {
          if (attempt.state !== "running") continue;
          attempt.state = "interrupted";
          attempt.lease = undefined;
          attempt.finishedAt = stamp;
          attempt.failureReason ??= "offline-task-cutover";
        }
        resource.status.phase = "pending";
        resource.status.currentAttemptId = undefined;
        resource.status.executionFailures = Math.max(1, resource.status.executionFailures ?? 0);
        resource.status.executionRetryAt ??= now + taskExecutionRetryDelay(resource.status.executionFailures);
        continued++;
      }

      const considered = new Set(
        observed ? taskInputAdmissionKeys(attemptEvents(observed), observed.continuedInputKeys) : [],
      );
      const children = Object.values(tree.resources ?? {})
        .filter((child) => {
          const stopped = tree.cancellations?.[child.metadata.id];
          return (
            child.spec.parentId === taskId &&
            (!stopped || (stopped.kind === undefined && stopped.decidedBy?.kind === "app"))
          );
        })
        .map((child) => ({ id: child.metadata.id, generation: child.metadata.generation }));
      const conditions = (resource.status.conditionIds ?? []).map((id) => {
        const condition = tree.conditions?.[id];
        if (!condition) throw new Error(`Condition ${id} is missing for Task ${taskId}`);
        return { id, generation: condition.metadata.generation };
      });
      const renamedConditions = conditions.flatMap(({ id }) => {
        const condition = tree.conditions![id]!;
        if (condition.spec.type !== "app.dependency.completed" || !id.startsWith("app-request:")) return [];
        condition.spec.type = "app.dependency.updated";
        condition.metadata.resourceVersion++;
        return [condition];
      });
      for (const [key, admission] of admissions) {
        if (admission.resultAttemptId) continue;
        // Recover only a proven first report, never infer one from current status.
        if (!admission.reportAttemptId) {
          const report = attempts.find((attempt) =>
            attempt.acceptedResult?.state === "stopped" && attempt.specHash === admission.specHash &&
            taskInputAdmissionKeys(attemptEvents(attempt), attempt.continuedInputKeys).includes(key));
          if (report) admission.reportAttemptId = report.metadata.id;
        }
        if (considered.has(key) && observed?.specHash === admission.specHash) {
          if (observed.acceptedResult?.state === "converged") admission.resultAttemptId = observed.metadata.id;
          else if (observed.acceptedResult?.state === "waiting" && resource.status.phase === "waiting")
            (resource.status.inputWaits ??= {})[key] ??= {
              taskGeneration: resource.metadata.generation,
              children,
              conditions,
            };
        }
        if (admission.resultAttemptId || resource.status.inputWaits?.[key]) continue;
        if (!newInputs.has(key) && !redo) continue;
        const event = admission.inputEvent;
        if (!event) continue;
        const request = (event.data as { request?: { id?: unknown } } | undefined)?.request;
        const item = typeof request?.id === "string" ? getAppInboxItem(store.db, request.id) : null;
        // Already returned historical answers remain in the caller's record.
        // An unfinished failure/worker stop still needs the original assignment.
        if (!redo && item?.appId === store.appId && item.status === "done") continue;
        restored.push({ event, observedAt: admission.admittedAt });
      }
      let queued = pendingEvents;
      if (restored.length) {
        queued = [];
        for (const entry of [...restored, ...pendingEvents].sort((a, b) => a.observedAt.localeCompare(b.observedAt)))
          queued = appendTaskTriggerEvent(queued, entry.event, entry.observedAt);
      }
      const changedTrigger = !isDeepStrictEqual(queued, pendingEvents);
      const trigger =
        changedTrigger && queued.length
          ? {
              taskId,
              taskGeneration: resource.metadata.generation,
              resourceVersion: (pending?.resourceVersion ?? 0) + 1,
              events: queued,
              event: preferredTriggerFromEvents(queued, readAppTaskAgent(config, taskId) ?? config.agent),
              observedAt: queued[queued.length - 1]!.observedAt,
            }
          : pending;
      const changedAttempts = attempts.filter(
        (attempt) => !isDeepStrictEqual(attempt, originalAttempts.get(attempt.metadata.id)),
      );
      const changedAdmissions = admissions.filter(
        ([key, admission]) => !isDeepStrictEqual(admission, originalAdmissions.get(key)),
      );
      if (
        !isDeepStrictEqual(resource, original) ||
        changedAttempts.length ||
        changedAdmissions.length ||
        renamedConditions.length ||
        changedTrigger ||
        selfStop
      ) {
        mutation.fences.push({ taskId, resourceVersion: original.metadata.resourceVersion });
        resource.metadata.resourceVersion++;
        resource.status.updatedAt = stamp;
        const nextCheckAt = store.db
          .prepare("SELECT next_check_at FROM app_tasks WHERE app_id = ? AND task_id = ?")
          .get(store.appId, taskId)?.next_check_at;
        mutation.tasks!.push({
          resource,
          trigger,
          nextCheckAt: typeof nextCheckAt === "number" ? nextCheckAt : null,
          ready: resource.status.phase === "pending" || Boolean(trigger) || Boolean(handoff),
        });
        for (const attempt of changedAttempts) attempt.metadata.resourceVersion++;
        mutation.attempts!.push(...changedAttempts);
        mutation.conditions!.push(...renamedConditions);
        mutation.admissions!.push(...changedAdmissions.map(([key, value]) => ({ taskId: key, value })));
      }
    }
    if (mutation.fences.length && !store.commit(mutation))
      throw new Error("Task state cutover lost its resource fence");
    return { tasks: mutation.fences.length, outcomes, continued, workerStops, inputs: mutation.admissions!.length };
  });
}
