import { stateTransaction } from "../../../lib/db/transaction.js";
import { assertAppTaskClaimCurrent } from "./app-task-reconciler.js";
import { readTaskInputs } from "./app-task-inputs.js";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { TaskCommunication, TaskChangeReceipt, TaskReconcileResult } from "@may-agent/sdk";
import type { AppTaskContext } from "./app-task-store.js";
import type { AppTaskClaim } from "./app-task-reconciler.js";
import { getAppInboxItem } from "../state/app-inbox-store.js";
import {
  applyConversationRequestUpdates,
  linkConversationRequestInputs,
  readConversationRequest,
} from "../state/conversation-requests.js";
import {
  createConversationTopic,
  readConversationInputTopicId,
  readConversationTopic,
} from "../state/conversations.js";
import type { AppTaskEvents } from "./app-task-emitter.js";

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
    // Both event kinds share the same operation name. Content cannot be changed on replay.
    const saved =
      events.read("conversation.message.created", localKey) ?? events.read("app.task.communication.updated", localKey);
    if (saved) {
      if (!isDeepStrictEqual(saved.data.communication, change))
        throw new Error("Communication id was reused for different content");
      const receipt = saved.data.receipt as NonNullable<TaskChangeReceipt["communication"]>[number] | undefined;
      if (receipt?.id !== change.id) throw new Error("Saved communication receipt is unavailable");
      return receipt;
    }
    const conversationId = item.conversationId!;
    let topicId = readConversationInputTopicId(db, item);
    if (change.topic?.kind === "none") topicId = undefined;
    if (change.topic?.kind === "existing") {
      if (!readConversationTopic(db, item.appId, conversationId, change.topic.id))
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
        appId: item.appId,
        conversationId,
        title: change.topic.title,
        openedBy: "agent",
        originMessageId: item.source.id,
      });
    }
    let messageId = change.message ? `task-message:${identity}` : undefined;
    if (change.replyId) {
      const prior = events.read("conversation.message.created", `communication:${change.replyId}`);
      if (
        !prior ||
        prior.data.conversationId !== conversationId ||
        typeof (prior.data.communication as TaskCommunication | undefined)?.inputId !== "string" ||
        typeof prior.data.messageId !== "string"
      )
        throw new Error("replyId must name a published explanation in this Conversation from this Task generation");
      readTaskCommunicationInput(config, claim, (prior.data.communication as TaskCommunication).inputId);
      messageId = prior.data.messageId;
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
    events.publish(localKey, {
      type: change.message ? "conversation.message.created" : "app.task.communication.updated",
      target: { appId: item.appId },
      data: {
        appId: item.appId,
        conversationId,
        communication: structuredClone(change),
        receipt,
        ...(messageId ? { messageId } : {}),
        ...(change.message
          ? {
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
            }
          : {}),
      },
    });
    return receipt;
  });
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
): TaskCommunication[] | undefined {
  const changes = result.communication;
  if (!result.response) return changes;
  const inputs = readTaskInputs(
    config,
    result.inputKeys ? { ...claim, events: [], continuedInputKeys: result.inputKeys } : claim,
  ).filter((input) => input.communication);
  if (!inputs.length) return changes;
  if (changes?.some((change) => change.message))
    throw new Error("Use response or explicit communication messages for this result, not both");
  if (new Set(inputs.map((input) => input.communication!.conversationId)).size !== 1)
    throw new Error("Multiple reply destinations require explicit communication inputId");
  const input = inputs.filter(({ source }) => source.kind === "human").at(-1) ?? inputs.at(-1)!;
  const id = `response-${createHash("sha256").update(input.key).digest("hex").slice(0, 32)}`;
  return [...(changes ?? []), { id, inputId: input.id, message: result.response }];
}

/** Exercise exactly the communication admission rules without committing or publishing effects. */
export function validateTaskCommunication(
  config: AppTaskContext,
  claim: AppTaskClaim,
  changes: readonly TaskCommunication[],
  events: AppTaskEvents,
): string | null {
  const completed = new Error("communication preview complete");
  const proposed = new Map<string, { eventId: number; data: Record<string, unknown> }>();
  try {
    stateTransaction(config.resourceStore.db, () => {
      assertAppTaskClaimCurrent(config, claim);
      applyTaskCommunication(config, claim, changes, {
        read: (type, key) => proposed.get(JSON.stringify([type, key])) ?? events.read(type, key),
        publish(key, event) {
          proposed.set(JSON.stringify([event.type, key]), { eventId: 0, data: event.data ?? {} });
          return 0;
        },
        onEvent: events.onEvent,
      });
      // Savepoints are discarded even on success. No event is sent to EventBus,
      // no request is dispatched, and no App mapping or external effect runs.
      throw completed;
    });
  } catch (error) {
    if (error === completed) return null;
    return error instanceof Error ? error.message : String(error);
  }
  return null;
}
