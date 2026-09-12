import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { AppConversationResource, AppInput, AppInputSource, AppResult, ConversationTurnResult } from "@may-agent/sdk";
import type { SqliteDb } from "../../../lib/db.js";
import type { AppTaskAttempt } from "../tasks/app-task-state.js";
import { taskInputAdmissionKeys } from "../tasks/app-task-inputs.js";

export type AppInboxStatus = "pending" | "handling" | "done";
export type AppInboxWaitKind = "app" | "task" | "session" | "analysis";

/** Input execution evidence, not fulfillment of the accepted human ask. */
export type AppInboxHandling =
  | { phase: "executing" }
  | { phase: "decided"; decision: ConversationTurnResult; requestRevisions?: Record<string, number> }
  | { phase: "failed"; reason: string }
  | { phase: "stopped"; reason: string };

export type AppTurnTarget = { appId: string; conversationId: string; turnId: string; expectedRevision: number };

export type AppInboxTaskDependencyKey = { appId: string; taskId: string; inputId: string; admissionKey?: string };

export type AppInboxTaskDependencyPage = {
  items: AppInboxTaskDependencyKey[];
  nextCursor?: AppInboxTaskDependencyKey;
};

export type AppInboxItem = {
  id: string;
  appId: string;
  parentId?: string;
  /** Exact existing Task that this typed input continues. */
  targetTaskId?: string;
  topicId?: string;
  /** Human feedback linked to an existing root request, not separate work. */
  continuesRequestId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  source: AppInputSource;
  input: AppInput;
  status: AppInboxStatus;
  sessionId?: string;
  waitingOn?: { kind: AppInboxWaitKind; id: string };
  /** Admission whose exact outcome this input awaits; independent of later Task cycles. */
  taskAdmissionKey?: string;
  /** The Task owns execution; this row only retains Conversation input and its reply. */
  executionTaskId?: string;
  result?: AppResult;
  handling?: AppInboxHandling;
  availableAt?: number;
  reviewAt?: number;
  lease?: { generation: number; owner: string; expiresAt: number };
  originEventId?: number;
  idempotencyKey?: string;
  createdAt: number;
  startedAt?: number;
  changedAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type CreateAppInboxItem = {
  id?: string;
  appId: string;
  parentId?: string;
  targetTaskId?: string;
  topicId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelTargetId?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  source: AppInputSource;
  input: AppInput;
  originEventId?: number;
  idempotencyKey?: string;
  now?: number;
};

export type AppInboxQuery = {
  appId?: string;
  status?: AppInboxStatus;
  idempotencyKey?: string;
  limit?: number;
};

export type AppInboxHealth = {
  appId: string;
  total: number;
  pending: number;
  handling: number;
  done: number;
  ready: number;
  waitingOnDependency: number;
  activeLeases: number;
  expiredLeases: number;
  oldestPendingAgeMs?: number;
  oldestHandlingItemAgeMs?: number;
};

type InboxRow = Record<string, unknown>;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid App inbox ${field}`);
  return value;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function parseJson<T>(value: unknown, field: string): T {
  if (typeof value !== "string") throw new Error(`Invalid App inbox ${field}`);
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Invalid App inbox ${field} JSON`);
  }
}

function rowToItem(row: InboxRow): AppInboxItem {
  const waitingKind = optionalText(row.waiting_on_kind) as AppInboxWaitKind | undefined;
  const waitingId = optionalText(row.waiting_on_id);
  const leaseOwner = optionalText(row.lease_owner);
  const leaseExpiresAt = optionalNumber(row.lease_expires_at);
  const generation = Number(row.lease_generation);
  const result = optionalText(row.result);

  return {
    id: requiredText(row.id, "id"),
    appId: requiredText(row.app_id, "app_id"),
    parentId: optionalText(row.parent_id),
    targetTaskId: optionalText(row.target_task_id),
    topicId: optionalText(row.topic_id),
    continuesRequestId: optionalText(row.continues_request_id),
    conversationId: optionalText(row.conversation_id),
    conversationSequence: optionalNumber(row.conversation_seq),
    channel: optionalText(row.channel),
    channelTargetId: optionalText(row.channel_target_id),
    channelThreadId: optionalText(row.channel_thread_id),
    channelMessageId: optionalNumber(row.channel_message_id),
    replyToSourceId: optionalText(row.reply_to_source_id),
    source: {
      kind: requiredText(row.source_kind, "source_kind") as AppInputSource["kind"],
      id: requiredText(row.source_id, "source_id"),
    },
    input: {
      kind: requiredText(row.input_kind, "input_kind"),
      data: parseJson(row.input_data, "input_data"),
    },
    status: requiredText(row.status, "status") as AppInboxStatus,
    sessionId: optionalText(row.session_id),
    waitingOn: waitingKind && waitingId ? { kind: waitingKind, id: waitingId } : undefined,
    taskAdmissionKey: optionalText(row.task_admission_key),
    executionTaskId: optionalText(row.execution_task_id),
    result: result ? parseJson<AppResult>(result, "result") : undefined,
    handling: row.handling ? parseJson<AppInboxHandling>(row.handling, "handling") : undefined,
    availableAt: optionalNumber(row.available_at),
    reviewAt: optionalNumber(row.review_at),
    lease:
      leaseOwner && leaseExpiresAt !== undefined
        ? { generation, owner: leaseOwner, expiresAt: leaseExpiresAt }
        : undefined,
    originEventId: optionalNumber(row.origin_event_id),
    idempotencyKey: optionalText(row.idempotency_key),
    createdAt: Number(row.created_at),
    startedAt: optionalNumber(row.started_at),
    changedAt: optionalNumber(row.changed_at) ?? Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: optionalNumber(row.completed_at),
  };
}

function validateCreate(input: CreateAppInboxItem): void {
  requiredText(input.appId, "appId");
  requiredText(input.source.id, "source.id");
  requiredText(input.input.kind, "input.kind");
  if (input.targetTaskId !== undefined) requiredText(input.targetTaskId, "targetTaskId");
  if (input.topicId !== undefined) requiredText(input.topicId, "topicId");
  if (!(["human", "app", "system"] as const).includes(input.source.kind)) {
    throw new Error(`Invalid App inbox source kind: ${input.source.kind}`);
  }
  const hasConversation = input.conversationId !== undefined;
  const hasSequence = input.conversationSequence !== undefined;
  if (hasSequence && !hasConversation) {
    throw new Error("App inbox conversationSequence requires conversationId");
  }
  if (input.source.kind === "human" && hasConversation !== hasSequence) {
    throw new Error("Human App inbox conversationId and conversationSequence must be provided together");
  }
  if (
    input.conversationSequence !== undefined &&
    (!Number.isSafeInteger(input.conversationSequence) || input.conversationSequence < 0)
  ) {
    throw new Error("App inbox conversationSequence must be a non-negative safe integer");
  }
  if (
    input.channelMessageId !== undefined &&
    (!Number.isSafeInteger(input.channelMessageId) || input.channelMessageId <= 0)
  ) {
    throw new Error("App inbox channelMessageId must be a positive safe integer");
  }
  if (input.originEventId !== undefined && (!Number.isSafeInteger(input.originEventId) || input.originEventId <= 0)) {
    throw new Error("App inbox originEventId must be a positive safe integer");
  }
}

export function getAppInboxItem(db: SqliteDb, id: string): AppInboxItem | null {
  const row = db.prepare("SELECT * FROM app_inbox_items WHERE id = ?").get(id);
  return row ? rowToItem(row) : null;
}

export function readActiveAppTurn(
  db: SqliteDb,
  appId: string,
  conversationId: string,
): AppConversationResource["activeTurn"] {
  const attempt = db
    .prepare(
      `SELECT a.attempt_id, a.task_generation, a.attempt_json FROM app_tasks t
     JOIN app_task_attempts a ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
     WHERE t.app_id = ? AND t.task_id = (
       SELECT execution_task_id FROM app_inbox_items
       WHERE app_id = ? AND conversation_id = ? AND execution_task_id IS NOT NULL LIMIT 1
     ) AND a.state = 'running'`,
    )
    .get(appId, appId, conversationId);
  if (attempt) {
    const claimed = parseJson<AppTaskAttempt>(attempt.attempt_json, "Task attempt");
    // Match the claimed batch's reply destination; newly queued input cannot
    // move the active Turn or its Stop button to a different surface.
    const inputs = taskInputAdmissionKeys(claimed.events ?? [], claimed.continuedInputKeys)
      .map((key) =>
        key.startsWith("conversation-input:") ? getAppInboxItem(db, key.slice("conversation-input:".length)) : null,
      )
      .filter((item) =>
        item?.appId === appId && item.conversationId === conversationId && item.executionTaskId === claimed.taskId,
      );
    const source = inputs.filter((item) => item?.source.kind === "human").at(-1) ?? inputs.at(-1);
    return {
      id: String(attempt.attempt_id),
      revision: Number(attempt.task_generation),
      ...(source?.channel ? { channel: source.channel } : {}),
      ...(source?.channelTargetId ? { channelTargetId: source.channelTargetId } : {}),
      ...(source?.channelThreadId ? { channelThreadId: source.channelThreadId } : {}),
      ...(source?.channelMessageId ? { channelMessageId: source.channelMessageId } : {}),
    };
  }
  const row = db
    .prepare(
      `SELECT id, lease_generation, channel, channel_target_id, channel_thread_id, channel_message_id FROM app_inbox_items
    WHERE app_id = ? AND conversation_id = ? AND source_kind = 'human'
      AND status = 'handling' AND lease_owner IS NOT NULL
    ORDER BY conversation_seq, created_at LIMIT 1`,
    )
    .get(appId, conversationId);
  return row
    ? {
        id: String(row.id),
        revision: Number(row.lease_generation),
        ...(row.channel ? { channel: String(row.channel) } : {}),
        ...(row.channel_target_id ? { channelTargetId: String(row.channel_target_id) } : {}),
        ...(row.channel_thread_id ? { channelThreadId: String(row.channel_thread_id) } : {}),
        ...(row.channel_message_id ? { channelMessageId: Number(row.channel_message_id) } : {}),
      }
    : undefined;
}

/** Called inside the Host's stop transaction; terminal input cannot restart. */
export function stopAppInboxTurn(db: SqliteDb, target: AppTurnTarget, now = Date.now()): boolean {
  if (!Number.isSafeInteger(target.expectedRevision) || target.expectedRevision < 1)
    throw new Error("Invalid turn revision");
  const row = db.prepare("SELECT * FROM app_inbox_items WHERE id = ?").get(target.turnId);
  if (
    !row ||
    row.app_id !== target.appId ||
    row.conversation_id !== target.conversationId ||
    row.source_kind !== "human" ||
    row.lease_generation !== target.expectedRevision
  )
    throw new Error("Turn control is stale or mismatched");
  if (row.status === "done") return false;
  const reason = "Human stopped this turn";
  db.run(
    `UPDATE app_inbox_items SET status = 'done', handling = ?, result = ?,
    available_at = NULL, review_at = NULL, waiting_on_kind = NULL, waiting_on_id = NULL,
    lease_owner = NULL, lease_expires_at = NULL, completed_at = ?, changed_at = ?, updated_at = ? WHERE id = ?`,
    [
      JSON.stringify({ phase: "stopped", reason }),
      JSON.stringify({
        summary: reason,
        response: "Stopped this turn. The ask remains unresolved; already admitted background Tasks continue.",
      }),
      now,
      now,
      now,
      target.turnId,
    ],
  );
  return true;
}

/** Unfinished requests created by one exact parent Task generation. */
export function listOpenAppInboxItemsByIdempotencyPrefix(
  db: SqliteDb,
  input: { appId: string; sourceAppId: string; prefix: string; limit?: number },
): AppInboxItem[] {
  const appId = requiredText(input.appId, "appId");
  const sourceAppId = requiredText(input.sourceAppId, "sourceAppId");
  const prefix = requiredText(input.prefix, "prefix");
  const limit = input.limit ?? 64;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
    throw new Error("App inbox lineage query limit must be an integer from 1 to 256");
  }
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ?
         AND status != 'done'
         AND source_kind = 'app'
         AND source_id = ?
         AND idempotency_key >= ?
         AND idempotency_key < ?
       ORDER BY idempotency_key, id
       LIMIT ?`,
    )
    .all(appId, sourceAppId, prefix, `${prefix}\uffff`, limit)
    .map(rowToItem);
}

export function listAppInboxItems(db: SqliteDb, query: AppInboxQuery = {}): AppInboxItem[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (query.appId !== undefined) {
    conditions.push("app_id = ?");
    params.push(requiredText(query.appId, "appId"));
  }
  if (query.status !== undefined) {
    if (query.status !== "pending" && query.status !== "handling" && query.status !== "done") {
      throw new Error(`Invalid App inbox status: ${String(query.status)}`);
    }
    conditions.push("status = ?");
    params.push(query.status);
  }
  if (query.idempotencyKey !== undefined) {
    conditions.push("idempotency_key = ?");
    params.push(requiredText(query.idempotencyKey, "idempotencyKey"));
  }
  const limit = query.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 500) {
    throw new Error("App inbox query limit must be an integer from 1 to 500");
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(...params, limit)
    .map(rowToItem);
}

/** Open App requests currently awaiting one exact Task. */
export function listAppInboxItemsWaitingOnTask(db: SqliteDb, appId: string, taskId: string): AppInboxItem[] {
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ?
         AND status = 'handling'
         AND waiting_on_kind = 'task'
         AND waiting_on_id = ?
       ORDER BY created_at, id`,
    )
    .all(requiredText(appId, "appId"), requiredText(taskId, "taskId"))
    .map(rowToItem);
}

/** Bounded request evidence used to project Conversation messages. */
export function listAppInboxConversationItems(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  limit: number,
  topicId?: string,
): AppInboxItem[] {
  requiredText(appId, "appId");
  requiredText(conversationId, "conversationId");
  const exactTopicId = topicId === undefined ? undefined : requiredText(topicId, "topicId");
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 200) {
    throw new Error("Conversation message limit must be an integer from 1 to 200");
  }
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ? AND conversation_id = ?${exactTopicId ? " AND topic_id = ?" : ""}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(appId, conversationId, ...(exactTopicId ? [exactTopicId] : []), limit)
    .map(rowToItem);
}

/** One bounded page of input-to-Task links awaiting their exact results. */
export function listAppInboxTaskDependencyKeys(
  db: SqliteDb,
  options: { after?: AppInboxTaskDependencyKey; limit?: number } = {},
): AppInboxTaskDependencyPage {
  const limit = options.limit ?? 256;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new Error("App inbox task dependency limit must be an integer from 1 to 1000");
  }
  const after = options.after;
  const rows = db
    .prepare(
      `SELECT app_id, waiting_on_id, id, task_admission_key
       FROM app_inbox_items INDEXED BY idx_app_inbox_task_wait_recovery
       WHERE status = 'handling'
         AND lease_owner IS NULL
         AND waiting_on_kind = 'task'
         AND waiting_on_id IS NOT NULL
         ${after ? "AND (app_id, waiting_on_id, id) > (?, ?, ?)" : ""}
       ORDER BY app_id, waiting_on_id, id
       LIMIT ?`,
    )
    .all(
      ...(after ? [requiredText(after.appId, "after.appId"), requiredText(after.taskId, "after.taskId"),
        requiredText(after.inputId, "after.inputId")] : []),
      limit + 1,
    )
    .map((row) => ({
      appId: requiredText(row.app_id, "app_id"),
      taskId: requiredText(row.waiting_on_id, "waiting_on_id"),
      inputId: requiredText(row.id, "id"),
      ...(optionalText(row.task_admission_key) ? { admissionKey: optionalText(row.task_admission_key) } : {}),
    }));
  const items = rows.slice(0, limit);
  return {
    items,
    ...(rows.length > limit && items.length > 0 ? { nextCursor: items[items.length - 1] } : {}),
  };
}

/** Current lifecycle health derived directly from the inbox authority, never event reconstruction. */
export function listAppInboxHealth(db: SqliteDb, query: { appId?: string; now?: number } = {}): AppInboxHealth[] {
  const now = query.now ?? Date.now();
  if (!Number.isFinite(now)) throw new Error("App inbox health now must be finite");
  const appId = query.appId === undefined ? undefined : requiredText(query.appId, "appId");
  const rows = db
    .prepare(
      `SELECT app_id,
              COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'handling' THEN 1 ELSE 0 END) AS handling,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
              SUM(CASE WHEN status != 'done'
                            AND execution_task_id IS NULL
                            AND NOT EXISTS (SELECT 1 FROM app_inbox_items owned
                              WHERE owned.app_id = app_inbox_items.app_id
                                AND owned.conversation_id = app_inbox_items.conversation_id
                                AND owned.execution_task_id IS NOT NULL)
                            AND ((lease_owner IS NULL AND available_at IS NOT NULL AND available_at <= ?)
                              OR (lease_expires_at IS NOT NULL AND lease_expires_at <= ?))
                       THEN 1 ELSE 0 END) AS ready,
              SUM(CASE WHEN status = 'handling' AND lease_owner IS NULL
                            AND waiting_on_kind IS NOT NULL AND waiting_on_id IS NOT NULL
                       THEN 1 ELSE 0 END) AS waiting_on_dependency,
              SUM(CASE WHEN status = 'handling' AND lease_owner IS NOT NULL
                            AND lease_expires_at > ?
                       THEN 1 ELSE 0 END) AS active_leases,
              SUM(CASE WHEN status = 'handling' AND lease_owner IS NOT NULL
                            AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?
                       THEN 1 ELSE 0 END) AS expired_leases,
              MIN(CASE WHEN status = 'pending' THEN created_at END) AS oldest_pending_at,
              MIN(CASE WHEN status = 'handling' THEN created_at END) AS oldest_handling_at
       FROM app_inbox_items
       WHERE (? IS NULL OR app_id = ?)
       GROUP BY app_id
       ORDER BY app_id`,
    )
    .all(now, now, now, now, appId ?? null, appId ?? null) as Array<Record<string, unknown>>;

  const age = (value: unknown): number | undefined =>
    typeof value === "number" ? Math.max(0, now - value) : undefined;
  return rows.map((row) => ({
    appId: requiredText(row.app_id, "app_id"),
    total: Number(row.total),
    pending: Number(row.pending),
    handling: Number(row.handling),
    done: Number(row.done),
    ready: Number(row.ready),
    waitingOnDependency: Number(row.waiting_on_dependency),
    activeLeases: Number(row.active_leases),
    expiredLeases: Number(row.expired_leases),
    oldestPendingAgeMs: age(row.oldest_pending_at),
    oldestHandlingItemAgeMs: age(row.oldest_handling_at),
  }));
}

export function createAppInboxItem(db: SqliteDb, input: CreateAppInboxItem): { item: AppInboxItem; created: boolean } {
  validateCreate(input);
  const now = input.now ?? Date.now();
  const id = input.id ?? `app_${randomUUID()}`;
  const result = db.run(
    `INSERT OR IGNORE INTO app_inbox_items (
       id, app_id, parent_id, target_task_id, topic_id, conversation_id, conversation_seq,
       channel, channel_target_id, channel_thread_id, channel_message_id, reply_to_source_id,
       source_kind, source_id, input_kind, input_data, status,
       available_at, origin_event_id, idempotency_key, created_at, changed_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.appId,
      input.parentId ?? null,
      input.targetTaskId ?? null,
      input.topicId ?? null,
      input.conversationId ?? null,
      input.conversationSequence ?? null,
      input.channel ?? null,
      input.channelTargetId ?? null,
      input.channelThreadId ?? null,
      input.channelMessageId ?? null,
      input.replyToSourceId ?? null,
      input.source.kind,
      input.source.id,
      input.input.kind,
      JSON.stringify(input.input.data),
      now,
      input.originEventId ?? null,
      input.idempotencyKey ?? null,
      now,
      now,
      now,
    ],
  );

  if (result.changes === 1) {
    const item = getAppInboxItem(db, id);
    if (!item) throw new Error(`Created App inbox item ${id} is missing`);
    return { item, created: true };
  }

  const existing = input.idempotencyKey
    ? db
        .prepare("SELECT * FROM app_inbox_items WHERE app_id = ? AND idempotency_key = ?")
        .get(input.appId, input.idempotencyKey)
    : db.prepare("SELECT * FROM app_inbox_items WHERE id = ?").get(id);
  if (!existing) throw new Error(`App inbox item ${id} conflicted with an unknown row`);
  let item = rowToItem(existing);
  if (item.appId !== input.appId) {
    throw new Error(`App inbox item ${id} already belongs to App ${item.appId}`);
  }
  if (
    item.parentId !== input.parentId ||
    item.targetTaskId !== input.targetTaskId ||
    item.topicId !== input.topicId ||
    item.source.kind !== input.source.kind ||
    item.source.id !== input.source.id ||
    !isDeepStrictEqual(item.input, input.input)
  ) {
    throw new Error(`App inbox idempotency key ${input.idempotencyKey ?? id} was reused with different input`);
  }
  if (input.originEventId !== undefined) {
    if (item.originEventId !== undefined && item.originEventId !== input.originEventId) {
      throw new Error(`App inbox item ${item.id} already belongs to event ${item.originEventId}`);
    }
    if (item.originEventId === undefined) {
      db.run(
        `UPDATE app_inbox_items
         SET origin_event_id = ?, updated_at = ?
         WHERE id = ? AND origin_event_id IS NULL`,
        [input.originEventId, now, item.id],
      );
      const linked = getAppInboxItem(db, item.id);
      if (!linked) throw new Error(`Linked App inbox item ${item.id} is missing`);
      item = linked;
    }
  }
  return { item, created: false };
}

export function listUnlinkedAppDelegations(db: SqliteDb, limit = 100): AppInboxItem[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("Delegation query limit must be positive");
  return (
    db
      .prepare(
        `SELECT * FROM app_inbox_items
         WHERE parent_id IS NOT NULL
           AND source_kind = 'app'
           AND origin_event_id IS NULL
           AND idempotency_key LIKE 'delegate:%'
         ORDER BY created_at, id
         LIMIT ?`,
      )
      .all(limit) as InboxRow[]
  ).map(rowToItem);
}
