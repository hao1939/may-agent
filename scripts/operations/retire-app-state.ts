#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../../src/lib/db.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import { appTaskContext } from "../../src/app/core/tasks/app-task-reconciler.js";
import { retireAppState, type RetiredAppRetirementPlan } from "../../src/app/core/state/retired-app-retirement.js";

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const state = value("--state-dir");
const file = value("--plan");
if (!state || !file || !args.includes("--confirm-quiesced") || !args.includes("--confirm-app-retired"))
  throw new Error(
    "Usage: bun scripts/operations/retire-app-state.ts --state-dir <stopped-state> --plan <plan.json> --confirm-quiesced --confirm-app-retired [--dry-run]",
  );
const known = new Set([
  "--state-dir",
  state,
  "--plan",
  file,
  "--confirm-quiesced",
  "--confirm-app-retired",
  "--dry-run",
]);
if (args.some((arg) => !known.has(arg))) throw new Error("Unknown retirement argument");
const path = join(resolve(state), "may.db");
if (!existsSync(path)) throw new Error("Host database does not exist");
const plan = JSON.parse(readFileSync(resolve(file), "utf8")) as RetiredAppRetirementPlan;
const db = openDatabase(path);
try {
  db.exec("PRAGMA busy_timeout = 1000");
  db.exec("PRAGMA foreign_keys = ON");
  const store = AppTaskResourceStore.activeFromDb(db, plan.appId);
  if (!store) throw new Error("Retired App has no Task resource state");
  const context = appTaskContext({
    appDir: resolve(state),
    projectDir: resolve(state),
    agent: plan.appId,
    maxConcurrent: 1,
    resourceStore: store,
  });
  console.log(JSON.stringify(retireAppState(context, plan, { dryRun: args.includes("--dry-run") }), null, 2));
} finally {
  db.close();
}
