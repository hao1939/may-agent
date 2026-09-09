import type { AppRequest, AppTaskAttachment } from "@may-agent/sdk";
import { isDeepStrictEqual } from "node:util";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { getAppInboxItem, waitAppInboxClaim, wakeAppInboxItem, type AppInboxClaim } from "../../app-inbox-store.js";
import {
  isAppTaskConverged,
  observeAppTaskIntent,
  readAppTaskIntent,
  readAppTaskTrigger,
  type AppTaskObservationResult,
} from "../../app-task-reconciler.js";
import type { AppTaskContext } from "../../app-task-store.js";
import { linkConversationTopicTask } from "../../conversations/store.js";

export type TaskRequestInput = {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppRequest>;
};

/** Persist Task input only. No mapping, executor, queue or notification calls. */
export function admitTaskRequest(config: AppTaskContext, input: TaskRequestInput): AppTaskObservationResult {
  if (input.appId !== config.resourceStore.appId) throw new Error("Task request belongs to another App");
  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("App task idempotency key must be non-empty");
  let intent;
  if (input.attachment.kind === "existing") {
    const taskId = input.attachment.taskId.trim();
    if (!taskId) throw new Error("Existing task id must be non-empty");
    const admission = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [idempotencyKey] })
      .appTaskAdmissions?.[idempotencyKey];
    if (admission) {
      if (admission.taskId !== taskId) throw new Error("Task request identity was reused for different work");
      if (!config.resourceStore.readTask(taskId) && !config.resourceStore.readReceipt(taskId)) {
        throw new Error(`Admitted Task ${taskId} is missing`);
      }
      return { kind: "observed", taskId, generation: admission.taskGeneration, changed: false };
    }
    if (isAppTaskConverged(config, taskId)) {
      throw new Error(`Task ${taskId} in App ${input.appId} is already complete; create distinct follow-up work`);
    }
    intent = readAppTaskIntent(config, taskId);
    if (!intent) throw new Error(`Task ${taskId} does not exist in App ${input.appId}`);
  } else intent = input.attachment.intent;
  return observeAppTaskIntent(config, {
    intent,
    appAgent: config.agent,
    admissionKey: idempotencyKey,
    trigger: {
      type: "app.task.requested",
      source:
        input.request.source.kind === "human" || input.request.humanRequested === true
          ? "human"
          : `app-inbox:${input.appId}`,
      owner: `agent:${config.agent}`,
      target: { project: input.appId, taskId: intent.id },
      idempotencyKey,
      data: { project: input.appId, taskId: intent.id, appId: input.appId, idempotencyKey, request: input.request },
    },
  });
}

/** Task admission, request wait/claim release and Topic correlation share one commit. */
export function attachRequestToTask(
  config: AppTaskContext,
  input: TaskRequestInput & { claim: AppInboxClaim; now?: number },
): AppTaskObservationResult {
  const db = config.resourceStore.db;
  return stateTransaction(db, () => {
    const now = input.now ?? Date.now();
    const current = getAppInboxItem(db, input.claim.item.id);
    const taskId = input.attachment.kind === "existing" ? input.attachment.taskId.trim() : input.attachment.intent.id;
    if (
      !current ||
      current.id !== input.request.id ||
      current.appId !== input.appId ||
      input.appId !== config.resourceStore.appId ||
      !isDeepStrictEqual(current.input, input.request.input) ||
      !isDeepStrictEqual(current.source, input.request.source)
    ) {
      throw new Error("Task attachment request does not match its claim");
    }
    if (current.targetTaskId && current.targetTaskId !== taskId) throw new Error("Cannot replace an exact Task target");
    const previous = input.claim.item.waitingOn;
    const replacing = previous?.kind === "task" && previous.id !== taskId;
    const operationKey = replacing ? `task:${current.id}:replace:${input.claim.generation}` : `task:${current.id}`;
    if (input.idempotencyKey !== operationKey) throw new Error("Task attachment identity must belong to its request");
    const replay =
      current.status === "handling" &&
      !current.lease &&
      current.waitingOn?.kind === "task" &&
      current.waitingOn.id === taskId &&
      db.prepare("SELECT lease_generation FROM app_inbox_items WHERE id = ?").get(current.id)?.lease_generation ===
        input.claim.generation;
    if (
      !replay &&
      (current.status !== "handling" ||
        current.lease?.owner !== input.claim.owner ||
        current.lease.generation !== input.claim.generation ||
        current.lease.expiresAt <= now)
    ) {
      throw new Error("claim is stale");
    }
    // Rechecks of accepted work retain its admission identity; App-selected
    // replacement has a separate key and is fenced by this request claim.
    const continuing = input.attachment.kind === "existing" && previous?.kind === "task" && previous.id === taskId;
    const generation = continuing
      ? (config.resourceStore.readTask(taskId)?.metadata.generation ??
        config.resourceStore.readReceipt(taskId)?.metadata.generation)
      : undefined;
    if (continuing && generation === undefined) throw new Error(`Attached Task ${taskId} is missing`);
    const observation: AppTaskObservationResult = continuing
      ? { kind: "observed", taskId, generation: generation!, changed: false }
      : admitTaskRequest(config, input);
    if (replay) return observation;
    if (!waitAppInboxClaim(db, input.claim, { kind: "task", id: observation.taskId }, { now })) {
      throw new Error("claim is stale");
    }
    if (current.topicId) linkConversationTopicTask(db, current.topicId, input.appId, observation.taskId, now);
    if (
      !readAppTaskTrigger(config, observation.taskId) &&
      (isAppTaskConverged(config, observation.taskId, observation.generation) ||
        config.resourceStore.readTask(observation.taskId)?.status.phase === "attention")
    ) {
      wakeAppInboxItem(db, current.id, now);
    }
    return observation;
  });
}
