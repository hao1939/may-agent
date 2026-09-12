import type { SqliteDb } from "../../../lib/db.js";

type TaskEmissionScope = { appId: string; taskId: string; generation: number };

/** Publication and replay reads use exactly the same Task generation scope. */
export function taskEmissionIdentity(scope: TaskEmissionScope, localKey: string): string {
  const key = localKey.trim();
  if (!key || key.length > 256) throw new Error("Task emit localKey must contain 1-256 characters");
  return `task:${scope.appId}:${scope.taskId}:${scope.generation}:emit:${key}`;
}

/** Read an already published fact, not a proposed or accepted Task result. */
export function readTaskEmission(
  db: SqliteDb,
  scope: TaskEmissionScope,
  type: string,
  localKey: string,
): { eventId: number; data: Record<string, unknown> } | null {
  const row = db
    .prepare(
      `SELECT id, data FROM events
     WHERE event_type = ? AND ingress_source = ? AND idempotency_scope = ? AND idempotency_key = ?`,
    )
    .get(type, `app-task:${scope.appId}`, scope.appId, taskEmissionIdentity(scope, localKey)) as
    { id: number; data: string } | undefined;
  return row ? { eventId: row.id, data: JSON.parse(row.data) as Record<string, unknown> } : null;
}
