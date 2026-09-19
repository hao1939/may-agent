#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { openDatabase } from "../../src/lib/db.js";
import { AppTaskResourceStore } from "../../src/app/core/state/app-task-resource-store.js";
import {
  recoverMalformedConversationInput,
  type MalformedConversationInputRecoveryPlan,
} from "../../src/app/core/state/malformed-conversation-input-recovery.js";
import { appTaskContext } from "../../src/app/core/tasks/app-task-reconciler.js";

function usage(): never {
  throw new Error(
    "Usage: bun scripts/operations/recover-malformed-conversation-input.ts " +
      "--state-dir <stopped-host-state-dir> --plan <plan.json> --confirm-quiesced [--dry-run]",
  );
}

const args = process.argv.slice(2);
const value = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const stateArg = value("--state-dir");
const planArg = value("--plan");
if (!stateArg || !planArg || !args.includes("--confirm-quiesced")) usage();
const known = new Set(["--state-dir", stateArg, "--plan", planArg, "--confirm-quiesced", "--dry-run"]);
if (args.some((arg) => !known.has(arg))) usage();

const stateDir = resolve(stateArg);
const databasePath = join(stateDir, "may.db");
const planPath = resolve(planArg);
if (!existsSync(databasePath)) throw new Error(`Host database does not exist: ${databasePath}`);
if (!existsSync(planPath)) throw new Error(`Recovery plan does not exist: ${planPath}`);
const plan = JSON.parse(readFileSync(planPath, "utf8")) as MalformedConversationInputRecoveryPlan;
if (plan.quiesced !== true) throw new Error("Plan must record quiesced=true");

const db = openDatabase(databasePath);
try {
  db.exec("PRAGMA busy_timeout = 1000");
  db.exec("PRAGMA foreign_keys = ON");
  const store = AppTaskResourceStore.activeFromDb(db, plan.malformed.appId);
  if (!store) throw new Error(`App ${plan.malformed.appId} does not use active Task resource state`);
  const task = store.readTask(plan.malformed.taskId);
  const agent = task?.spec.agent?.trim() || plan.malformed.appId;
  const context = appTaskContext({
    appDir: stateDir,
    projectDir: stateDir,
    agent,
    maxConcurrent: 1,
    resourceStore: store,
  });
  const result = recoverMalformedConversationInput(context, plan, {
    dryRun: args.includes("--dry-run"),
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  db.close();
}
