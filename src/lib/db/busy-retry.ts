import { log } from "../log.js";

const SQLITE_BUSY_PATTERNS = [/database is locked/i, /SQLITE_BUSY/i];
const WORKER_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000];
const HOST_RETRY_DELAYS_MS = [5, 10, 20, 40, 80, 160, 320, 640];
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
  const retryDelaysMs =
    process.env.MAY_TASK_ATTEMPT_CHILD === "1" ? WORKER_RETRY_DELAYS_MS : HOST_RETRY_DELAYS_MS;
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
