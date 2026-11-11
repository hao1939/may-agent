#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverAppDefinitions } from "../../src/app/adapters/discovery/app-definitions.js";
import { convertStoppedTaskContracts } from "../../src/app/composition/task-contract-conversion.js";
import { AppRegistry } from "../../src/app/core/apps/registry.js";
import { openDatabase } from "../../src/lib/db.js";
import { stateTransaction } from "../../src/lib/db/transaction.js";

const args = process.argv.slice(2);
const options = new Map<string, string | true>();
for (let index = 0; index < args.length; index++) {
  const flag = args[index]!;
  if (options.has(flag)) throw new Error(`Repeated conversion argument: ${flag}`);
  if (flag === "--state-dir" || flag === "--projects-root") {
    const value = args[++index];
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a path`);
    options.set(flag, value);
  } else if (flag === "--apply" || flag === "--confirm-quiesced") options.set(flag, true);
  else throw new Error(`Unknown conversion argument: ${flag}`);
}
const state = options.get("--state-dir");
const projects = options.get("--projects-root");
if (typeof state !== "string" || typeof projects !== "string" || !options.has("--confirm-quiesced"))
  throw new Error(
    "Usage: bun scripts/operations/convert-task-contracts.ts --state-dir <stopped-state> --projects-root <new-app-source> --confirm-quiesced [--apply]. Back up the state first. Defaults to dry run.",
  );
const persistDir = resolve(state);
const database = join(persistDir, "may.db");
if (!existsSync(database)) throw new Error(`Missing database: ${database}`);
const registry = new AppRegistry(discoverAppDefinitions(resolve(projects)));
await registry.reload();
const db = openDatabase(database);
const dryRun = Symbol("dry-run");
let result;
try {
  db.exec("PRAGMA busy_timeout = 1000");
  db.exec("PRAGMA foreign_keys = ON");
  try {
    stateTransaction(db, () => {
      result = convertStoppedTaskContracts({
        db,
        persistDir,
        apps: registry.entries().map(({ definition }) => definition),
      });
      if (!options.has("--apply")) throw dryRun;
    });
  } catch (error) {
    if (error !== dryRun) throw error;
  }
  console.log(JSON.stringify({ applied: options.has("--apply"), ...result }, null, 2));
} finally {
  db.close();
}
