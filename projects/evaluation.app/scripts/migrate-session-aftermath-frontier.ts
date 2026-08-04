import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  migrateTaskState,
  projectRuntimePaths,
  setProjectLifecycle,
  type TaskStateConfig,
  type TaskTree,
} from "@may-agent/sdk";

export const legacySessionTaskPrefix = "runtime/session-aftermath/";

export type SessionAftermathMigrationStats = {
  resourcesRemoved: number;
  triggersRemoved: number;
  attemptsRemoved: number;
  receiptsRemoved: number;
  conditionsRemoved: number;
  structuralParentsRepaired: number;
};

const structuralParentIds = ["evaluator-reliability", "pipeline-health"];

export function migrateSessionAftermathFrontier(
  tree: TaskTree,
  options: { retireLegacySessionTasks?: boolean } = {},
): SessionAftermathMigrationStats {
  const retireLegacySessionTasks =
    options.retireLegacySessionTasks === undefined
      ? true
      : options.retireLegacySessionTasks;
  const legacyTaskIds = new Set(
    retireLegacySessionTasks
      ? [
          ...Object.keys(tree.resources ?? {}),
          ...Object.keys(tree.taskTriggers ?? {}),
          ...Object.values(tree.attempts ?? {}).map(
            (attempt) => attempt.taskId,
          ),
          ...Object.keys(tree.receipts ?? {}),
        ].filter((id) => id.startsWith(legacySessionTaskPrefix))
      : [],
  );
  const remainingDependencies = Object.values(tree.resources ?? {}).flatMap(
    (resource) =>
      (resource.spec.dependsOn ?? []).filter((id) => legacyTaskIds.has(id)),
  );
  if (remainingDependencies.length > 0) {
    throw new Error(
      `Cannot retire legacy aftermath tasks still used as dependencies: ${[
        ...new Set(remainingDependencies),
      ].join(", ")}`,
    );
  }

  const stats: SessionAftermathMigrationStats = {
    resourcesRemoved: 0,
    triggersRemoved: 0,
    attemptsRemoved: 0,
    receiptsRemoved: 0,
    conditionsRemoved: 0,
    structuralParentsRepaired: 0,
  };

  const removedConditionIds = new Set(
    Object.entries(tree.resources ?? {}).flatMap(([taskId, resource]) =>
      taskId.startsWith(legacySessionTaskPrefix) ||
      structuralParentIds.includes(taskId)
        ? (resource.status.conditionIds ?? [])
        : [],
    ),
  );
  for (const taskId of structuralParentIds) {
    const resource = tree.resources?.[taskId];
    if (!resource) continue;
    if (!tree.groups?.[taskId]) {
      throw new Error(
        `Cannot retire structural parent ${taskId}: group missing`,
      );
    }
    if (resource.status.currentAttemptId) {
      throw new Error(
        `Cannot retire structural parent ${taskId}: attempt still running`,
      );
    }
    delete tree.resources?.[taskId];
    delete tree.taskTriggers?.[taskId];
    for (const [attemptId, attempt] of Object.entries(tree.attempts ?? {})) {
      if (attempt.taskId !== taskId) continue;
      delete tree.attempts?.[attemptId];
      stats.attemptsRemoved += 1;
    }
    if (tree.receipts?.[taskId]) {
      delete tree.receipts[taskId];
      stats.receiptsRemoved += 1;
    }
    stats.structuralParentsRepaired += 1;
  }
  tree.active_task_ids = (tree.active_task_ids ?? []).filter(
    (taskId) => !structuralParentIds.includes(taskId),
  );
  if (
    tree.active_task_id &&
    structuralParentIds.includes(tree.active_task_id)
  ) {
    tree.active_task_id = null;
  }
  for (const taskId of legacyTaskIds) {
    if (!tree.resources?.[taskId]) continue;
    delete tree.resources?.[taskId];
    stats.resourcesRemoved += 1;
  }
  for (const taskId of Object.keys(tree.taskTriggers ?? {})) {
    if (!legacyTaskIds.has(taskId)) continue;
    delete tree.taskTriggers?.[taskId];
    stats.triggersRemoved += 1;
  }
  for (const [attemptId, attempt] of Object.entries(tree.attempts ?? {})) {
    if (!legacyTaskIds.has(attempt.taskId)) continue;
    delete tree.attempts?.[attemptId];
    stats.attemptsRemoved += 1;
  }
  for (const taskId of Object.keys(tree.receipts ?? {})) {
    if (!legacyTaskIds.has(taskId)) continue;
    delete tree.receipts?.[taskId];
    stats.receiptsRemoved += 1;
  }

  const usedConditionIds = new Set(
    Object.values(tree.resources ?? {}).flatMap(
      (resource) => resource.status.conditionIds ?? [],
    ),
  );
  for (const conditionId of removedConditionIds) {
    if (usedConditionIds.has(conditionId)) continue;
    if (!tree.conditions?.[conditionId]) continue;
    delete tree.conditions?.[conditionId];
    stats.conditionsRemoved += 1;
  }

  return stats;
}

function argumentValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

function migrationConfig(): TaskStateConfig {
  const appDir = resolve(import.meta.dirname, "..");
  const paths = projectRuntimePaths(appDir);
  return {
    appDir,
    projectDir: appDir,
    statePath: paths.taskStatePath,
    journalPath: paths.journalPath,
    worker: "session-aftermath-frontier-migration",
    maxConcurrent: 5,
  };
}

if (import.meta.main) {
  const config = migrationConfig();
  const pause = process.argv.includes("--pause");
  const resume = process.argv.includes("--resume");
  const apply = process.argv.includes("--apply");
  const structuralOnly = process.argv.includes("--structural-only");
  if ([pause, resume, apply].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --pause, --resume, or --apply");
  }
  if (pause || resume) {
    const lifecycle = pause ? "paused" : "active";
    setProjectLifecycle(
      config,
      lifecycle,
      `session aftermath frontier migration ${pause ? "pause" : "resume"}`,
    );
    console.log(JSON.stringify({ lifecycle }, null, 2));
    process.exit(0);
  }

  const expectedRevision = argumentValue("--expected-revision");
  if (apply && !expectedRevision) {
    throw new Error("--apply requires --expected-revision=<dry-run revision>");
  }
  const currentRevision = createHash("sha256")
    .update(readFileSync(config.statePath))
    .digest("hex");
  let stats: SessionAftermathMigrationStats | undefined;
  const result = migrateTaskState(config, {
    expectedRevision: expectedRevision ?? currentRevision,
    dryRun: !apply,
    allowShrinkage: true,
    migrate: (tree) => {
      stats = migrateSessionAftermathFrontier(tree, {
        retireLegacySessionTasks: !structuralOnly,
      });
    },
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        ...result,
        stats,
        scope: structuralOnly ? "structural-parents" : "legacy-and-structural",
        disposition:
          "The evaluation database and session eval trails remain the audit history; the standing aftermath frontier will rediscover any terminal session without an evaluation.",
      },
      null,
      2,
    ),
  );
}
