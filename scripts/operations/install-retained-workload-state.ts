#!/usr/bin/env bun
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../../src/lib/db.js";
import { installRetainedWorkloadState } from "../../src/app/composition/install-retained-workload-state.js";

const args = process.argv.slice(2);
if (
  (args.length !== 5 && args.length !== 6) ||
  args[0] !== "--state-dir" ||
  !args[1] ||
  args[2] !== "--plan" ||
  !args[3] ||
  args[4] !== "--confirm-quiesced" ||
  (args.length === 6 && args[5] !== "--dry-run")
)
  throw new Error(
    "Usage: bun scripts/operations/install-retained-workload-state.ts --state-dir <isolated-stopped-state> --plan <installation.json> --confirm-quiesced [--dry-run]",
  );
const state = resolve(args[1]);
const path = join(state, "may.db");
if (!lstatSync(state).isDirectory() || !lstatSync(path).isFile())
  throw new Error("Retained installation requires an existing ordinary Host database");
const body = readFileSync(resolve(args[3]), "utf8");
if (Buffer.byteLength(body) > 1024 * 1024) throw new Error("Retained installation plan exceeds 1 MiB");
const plan: unknown = JSON.parse(body);
const db = openDatabase(path);
try {
  db.exec("PRAGMA busy_timeout = 1000");
  db.exec("PRAGMA foreign_keys = ON");
  console.log(
    JSON.stringify(
      installRetainedWorkloadState(db, state, plan, { quiesced: true, dryRun: args.includes("--dry-run") }),
    ),
  );
} finally {
  db.close();
}
