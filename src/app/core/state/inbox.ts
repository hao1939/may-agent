import type { SqliteDb } from "../../../lib/db.js";
import type { AppInputContext, AppTaskAttachment, AppResult } from "@may-agent/sdk";
import { isDeepStrictEqual } from "node:util";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { getAppInboxItem, type AppInboxItem } from "./app-inbox-store.js";
import {
  observeAppTaskIntent,
  readAppTaskIntent,
  type AppTaskObservationResult,
} from "../tasks/app-task-reconciler.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import { linkConversationTopicTask } from "./conversations.js";
import { linkConversationRequestTask } from "./conversation-requests.js";

export type TaskRequestInput = {
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppInputContext>;
  authorize?: () => void;
  inboxInputId?: string;
  now?: number;
  topicId?: string;
  requestLink?: Omit<Parameters<typeof linkConversationRequestTask>[1], "taskRef">;
};

/** Persist resolved Task input and Conversation links. No App mapping, execution or notification calls. */
export function admitTaskRequest(config: AppTaskContext, input: TaskRequestInput): AppTaskObservationResult {
  return stateTransaction(config.resourceStore.db, () => {
    input.authorize?.();
    const db = config.resourceStore.db;
    const item = input.inboxInputId ? getAppInboxItem(db, input.inboxInputId) : null;
    if (input.inboxInputId) {
      if (
        !item ||
        item.id !== input.request.id ||
        item.appId !== input.appId ||
        !isDeepStrictEqual(item.input, input.request.input) ||
        !isDeepStrictEqual(item.source, input.request.source)
      )
        throw new Error("Task admission does not match its saved input");
      if (input.idempotencyKey !== `task:${item.id}`)
        throw new Error("Task admission identity must belong to its input");
      if (item.waitingOn?.kind === "task") {
        const task = config.resourceStore.readTask(item.waitingOn.id);
        if (!task) throw new Error(`Attached Task ${item.waitingOn.id} is missing`);
        const target = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
        if (target !== item.waitingOn.id) throw new Error("Cannot remap an admitted input to different work");
        return admitAuthorizedTaskRequest(config, {
          ...input,
          idempotencyKey: item.taskAdmissionKey ?? input.idempotencyKey,
        });
      }
      if (
        item.status === "done" ||
        item.executionTaskId ||
        (item.lease && item.lease.expiresAt > (input.now ?? Date.now()))
      )
        throw new Error("Input is already owned or completed");
      const taskId = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
      if (item.targetTaskId && item.targetTaskId !== taskId) throw new Error("Cannot replace an exact Task target");
    }
    // A released Host could commit the Task before saving its input link.
    // Reuse that exact admission during the offline upgrade/restart boundary.
    if (item) {
      const taskId = input.attachment.kind === "existing" ? input.attachment.taskId : input.attachment.intent.id;
      const keys = [input.idempotencyKey, `task:${item.id}:desired:${taskId}`, `task:${item.id}:existing:${taskId}`];
      const admissions = config.resourceStore.readTaskContext({ taskIds: [], admissionIds: keys }).appTaskAdmissions;
      input = { ...input, idempotencyKey: keys.find((key) => admissions?.[key]) ?? input.idempotencyKey };
    }
    const observation = admitAuthorizedTaskRequest(config, input);
    if (item) linkTaskInput(db, item.id, observation.taskId, input.idempotencyKey, input.now);
    const topicId = item?.topicId ?? input.topicId;
    if (topicId) linkConversationTopicTask(db, topicId, input.appId, observation.taskId);
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
      if (!config.resourceStore.readTask(taskId)) {
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

/** Called inside Task admission's transaction; this row is correlation, never an execution owner. */
export function linkTaskInput(
  db: SqliteDb,
  inputId: string,
  taskId: string,
  admissionKey: string,
  now = Date.now(),
): void {
  const updated = db
    .prepare(
      `UPDATE app_inbox_items SET status = 'handling',
    waiting_on_kind = 'task', waiting_on_id = ?, task_admission_key = ?,
    available_at = NULL, review_at = NULL, lease_owner = NULL, lease_expires_at = NULL,
    changed_at = ?, updated_at = ? WHERE id = ? AND status != 'done' AND execution_task_id IS NULL`,
    )
    .run(taskId, admissionKey, now, now, inputId);
  if (updated.changes !== 1) throw new Error("Task input is unavailable");
}

/** A compare-and-set projection of an exact Task answer, not another attempt. */
export function completeTaskInput(db: SqliteDb, item: AppInboxItem, result: AppResult, now: number): boolean {
  if (item.waitingOn?.kind !== "task") return false;
  return (
    db
      .prepare(
        `UPDATE app_inbox_items SET status = 'done', result = ?, completed_at = ?,
      available_at = NULL, review_at = NULL, changed_at = ?, updated_at = ?
    WHERE id = ? AND status = 'handling' AND lease_owner IS NULL
      AND waiting_on_kind = 'task' AND waiting_on_id = ? AND task_admission_key IS ?`,
      )
      .run(JSON.stringify(result), now, now, now, item.id, item.waitingOn.id, item.taskAdmissionKey ?? null).changes ===
    1
  );
}

/** Backfill only an unambiguous historical input admission, never the Task's latest answer. */
export function recoverTaskInputAdmissionKey(db: SqliteDb, item: AppInboxItem): string | undefined {
  if (item.taskAdmissionKey || item.waitingOn?.kind !== "task") return item.taskAdmissionKey;
  const keys = [
    `task:${item.id}`,
    `task:${item.id}:desired:${item.waitingOn.id}`,
    `task:${item.id}:existing:${item.waitingOn.id}`,
  ];
  const rows = db
    .prepare(
      `SELECT task_id FROM app_task_admissions WHERE app_id = ?
    AND task_id IN (?, ?, ?) AND json_extract(admission_json, '$.taskId') = ?`,
    )
    .all(item.appId, ...keys, item.waitingOn.id);
  if (rows.length !== 1) return undefined;
  const key = String(rows[0]!.task_id);
  db.prepare(
    `UPDATE app_inbox_items SET task_admission_key = ?
    WHERE id = ? AND task_admission_key IS NULL AND waiting_on_kind = 'task' AND waiting_on_id = ?`,
  ).run(key, item.id, item.waitingOn.id);
  return key;
}
