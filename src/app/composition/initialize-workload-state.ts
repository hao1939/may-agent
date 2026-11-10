import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  rmdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { openDatabase } from "../../lib/db.js";
import { applyDbSchema } from "../../lib/db/schema.js";
import { stateTransaction } from "../../lib/db/transaction.js";
import { TaskBudgetAdmissionStore, type InstalledTaskBudgetPolicy } from "../core/state/task-budget-admission.js";
import { TaskExecutionStore, type ExecutionScope } from "../core/state/task-execution-store.js";

/** Installation input only. These declarations grant no App/Task capability. */
export type WorkloadStateInitialization = {
  version: 1;
  host: { slots: number; backgroundSlots: number };
  apps: ReadonlyArray<InstalledTaskBudgetPolicy & { rootExecutionSlots: number }>;
  limits: ReadonlyArray<{ scope: Exclude<ExecutionScope, { kind: "host" }>; slots: number }>;
};

function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    throw new Error("Invalid workload initialization declaration");
  return value as Record<string, unknown>;
}

/** Shared validation for trusted fresh and offline-retained installation plans. */
export function validateWorkloadStateInitialization(input: unknown): WorkloadStateInitialization {
  const plan = object(input, ["version", "host", "apps", "limits"]);
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.apps) ||
    !plan.apps.length ||
    plan.apps.length > 128 ||
    !Array.isArray(plan.limits) ||
    !plan.limits.length ||
    plan.limits.length > 256
  )
    throw new Error("Workload initialization requires bounded App and execution declarations");
  const host = object(plan.host, ["slots", "backgroundSlots"]);
  if (!Number.isSafeInteger(host.backgroundSlots) || (host.backgroundSlots as number) < 1)
    throw new Error("Workload initialization requires an explicit positive background sublimit");
  const apps = new Set<string>();
  for (const value of plan.apps) {
    const app = object(value, [
      "appId",
      "sponsor",
      "dailyCredits",
      "rootCredits",
      "rootExecutionSlots",
      "standing",
      "coordination",
    ]);
    if (
      typeof app.appId !== "string" ||
      apps.has(app.appId) ||
      !Number.isSafeInteger(app.rootExecutionSlots) ||
      (app.rootExecutionSlots as number) < 1
    )
      throw new Error("Workload initialization requires unique Apps and explicit root execution defaults");
    apps.add(app.appId);
    object(app.sponsor, ["appId", "agent"]);
    if (app.coordination !== undefined)
      object(app.coordination, ["taskId", "workflow", "agent", "maxAttemptMs", "dailyCredits", "credits"]);
    if (app.standing !== undefined) {
      if (!Array.isArray(app.standing)) throw new Error("Invalid standing allowances");
      for (const standing of app.standing) object(standing, ["taskId", "credits"]);
    }
  }
  const scopes = new Set<string>();
  for (const value of plan.limits) {
    const limit = object(value, ["scope", "slots"]);
    const scope = object(limit.scope, ["kind", "recipient", "root"]);
    let key: string;
    if (scope.kind === "agent" && scope.root === undefined) {
      const recipient = object(scope.recipient, ["kind", "id"]);
      key = JSON.stringify(["agent", recipient.kind, recipient.id]);
    } else if (scope.kind === "root" && scope.recipient === undefined) {
      const root = object(scope.root, ["appId", "taskId"]);
      if (!apps.has(root.appId as string)) throw new Error("Root execution declarations require their App policy");
      key = JSON.stringify(["root", root.appId, root.taskId]);
    } else throw new Error("Only exact recipient and root execution limits belong in the limits list");
    if (scopes.has(key)) throw new Error("Repeated execution scope in workload initialization");
    scopes.add(key);
  }
  return input as WorkloadStateInitialization;
}

function sync(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Publish a complete, configured NEW database before any opener can execute.
 * Never accepts retained state or treats an empty Task census as quiescence.
 * A competing ordinary opener wins by creating may.db, or opens our complete
 * file; exclusive linking never replaces its database. No live cutover occurs. */
export function initializeWorkloadState(
  stateDir: string,
  input: unknown,
): {
  kind: "initialized";
  appCount: number;
  executionLimitCount: number;
} {
  const destination = resolve(stateDir);
  try {
    lstatSync(destination);
    throw new Error(
      "Workload initialization requires an absent state directory; retained state needs explicit adoption",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const plan = validateWorkloadStateInitialization(input);
  const stage = mkdtempSync(join(dirname(destination), ".may-workload-init-"));
  let created = false;
  let published = false;
  try {
    const candidate = join(stage, "may.db");
    const db = openDatabase(candidate);
    try {
      db.exec("PRAGMA journal_mode = DELETE");
      db.exec("PRAGMA foreign_keys = ON");
      applyDbSchema(db);
      stateTransaction(db, () => {
        const budgets = new TaskBudgetAdmissionStore(db);
        const executions = new TaskExecutionStore(db);
        for (const app of plan.apps) budgets.install(app);
        for (const limit of plan.limits) executions.installLimit(limit.scope, limit.slots);
        executions.installLimit({ kind: "host" }, plan.host.slots, { backgroundSlots: plan.host.backgroundSlots });
      });
    } finally {
      db.close();
    }
    if (["-wal", "-shm", "-journal"].some((suffix) => existsSync(candidate + suffix)))
      throw new Error("Workload initialization cannot publish SQLite recovery files");
    sync(candidate);
    mkdirSync(destination, { mode: 0o700 });
    created = true;
    linkSync(candidate, join(destination, "may.db"));
    published = true;
    sync(destination);
    sync(dirname(destination));
    return { kind: "initialized", appCount: plan.apps.length, executionLimitCount: plan.limits.length + 2 };
  } finally {
    rmSync(stage, { recursive: true, force: true });
    // Never remove another opener's state, even if it won during publication.
    if (created && !published) {
      try {
        rmdirSync(destination);
      } catch {
        /* a competing opener owns its files */
      }
    }
  }
}
