import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Check } from "typebox/value";
import type { SqliteDb } from "../../../lib/db.js";
import {
  conversationTurnResultSchema,
  type AppTaskAttachment,
  type ConversationTurnResult,
  type TaskAcceptanceBasis,
  type TaskIntent,
} from "@may-agent/sdk";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import {
  assertAppTaskClaimCurrent,
  appTaskAttemptReport,
  cancelAppTask,
  completeAppTask,
  stopAppTaskAttempt,
  type AppTaskClaim,
  type AppTaskCancellationResult,
} from "../tasks/app-task-reconciler.js";
import { admitTaskRequest } from "./inbox.js";
import {
  createAppInboxItem,
  getAppInboxItem,
  listAppInboxItems,
  type CreateAppInboxItem,
  type AppTurnTarget,
} from "./app-inbox-store.js";
import { createConversationTopic, readConversationTopic, listConversationTopicLinksForTask } from "./conversations.js";
function stableTopicId(appId: string, conversationId: string, originMessageId: string): string {
  return `topic_${createHash("sha256").update([appId, conversationId, originMessageId].join("\0")).digest("hex").slice(0, 24)}`;
}
import { applyConversationRequestUpdates, readConversationRequest } from "./conversation-requests.js";

/** Code assigns one execution identity per Conversation; agents never construct it. */
export function conversationTaskId(appId: string, conversationId: string): string {
  return `conversation_${createHash("sha256").update([appId, conversationId].join("\0")).digest("hex").slice(0, 24)}`;
}

/** Conventional execution intent, shared by admission and offline cutover. */
export function conversationTaskIntent(config: AppTaskContext): Omit<TaskIntent, "id"> {
  const root = config.resourceStore.rootTaskId();
  if (!root) throw new Error("Conversation App has no structural root");
  return {
    parentId: root,
    executor: "conversation",
    outcome: "Handle this Conversation's admitted input and return useful outcomes to the human",
    acceptance: ["Address the considered input and preserve unresolved accepted Requests"],
  };
}

export function isConversationTask(config: AppTaskContext, taskId: string): boolean {
  return Boolean(
    config.resourceStore.db
      .prepare("SELECT 1 FROM app_inbox_items WHERE app_id = ? AND execution_task_id = ? LIMIT 1")
      .get(config.resourceStore.appId, taskId),
  );
}

/** A prepared judgment has no authority to settle or close its executing Task. */
export type ConversationTaskProposal = {
  decision: ConversationTurnResult;
  followUp?: { config: AppTaskContext; attachment: AppTaskAttachment };
  taskControls?: Array<{
    config: AppTaskContext;
    taskId: string;
    generation: number;
    resourceVersion: number;
  }>;
};

/** Stop exactly the input considered by this Turn. Newer input remains pending. */
export function stopConversationTaskTurn(config: AppTaskContext, target: AppTurnTarget, now = Date.now()) {
  if (
    target.appId !== config.resourceStore.appId ||
    !Number.isSafeInteger(target.expectedRevision) ||
    target.expectedRevision < 1
  )
    throw new Error("Conversation Turn stop is stale or mismatched");
  const taskId = conversationTaskId(target.appId, target.conversationId);
  const reason = "Human stopped this turn";
  return stateTransaction(config.resourceStore.db, () => {
    const result = stopAppTaskAttempt(config, {
      taskId,
      attemptId: target.turnId,
      expectedGeneration: target.expectedRevision,
      reason,
    });
    if (result.changed) {
      const items = result.inputKeys.map((key) => {
        const item = key.startsWith("conversation-input:")
          ? getAppInboxItem(config.resourceStore.db, key.slice("conversation-input:".length))
          : null;
        if (
          !item ||
          item.executionTaskId !== taskId ||
          item.conversationId !== target.conversationId ||
          item.appId !== target.appId
        )
          throw new Error("Stopped input does not belong to the Conversation");
        return item;
      });
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

/** Source PoC boundary: input and its Task admission become visible in one commit. */
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
    const taskId = conversationTaskId(input.appId, input.conversationId);
    // An expired legacy lease is not proof that its executor stopped. Cut over
    // only a drained Conversation; do not layer a Task over old execution.
    if (
      db
        .prepare(
          `SELECT 1 FROM app_inbox_items WHERE app_id = ? AND conversation_id = ?
      AND execution_task_id IS NULL AND status != 'done'
      ${input.conversationInputKinds ? `AND input_kind IN (${input.conversationInputKinds.map(() => "?").join(",")})` : ""}
      LIMIT 1`,
        )
        .get(input.appId, input.conversationId, ...(input.conversationInputKinds ?? []))
    ) {
      throw new Error("Conversation still has unhandled legacy input; drain before cutover");
    }
    const prior = input.idempotencyKey
      ? listAppInboxItems(db, { appId: input.appId, idempotencyKey: input.idempotencyKey, limit: 1 })[0]
      : input.id
        ? getAppInboxItem(db, input.id)
        : null;
    if (input.source.kind === "human" && input.conversationSequence === undefined) {
      const latest = db
        .prepare(
          "SELECT MAX(conversation_seq) AS sequence FROM app_inbox_items WHERE app_id = ? AND conversation_id = ?",
        )
        .get(input.appId, input.conversationId);
      input = { ...input, conversationSequence: prior?.conversationSequence ?? Number(latest?.sequence ?? 0) + 1 };
    }
    if (
      prior &&
      (prior.appId !== input.appId ||
        prior.conversationId !== input.conversationId ||
        prior.executionTaskId !== taskId ||
        !isDeepStrictEqual(prior.input, input.input) ||
        !isDeepStrictEqual(prior.source, input.source) ||
        prior.conversationSequence !== input.conversationSequence ||
        (input.topicId !== undefined && input.topicId !== prior.topicId))
    )
      throw new Error("Conversation input identity was reused for different input");
    if (prior?.status === "done") return { item: prior, taskId, created: false };
    const created = prior ? { item: prior, created: false } : createAppInboxItem(db, input);
    const item = created.item;
    const admissionKey = `conversation-input:${item.id}`;
    const observed = admitTaskRequest(config, {
      appId: input.appId,
      attachment: config.resourceStore.readTask(taskId)
        ? { kind: "existing", taskId }
        : { kind: "desired", intent: { ...input.intent, id: taskId } },
      idempotencyKey: admissionKey,
      request: { id: item.id, source: item.source, input: item.input },
    });
    db.run(
      `UPDATE app_inbox_items SET execution_task_id = ?, task_admission_key = ?,
      available_at = NULL WHERE id = ?`,
      [taskId, admissionKey, item.id],
    );
    return { item: getAppInboxItem(db, item.id)!, taskId: observed.taskId, created: created.created };
  });
}

/** Read the exact claimed input batch, including input retained after an unaccepted answer. */
export function readConversationTaskInputs(config: AppTaskContext, claim: AppTaskClaim) {
  assertAppTaskClaimCurrent(config, claim);
  const keys = [...(claim.continuedInputKeys ?? [])];
  for (const { event } of claim.events) {
    if (event.type !== "app.task.requested") continue;
    const request = (event.data as { request?: { id?: unknown; source?: unknown; input?: unknown } } | undefined)
      ?.request;
    const item = typeof request?.id === "string" ? getAppInboxItem(config.resourceStore.db, request.id) : null;
    if (
      !item ||
      event.idempotencyKey !== item.taskAdmissionKey ||
      !isDeepStrictEqual(item.source, request?.source) ||
      !isDeepStrictEqual(item.input, request?.input)
    )
      throw new Error("Conversation input does not belong to this Task attempt");
    keys.push(item.taskAdmissionKey!);
  }
  const items = [...new Set(keys)].map((key) => {
    const item = key.startsWith("conversation-input:")
      ? getAppInboxItem(config.resourceStore.db, key.slice("conversation-input:".length))
      : null;
    if (
      !item?.conversationId ||
      item.appId !== config.resourceStore.appId ||
      item.executionTaskId !== claim.taskId ||
      item.taskAdmissionKey !== key ||
      claim.taskId !== conversationTaskId(item.appId, item.conversationId) ||
      item.status === "done" ||
      item.lease
    )
      throw new Error("Conversation input does not belong to this Task attempt");
    return item;
  });
  if (!items.length) throw new Error("Conversation attempt has no admitted input");
  // The final item supplies the Turn's current ask and reply destination.
  // Keep system evidence before human input, including retained input from an earlier attempt.
  return items.sort((left, right) => Number(left.source.kind === "human") - Number(right.source.kind === "human"));
}

/** Task outcome, Topic, Request decisions and reply share the Task's single fence. */
export function completeConversationTaskTurn(
  config: AppTaskContext,
  claim: AppTaskClaim,
  decision: ConversationTurnResult,
  options: {
    now?: number;
    followUp?: ConversationTaskProposal["followUp"];
    taskControls?: ConversationTaskProposal["taskControls"];
    acceptanceBasis?: TaskAcceptanceBasis;
  } = {},
): ReturnType<typeof completeAppTask> & {
  admittedTasks?: Array<{ appId: string; taskId: string }>;
  cancelledTasks?: AppTaskCancellationResult[];
} {
  if (!Check(conversationTurnResultSchema, decision)) throw new Error("Invalid Conversation decision");
  if ((decision.taskControls?.length ?? 0) !== (options.taskControls?.length ?? 0))
    throw new Error("Conversation Task controls must be prepared");
  if (Boolean(decision.followUp) !== Boolean(options.followUp))
    throw new Error("Conversation follow-up must be prepared");
  const db = config.resourceStore.db;
  const now = options.now ?? Date.now();
  return stateTransaction(db, () => {
    const items = readConversationTaskInputs(config, claim);
    const item = items.at(-1)!;
    if (decision.taskControls?.length && (item.source.kind !== "human" || decision.followUp))
      throw new Error("Task controls require a direct human Turn without a follow-up handoff");
    if (
      !decision.response?.trim() &&
      (items.some((entry) => entry.source.kind === "human") || decision.followUp || decision.requestUpdates?.length)
    )
      throw new Error("Conversation decision requires a reply");
    const accepted = completeAppTask(config, claim, {
      summary: decision.summary,
      response: decision.response,
      result: { conversation: decision },
      evidence: decision.evidence,
      acceptanceBasis: options.acceptanceBasis,
    });
    // New, unreviewed evidence may retain this as progress. Such an attempt
    // must not publish a final answer or apply its proposed Request closure.
    if (accepted.status !== "applied" || !config.resourceStore.readAttempt(claim.attemptId)?.acceptedResult)
      return accepted;
    const conversationId = item.conversationId!;
    let topicId = item.topicId;
    if (!topicId && decision.topic.kind === "existing") topicId = decision.topic.id;
    if (!topicId && decision.topic.kind === "new") {
      topicId = stableTopicId(item.appId, conversationId, item.source.id);
      createConversationTopic(db, {
        id: topicId,
        appId: item.appId,
        conversationId,
        title: decision.topic.title,
        openedBy: item.source.kind,
        originMessageId: item.source.id,
        now,
      });
    }
    if (topicId) {
      const topic = readConversationTopic(db, item.appId, conversationId, topicId);
      if (!topic) throw new Error("Conversation decision selected an unavailable Topic");
      topicId = topic.id;
    }
    const result = {
      summary: decision.summary,
      response: decision.response,
      result: { conversation: decision },
      evidence: decision.evidence,
    };
    applyConversationRequestUpdates(db, {
      appId: item.appId,
      conversationId,
      topicId,
      updates: decision.requestUpdates ?? [],
      updateKey: `attempt:${claim.attemptId}`,
      messageId: `result:${item.id}`,
      now,
    });
    const admittedTasks: Array<{ appId: string; taskId: string }> = [];
    const cancelledTasks: AppTaskCancellationResult[] = [];
    for (const [index, control] of (decision.taskControls ?? []).entries()) {
      const prepared = options.taskControls![index]!;
      if (
        prepared.config.resourceStore.db !== db ||
        prepared.config.resourceStore.appId !== control.appId ||
        prepared.taskId !== control.taskId ||
        (control.appId === item.appId && control.taskId === claim.taskId)
      )
        throw new Error("Conversation Task control has a mismatched or self-owned target");
      cancelledTasks.push(
        cancelAppTask(prepared.config, {
          ...control,
          expectedGeneration: prepared.generation,
          expectedResourceVersion: prepared.resourceVersion,
          controlKey: `conversation-control:${claim.attemptId}:${index}`,
        }),
      );
    }
    if (decision.followUp && options.followUp) {
      if (!topicId) throw new Error("Conversation follow-up requires a Topic");
      const { config: target, attachment } = options.followUp;
      if (target.resourceStore.db !== db || target.resourceStore.appId !== decision.followUp.appId)
        throw new Error("Conversation follow-up must use the same Host state and selected App");
      const request = decision.followUp.requestId
        ? readConversationRequest(db, item.appId, conversationId, decision.followUp.requestId)
        : null;
      if (decision.followUp.requestId && request?.status !== "open")
        throw new Error("Conversation follow-up must serve an open accepted Request");
      const admitted = admitTaskRequest(target, {
        appId: decision.followUp.appId,
        attachment,
        idempotencyKey: `conversation-follow-up:${item.appId}:${item.id}`,
        request: { id: item.id, source: item.source, input: decision.followUp.input },
        topicId,
        ...(request
          ? { requestLink: { appId: item.appId, conversationId, id: request.id, revision: request.revision } }
          : {}),
      });
      admittedTasks.push({ appId: target.resourceStore.appId, taskId: admitted.taskId });
    }
    // Existing Conversation readers render this durable reply. No event sink or
    // second follow-up worker needs to run for Request closure to be truthful.
    for (const handled of items) {
      const changed = db.run(
        `UPDATE app_inbox_items SET status = 'done', topic_id = ?, result = ?, handling = NULL,
      completed_at = ?, changed_at = ?, updated_at = ?
      WHERE id = ? AND execution_task_id = ? AND status != 'done' AND lease_owner IS NULL`,
        [
          handled.id === item.id ? (topicId ?? null) : (handled.topicId ?? null),
          handled.id === item.id ? JSON.stringify(result) : null,
          now,
          now,
          now,
          handled.id,
          claim.taskId,
        ],
      ).changes;
      if (changed !== 1) throw new Error("Conversation input changed during settlement");
    }
    return { ...accepted, admittedTasks, cancelledTasks };
  });
}

/** An exact saved answer, report or owner closure, never a notification's claimed result. */
type ConversationTaskChange =
  { attemptId: string; closedGeneration?: never } | { closedGeneration: number; attemptId?: never };
export type ConversationTaskChangeRef = {
  appId: string;
  conversationId: string;
  topicId: string;
  taskAppId: string;
  taskId: string;
} & ConversationTaskChange;

/** Successful admissions remove themselves from discovery; the limit bounds returned work. */
// Input-backed work exposes its selected report until answered or closed.
// Seeded work has no input receipt; preserve its per-attempt incomplete observations.
// Both event admission and recovery use this predicate (aliases: attempt, topic).
const returnedAttemptSql = `(
  json_extract(attempt.attempt_json, '$.acceptedResult.state') = 'converged'
  OR (json_extract(attempt.attempt_json, '$.acceptedResult.state') IN ('incomplete', 'stopped')
    AND NOT EXISTS (SELECT 1 FROM app_task_admissions admission
      WHERE admission.app_id = attempt.app_id
        AND json_extract(admission.admission_json, '$.taskId') = attempt.task_id
        AND json_extract(admission.admission_json, '$.taskGeneration') = attempt.task_generation))
  OR (NOT EXISTS (SELECT 1 FROM app_task_cancellations closed
      WHERE closed.app_id = attempt.app_id AND closed.task_id = attempt.task_id)
    AND EXISTS (SELECT 1 FROM app_task_admissions admission
      JOIN app_inbox_items origin_input
        ON origin_input.id = json_extract(admission.admission_json, '$.inputEvent.data.request.id')
      WHERE admission.app_id = attempt.app_id
        AND json_extract(admission.admission_json, '$.taskId') = attempt.task_id
        AND json_extract(admission.admission_json, '$.taskGeneration') = attempt.task_generation
        AND json_extract(admission.admission_json, '$.resultAttemptId') IS NULL
        AND json_extract(admission.admission_json, '$.reportAttemptId') = attempt.attempt_id
        AND origin_input.app_id = topic.app_id
        AND origin_input.conversation_id = topic.conversation_id
        AND origin_input.topic_id = topic.id)
  )
)`;

export function listPendingConversationTaskChanges(
  db: SqliteDb,
  appId: string,
  limit = 100,
): ConversationTaskChangeRef[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Conversation change limit must be an integer from 1 to 100");
  return db
    .prepare(
      `
    WITH changes AS (
      SELECT topic.app_id AS appId, topic.conversation_id AS conversationId, topic.id AS topicId,
        linked.app_id AS taskAppId, linked.task_id AS taskId, attempt.attempt_id AS attemptId,
        NULL AS closedGeneration, attempt.started_at AS changedAt,
        'conversation-result:' || topic.app_id || ':' || topic.conversation_id || ':' ||
          topic.id || ':' || linked.app_id || ':' || attempt.attempt_id AS inputId
      FROM conversation_topics topic
      JOIN conversation_topic_tasks linked ON linked.topic_id = topic.id
      JOIN app_task_attempts attempt ON attempt.app_id = linked.app_id AND attempt.task_id = linked.task_id
      WHERE topic.app_id = ? AND ${returnedAttemptSql}
      UNION ALL
      SELECT topic.app_id, topic.conversation_id, topic.id, linked.app_id, linked.task_id, NULL,
        json_extract(closed.cancellation_json, '$.generation'), closed.requested_at,
        'conversation-closure:' || topic.app_id || ':' || topic.conversation_id || ':' ||
          topic.id || ':' || linked.app_id || ':' || linked.task_id || ':' ||
          json_extract(closed.cancellation_json, '$.generation')
      FROM conversation_topics topic
      JOIN conversation_topic_tasks linked ON linked.topic_id = topic.id
      JOIN app_task_cancellations closed ON closed.app_id = linked.app_id AND closed.task_id = linked.task_id
      WHERE topic.app_id = ?
    )
    SELECT appId, conversationId, topicId, taskAppId, taskId, attemptId, closedGeneration
    FROM changes
    WHERE EXISTS (
        SELECT 1 FROM app_inbox_items input
        JOIN app_tasks owner ON owner.app_id = input.app_id AND owner.task_id = input.execution_task_id
        WHERE input.app_id = changes.appId AND input.conversation_id = changes.conversationId
          AND NOT (changes.taskAppId = owner.app_id AND changes.taskId = owner.task_id)
          AND NOT EXISTS (SELECT 1 FROM app_task_cancellations closed
            WHERE closed.app_id = owner.app_id AND closed.task_id = owner.task_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM app_inbox_items handled
        WHERE handled.id = changes.inputId
      )
    ORDER BY changedAt, taskAppId, taskId, inputId
    LIMIT ?
  `,
    )
    .all(appId, appId, limit)
    .map((row) => {
      const ref = {
        appId: String(row.appId),
        conversationId: String(row.conversationId),
        topicId: String(row.topicId),
        taskAppId: String(row.taskAppId),
        taskId: String(row.taskId),
      };
      return typeof row.attemptId === "string"
        ? { ...ref, attemptId: row.attemptId }
        : { ...ref, closedGeneration: Number(row.closedGeneration) };
    });
}

export function admitConversationTaskChange(
  target: AppTaskContext,
  source: Pick<AppTaskContext, "resourceStore">,
  input: { conversationId: string; topicId: string; taskId: string } & ConversationTaskChange,
  conversationInputKinds?: readonly string[],
) {
  const db = target.resourceStore.db;
  if (source.resourceStore.db !== db) throw new Error("Conversation result belongs to another Host state");
  return stateTransaction(db, () => {
    const appId = target.resourceStore.appId;
    if (
      !listConversationTopicLinksForTask(db, source.resourceStore.appId, input.taskId).some(
        (link) =>
          link.appId === appId && link.conversationId === input.conversationId && link.topicId === input.topicId,
      )
    )
      throw new Error("Task result has no link to this Conversation Topic");
    const task = target.resourceStore.readTask(conversationTaskId(appId, input.conversationId));
    if (!task) throw new Error("Conversation has no execution Task");
    if (source.resourceStore.appId === appId && input.taskId === task.metadata.id)
      throw new Error("A Conversation cannot consume its own outcome as new input");
    const prefix = `${appId}:${input.conversationId}:${input.topicId}:${source.resourceStore.appId}`;
    let id: string;
    let fact: { kind: string; data: Record<string, unknown> };
    if (input.attemptId !== undefined) {
      const attempt = source.resourceStore.readAttempt(input.attemptId);
      if (attempt?.taskId !== input.taskId || (!attempt.acceptedResult && attempt.state !== "failed"))
        throw new Error("Task result must name an accepted attempt or saved failure of the linked Task");
      // Match the saved selection used by recovery; retries remain in history.
      if (
        !db
          .prepare(
            `SELECT 1 FROM app_task_attempts attempt, conversation_topics topic
          WHERE attempt.app_id = ? AND attempt.attempt_id = ?
            AND topic.app_id = ? AND topic.conversation_id = ? AND topic.id = ?
            AND ${returnedAttemptSql}`,
          )
          .get(source.resourceStore.appId, input.attemptId, appId, input.conversationId, input.topicId)
      )
        return { taskId: task.metadata.id, created: false };
      const outcome =
        attempt.acceptedResult?.state === "converged" ? attempt.acceptedResult : appTaskAttemptReport(attempt);
      if (!outcome) return { taskId: task.metadata.id, created: false };
      id = `conversation-result:${prefix}:${input.attemptId}`;
      fact = {
        kind: "task-outcome",
        data: {
          appId: source.resourceStore.appId,
          taskId: input.taskId,
          generation: attempt.taskGeneration,
          attemptId: input.attemptId,
          outcome,
        },
      };
    } else {
      const closure = source.resourceStore.readCancellation(input.taskId);
      if (!closure || closure.generation !== input.closedGeneration)
        throw new Error("Task closure must name the closed generation of the linked Task");
      id = `conversation-closure:${prefix}:${input.taskId}:${closure.generation}`;
      fact = {
        kind: "task-closed",
        data: { appId: source.resourceStore.appId, taskId: input.taskId, generation: closure.generation, closure },
      };
    }
    return admitConversationTaskInput(target, {
      id,
      idempotencyKey: id,
      appId,
      conversationId: input.conversationId,
      topicId: input.topicId,
      source: { kind: "system", id },
      input: fact,
      intent: task.spec,
      conversationInputKinds,
    });
  });
}
