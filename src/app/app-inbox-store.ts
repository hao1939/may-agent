import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { AppInput, AppInputSource, AppResult } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";

export type AppInboxStatus = "pending" | "handling" | "done";
export type AppInboxWaitKind = "app" | "task" | "session" | "analysis";

export type AppInboxTaskDependencyKey = { appId: string; taskId: string };

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
  result?: AppResult;
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

export type AppInboxClaim = {
  item: AppInboxItem;
  generation: number;
  owner: string;
};

/** A claim durably associated with the exact agent session that was executing it. */
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
    result: result ? parseJson<AppResult>(result, "result") : undefined,
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

/** Human conversations currently awaiting one exact Task. */
export function listHumanAppInboxItemsWaitingOnTask(db: SqliteDb, appId: string, taskId: string): AppInboxItem[] {
  return listAppInboxItemsWaitingOnTask(db, appId, taskId).filter(
    (item) => item.source.kind === "human" && item.conversationId !== undefined,
  );
}

/** Human Conversation requests whose current Task is waiting on one exact App request. */
export function listHumanAppInboxItemsWaitingOnAppRequest(db: SqliteDb, requestId: string): AppInboxItem[] {
  const normalizedRequestId = requiredText(requestId, "requestId");
  return db
    .prepare(
      `SELECT DISTINCT inbox.*
       FROM app_task_conditions condition
       JOIN app_task_condition_routes route
         ON route.app_id = condition.app_id AND route.condition_id = condition.condition_id
       JOIN app_inbox_items inbox
         ON inbox.app_id = route.app_id
        AND inbox.waiting_on_kind = 'task'
        AND inbox.waiting_on_id = route.task_id
       WHERE condition.condition_id = ?
         AND json_extract(condition.condition_json, '$.spec.type') = 'app.dependency.completed'
         AND json_extract(condition.condition_json, '$.spec.subject') = ?
         AND inbox.source_kind = 'human'
         AND inbox.conversation_id IS NOT NULL
         AND inbox.status = 'handling'
       ORDER BY inbox.created_at, inbox.id`,
    )
    .all(`app-request:${normalizedRequestId}`, `id:${normalizedRequestId}`)
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

export function associateAppInboxClaimTopic(
  db: SqliteDb,
  claim: AppInboxClaim,
  topicId: string,
  now = Date.now(),
): boolean {
  const id = requiredText(topicId, "topic id");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET topic_id = ?, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?
         AND (topic_id IS NULL OR topic_id = ?)`,
      [id, now, now, claim.item.id, claim.generation, claim.owner, id],
    ).changes === 1
  );
}

export function listAppInboxChildren(db: SqliteDb, parentId: string): AppInboxItem[] {
  return db
    .prepare("SELECT * FROM app_inbox_items WHERE parent_id = ? ORDER BY created_at, id")
    .all(requiredText(parentId, "parent request id"))
    .map(rowToItem);
}

/** Unfinished human requests already associated with the visible Conversation Topics. */
export function listOpenConversationTopicRequests(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  topicIds: string[],
  excludeRequestId: string,
  limit = 8,
): AppInboxItem[] {
  const topics = [...new Set(topicIds.map((topicId) => requiredText(topicId, "topic id")))];
  if (topics.length === 0) return [];
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 32) {
    throw new Error("Open Conversation request limit must be an integer from 1 to 32");
  }
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ? AND conversation_id = ?
         AND source_kind = 'human' AND status != 'done'
         AND continues_request_id IS NULL AND id != ?
         AND topic_id IN (${topics.map(() => "?").join(", ")})
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(
      requiredText(appId, "appId"),
      requiredText(conversationId, "conversationId"),
      requiredText(excludeRequestId, "excludeRequestId"),
      ...topics,
      limit,
    )
    .map(rowToItem);
}

/** One bounded page of distinct canonical Task dependencies awaiting review. */
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
      `SELECT app_id, waiting_on_id
       FROM app_inbox_items INDEXED BY idx_app_inbox_task_wait_recovery
       WHERE status = 'handling'
         AND lease_owner IS NULL
         AND waiting_on_kind = 'task'
         AND waiting_on_id IS NOT NULL
         ${after ? "AND (app_id, waiting_on_id) > (?, ?)" : ""}
       GROUP BY app_id, waiting_on_id
       ORDER BY app_id, waiting_on_id
       LIMIT ?`,
    )
    .all(
      ...(after ? [requiredText(after.appId, "after.appId"), requiredText(after.taskId, "after.taskId")] : []),
      limit + 1,
    )
    .map((row) => ({
      appId: requiredText(row.app_id, "app_id"),
      taskId: requiredText(row.waiting_on_id, "waiting_on_id"),
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

const CLAIMABLE_SQL = `
  status != 'done'
  AND (
    (lease_owner IS NULL AND available_at IS NOT NULL AND available_at <= ?)
    OR (lease_expires_at IS NOT NULL AND lease_expires_at <= ?)
  )
`;

function claimedRow(
  db: SqliteDb,
  whereSql: string,
  whereParams: unknown[],
  owner: string,
  leaseMs: number,
  now: number,
): AppInboxClaim | null {
  requiredText(owner, "lease owner");
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");
  const row = db
    .prepare(
      `UPDATE app_inbox_items
       SET status = 'handling',
           available_at = NULL,
           session_id = NULL,
           started_at = COALESCE(started_at, ?),
           changed_at = ?,
           lease_generation = lease_generation + 1,
           lease_owner = ?,
           lease_expires_at = ?,
           updated_at = ?
       WHERE ${whereSql}
       RETURNING *`,
    )
    .get(now, now, owner, now + leaseMs, now, ...whereParams);
  if (!row) return null;
  const item = rowToItem(row);
  return { item, generation: item.lease!.generation, owner };
}

export function claimAppInboxItem(
  db: SqliteDb,
  id: string,
  owner: string,
  leaseMs: number,
  now = Date.now(),
): AppInboxClaim | null {
  return claimedRow(
    db,
    `id = ? AND ${CLAIMABLE_SQL}
     AND (
       conversation_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM app_inbox_items active
         WHERE active.app_id = app_inbox_items.app_id
           AND active.conversation_id = app_inbox_items.conversation_id
           AND active.id != app_inbox_items.id
           AND active.lease_owner IS NOT NULL
           AND active.lease_expires_at > ?
       )
     )`,
    [id, now, now, now],
    owner,
    leaseMs,
    now,
  );
}

/** `candidate` is the ready input; IDs are bound parameters, never SQL text. */
export function excludeExecutingConversations(executingIds: string[]): string {
  return executingIds.length
    ? `AND NOT EXISTS (
    SELECT 1 FROM app_inbox_items local
    WHERE local.id IN (${executingIds.map(() => "?").join(",")})
      AND (local.id = candidate.id OR
        (local.app_id = candidate.app_id AND local.conversation_id = candidate.conversation_id))
  )`
    : "";
}

export function claimNextAppInboxItem(
  db: SqliteDb,
  appId: string,
  owner: string,
  leaseMs: number,
  now = Date.now(),
  executingIds: string[] = [],
): AppInboxClaim | null {
  requiredText(appId, "appId");
  requiredText(owner, "lease owner");
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");

  const row = db
    .prepare(
      `UPDATE app_inbox_items
       SET status = 'handling',
           available_at = NULL,
           session_id = NULL,
           started_at = COALESCE(started_at, ?),
           changed_at = ?,
           lease_generation = lease_generation + 1,
           lease_owner = ?,
           lease_expires_at = ?,
           updated_at = ?
       WHERE id = (
         SELECT candidate.id
         FROM app_inbox_items candidate
         WHERE candidate.app_id = ?
           ${excludeExecutingConversations(executingIds)}
           AND candidate.status != 'done'
           AND (
             (candidate.lease_owner IS NULL
               AND candidate.available_at IS NOT NULL
               AND candidate.available_at <= ?)
             OR (candidate.lease_expires_at IS NOT NULL
               AND candidate.lease_expires_at <= ?)
           )
           AND (
             candidate.conversation_id IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM app_inbox_items active
               WHERE active.app_id = candidate.app_id
                 AND active.conversation_id = candidate.conversation_id
                 AND active.id != candidate.id
                 AND active.lease_owner IS NOT NULL
                 AND active.lease_expires_at > ?
             )
           )
         ORDER BY candidate.created_at, candidate.conversation_seq, candidate.id
         LIMIT 1
       )
       RETURNING *`,
    )
    .get(now, now, owner, now + leaseMs, now, appId, ...executingIds, now, now, now);
  if (!row) return null;
  const item = rowToItem(row);
  return { item, generation: item.lease!.generation, owner };
}

export function renewAppInboxClaim(db: SqliteDb, claim: AppInboxClaim, leaseMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) throw new Error("App inbox leaseMs must be positive");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET lease_expires_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [now + leaseMs, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

/** Check at the effect's transaction boundary, not only after execution. */
export function assertAppInboxClaim(db: SqliteDb, claim: AppInboxClaim, now = Date.now()): void {
  const item = getAppInboxItem(db, claim.item.id);
  if (
    item?.status !== "handling" ||
    item.lease?.owner !== claim.owner ||
    item.lease.generation !== claim.generation ||
    item.lease.expiresAt <= now
  )
    throw new Error("claim is stale");
}

export function associateAppInboxClaimSession(
  db: SqliteDb,
  claim: AppInboxClaim,
  sessionId: string,
  now = Date.now(),
): boolean {
  requiredText(sessionId, "sessionId");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET session_id = ?, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [sessionId, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function waitAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  options: { reviewAfterMs?: number; now?: number } = {},
): boolean {
  requiredText(waitingOn.id, "waitingOn.id");
  const now = options.now ?? Date.now();
  const reviewAt = options.reviewAfterMs === undefined ? null : now + options.reviewAfterMs;
  if (options.reviewAfterMs !== undefined && (!Number.isFinite(options.reviewAfterMs) || options.reviewAfterMs < 0)) {
    throw new Error("App inbox reviewAfterMs must be finite and non-negative");
  }
  return (
    db.run(
      `UPDATE app_inbox_items
       SET waiting_on_kind = ?, waiting_on_id = ?, review_at = ?, available_at = ?,
           session_id = NULL, lease_owner = NULL, lease_expires_at = NULL, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [waitingOn.kind, waitingOn.id, reviewAt, reviewAt, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function wakeAppInboxItem(db: SqliteDb, id: string, now = Date.now()): boolean {
  return (
    db.run(
      `UPDATE app_inbox_items
       SET available_at = CASE
             WHEN available_at IS NULL OR available_at > ? THEN ?
             ELSE available_at
           END,
           review_at = NULL,
           updated_at = ?
       WHERE id = ? AND status = 'handling' AND lease_owner IS NULL`,
      [now, now, now, id],
    ).changes === 1
  );
}

/** Wake every unfinished item explicitly waiting on a completed dependency. */
export function wakeAppInboxItemsWaitingOn(
  db: SqliteDb,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  now = Date.now(),
): number {
  return wakeAppInboxItemsWaitingOnScope(db, waitingOn, now);
}

/** Wake one dependency only inside its canonical App scope. */
export function wakeAppInboxItemsWaitingOnApp(
  db: SqliteDb,
  appId: string,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  now = Date.now(),
): number {
  return wakeAppInboxItemsWaitingOnScope(db, waitingOn, now, requiredText(appId, "appId"));
}

function wakeAppInboxItemsWaitingOnScope(
  db: SqliteDb,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  now: number,
  appId?: string,
): number {
  requiredText(waitingOn.id, "waitingOn.id");
  const result = db.run(
    `UPDATE app_inbox_items
     SET available_at = CASE
           WHEN available_at IS NULL OR available_at > ? THEN ?
           ELSE available_at
         END,
         review_at = NULL,
         updated_at = ?
     WHERE status = 'handling'
       AND lease_owner IS NULL
       AND waiting_on_kind = ?
       AND waiting_on_id = ?
       ${appId ? "AND app_id = ?" : ""}
       AND (available_at IS NULL OR available_at > ? OR review_at IS NOT NULL)`,
    [now, now, now, waitingOn.kind, waitingOn.id, ...(appId ? [appId] : []), now],
  );
  return result.changes;
}

export function completeAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  result: AppResult,
  now = Date.now(),
): boolean {
  requiredText(result.summary, "result.summary");
  return (
    db.run(
      `UPDATE app_inbox_items
       SET status = 'done', result = ?, completed_at = ?, changed_at = ?, updated_at = ?,
           waiting_on_kind = NULL, waiting_on_id = NULL,
           review_at = NULL, available_at = NULL,
           lease_owner = NULL, lease_expires_at = NULL
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [JSON.stringify(result), now, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export function releaseAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  options: { retryAfterMs?: number; now?: number } = {},
): boolean {
  const now = options.now ?? Date.now();
  const retryAfterMs = options.retryAfterMs ?? 0;
  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
    throw new Error("App inbox retryAfterMs must be finite and non-negative");
  }
  const retryAt = now + retryAfterMs;
  return (
    db.run(
      `UPDATE app_inbox_items
       SET status = CASE WHEN waiting_on_kind IS NULL THEN 'pending' ELSE 'handling' END,
           available_at = CASE WHEN waiting_on_kind IS NULL THEN ? ELSE NULL END,
           review_at = CASE WHEN waiting_on_kind IS NULL THEN review_at ELSE NULL END,
           session_id = NULL,
           lease_owner = NULL, lease_expires_at = NULL, changed_at = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [retryAt, now, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}
