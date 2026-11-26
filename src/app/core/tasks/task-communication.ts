import type { TaskChangeReceipt, TaskCommunication, TaskReconcileResult } from "@may-agent/sdk/app";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { getAppInboxItem, inputConversationAppId } from "../state/app-inbox-store.js";
import {
  applyConversationRequestUpdates,
  linkConversationRequestInputs,
  listConversationInputRequests,
  readConversationRequest,
} from "../state/conversation-requests.js";
import {
  createConversationTopic,
  hasConversationInputTopicSelection,
  readConversationInputTopicId,
  readConversationTopic,
} from "../state/conversations.js";
import type { AppTaskEvents } from "./app-task-emitter.js";
import { readTaskInputs } from "./app-task-inputs.js";
import { readTaskChangeInputKeys, type AppTaskClaim } from "./app-task-reconciler.js";
import type { AppTaskContext } from "./app-task-store.js";

type CommunicationReceipt = NonNullable<TaskChangeReceipt["communication"]>[number];
type SavedCommunication = {
  communication: TaskCommunication;
  receipt: CommunicationReceipt;
  conversationId: string;
  /** Only a newly published explanation can be cited by replyId. */
  messageId?: string;
};

function readCommunicationReceipt(config: AppTaskContext, claim: AppTaskClaim, id: string): SavedCommunication | null {
  const row = config.resourceStore.db
    .prepare(
      `SELECT receipt_json FROM app_task_communication_receipts
     WHERE app_id = ? AND task_id = ? AND task_generation = ? AND communication_id = ?`,
    )
    .get(config.resourceStore.appId, claim.taskId, claim.generation, id.trimEnd()) as { receipt_json: string } | null;
  if (!row) return null;
  const saved = JSON.parse(row.receipt_json) as SavedCommunication | null;
  if (
    typeof saved?.communication?.id !== "string" ||
    saved.communication.id.trimEnd() !== id.trimEnd() ||
    saved.receipt?.id !== saved.communication.id ||
    typeof saved.conversationId !== "string"
  )
    throw new Error("Saved communication receipt is unavailable");
  return saved;
}

/** Authority follows the accepted input, never a copied Conversation or Task reference. */
export function readTaskCommunicationInput(config: AppTaskContext, claim: AppTaskClaim, inputId: string) {
  const item = getAppInboxItem(config.resourceStore.db, inputId);
  const key = item?.taskAdmissionKey;
  const admission = key
    ? config.resourceStore.readTaskContext({ taskIds: [], admissionIds: [key] }).appTaskAdmissions?.[key]
    : undefined;
  const request = (
    admission?.inputEvent?.data as { request?: { id?: unknown; source?: unknown; input?: unknown } } | undefined
  )?.request;
  if (
    !item?.conversationId ||
    item.appId !== config.resourceStore.appId ||
    !admission ||
    admission.taskId !== claim.taskId ||
    admission.taskGeneration > claim.generation ||
    request?.id !== item.id ||
    !isDeepStrictEqual(request.source, item.source) ||
    !isDeepStrictEqual(request.input, item.input)
  )
    throw new Error("Communication requires an input accepted by this Task with saved reply context");
  return item;
}

/** Runs inside the Task changes transaction. Event fan-out waits for its outer commit. */
export function applyTaskCommunication(
  config: AppTaskContext,
  claim: AppTaskClaim,
  changes: readonly TaskCommunication[],
  events: AppTaskEvents,
): NonNullable<TaskChangeReceipt["communication"]> {
  const db = config.resourceStore.db;
  return changes.map((change) => {
    const item = readTaskCommunicationInput(config, claim, change.inputId);
    if (change.message && change.replyId) throw new Error("Publish a message or cite replyId, not both");
    if (!change.message && !change.topic && !change.requestUpdates?.length)
      throw new Error("Communication requires a message, Request update or Topic decision");
    const localKey = `communication:${change.id}`;
    // Retain reads of existing journal receipts without producing new receipt Events.
    // The full operation and its original result survive replacement attempts.
    const saved =
      readCommunicationReceipt(config, claim, change.id) ??
      (events.read("app.task.communication.updated", localKey) ?? events.read("conversation.message.created", localKey))
        ?.data;
    if (saved) {
      if (!isDeepStrictEqual(saved.communication, change))
        throw new Error("Communication id was reused for different content");
      const receipt = saved.receipt as CommunicationReceipt | undefined;
      if (receipt?.id !== change.id) throw new Error("Saved communication receipt is unavailable");
      return receipt;
    }
    const conversationId = item.conversationId!;
    const conversationAppId = inputConversationAppId(db, item);
    // Exact cross-App feedback can answer its human, but does not transfer the
    // Conversation owner's accepted promises to this Task.
    if (conversationAppId !== item.appId && change.requestUpdates?.length)
      throw new Error("Cross-App feedback cannot update another App's Conversation Requests");
    let topicId = readConversationInputTopicId(db, item);
    if (change.topic?.kind === "none") topicId = undefined;
    if (change.topic?.kind === "existing") {
      if (!readConversationTopic(db, conversationAppId, conversationId, change.topic.id))
        throw new Error("Topic does not belong to this Conversation");
      topicId = change.topic.id;
    }
    const identity = createHash("sha256")
      .update(JSON.stringify([item.appId, claim.taskId, claim.generation, change.id]))
      .digest("hex");
    if (change.topic?.kind === "new") {
      topicId = `task-topic:${identity}`;
      createConversationTopic(db, {
        id: topicId,
        appId: conversationAppId,
        conversationId,
        title: change.topic.title,
        openedBy: "agent",
        originMessageId: item.source.id,
      });
    }
    if (change.topic)
      db.run(
        `INSERT INTO conversation_input_topic_selections
           (app_id, conversation_id, input_id, topic_id, selected_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(app_id, conversation_id, input_id) DO UPDATE SET
           topic_id = excluded.topic_id, selected_at = excluded.selected_at`,
        [conversationAppId, conversationId, item.id, topicId ?? null, Date.now()],
      );
    let messageId = change.message ? `task-message:${identity}` : undefined;
    if (change.replyId) {
      const prior =
        readCommunicationReceipt(config, claim, change.replyId) ??
        events.read("conversation.message.created", `communication:${change.replyId}`)?.data;
      if (
        !prior ||
        prior.conversationId !== conversationId ||
        typeof (prior.communication as TaskCommunication | undefined)?.inputId !== "string" ||
        typeof prior.messageId !== "string"
      )
        throw new Error("replyId must name a published explanation in this Conversation from this Task generation");
      readTaskCommunicationInput(config, claim, (prior.communication as TaskCommunication).inputId);
      messageId = prior.messageId;
    }
    // A known Request belongs to the Task which accepted its originating input.
    // Reviewer taskRefs and a shared Conversation do not transfer that obligation.
    for (const update of change.requestUpdates ?? []) {
      const linked = db
        .prepare(
          `SELECT input.id FROM conversation_request_inputs link
        JOIN app_inbox_items input ON input.id = link.input_id
        WHERE link.app_id = ? AND link.conversation_id = ? AND link.request_id = ?`,
        )
        .all(item.appId, conversationId, update.id) as Array<{ id: string }>;
      if (!linked.length && readConversationRequest(db, item.appId, conversationId, update.id)) {
        const owner = db
          .prepare(
            `SELECT attempt.task_id FROM conversation_requests request
          JOIN app_task_attempts attempt ON attempt.app_id = request.app_id
          AND (request.update_key = 'attempt:' || attempt.attempt_id
            OR request.update_key LIKE 'request:' || attempt.attempt_id || ':%')
          WHERE request.app_id = ? AND request.conversation_id = ? AND request.id = ? LIMIT 1`,
          )
          .get(item.appId, conversationId, update.id);
        if (owner?.task_id !== claim.taskId)
          throw new Error("Request has no saved acceptance relationship to this Task");
      }
      for (const original of linked) readTaskCommunicationInput(config, claim, original.id);
      const ids = update.inputIds ?? [item.id];
      for (const id of ids) {
        const origin = readTaskCommunicationInput(config, claim, id);
        if (origin.conversationId !== conversationId)
          throw new Error("Request inputs must belong to the same Conversation");
      }
      // The durable input-to-Task admission proves authority for ordinary Tasks too.
      applyConversationRequestUpdates(db, {
        actor: { appId: item.appId, taskId: claim.taskId },
        appId: item.appId,
        conversationId,
        topicId,
        topicSelected: hasConversationInputTopicSelection(db, item),
        updates: [update],
        updateKey: `communication:${identity}`,
        messageId,
        now: Date.now(),
      });
      linkConversationRequestInputs(db, item.appId, conversationId, update.id, ids);
    }
    if (change.topic) db.run("UPDATE app_inbox_items SET topic_id = ? WHERE id = ?", [topicId ?? null, item.id]);
    const receipt = {
      id: change.id,
      ...(messageId ? { messageId } : {}),
      ...(change.requestUpdates?.length
        ? {
            requests: change.requestUpdates.map(({ id }) =>
              readConversationRequest(db, item.appId, conversationId, id)!,
            ),
          }
        : {}),
    };
    // This joins the Task changes transaction, including preflight rollback.
    // Full Request scopes belong in the receipt, outside bounded message history.
    const savedCommunication: SavedCommunication = {
      conversationId,
      communication: change,
      receipt,
      ...(change.message ? { messageId } : {}),
    };
    db.run(
      `INSERT INTO app_task_communication_receipts
       (app_id, task_id, task_generation, communication_id, receipt_json) VALUES (?, ?, ?, ?, ?)`,
      // Match historical communication:<id> emission-key trimming; the saved content stays exact.
      [item.appId, claim.taskId, claim.generation, change.id.trimEnd(), JSON.stringify(savedCommunication)],
    );
    if (change.message)
      events.publish(localKey, {
        type: "conversation.message.created",
        target: { appId: conversationAppId },
        data: {
          appId: conversationAppId,
          conversationId,
          communication: { id: change.id, inputId: change.inputId },
          messageId,
          author: { kind: "agent", id: claim.agent },
          text: change.message,
          replyTo: item.source.id,
          metadata: {
            requestId: item.id,
            communicationId: change.id,
            taskRefs: [{ appId: item.appId, taskId: claim.taskId }],
            ...(topicId ? { topicId } : {}),
            ...(item.channel ? { channel: item.channel } : {}),
            ...(item.channelTargetId ? { channelTargetId: item.channelTargetId } : {}),
            ...(item.channelThreadId ? { channelThreadId: item.channelThreadId } : {}),
            ...(item.channelMessageId ? { channelMessageId: item.channelMessageId } : {}),
          },
        },
      });
    return receipt;
  });
}

/** Convergence cannot silently discard a human promise accepted by these inputs. */
export function assertCommunicationRequestsSettled(
  config: AppTaskContext,
  claim: AppTaskClaim,
  inputKeys?: string[],
  acceptedLiveEventIds?: number[],
): void {
  const keys = readTaskChangeInputKeys(config, claim, inputKeys, acceptedLiveEventIds);
  const inputs = readTaskInputs(config, { ...claim, events: [], continuedInputKeys: keys });
  for (const input of inputs) {
    if (!input.communication) continue;
    const open = listConversationInputRequests(config.resourceStore.db, config.resourceStore.appId,
      input.communication.conversationId, [input.id]).find((request) => request.status === "open");
    if (open) throw new Error(`Request ${open.id} remains open; retain useful work or a real wait instead of converging`);
  }
}

/** Project accepted input coverage, without deriving a chat message from a work result. */
export function settleTaskCommunicationInputs(config: AppTaskContext, claim: AppTaskClaim): void {
  const db = config.resourceStore.db;
  const now = Date.now();
  db.run(
    `UPDATE app_inbox_items SET status = 'done', completed_at = ?, changed_at = ?, updated_at = ?
    WHERE app_id = ? AND execution_task_id = ? AND status != 'done' AND lease_owner IS NULL
      AND task_admission_key IN (SELECT task_id FROM app_task_admissions WHERE app_id = ?
        AND json_extract(admission_json, '$.taskId') = ?
        AND json_extract(admission_json, '$.resultAttemptId') = ?)`,
    [
      now,
      now,
      now,
      config.resourceStore.appId,
      claim.taskId,
      config.resourceStore.appId,
      claim.taskId,
      claim.attemptId,
    ],
  );
}

/** A final caller response can use the one unambiguous saved discussion destination. */
export function taskResultCommunication(
  config: AppTaskContext,
  claim: AppTaskClaim,
  result: Pick<TaskReconcileResult, "response" | "inputKeys" | "communication">,
  acceptedLiveEventIds?: number[],
): TaskCommunication[] | undefined {
  const changes = result.communication;
  if (!result.response) return changes;
  const keys = readTaskChangeInputKeys(config, claim, result.inputKeys, acceptedLiveEventIds);
  const inputs = readTaskInputs(config, { ...claim, events: [], continuedInputKeys: keys })
    .filter((input) => input.communication);
  if (!inputs.length) return changes;
  if (changes?.some((change) => change.message))
    throw new Error("Use response or explicit communication messages for this result, not both");
  if (new Set(inputs.map((input) => {
    const item = getAppInboxItem(config.resourceStore.db, input.id)!;
    return JSON.stringify([inputConversationAppId(config.resourceStore.db, item), input.communication!.conversationId]);
  })).size !== 1)
    throw new Error("Multiple reply destinations require explicit communication inputId");
  const input = inputs.filter(({ source }) => source.kind === "human").at(-1) ?? inputs.at(-1)!;
  const id = `response-${createHash("sha256").update(input.key).digest("hex").slice(0, 32)}`;
  return [...(changes ?? []), { id, inputId: input.id, message: result.response }];
}
