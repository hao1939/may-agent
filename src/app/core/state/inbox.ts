import type { SqliteDb } from "../../../lib/db.js";
import {
  assertAppInboxClaim,
  completeAppInboxClaim,
  recordAppInboxHandling,
  wakeAppInboxItemsWaitingOn,
  type AppInboxHandling,
} from "./app-inbox-store.js";
import { applyConversationRequestUpdates, ConversationRequestConflict } from "./conversation-requests.js";
import type { AppInputContext, AppTaskAttachment, AppResult } from "@may-agent/sdk";
import { isDeepStrictEqual } from "node:util";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { getAppInboxItem, waitAppInboxClaim, wakeAppInboxItem, type AppInboxClaim } from "./app-inbox-store.js";
import {
  isAppTaskConverged,
  observeAppTaskIntent,
  readAppTaskIntent,
  readAppTaskTrigger,
  type AppTaskObservationResult,
} from "../tasks/app-task-reconciler.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import { isTaskAttentionReadyForReview } from "../tasks/app-task-state.js";
import { linkConversationTopicTask } from "./conversations.js";
import { linkConversationRequestTask } from "./conversation-requests.js";

export type TaskRequestInput = {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppInputContext>;
  authorize?: () => void;
  topicId?: string;
  requestLink?: Omit<Parameters<typeof linkConversationRequestTask>[1], "taskRef">;
};

/** Persist resolved Task input and Conversation links. No App mapping, execution or notification calls. */
export function admitTaskRequest(config: AppTaskContext, input: TaskRequestInput): AppTaskObservationResult {
  return stateTransaction(config.resourceStore.db, () => {
    input.authorize?.();
    const observation = admitAuthorizedTaskRequest(config, input);
    if (input.topicId)
      linkConversationTopicTask(config.resourceStore.db, input.topicId, input.appId, observation.taskId);
    if (input.requestLink)
      linkConversationRequestTask(config.resourceStore.db, {
        ...input.requestLink,
        taskRef: { appId: input.appId, taskId: observation.taskId },
      });
    return observation;
  });
}

function admitAuthorizedTaskRequest(config: AppTaskContext, input: TaskRequestInput): AppTaskObservationResult {
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
    // A released Host could commit admission and crash before storing the wait.
    // Reuse that exact target's identity; normal admission checks still reject
    // changed work. The request wait becomes authoritative in this transaction,
    // so no admission rewrite, scan or schema migration is needed.
    let admissionKey = operationKey;
    if (!previous) {
      const keys = [
        operationKey,
        `task:${current.id}:${input.attachment.kind}:${taskId}`,
        `task:${current.id}:${input.attachment.kind === "existing" ? "desired" : "existing"}:${taskId}`,
      ];
      const admissions = config.resourceStore.readTaskContext({
        taskIds: [],
        admissionIds: keys,
      }).appTaskAdmissions;
      admissionKey = keys.find((key) => admissions?.[key]) ?? operationKey;
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
      : admitTaskRequest(config, { ...input, idempotencyKey: admissionKey });
    if (replay) return observation;
    if (!waitAppInboxClaim(db, input.claim, { kind: "task", id: observation.taskId }, { now })) {
      throw new Error("claim is stale");
    }
    if (current.topicId) linkConversationTopicTask(db, current.topicId, input.appId, observation.taskId, now);
    const hasPendingInput = Boolean(readAppTaskTrigger(config, observation.taskId));
    if (
      isTaskAttentionReadyForReview(config.resourceStore.readTask(observation.taskId), hasPendingInput) ||
      (!hasPendingInput && isAppTaskConverged(config, observation.taskId, observation.generation))
    ) {
      wakeAppInboxItem(db, current.id, now);
    }
    return observation;
  });
}

/** Retry an uncommitted result, not a rejected decision or Task operation. */
export class InputCompletionError extends Error {}

/** Input result, accepted-ask closure and dependent wakes share one commit. */
export function completeInboxInput(
  db: SqliteDb,
  input: {
    claim: AppInboxClaim;
    result: AppResult;
    handling?: AppInboxHandling;
    authorize: () => void;
    now: number;
  },
): void {
  const { claim, result, handling, authorize, now } = input;
  try {
    stateTransaction(db, () => {
      authorize();
      assertAppInboxClaim(db, claim, now);
      if (handling) recordAppInboxHandling(db, claim, handling, now);
      if (!handling && claim.item.handling?.phase === "decided" && claim.item.conversationId) {
        const closing = (claim.item.handling.decision.requestUpdates ?? []).filter(
          (update) => update.disposition !== "open",
        );
        if (closing.length)
          applyConversationRequestUpdates(db, {
            appId: claim.item.appId,
            conversationId: claim.item.conversationId,
            topicId: claim.item.topicId,
            updates: closing.map((update) => ({ ...update, expectedRevision: update.expectedRevision + 1 })),
            updateKey: `input:${claim.item.id}:close`,
            messageId: `result:${claim.item.id}`,
            now,
          });
      }
      const rowCompleted = completeAppInboxClaim(db, claim, result, now);
      if (!rowCompleted) throw new Error("claim is stale");
      wakeAppInboxItemsWaitingOn(db, { kind: "app", id: claim.item.id }, now);
    });
  } catch (error) {
    if (!handling && claim.item.handling?.phase === "decided" && !(error instanceof ConversationRequestConflict))
      throw new InputCompletionError(error instanceof Error ? error.message : String(error), { cause: error });
    throw error;
  }
}
