import type { SqliteDb } from "../db.js";

const active = new WeakSet<SqliteDb>();

export type StateTransactionPublication = Readonly<{
  commit(): void;
  rollback(): void;
}>;

export function inStateTransaction(db: SqliteDb): boolean {
  return active.has(db);
}

/** Hold one outer transaction open while coordinated synchronous operations use savepoints. */
export function stageStateTransaction(db: SqliteDb): StateTransactionPublication {
  if (active.has(db)) throw new Error("Cannot stage a state transaction inside another state transaction");
  db.exec("BEGIN IMMEDIATE");
  active.add(db);
  let open = true;
  return Object.freeze({
    commit() {
      if (!open) throw new Error("State transaction is already closed");
      db.exec("COMMIT");
      open = false;
      active.delete(db);
    },
    rollback() {
      if (!open) return;
      try {
        db.exec("ROLLBACK");
      } finally {
        open = false;
        active.delete(db);
      }
    },
  });
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
