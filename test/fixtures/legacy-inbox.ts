/** Test-only snapshots from the retired inbox worker, for read and offline-cutover fixtures. */
import type { SqliteDb } from "../../src/lib/db.js";
import type { AppResult } from "@may-agent/sdk";
import {
  getAppInboxItem,
  type AppInboxItem,
  type AppInboxHandling,
  type AppInboxWaitKind,
} from "../../src/app/core/state/app-inbox-store.js";
export type AppInboxClaim = { item: AppInboxItem; generation: number; owner: string };
function requiredText(value: string, field: string): string {
  if (!value.trim()) throw new Error(`${field} must be non-empty`);
  return value.trim();
}

const CLAIMABLE_SQL = `
  status != 'done'
  AND execution_task_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM app_inbox_items owned
    WHERE owned.app_id = app_inbox_items.app_id
      AND owned.conversation_id = app_inbox_items.conversation_id
      AND owned.execution_task_id IS NOT NULL
  )
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
  const item = getAppInboxItem(db, String(row.id))!;
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
  for (const row of db
    .prepare("SELECT id FROM app_inbox_items WHERE app_id = ? ORDER BY created_at, conversation_seq, id")
    .all(appId)) {
    const claim = claimAppInboxItem(db, String(row.id), owner, leaseMs, now);
    if (claim) return claim;
  }
  return null;
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

export function recordAppInboxHandling(
  db: SqliteDb,
  claim: AppInboxClaim,
  handling: AppInboxHandling | null,
  now = Date.now(),
): void {
  const changed = db.run(
    `UPDATE app_inbox_items SET handling = ?, updated_at = ?
    WHERE id = ? AND status = 'handling' AND lease_owner = ? AND lease_generation = ? AND lease_expires_at > ?`,
    [handling ? JSON.stringify(handling) : null, now, claim.item.id, claim.owner, claim.generation, now],
  ).changes;
  if (changed !== 1) throw new Error("claim is stale");
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
