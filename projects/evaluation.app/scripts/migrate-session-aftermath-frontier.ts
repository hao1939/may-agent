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
};

export function migrateSessionAftermathFrontier(
  tree: TaskTree,
): SessionAftermathMigrationStats {
  const legacyTaskIds = new Set(
    [
      ...Object.keys(tree.resources ?? {}),
      ...Object.keys(tree.taskTriggers ?? {}),
      ...Object.values(tree.attempts ?? {}).map((attempt) => attempt.taskId),
      ...Object.keys(tree.receipts ?? {}),
    ].filter((id) => id.startsWith(legacySessionTaskPrefix)),
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
  };

  const removedConditionIds = new Set(
    Object.entries(tree.resources ?? {}).flatMap(([taskId, resource]) =>
      taskId.startsWith(legacySessionTaskPrefix)
        ? (resource.status.conditionIds ?? [])
        : [],
    ),
  );
  for (const taskId of legacyTaskIds) {
    if (!tree.resources?.[taskId]) continue;
    delete tree.resources?.[taskId];
    stats.resourcesRemoved += 1;
  }
  for (const taskId of Object.keys(tree.taskTriggers ?? {})) {
    if (!taskId.startsWith(legacySessionTaskPrefix)) continue;
    delete tree.taskTriggers?.[taskId];
    stats.triggersRemoved += 1;
  }
  for (const [attemptId, attempt] of Object.entries(tree.attempts ?? {})) {
    if (!attempt.taskId.startsWith(legacySessionTaskPrefix)) continue;
    delete tree.attempts?.[attemptId];
    stats.attemptsRemoved += 1;
  }
  for (const taskId of Object.keys(tree.receipts ?? {})) {
    if (!taskId.startsWith(legacySessionTaskPrefix)) continue;
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
      stats = migrateSessionAftermathFrontier(tree);
    },
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        ...result,
        stats,
        disposition:
          "The evaluation database and session eval trails remain the audit history; the standing aftermath frontier will rediscover any terminal session without an evaluation.",
      },
      null,
      2,
    ),
  );
}
