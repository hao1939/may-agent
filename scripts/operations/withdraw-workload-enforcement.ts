#!/usr/bin/env bun
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../../src/lib/db.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";
import { assertOfflineWorkloadExecution, assertOfflineWorkloadFiles } from "../../src/app/composition/install-retained-workload-state.js";
import { inspectWorkloadConfiguration, withdrawWorkloadEnforcement } from "../../src/app/composition/withdraw-workload-enforcement.js";

const args = process.argv.slice(2);
const inspect = args.length === 4 && args[2] === "--confirm-quiesced" && args[3] === "--inspect";
const apply = (args.length === 5 || args.length === 6) && args[2] === "--plan" && !!args[3] &&
  args[4] === "--confirm-quiesced" && (args.length === 5 || args[5] === "--dry-run");
if (args[0] !== "--state-dir" || !args[1] || (!inspect && !apply))
  throw new Error("Usage: bun scripts/operations/withdraw-workload-enforcement.ts --state-dir <isolated-stopped-state> --confirm-quiesced --inspect | --state-dir <isolated-stopped-state> --plan <withdrawal.json> --confirm-quiesced [--dry-run]");
const state = resolve(args[1]);
const path = join(state, "may.db");
if (!lstatSync(state).isDirectory() || !lstatSync(path).isFile()) throw new Error("Withdrawal requires an existing ordinary Host database");
const db = openDatabase(path);
try {
  db.exec("PRAGMA busy_timeout = 1000");
  db.exec("PRAGMA foreign_keys = ON");
  if (inspect) {
    assertOfflineWorkloadFiles(db, state);
    console.log(JSON.stringify(stateTransaction(db, () => { assertOfflineWorkloadExecution(db); return inspectWorkloadConfiguration(db); })));
  } else {
    const body = readFileSync(resolve(args[3]!), "utf8");
    if (Buffer.byteLength(body) > 1024 * 1024) throw new Error("Withdrawal plan exceeds 1 MiB");
    console.log(JSON.stringify(withdrawWorkloadEnforcement(db, state, JSON.parse(body), { quiesced: true, dryRun: args.includes("--dry-run") })));
  }
} finally {
  db.close();
}
