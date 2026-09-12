import type { SqliteDb } from "../../../lib/db.js";
import { loadPersistedEvent } from "../events/persisted.js";

type TaskEmissionScope = { appId: string; taskId: string; generation: number };

/** An unambiguous tuple; Task IDs and local keys may themselves contain delimiters. */
export function taskEmissionIdentity(scope: TaskEmissionScope, localKey: string): string {
  const key = localKey.trim();
  if (!key || key.length > 256) throw new Error("Task emit localKey must contain 1-256 characters");
  return `task-emission:${JSON.stringify([scope.appId, scope.taskId, scope.generation, key])}`;
}

/** Preserve existing receipts, checking the stored Task identity before trusting a legacy key. */
export function findTaskEmission(
  db: SqliteDb,
  scope: TaskEmissionScope,
  type: string,
  localKey: string,
): { eventId: number; idempotencyKey: string } | null {
  const key = taskEmissionIdentity(scope, localKey);
  const legacyKey = `task:${scope.appId}:${scope.taskId}:${scope.generation}:emit:${localKey.trim()}`;
  return (
    (db
      .prepare(
        `SELECT id AS eventId, idempotency_key AS idempotencyKey FROM events
     WHERE event_type = ? AND ingress_source = ? AND idempotency_scope = ?
       AND idempotency_key IN (?, ?) AND project_id = ? AND task_id = ?
     ORDER BY idempotency_key = ? DESC LIMIT 1`,
      )
      .get(type, `app-task:${scope.appId}`, scope.appId, key, legacyKey, scope.appId, scope.taskId, key) as {
      eventId: number;
      idempotencyKey: string;
    } | null) ?? null
  );
}

/** Read verified original bytes. Known but damaged publication is not permission to redo it. */
export function readTaskEmission(
  db: SqliteDb,
  scope: TaskEmissionScope,
  type: string,
  localKey: string,
  persistDir?: string,
): { eventId: number; data: Record<string, unknown> } | null {
  const row = findTaskEmission(db, scope, type, localKey);
  if (!row) return null;
  const event = loadPersistedEvent(db, row.eventId, persistDir);
  const data = event && "data" in event ? (event.data as Record<string, unknown>) : undefined;
  const emission = data?.emission as Record<string, unknown> | undefined;
  if (
    !data ||
    data.idempotencyKey !== row.idempotencyKey ||
    emission?.appId !== scope.appId ||
    emission.taskId !== scope.taskId ||
    emission.generation !== scope.generation ||
    emission.localKey !== localKey.trim()
  ) {
    throw new Error(`Published Task fact ${row.eventId} could not be verified`);
  }
  return { eventId: row.eventId, data };
}
