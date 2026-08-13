import { randomUUID } from "node:crypto";
import type { AppInput, AppInputSource, AppResult } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";

export type AppInboxStatus = "pending" | "handling" | "done";
export type AppInboxWaitKind = "app" | "task" | "session";

export type AppInboxItem = {
  id: string;
  appId: string;
  parentId?: string;
  conversationId?: string;
  conversationSequence?: number;
  source: AppInputSource;
  input: AppInput;
  status: AppInboxStatus;
  sessionId?: string;
  waitingOn?: { kind: AppInboxWaitKind; id: string };
  result?: AppResult;
  availableAt?: number;
  reviewAt?: number;
  lease?: { generation: number; owner: string; expiresAt: number };
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
  source: AppInputSource;
  input: AppInput;
  idempotencyKey?: string;
  now?: number;
};

export type AppInboxClaim = {
  item: AppInboxItem;
  generation: number;
  owner: string;
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
    idempotencyKey: optionalText(row.idempotency_key),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
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
}

export function getAppInboxItem(db: SqliteDb, id: string): AppInboxItem | null {
  const row = db.prepare("SELECT * FROM app_inbox_items WHERE id = ?").get(id);
  return row ? rowToItem(row) : null;
}

export function createAppInboxItem(
  db: SqliteDb,
  input: CreateAppInboxItem,
): { item: AppInboxItem; created: boolean } {
  validateCreate(input);
  const now = input.now ?? Date.now();
  const id = input.id ?? `app_${randomUUID()}`;
  const result = db.run(
    `INSERT OR IGNORE INTO app_inbox_items (
       id, app_id, parent_id, conversation_id, conversation_seq,
       source_kind, source_id, input_kind, input_data, status,
       available_at, idempotency_key, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [
      id,
      input.appId,
      input.parentId ?? null,
      input.conversationId ?? null,
      input.conversationSequence ?? null,
      input.source.kind,
      input.source.id,
      input.input.kind,
      JSON.stringify(input.input.data),
      now,
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
  const item = rowToItem(existing);
  if (item.appId !== input.appId) {
    throw new Error(`App inbox item ${id} already belongs to App ${item.appId}`);
  }
  return { item, created: false };
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

export function renewAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  leaseMs: number,
  now = Date.now(),
): boolean {
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

export function waitAppInboxClaim(
  db: SqliteDb,
  claim: AppInboxClaim,
  waitingOn: { kind: AppInboxWaitKind; id: string },
  options: { reviewAfterMs?: number; now?: number } = {},
): boolean {
  requiredText(waitingOn.id, "waitingOn.id");
  const now = options.now ?? Date.now();
  const reviewAt = options.reviewAfterMs === undefined ? null : now + options.reviewAfterMs;
  if (
    options.reviewAfterMs !== undefined &&
    (!Number.isFinite(options.reviewAfterMs) || options.reviewAfterMs < 0)
  ) {
    throw new Error("App inbox reviewAfterMs must be finite and non-negative");
  }
  return (
    db.run(
      `UPDATE app_inbox_items
       SET waiting_on_kind = ?, waiting_on_id = ?, review_at = ?, available_at = ?,
           lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [
        waitingOn.kind,
        waitingOn.id,
        reviewAt,
        reviewAt,
        now,
        claim.item.id,
        claim.generation,
        claim.owner,
      ],
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
       AND waiting_on_id = ?`,
    [now, now, now, waitingOn.kind, waitingOn.id],
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
           available_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'handling'
         AND lease_generation = ? AND lease_owner = ?`,
      [retryAt, now, claim.item.id, claim.generation, claim.owner],
    ).changes === 1
  );
}
