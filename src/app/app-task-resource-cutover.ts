import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { getDb } from "../lib/requests.js";
import { AppTaskResourceStore, importPausedTaskStateToResourceStore } from "./app-task-resource-store.js";
import { readTaskState, setProjectLifecycle, type TaskStateConfig } from "./app-task-store.js";

export type TaskResourceCutoverInspection = {
  appId: string;
  sourceRevision: string;
  lifecycle: string | null;
  taskCount: number;
  runningAttemptIds: string[];
  resourceAuthority: "none" | "shadow" | "resources";
};

function sourceRevision(config: TaskStateConfig): string {
  return createHash("sha256").update(readFileSync(config.statePath)).digest("hex");
}

function appIdForCutover(config: TaskStateConfig, project: string | undefined): string {
  const appId = (project?.trim() || basename(config.appDir)).replace(/\.app$/, "");
  if (!appId) throw new Error("Task resource cutover cannot determine the App id");
  return appId;
}

/** Read-only cutover preflight. It never creates resource rows. */
export function inspectTaskResourceCutover(
  config: TaskStateConfig,
  persistDir: string,
): TaskResourceCutoverInspection {
  const tree = readTaskState(config);
  const appId = appIdForCutover(config, tree.project);
  const db = getDb(persistDir);
  const authority = db
    .prepare("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'")
    .get(appId) as { value?: unknown } | null;
  const resourceAuthority =
    authority?.value === "resources" ? "resources" : authority?.value === "shadow" ? "shadow" : "none";
  if (resourceAuthority === "resources") {
    const store = AppTaskResourceStore.activeFromDb(db, appId);
    if (!store) throw new Error(`Task resource authority for ${appId} is inconsistent`);
    const taskCount = db.prepare("SELECT COUNT(*) AS count FROM app_tasks WHERE app_id = ?").get(appId) as {
      count: number;
    };
    const runningAttempts = db
      .prepare(
        "SELECT attempt_id FROM app_task_attempts WHERE app_id = ? AND state = 'running' ORDER BY attempt_id",
      )
      .all(appId) as Array<{ attempt_id: string }>;
    return {
      appId,
      sourceRevision: store.sourceRevision() ?? sourceRevision(config),
      lifecycle: store.projectLifecycle(),
      taskCount: taskCount.count,
      runningAttemptIds: runningAttempts.map((attempt) => attempt.attempt_id),
      resourceAuthority,
    };
  }
  return {
    appId,
    sourceRevision: sourceRevision(config),
    lifecycle: typeof tree.project_lifecycle === "string" ? tree.project_lifecycle : null,
    taskCount: Object.keys(tree.resources ?? {}).length,
    runningAttemptIds: Object.values(tree.attempts ?? {})
      .filter((attempt) => attempt.state === "running")
      .map((attempt) => attempt.metadata.id)
      .sort(),
    resourceAuthority,
  };
}

/** Phase one: stop new claims. The operator still waits for drain before stopping the daemon. */
export function pauseTaskResourceCutover(
  config: TaskStateConfig,
  persistDir: string,
  reason: string,
): TaskResourceCutoverInspection {
  if (config.resourceStore) throw new Error("Task resource cutover source is already resource-backed");
  const before = inspectTaskResourceCutover(config, persistDir);
  if (before.resourceAuthority === "resources") {
    throw new Error(`Task resource authority for ${before.appId} is already active`);
  }
  setProjectLifecycle(config, "paused", reason);
  return inspectTaskResourceCutover(config, persistDir);
}

/**
 * Offline cutover. The explicit daemonStopped assertion is intentionally not
 * auto-detected: process discovery is not a safe authority boundary.
 */
export function activateTaskResourceCutover(input: {
  config: TaskStateConfig;
  persistDir: string;
  expectedSourceRevision: string;
  daemonStopped: true;
  resume?: boolean;
}): TaskResourceCutoverInspection {
  if (input.daemonStopped !== true) throw new Error("Task resource activation requires daemonStopped=true");
  const before = inspectTaskResourceCutover(input.config, input.persistDir);
  if (before.resourceAuthority === "resources") {
    throw new Error(`Task resource authority for ${before.appId} is already active`);
  }
  if (before.lifecycle !== "paused") throw new Error("Task resource activation requires a paused source App");
  if (before.runningAttemptIds.length > 0) {
    throw new Error(`Task resource activation requires drained attempts: ${before.runningAttemptIds.join(", ")}`);
  }
  const imported = importPausedTaskStateToResourceStore(input.config, input.persistDir, [], {
    activate: true,
    expectedSourceRevision: input.expectedSourceRevision,
  });
  const store = AppTaskResourceStore.activeFromDb(getDb(input.persistDir), imported.appId);
  if (!store) throw new Error(`Task resource activation for ${imported.appId} did not publish authority`);
  if (input.resume) store.setProjectLifecycle("active");
  return {
    ...before,
    sourceRevision: imported.sourceRevision,
    lifecycle: store.projectLifecycle(),
    resourceAuthority: "resources",
  };
}
