import type { SqliteDb } from "../db.js";

const active = new WeakSet<SqliteDb>();

export function inStateTransaction(db: SqliteDb): boolean {
  return active.has(db);
}

/** Synchronous SQL only. Nested store operations join one commit via savepoints. */
export function stateTransaction<T>(db: SqliteDb, operation: () => T): T {
  const nested = active.has(db);
  db.exec(nested ? "SAVEPOINT state_operation" : "BEGIN IMMEDIATE");
  active.add(db);
  try {
    const result = operation();
    if (result && typeof (result as { then?: unknown }).then === "function") {
      throw new Error("State transactions must be synchronous");
    }
    db.exec(nested ? "RELEASE state_operation" : "COMMIT");
    return result;
  } catch (error) {
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
}
