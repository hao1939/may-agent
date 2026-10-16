import { isTaskWorkerProcess } from "../task-worker-context.js";
import { log } from "../log.js";

const SQLITE_BUSY_PATTERNS = [/database is locked/i, /SQLITE_BUSY/i];
const WORKER_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000];
const INITIALIZATION_RETRY_DELAYS_MS = [5, 10, 20, 40, 80, 160, 320, 640];
const sleepArray = new Int32Array(new SharedArrayBuffer(4));

function isSqliteBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return SQLITE_BUSY_PATTERNS.some((pattern) => pattern.test(message));
}

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(sleepArray, 0, 0, ms);
}

export function withSqliteBusyRetry<T>(operation: string, run: () => T): T {
  // SQLite already owns the serving connection's short busy wait. Do not
  // compound it with synchronous sleeps or replay a whole operation here.
  // An unsaved operation fails to its caller; accepted work retains its
  // existing journal/Task recovery owner for a later event-loop turn.
  if (!isTaskWorkerProcess()) return run();
  return retrySqliteBusy(operation, run, WORKER_RETRY_DELAYS_MS);
}

/** Repeatable schema/definition installation, outside ordinary work delivery. */
export function withSqliteInitializationRetry<T>(operation: string, run: () => T): T {
  return retrySqliteBusy(operation, run, INITIALIZATION_RETRY_DELAYS_MS);
}

function retrySqliteBusy<T>(operation: string, run: () => T, retryDelaysMs: readonly number[]): T {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return run();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusy(error) || attempt === retryDelaysMs.length) throw error;
      const delayMs = retryDelaysMs[attempt] ?? 0;
      log(
        "warn",
        `[db] ${operation} hit SQLite write contention (${error instanceof Error ? error.message : String(error)}); retrying in ${delayMs}ms (${attempt + 1}/${retryDelaysMs.length})`,
      );
      sleepSync(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
