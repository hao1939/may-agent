import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { AppCommitmentView, AppInput, AppInputSource, AppResult } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";

export type AppInboxStatus = "pending" | "handling" | "done";
export type AppInboxWaitKind = "app" | "task" | "session" | "analysis";
export type AppInboxDeliveryStatus = "pending" | "sending" | "delivered" | "failed" | "uncertain";

export type AppInboxDelivery = {
  itemId: string;
  operationId: string;
  kind: "progress" | "final";
  text?: string;
  sessionId: string;
  requestId: string;
  channel: string;
  status: AppInboxDeliveryStatus;
  externalMessageId?: string;
  failureReason?: string;
  receiptEventId?: number;
  createdAt: number;
  updatedAt: number;
  attemptedAt?: number;
  completedAt?: number;
};

export type AppInboxItem = {
  id: string;
  appId: string;
  parentId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
  channelThreadId?: string;
  channelMessageId?: number;
  replyToSourceId?: string;
  source: AppInputSource;
  input: AppInput;
  status: AppInboxStatus;
  sessionId?: string;
  waitingOn?: { kind: AppInboxWaitKind; id: string };
  result?: AppResult;
  delivery?: AppInboxDelivery;
  availableAt?: number;
  reviewAt?: number;
  lease?: { generation: number; owner: string; expiresAt: number };
  originEventId?: number;
  idempotencyKey?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

export type CreateAppInboxItem = {
  id?: string;
  appId: string;
  parentId?: string;
  conversationId?: string;
  conversationSequence?: number;
  channel?: string;
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

/** A claim durably associated with the exact owner session that was executing it. */
export type AppInboxSessionClaim = {
  claim: AppInboxClaim;
  sessionId: string;
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
  waitingOnDelivery: number;
  activeLeases: number;
  expiredLeases: number;
  oldestPendingAgeMs?: number;
  oldestHandlingItemAgeMs?: number;
};

export type AppConversationTurn = {
  requestId: string;
  sourceId: string;
  replyToSourceId?: string;
  input: AppInput;
  state: "working" | "done";
  deliveries: AppInboxDelivery[];
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
    conversationId: optionalText(row.conversation_id),
    conversationSequence: optionalNumber(row.conversation_seq),
    channel: optionalText(row.channel),
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
    updatedAt: Number(row.updated_at),
    completedAt: optionalNumber(row.completed_at),
  };
}

function rowToDelivery(row: InboxRow): AppInboxDelivery {
  return {
    itemId: requiredText(row.item_id, "delivery.item_id"),
    operationId: requiredText(row.operation_id, "delivery.operation_id"),
    kind: requiredText(row.kind, "delivery.kind") as AppInboxDelivery["kind"],
    text: optionalText(row.text),
    sessionId: requiredText(row.session_id, "delivery.session_id"),
    requestId: requiredText(row.request_id, "delivery.request_id"),
    channel: requiredText(row.channel, "delivery.channel"),
    status: requiredText(row.status, "delivery.status") as AppInboxDeliveryStatus,
    externalMessageId: optionalText(row.external_message_id),
    failureReason: optionalText(row.failure_reason),
    receiptEventId: optionalNumber(row.receipt_event_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    attemptedAt: optionalNumber(row.attempted_at),
    completedAt: optionalNumber(row.completed_at),
  };
}

function validateCreate(input: CreateAppInboxItem): void {
  requiredText(input.appId, "appId");
  requiredText(input.source.id, "source.id");
  requiredText(input.input.kind, "input.kind");
  if (!(["human", "app", "system"] as const).includes(input.source.kind)) {
    throw new Error(`Invalid App inbox source kind: ${input.source.kind}`);
  }
  const hasConversation = input.conversationId !== undefined;
  const hasSequence = input.conversationSequence !== undefined;
  if (hasConversation !== hasSequence) {
    throw new Error("App inbox conversationId and conversationSequence must be provided together");
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
  if (!row) return null;
  const item = rowToItem(row);
  const delivery = getAppInboxDelivery(db, item.id);
  return delivery ? { ...item, delivery } : item;
}

export function getAppInboxDelivery(db: SqliteDb, itemId: string): AppInboxDelivery | null {
  const row = db
    .prepare(
      `SELECT * FROM app_inbox_deliveries
       WHERE item_id = ? AND kind = 'final'
       ORDER BY created_at DESC, operation_id DESC
       LIMIT 1`,
    )
    .get(itemId);
  return row ? rowToDelivery(row) : null;
}

export function listAppInboxDeliveries(db: SqliteDb, itemId: string): AppInboxDelivery[] {
  return db
    .prepare("SELECT * FROM app_inbox_deliveries WHERE item_id = ? ORDER BY created_at, operation_id")
    .all(requiredText(itemId, "itemId"))
    .map(rowToDelivery);
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
    .map((row) => {
      const item = rowToItem(row);
      const delivery = getAppInboxDelivery(db, item.id);
      return delivery ? { ...item, delivery } : item;
    });
}

/** Read-only conversation view derived from inbox requests and delivery operations. */
export function listAppConversationTurns(
  db: SqliteDb,
  appId: string,
  conversationId: string,
  limit = 50,
): AppConversationTurn[] {
  requiredText(appId, "appId");
  requiredText(conversationId, "conversationId");
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 200) {
    throw new Error("Conversation limit must be an integer from 1 to 200");
  }
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT * FROM app_inbox_items
         WHERE app_id = ? AND conversation_id = ? AND source_kind = 'human'
         ORDER BY conversation_seq DESC, created_at DESC, id DESC
         LIMIT ?
       ) recent
       ORDER BY conversation_seq, created_at, id`,
    )
    .all(appId, conversationId, limit);
  return rows.map((row) => {
    const item = rowToItem(row);
    return {
      requestId: item.id,
      sourceId: item.source.id,
      replyToSourceId: item.replyToSourceId,
      input: item.input,
      state: item.status === "done" ? "done" : "working",
      deliveries: listAppInboxDeliveries(db, item.id),
    };
  });
}

function boundedCommitmentText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

function commitmentMessage(item: AppInboxItem): string {
  const data = item.input.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    for (const field of ["message", "text"]) {
      if (typeof record[field] === "string" && record[field].trim()) {
        return boundedCommitmentText(record[field], 160);
      }
    }
  }
  return boundedCommitmentText(`${item.input.kind} request`, 160);
}

function commitmentState(item: AppInboxItem): AppCommitmentView["state"] {
  if (item.status === "pending") return "queued";
  if (item.result) return "ready";
  if (item.waitingOn?.kind === "analysis" || item.waitingOn?.kind === "session") return "analyzing";
  if (item.waitingOn) return "waiting";
  return "working";
}

function commitmentProgress(
  item: AppInboxItem,
  deliveries: AppInboxDelivery[],
  state: AppCommitmentView["state"],
): string | undefined {
  if (state === "ready") {
    const finalDelivery = deliveries.filter((delivery) => delivery.kind === "final").at(-1);
    if (!finalDelivery) return "May has a result ready to deliver.";
    if (finalDelivery.status === "uncertain") {
      return `May has a result; delivery to ${finalDelivery.channel} is unconfirmed.`;
    }
    if (finalDelivery.status === "failed") {
      return `May has a result; delivery to ${finalDelivery.channel} failed.`;
    }
    return `May has a result ready for ${finalDelivery.channel}.`;
  }
  return deliveries.filter((delivery) => delivery.kind === "progress" && delivery.text?.trim()).at(-1)?.text;
}

/** Read-only human work view derived from unfinished durable App requests. */
export function listOpenAppCommitments(
  db: SqliteDb,
  appId: string,
  options: { excludeRequestId?: string; limit?: number } = {},
): AppCommitmentView[] {
  requiredText(appId, "appId");
  const limit = options.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error("Commitment limit must be an integer from 1 to 100");
  }
  const excludeRequestId = options.excludeRequestId?.trim();
  const rows = db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE app_id = ? AND source_kind = 'human' AND status IN ('pending', 'handling')
         AND (? = '' OR id != ?)
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(appId, excludeRequestId ?? "", excludeRequestId ?? "", limit);

  return rows.map((row) => {
    const item = rowToItem(row);
    const deliveries = listAppInboxDeliveries(db, item.id);
    const state = commitmentState(item);
    const progress = commitmentProgress(item, deliveries, state);
    const updatedAt = deliveries.reduce((latest, delivery) => Math.max(latest, delivery.updatedAt), item.updatedAt);
    return {
      requestId: item.id,
      ...(item.conversationId ? { conversationId: item.conversationId } : {}),
      message: commitmentMessage(item),
      state,
      ...(progress ? { progress: boundedCommitmentText(progress, 240) } : {}),
      createdAt: item.createdAt,
      updatedAt,
    };
  });
}

/**
 * Previous-runtime claims that reached owner-session admission before the
 * process stopped. The generation, owner, and session together are the fence
 * used when converting one of these claims into an explicit session wait.
 */
export function listAppInboxAssociatedSessionClaims(db: SqliteDb): AppInboxSessionClaim[] {
  const rows = db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE status = 'handling'
         AND session_id IS NOT NULL
         AND lease_owner IS NOT NULL
         AND lease_expires_at IS NOT NULL
       ORDER BY created_at, id`,
    )
    .all();

  return rows.map((row) => {
    const item = rowToItem(row);
    if (!item.sessionId || !item.lease) throw new Error(`Invalid associated session claim ${item.id}`);
    return {
      claim: { item, generation: item.lease.generation, owner: item.lease.owner },
      sessionId: item.sessionId,
    };
  });
}

/** Session waits are runtime recovery state, not an App authoring capability. */
export function listAppInboxSessionWaits(db: SqliteDb): AppInboxItem[] {
  return listAppInboxDependencyWaits(db, "session");
}

/** Durable waits that must be re-observed after events may have been missed offline. */
export function listAppInboxDependencyWaits(db: SqliteDb, kind: AppInboxWaitKind): AppInboxItem[] {
  return db
    .prepare(
      `SELECT * FROM app_inbox_items
       WHERE status = 'handling'
         AND lease_owner IS NULL
         AND waiting_on_kind = ?
         AND waiting_on_id IS NOT NULL
       ORDER BY created_at, id`,
    )
    .all(kind)
    .map(rowToItem);
}

/** True when the App inbox is the explicit unfinished owner of this dependency. */
export function hasAppInboxWait(db: SqliteDb, waitingOn: { kind: AppInboxWaitKind; id: string }): boolean {
  const id = requiredText(waitingOn.id, "waitingOn.id");
  const row = db
    .prepare(
      `SELECT 1 AS found
       FROM app_inbox_items
       WHERE status != 'done'
         AND waiting_on_kind = ?
         AND waiting_on_id = ?
       LIMIT 1`,
    )
    .get(waitingOn.kind, id) as { found?: unknown } | undefined;
  return row?.found === 1;
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
              SUM(CASE WHEN status = 'handling' AND result IS NOT NULL
                            AND EXISTS (
                              SELECT 1 FROM app_inbox_deliveries delivery
                              WHERE delivery.item_id = app_inbox_items.id
                                AND delivery.kind = 'final'
                                AND delivery.status != 'delivered'
                            )
                       THEN 1 ELSE 0 END) AS waiting_on_delivery,
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
    waitingOnDelivery: Number(row.waiting_on_delivery),
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
       id, app_id, parent_id, conversation_id, conversation_seq,
       channel, channel_thread_id, channel_message_id, reply_to_source_id,
       source_kind, source_id, input_kind, input_data, status,
       available_at, origin_event_id, idempotency_key, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    [
      id,
      input.appId,
      input.parentId ?? null,
      input.conversationId ?? null,
      input.conversationSequence ?? null,
      input.channel ?? null,
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
           lease_generation = lease_generation + 1,
           lease_owner = ?,
           lease_expires_at = ?,
           updated_at = ?
       WHERE ${whereSql}
       RETURNING *`,
    )
    .get(owner, now + leaseMs, now, ...whereParams);
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

export function claimNextAppInboxItem(
  db: SqliteDb,
  appId: string,
  owner: string,
  leaseMs: number,
  now = Date.now(),
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
           lease_generation = lease_generation + 1,
           lease_owner = ?,
           lease_expires_at = ?,
           updated_at = ?
       WHERE id = (
         SELECT candidate.id
         FROM app_inbox_items candidate
         WHERE candidate.app_id = ?
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
    .get(owner, now + leaseMs, now, appId, now, now, now);
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
       SET session_id = ?, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [sessionId, now, claim.item.id, claim.generation, claim.owner],
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
           session_id = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [waitingOn.kind, waitingOn.id, reviewAt, reviewAt, now, claim.item.id, claim.generation, claim.owner],
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
       AND (available_at IS NULL OR available_at > ? OR review_at IS NOT NULL)`,
    [now, now, now, waitingOn.kind, waitingOn.id, now],
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
       SET status = 'done', result = ?, completed_at = ?, updated_at = ?,
           waiting_on_kind = NULL, waiting_on_id = NULL,
           review_at = NULL, available_at = NULL,
           lease_owner = NULL, lease_expires_at = NULL
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [JSON.stringify(result), now, now, claim.item.id, claim.generation, claim.owner],
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
           available_at = ?, session_id = NULL,
           lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [retryAt, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}

export type AppInboxDeliveryDispatch = {
  delivery: AppInboxDelivery;
  item: AppInboxItem;
  text: string;
};

export function stageAppInboxClaimDelivery(
  db: SqliteDb,
  claim: AppInboxClaim,
  input: { channel: string; sessionId: string; requestId: string; result: AppResult },
  now = Date.now(),
): AppInboxDelivery {
  const channel = requiredText(input.channel, "delivery.channel");
  const sessionId = requiredText(input.sessionId, "delivery.sessionId");
  const requestId = requiredText(input.requestId, "delivery.requestId");
  requiredText(input.result.summary, "delivery.result.summary");
  const operationId = `app-delivery:${claim.item.id}:${claim.generation}`;
  const updated = db.run(
    `UPDATE app_inbox_items
     SET result = ?, waiting_on_kind = NULL, waiting_on_id = NULL,
         review_at = NULL, available_at = NULL,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
     WHERE id = ? AND status = 'handling'
       AND lease_generation = ? AND lease_owner = ? AND session_id = ?`,
    [JSON.stringify(input.result), now, claim.item.id, claim.generation, claim.owner, sessionId],
  );
  if (updated.changes !== 1) throw new Error("claim is stale or has no matching owner session");

  const inserted = db.run(
    `INSERT INTO app_inbox_deliveries (
       operation_id, item_id, kind, text, session_id, request_id, channel, status, created_at, updated_at
     ) VALUES (?, ?, 'final', ?, ?, ?, ?, 'pending', ?, ?)`,
    [
      operationId,
      claim.item.id,
      input.result.response?.trim() || input.result.summary.trim(),
      sessionId,
      requestId,
      channel,
      now,
      now,
    ],
  );
  if (inserted.changes !== 1) throw new Error(`Cannot stage delivery for App inbox item ${claim.item.id}`);
  return getAppInboxDelivery(db, claim.item.id)!;
}

export function stageAppInboxProgressDelivery(
  db: SqliteDb,
  input: {
    itemId: string;
    operationId: string;
    channel: string;
    sessionId: string;
    requestId: string;
    text: string;
  },
  now = Date.now(),
): AppInboxDelivery {
  const itemId = requiredText(input.itemId, "delivery.itemId");
  const operationId = requiredText(input.operationId, "delivery.operationId");
  const channel = requiredText(input.channel, "delivery.channel");
  const sessionId = requiredText(input.sessionId, "delivery.sessionId");
  const requestId = requiredText(input.requestId, "delivery.requestId");
  const text = requiredText(input.text, "delivery.text").trim();
  const item = db.prepare("SELECT status FROM app_inbox_items WHERE id = ?").get(itemId) as
    { status?: unknown } | undefined;
  if (!item || item.status === "done") throw new Error(`Cannot stage progress for completed App inbox item ${itemId}`);
  db.run(
    `INSERT OR IGNORE INTO app_inbox_deliveries (
       operation_id, item_id, kind, text, session_id, request_id, channel, status, created_at, updated_at
     ) VALUES (?, ?, 'progress', ?, ?, ?, ?, 'pending', ?, ?)`,
    [operationId, itemId, text, sessionId, requestId, channel, now, now],
  );
  const row = db.prepare("SELECT * FROM app_inbox_deliveries WHERE operation_id = ?").get(operationId);
  if (!row) throw new Error(`Cannot stage progress delivery ${operationId}`);
  const delivery = rowToDelivery(row);
  if (
    delivery.itemId !== itemId ||
    delivery.kind !== "progress" ||
    delivery.channel !== channel ||
    delivery.sessionId !== sessionId ||
    delivery.requestId !== requestId ||
    delivery.text !== text
  ) {
    throw new Error(`Progress delivery operation ${operationId} was reused with different input`);
  }
  return delivery;
}

export function claimNextAppInboxDelivery(db: SqliteDb, now = Date.now()): AppInboxDeliveryDispatch | null {
  const row = db
    .prepare(
      `UPDATE app_inbox_deliveries
       SET status = 'sending', attempted_at = ?, updated_at = ?
       WHERE operation_id = (
         SELECT delivery.operation_id
         FROM app_inbox_deliveries delivery
         JOIN app_inbox_items item ON item.id = delivery.item_id
         WHERE delivery.status = 'pending' AND item.status = 'handling'
         ORDER BY delivery.created_at, delivery.item_id
         LIMIT 1
       )
       RETURNING *`,
    )
    .get(now, now);
  if (!row) return null;
  const delivery = rowToDelivery(row);
  const item = getAppInboxItem(db, delivery.itemId);
  if (!item) throw new Error(`Delivery ${delivery.operationId} has no App inbox item`);
  const text =
    delivery.text?.trim() ||
    (delivery.kind === "final" && item.result ? item.result.response?.trim() || item.result.summary.trim() : "");
  if (!text) throw new Error(`Delivery ${delivery.operationId} has no human-facing response`);
  return { delivery, item, text };
}

/** Safe only when event persistence failed before any transport subscriber ran. */
export function restorePendingAppInboxDelivery(db: SqliteDb, operationId: string, now = Date.now()): boolean {
  return (
    db.run(
      `UPDATE app_inbox_deliveries
       SET status = 'pending', attempted_at = NULL, updated_at = ?
       WHERE operation_id = ? AND status = 'sending'`,
      [now, requiredText(operationId, "delivery.operationId")],
    ).changes === 1
  );
}

/** A persisted sending state survived its process, so the external outcome is unknown. */
export function markAppInboxSendingDeliveriesUncertain(db: SqliteDb, now = Date.now()): number {
  return db.run(
    `UPDATE app_inbox_deliveries
     SET status = 'uncertain',
         failure_reason = COALESCE(failure_reason, 'Runtime restarted before an authoritative delivery receipt'),
         updated_at = ?
     WHERE status = 'sending'`,
    [now],
  ).changes;
}

/**
 * Internal agent delivery and local control-console rendering are safe to
 * replay because both carry the stable delivery operation ID. External channel
 * sends remain uncertain after restart and must never be retried blindly.
 */
export function restoreReplayableAppInboxDeliveries(db: SqliteDb, now = Date.now()): number {
  return db.run(
    `UPDATE app_inbox_deliveries
     SET status = 'pending', attempted_at = NULL, updated_at = ?
     WHERE status = 'sending'
       AND (channel LIKE 'agent:%' OR channel IN ('may-console', 'control-socket', 'socket'))`,
    [now],
  ).changes;
}

export type AppInboxDeliveryReceipt = {
  operationId: string;
  itemId: string;
  sessionId: string;
  requestId: string;
  channel: string;
  status: "delivered" | "failed" | "uncertain";
  externalMessageId?: string;
  reason?: string;
  eventId?: number;
};

export function recordAppInboxDeliveryReceipt(
  db: SqliteDb,
  receipt: AppInboxDeliveryReceipt,
  now = Date.now(),
): { matched: boolean; completed: boolean; status?: AppInboxDeliveryStatus } {
  const operationId = requiredText(receipt.operationId, "delivery.operationId");
  const currentRow = db.prepare("SELECT * FROM app_inbox_deliveries WHERE operation_id = ?").get(operationId);
  if (!currentRow) return { matched: false, completed: false };
  const current = rowToDelivery(currentRow);
  if (
    current.itemId !== receipt.itemId ||
    current.sessionId !== receipt.sessionId ||
    current.requestId !== receipt.requestId ||
    current.channel !== receipt.channel
  ) {
    return { matched: false, completed: false };
  }

  if (receipt.status !== "delivered") {
    if (current.status !== "delivered") {
      db.run(
        `UPDATE app_inbox_deliveries
         SET status = ?, failure_reason = ?, receipt_event_id = COALESCE(?, receipt_event_id), updated_at = ?
         WHERE operation_id = ? AND status != 'delivered'`,
        [receipt.status, receipt.reason?.trim() || null, receipt.eventId ?? null, now, operationId],
      );
    }
    return {
      matched: true,
      completed: false,
      status: rowToDelivery(db.prepare("SELECT * FROM app_inbox_deliveries WHERE operation_id = ?").get(operationId)!)
        .status,
    };
  }

  db.run(
    `UPDATE app_inbox_deliveries
     SET status = 'delivered', external_message_id = ?, failure_reason = NULL,
         receipt_event_id = COALESCE(?, receipt_event_id), completed_at = COALESCE(completed_at, ?), updated_at = ?
     WHERE operation_id = ?`,
    [receipt.externalMessageId?.trim() || null, receipt.eventId ?? null, now, now, operationId],
  );
  const completed =
    current.kind === "final" &&
    db.run(
      `UPDATE app_inbox_items
     SET status = 'done', completed_at = ?, updated_at = ?,
         waiting_on_kind = NULL, waiting_on_id = NULL,
         review_at = NULL, available_at = NULL,
         lease_owner = NULL, lease_expires_at = NULL
     WHERE id = ? AND status = 'handling' AND result IS NOT NULL AND session_id = ?`,
      [now, now, current.itemId, current.sessionId],
    ).changes === 1;
  return { matched: true, completed, status: "delivered" };
}
