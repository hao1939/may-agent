import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDb } from "../../lib/db.js";
import { stateTransaction } from "../../lib/db/transaction.js";
import { readSessionMetaRecoveryEvidence } from "../../lib/persistence.js";
import { hasLiveSessionExecution } from "../../lib/session-cleanup.js";
import { AppTaskResourceStore } from "../core/state/app-task-resource-store.js";
import { TaskBudgetAdmissionStore } from "../core/state/task-budget-admission.js";
import { adoptTaskBudget } from "../core/state/task-budget-funding.js";
import type { BudgetRoot, BudgetTaskRef } from "../core/state/task-budget-store.js";
import { TaskExecutionStore } from "../core/state/task-execution-store.js";
import { validateWorkloadStateInitialization, type WorkloadStateInitialization } from "./initialize-workload-state.js";

export type RetainedWorkloadInstallation = {
  version: 1;
  policy: WorkloadStateInitialization;
  adoptions: ReadonlyArray<{
    task: BudgetTaskRef;
    generation: number;
    resourceVersion: number;
    root: BudgetRoot;
    adoptionId: string;
    reason: string;
  }>;
};

function object(value: unknown, fields: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    throw new Error("Invalid retained workload installation declaration");
  return value as Record<string, unknown>;
}

function taskKey(value: unknown): string {
  const task = object(value, ["appId", "taskId"]);
  if (
    [task.appId, task.taskId].some(
      (part) => typeof part !== "string" || !part || part !== part.trim() || Buffer.byteLength(part) > 1024,
    )
  )
    throw new Error("Retained adoption requires exact Task identities");
  return JSON.stringify([task.appId, task.taskId]);
}

function validate(input: unknown): RetainedWorkloadInstallation {
  const plan = object(input, ["version", "policy", "adoptions"]);
  if (plan.version !== 1 || !Array.isArray(plan.adoptions) || plan.adoptions.length > 4096)
    throw new Error("Retained workload installation requires bounded explicit adoptions");
  const policy = validateWorkloadStateInitialization(plan.policy);
  const rootLimits = new Set(
    policy.limits.flatMap((limit) => (limit.scope.kind === "root" ? [taskKey(limit.scope.root)] : [])),
  );
  const tasks = new Set<string>();
  for (const value of plan.adoptions) {
    const adoption = object(value, ["task", "generation", "resourceVersion", "root", "adoptionId", "reason"]);
    const key = taskKey(adoption.task);
    if (tasks.has(key)) throw new Error("Repeated retained Task adoption");
    tasks.add(key);
    if (
      [adoption.generation, adoption.resourceVersion].some(
        (value) => !Number.isSafeInteger(value) || (value as number) < 1,
      )
    )
      throw new Error("Retained adoption requires exact resource fences");
    const root = object(adoption.root, ["root", "sponsor", "purpose", "credits", "renewal"]);
    object(root.sponsor, ["appId", "agent"]);
    if (!rootLimits.has(taskKey(root.root)))
      throw new Error("Every adopted historical root requires an explicit execution limit");
  }
  for (const value of plan.adoptions) {
    if (!tasks.has(taskKey(value.root.root))) throw new Error("Every retained root requires its own fenced adoption");
  }
  return input as RetainedWorkloadInstallation;
}

/** Conservative evidence checks, NOT a start barrier. The operator must first
 * isolate state from every launcher/runtime/worker. Retained artifacts cannot
 * discover a start which has not written its first evidence yet. Never use
 * these checks to justify online activation or to perform implicit cleanup. */
function assertRetainedSessionsClean(stateDir: string): void {
  const sessions = join(stateDir, "sessions");
  if (!existsSync(sessions)) return;
  if (!lstatSync(sessions).isDirectory()) throw new Error("Session state requires explicit recovery");
  for (const entry of readdirSync(sessions, { withFileTypes: true })) {
    if (!entry.isDirectory()) throw new Error("Unknown session artifact requires explicit recovery");
    const directory = join(sessions, entry.name);
    // Even malformed/empty group evidence must not collapse into an empty set.
    if (["[ACTIVE]", "[STARTED]", "bash-process-groups.json"].some((name) => existsSync(join(directory, name))))
      throw new Error("Retained execution markers or descendants require confirmed cleanup");
    const evidence = readSessionMetaRecoveryEvidence(stateDir, entry.name);
    if (
      evidence.state !== "valid" ||
      evidence.meta.status === "running" ||
      hasLiveSessionExecution({ persistDir: stateDir, manager: { hasActiveSession: () => false } }, entry.name)
    )
      throw new Error("Retained session execution requires confirmed cleanup");
  }
}

/** Offline installation only. `quiesced` records an external operating contract;
 * it is not evidence that the caller has stopped or excluded other processes.
 * All previous execution must be cleaned through ordinary recovery first.
 * No history is charged, no Task is closed, no live reservation is adopted or
 * released. Existing adoption and policy stores remain the only authorities. */
export function installRetainedWorkloadState(
  db: SqliteDb,
  stateDir: string,
  input: unknown,
  options: { quiesced: true; dryRun?: boolean },
): { kind: "installed" | "dry-run"; appCount: number; adoptionCount: number } {
  if (options.quiesced !== true) throw new Error("Retained installation requires externally isolated, quiesced state");
  const plan = validate(input);
  const file = db
    .prepare("PRAGMA database_list")
    .all()
    .find((row) => row.name === "main")?.file;
  if (typeof file !== "string" || !file || realpathSync(file) !== realpathSync(join(stateDir, "may.db")))
    throw new Error("Retained installation requires the exact database and session state directory");
  assertRetainedSessionsClean(stateDir);
  const result = {
    kind: options.dryRun ? ("dry-run" as const) : ("installed" as const),
    appCount: plan.policy.apps.length,
    adoptionCount: plan.adoptions.length,
  };
  const dryRun = Symbol("rollback retained installation validation");
  try {
    return stateTransaction(db, () => {
      if (db.prepare("SELECT 1 FROM task_execution_reservations WHERE released_at IS NULL LIMIT 1").get())
        throw new Error("Retained execution reservations require confirmed cleanup before offline installation");
      // Include ended business Tasks. A terminal business outcome is not exit.
      if (db.prepare("SELECT 1 FROM app_task_attempts WHERE state = 'running' LIMIT 1").get())
        throw new Error("Retained running attempts require ordinary recovery before offline installation");
      for (const adoption of plan.adoptions) {
        const resource = AppTaskResourceStore.inspectFromDb(db, adoption.task.appId).readTask(adoption.task.taskId);
        if (
          !resource ||
          resource.metadata.generation !== adoption.generation ||
          resource.metadata.resourceVersion !== adoption.resourceVersion
        )
          throw new Error("Retained adoption lost its exact resource fence");
      }
      const admission = new TaskBudgetAdmissionStore(db);
      const execution = new TaskExecutionStore(db);
      for (const app of plan.policy.apps) admission.install(app);
      for (const limit of plan.policy.limits) execution.installLimit(limit.scope, limit.slots);
      for (const adoption of plan.adoptions) {
        const policy = admission.policy(adoption.root.sponsor.appId);
        if (!policy || policy.sponsor.agent !== adoption.root.sponsor.agent)
          throw new Error("Retained sponsorship requires its exact installed policy");
        adoptTaskBudget(db, adoption);
        if (adoption.root.purpose === "coordination") {
          const resource = AppTaskResourceStore.inspectFromDb(db, adoption.task.appId).readTask(adoption.task.taskId)!;
          admission.assertProtectedTask(
            adoption.task,
            resource,
            resource.spec.agent ??
              resource.spec.owner ??
              admission.policy(adoption.task.appId)?.coordination?.agent ??
              "",
          );
        } else if (admission.policy(adoption.task.appId)?.coordination?.taskId === adoption.task.taskId) {
          throw new Error("Installed coordination requires its protected attribution");
        }
      }
      execution.installLimit({ kind: "host" }, plan.policy.host.slots, {
        backgroundSlots: plan.policy.host.backgroundSlots,
      });
      if (options.dryRun) throw dryRun;
      return result;
    });
  } catch (error) {
    if (error === dryRun) return result;
    throw error;
  }
}
