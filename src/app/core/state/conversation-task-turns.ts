import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Check } from "typebox/value";
import { conversationTurnResultSchema, type ConversationTurnResult, type TaskIntent } from "@may-agent/sdk";
import { stateTransaction } from "../../../lib/db/transaction.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import { assertAppTaskClaimCurrent, completeAppTask, type AppTaskClaim } from "../tasks/app-task-reconciler.js";
import { admitTaskRequest } from "./inbox.js";
import { createAppInboxItem, getAppInboxItem, listAppInboxItems, type CreateAppInboxItem } from "./app-inbox-store.js";
import { createConversationTopic, readConversationTopic } from "./conversations.js";
import { stableTopicId } from "./conversation-turns.js";
import { applyConversationRequestUpdates } from "./conversation-requests.js";

/** Code assigns one execution identity per Conversation; agents never construct it. */
export function conversationTaskId(appId: string, conversationId: string): string {
  return `conversation_${createHash("sha256").update([appId, conversationId].join("\0")).digest("hex").slice(0, 24)}`;
}

/** Source PoC boundary: input and its Task admission become visible in one commit. */
export function admitConversationTaskInput(
  config: AppTaskContext,
  input: CreateAppInboxItem & { conversationId: string; intent: Omit<TaskIntent, "id"> },
) {
  const db = config.resourceStore.db;
  return stateTransaction(db, () => {
    if (input.appId !== config.resourceStore.appId) throw new Error("Conversation belongs to another App");
    if (!input.conversationId.trim()) throw new Error("Conversation identity is required");
    if (input.source.kind !== "human") throw new Error("Conversation Task PoC currently requires human input");
    const taskId = conversationTaskId(input.appId, input.conversationId);
    // An expired legacy lease is not proof that its executor stopped. Cut over
    // only a drained Conversation; do not layer a Task over old execution.
    if (
      db
        .prepare(
          `SELECT 1 FROM app_inbox_items WHERE app_id = ? AND conversation_id = ?
      AND execution_task_id IS NULL AND status != 'done' LIMIT 1`,
        )
        .get(input.appId, input.conversationId)
    ) {
      throw new Error("Conversation still has unhandled legacy input; drain before cutover");
    }
    const prior = input.idempotencyKey
      ? listAppInboxItems(db, { appId: input.appId, idempotencyKey: input.idempotencyKey, limit: 1 })[0]
      : input.id
        ? getAppInboxItem(db, input.id)
        : null;
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

/** Read the exact claimed input, not an inbox claim or a model-supplied identity. */
export function readConversationTaskTurn(config: AppTaskContext, claim: AppTaskClaim) {
  assertAppTaskClaimCurrent(config, claim);
  // This first slice deliberately supports one direct input. Batched input and
  // child returns need their own acceptance evidence before runtime cutover.
  if (claim.events.length !== 1 || claim.continuedInputKeys?.length)
    throw new Error("Conversation Task PoC currently requires one fresh input");
  const event = claim.events[0]!.event;
  const request = (event.data as { request?: { id?: unknown; source?: unknown; input?: unknown } } | undefined)
    ?.request;
  const item = typeof request?.id === "string" ? getAppInboxItem(config.resourceStore.db, request.id) : null;
  if (
    event.type !== "app.task.requested" ||
    !item?.conversationId ||
    item.appId !== config.resourceStore.appId ||
    item.executionTaskId !== claim.taskId ||
    claim.taskId !== conversationTaskId(item.appId, item.conversationId) ||
    item.status === "done" ||
    item.lease ||
    event.idempotencyKey !== item.taskAdmissionKey ||
    !isDeepStrictEqual(item.source, request?.source) ||
    !isDeepStrictEqual(item.input, request?.input)
  ) {
    throw new Error("Conversation input does not belong to this Task attempt");
  }
  return item;
}

/** Task outcome, Topic, Request decisions and reply share the Task's single fence. */
export function completeConversationTaskTurn(
  config: AppTaskContext,
  claim: AppTaskClaim,
  decision: ConversationTurnResult,
  now = Date.now(),
) {
  if (!Check(conversationTurnResultSchema, decision)) throw new Error("Invalid Conversation decision");
  if (decision.followUp || decision.taskControls?.length)
    throw new Error("Conversation Task PoC does not yet support follow-up or Task controls");
  if (!decision.response?.trim()) throw new Error("Conversation decision requires a reply");
  const db = config.resourceStore.db;
  return stateTransaction(db, () => {
    const item = readConversationTaskTurn(config, claim);
    const accepted = completeAppTask(config, claim, {
      summary: decision.summary,
      response: decision.response,
      result: { conversation: decision },
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
    if (topicId && !readConversationTopic(db, item.appId, conversationId, topicId))
      throw new Error("Conversation decision selected an unavailable Topic");
    const result = { summary: decision.summary, response: decision.response, result: { conversation: decision } };
    applyConversationRequestUpdates(db, {
      appId: item.appId,
      conversationId,
      topicId,
      updates: decision.requestUpdates ?? [],
      updateKey: `attempt:${claim.attemptId}`,
      messageId: `result:${item.id}`,
      now,
    });
    // Existing Conversation readers render this durable reply. No event sink or
    // second follow-up worker needs to run for Request closure to be truthful.
    const changed = db.run(
      `UPDATE app_inbox_items SET status = 'done', topic_id = ?, result = ?,
      completed_at = ?, changed_at = ?, updated_at = ?
      WHERE id = ? AND execution_task_id = ? AND status != 'done' AND lease_owner IS NULL`,
      [topicId ?? null, JSON.stringify(result), now, now, now, item.id, claim.taskId],
    ).changes;
    if (changed !== 1) throw new Error("Conversation input changed during settlement");
    return accepted;
  });
}
