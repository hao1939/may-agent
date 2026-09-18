import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { openDatabase } from "../../src/lib/db.js";
import { closeDb, getDb } from "../../src/lib/db/connection.js";
import { withSqliteBusyRetry } from "../../src/lib/db/busy-retry.js";
import { enterTaskWorkerProcess, isTaskWorkerProcess } from "../../src/lib/task-worker-context.js";

const scenario = process.argv[2];
const root = process.argv[3]!;
const waits: number[] = [];
const originalWait = Atomics.wait;
Atomics.wait = ((_array, _index, _value, timeout) => {
  waits.push(timeout ?? Infinity);
  return "timed-out";
}) as typeof Atomics.wait;

let retryAttempts = 0;
function exhaustRetries(): void {
  try {
    withSqliteBusyRetry("role probe", () => {
      retryAttempts += 1;
      throw new Error("SQLITE_BUSY");
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "SQLITE_BUSY") throw error;
  }
}

let entryError: string | null = null;
let dbError: string | null = null;
let initialized = false;
let tableNames: string[] = [];
try {
  if (scenario === "entry-without-parent" || scenario.startsWith("worker-")) {
    try {
      enterTaskWorkerProcess();
    } catch (error) {
      entryError = error instanceof Error ? error.message : String(error);
    }
  }

  if (scenario === "worker-initialized") {
    mkdirSync(root, { recursive: true });
    const seed = openDatabase(join(root, "may.db"));
    seed.exec("CREATE TABLE events (id INTEGER PRIMARY KEY); CREATE TABLE app_tasks (id INTEGER PRIMARY KEY)");
    seed.close();
  }

  try {
    const db = getDb(root);
    tableNames = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
      name: string;
    }>).map(({ name }) => name);
    initialized = tableNames.includes("events");
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
    const db = openDatabase(join(root, "may.db"));
    tableNames = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
      name: string;
    }>).map(({ name }) => name);
    db.close();
  }
  exhaustRetries();
} finally {
  Atomics.wait = originalWait;
  closeDb(root);
}

const result = {
  connected: process.connected,
  worker: isTaskWorkerProcess(),
  entryError,
  dbError,
  initialized,
  tableNames,
  waits,
  retryAttempts,
  legacyMarker: process.env.MAY_TASK_ATTEMPT_CHILD ?? null,
};
if (process.send) process.send(result);
else process.stdout.write(`${JSON.stringify(result)}\n`);
