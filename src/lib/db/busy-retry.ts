import { log } from "../log.js";

const SQLITE_BUSY_PATTERNS = [/database is locked/i, /SQLITE_BUSY/i];
const RETRY_DELAYS_MS = [250, 500, 1_000, 2_000];
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
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return run();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusy(error) || attempt === RETRY_DELAYS_MS.length) throw error;
      const delayMs = RETRY_DELAYS_MS[attempt] ?? 0;
      log(
        "warn",
        `[db] ${operation} hit SQLite write contention (${error instanceof Error ? error.message : String(error)}); retrying in ${delayMs}ms (${attempt + 1}/${RETRY_DELAYS_MS.length})`,
      );
      sleepSync(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
