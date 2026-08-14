import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  migrateTaskState,
  projectRuntimePaths,
  type TaskNode,
  type TaskStateConfig,
  type TaskTree,
} from "@may-agent/sdk/legacy";

type MigrationManifest = {
  version: 1;
  reviewedAt: string;
  baselineSha256: string;
  groups: Record<string, { parentId: string | null; owner: string }>;
  rename: { from: string; to: string };
  placements: Record<string, string[]>;
  clearControllerWaits: string[];
  removeResources: string[];
  removalDisposition: string;
};

function unique(values: string[], label: string): Set<string> {
  const result = new Set(values);
  if (result.size !== values.length)
    throw new Error(`${label} contains duplicate task IDs`);
  return result;
}

function setParent(tree: TaskTree, taskId: string, parentId: string): void {
  const resource = tree.resources?.[taskId];
  if (!resource) throw new Error(`Placement references missing task ${taskId}`);
  if (resource.spec.parentId === parentId) return;
  resource.spec.parentId = parentId;
  resource.metadata.resourceVersion += 1;
}

function clearControllerWait(tree: TaskTree, taskId: string): void {
  const resource = tree.resources?.[taskId];
  if (!resource)
    throw new Error(`Controller disposition references missing task ${taskId}`);
  const conditionIds = resource.status.conditionIds ?? [];
  const changed =
    resource.status.phase !== "converged" || conditionIds.length > 0;
  if (!changed) return;
  resource.status = {
    ...resource.status,
    phase: "converged",
    observedGeneration: resource.metadata.generation,
    currentAttemptId: undefined,
    conditionIds: [],
    summary:
      "Controller work is represented by sibling leaves; waiting fan-out was removed by task-graph migration v1.",
    updatedAt: new Date().toISOString(),
  };
  resource.metadata.resourceVersion += 1;
}

export function applyTaskGraphMigration(
  tree: TaskTree,
  manifest: MigrationManifest,
): void {
  if (manifest.version !== 1)
    throw new Error(
      `Unsupported migration manifest version ${manifest.version}`,
    );
  const removals = unique(manifest.removeResources, "removeResources");
  const placementEntries = Object.entries(manifest.placements);
  const placed = unique(
    placementEntries.flatMap(([, ids]) => ids),
    "placements",
  );
  for (const taskId of removals) {
    if (placed.has(taskId))
      throw new Error(`Task ${taskId} is both removed and placed`);
  }

  tree.root_task_id = "project";
  tree.groups = Object.fromEntries(
    Object.entries(manifest.groups).map(([id, group]) => [
      id,
      {
        id,
        parent_id: group.parentId,
        owner: group.owner,
      } satisfies TaskNode,
    ]),
  );

  for (const taskId of removals) {
    delete tree.resources?.[taskId];
    delete tree.taskTriggers?.[taskId];
  }

  const { from, to } = manifest.rename;
  const oldController = tree.resources?.[from];
  const newController = tree.resources?.[to];
  if (oldController && newController)
    throw new Error(
      `Both old and new controller identities exist: ${from}, ${to}`,
    );
  if (oldController) {
    oldController.metadata.id = to;
    oldController.metadata.resourceVersion += 1;
    tree.resources![to] = oldController;
    delete tree.resources![from];
    delete tree.taskTriggers?.[from];
  } else if (!newController) {
    throw new Error(
      `Neither old nor new controller identity exists: ${from}, ${to}`,
    );
  }

  for (const [parentId, taskIds] of placementEntries) {
    if (!tree.groups[parentId])
      throw new Error(`Placement references missing group ${parentId}`);
    for (const taskId of taskIds) setParent(tree, taskId, parentId);
  }
  for (const taskId of manifest.clearControllerWaits) {
    clearControllerWait(tree, taskId);
    delete tree.taskTriggers?.[taskId];
  }

  const remaining = Object.keys(tree.resources ?? {}).sort();
  const expected = [...placed].sort();
  if (JSON.stringify(remaining) !== JSON.stringify(expected)) {
    const unexpected = remaining.filter((id) => !placed.has(id));
    const missing = expected.filter((id) => !tree.resources?.[id]);
    throw new Error(
      `Manifest does not exactly cover the resulting live graph; unexpected=${unexpected.join(",") || "none"}; missing=${missing.join(",") || "none"}`,
    );
  }

  const linkedConditions = new Set(
    Object.values(tree.resources ?? {}).flatMap(
      (resource) => resource.status.conditionIds ?? [],
    ),
  );
  for (const conditionId of Object.keys(tree.conditions ?? {})) {
    if (!linkedConditions.has(conditionId))
      delete tree.conditions?.[conditionId];
  }
}

function argumentValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

if (import.meta.main) {
  const appDir = resolve(import.meta.dirname, "..");
  const projectDir = resolve(appDir, "../aks-rp-e2e");
  const manifestPath = resolve(appDir, "tasks/task-graph-migration-v1.json");
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as MigrationManifest;
  const apply = process.argv.includes("--apply");
  const expectedRevision =
    argumentValue("--expected-revision") ?? manifest.baselineSha256;
  const paths = projectRuntimePaths(appDir);
  const config: TaskStateConfig = {
    appDir,
    projectDir,
    statePath: paths.taskStatePath,
    journalPath: paths.journalPath,
    worker: "task-graph-migration-v1",
    maxConcurrent: 8,
  };
  const result = migrateTaskState(config, {
    expectedRevision,
    dryRun: !apply,
    allowShrinkage: true,
    migrate: (tree) => applyTaskGraphMigration(tree, manifest),
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        manifest: manifestPath,
        reviewedAt: manifest.reviewedAt,
        removalDisposition: manifest.removalDisposition,
        ...result,
      },
      null,
      2,
    ),
  );
}
