import type { SqliteDb } from "../db.js";

const active = new WeakMap<SqliteDb, Array<() => void>>();

export function inStateTransaction(db: SqliteDb): boolean {
  return active.has(db);
}

/** The journal is durable work; callbacks only deliver it after the outer commit. */
export function afterStateCommit(db: SqliteDb, deliver: () => void): void {
  const pending = active.get(db);
  if (pending) pending.push(deliver);
  else deliver();
}

/** Synchronous SQL only. Nested store operations join one commit via savepoints. */
export function stateTransaction<T>(db: SqliteDb, operation: () => T): T {
  const parent = active.get(db);
  const nested = parent !== undefined;
  const pending = parent ?? [];
  const checkpoint = pending.length;
  db.exec(nested ? "SAVEPOINT state_operation" : "BEGIN IMMEDIATE");
  active.set(db, pending);
  let result: T;
  try {
    result = operation();
    if (result && typeof (result as { then?: unknown }).then === "function") {
      throw new Error("State transactions must be synchronous");
    }
    db.exec(nested ? "RELEASE state_operation" : "COMMIT");
  } catch (error) {
    pending.length = checkpoint;
    try {
      if (nested) {
        db.exec("ROLLBACK TO state_operation");
        db.exec("RELEASE state_operation");
      } else db.exec("ROLLBACK");
    } catch {
      // Preserve the operation failure.
    }
    throw error;
  } finally {
    if (!nested) active.delete(db);
  }
  // Outside the rollback boundary: delivery failure cannot undo committed SQL.
  if (!nested) {
    const errors: unknown[] = [];
    for (const deliver of pending) {
      try { deliver(); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "State committed, but event delivery failed");
  }
  return result;
}
