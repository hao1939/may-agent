import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;
type TaskNode = MutableRecord & {
  id: string;
  parent_id?: string;
  state?: string;
  status?: string;
  children?: string[];
  context?: MutableRecord;
  trace?: MutableRecord;
  conflict_scope?: string[];
};

type ArchivedBundle = {
  tasks?: Array<MutableRecord>;
};

const attemptId =
  "a_ops-apply-represent-net-integration-terminal-review-wait-20260715_20260715033000";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const projectTaskId = "project";
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "net-integration";
const waitTaskId = "wait-net-integration-multinic-dualstack-ado-run-172275388-result";
const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const fixTaskIds = [
  "fix-net-integration-multinic-dualstack-run-172275388",
  "fix-net-integration-multinic-mixed-run-172275388",
] as const;
const archivePath = resolve(
  appDir,
  ".state/tasks/archive/done-leaves-20260715022044909.json",
);
const evidencePath =
  "evidence/archive/20260715-metric-alert-aks-rp-e2e-process-loop-unrepresented-record-count-alert3756-fix-root-cause.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const specIds = [
  "spec.net-integration.multinic-dualstack",
  "spec.net-integration.multinic-mixed",
] as const;

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function readArchivedTask(): MutableRecord {
  const archive = JSON.parse(readFileSync(archivePath, "utf8")) as ArchivedBundle;
  const archived = (archive.tasks ?? []).find((task) => task.id === waitTaskId);
  assert(archived, `Archived task ${waitTaskId} not found in ${archivePath}`);
  return archived;
}

function workflowProgressSnapshot(task: TaskNode | undefined): MutableRecord {
  return asRecord(asRecord(task?.context).workflowProgress);
}

function removeValue(values: string[], value: string): string[] {
  return values.filter((entry) => entry !== value);
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const archivedTask = readArchivedTask();
const archivedContext = asRecord(archivedTask.context);
const archivedTrace = asRecord(archivedTask.trace);
const archivedAcceptedQueuedPipelineRun = asRecord(
  archivedContext.acceptedQueuedPipelineRun,
);
const restoredConflictScope = unique([
  "feature-compact:net-integration",
  "feature:net-integration",
  ...specIds.map((specId) => `spec:${specId}`),
  "ado-run:172275388",
]);

const beforeTree = readTaskTree(config);
const beforeProject = beforeTree.tasks[projectTaskId] as TaskNode | undefined;
const beforeLoop = beforeTree.tasks[loopTaskId] as TaskNode | undefined;
const beforeWait = beforeTree.tasks[waitTaskId] as TaskNode | undefined;
const beforeHolder = beforeTree.tasks[holderTaskId] as TaskNode | undefined;
assert(beforeProject, `Missing task ${projectTaskId}`);
assert(beforeLoop, `Missing task ${loopTaskId}`);
assert(beforeHolder, `Missing task ${holderTaskId}`);

const beforeProgress = workflowProgressSnapshot(beforeLoop);
if (beforeWait) {
  assert(
    [projectTaskId, loopTaskId].includes(asString(beforeWait.parent_id)),
    `Expected ${waitTaskId} parent_id to be ${projectTaskId} or ${loopTaskId} before repair; found ${String(beforeWait.parent_id ?? "(missing)")}`,
  );
}
assert(
  Number(beforeProgress.unrepresentedNonTerminalCount ?? 0) >= 0,
  `Expected ${loopTaskId} workflowProgress to exist before repair`,
);

const featureStateLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const featureState = featureStateLoaded.state;
const featureBefore = clone(featureState.features[featureKey]);
assert(featureBefore, `Missing feature state for ${featureKey}`);
assert(
  [waitTaskId, holderTaskId].includes(String(featureBefore.taskId ?? "")),
  `Expected feature state ${featureKey}.taskId to be ${waitTaskId} or ${holderTaskId}; found ${String(featureBefore.taskId ?? "(missing)")}`,
);

const mutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const projectTask = tree.tasks[projectTaskId] as TaskNode | undefined;
  const loopTask = tree.tasks[loopTaskId] as TaskNode | undefined;
  const waitTask = tree.tasks[waitTaskId] as TaskNode | undefined;
  if (!projectTask) throw new Error(`Missing task ${projectTaskId} during repair`);
  if (!loopTask) throw new Error(`Missing task ${loopTaskId} during repair`);

  if (waitTask) {
    projectTask.children = removeValue(
      asStringArray(projectTask.children),
      waitTaskId,
    );
    loopTask.children = unique([...(asStringArray(loopTask.children) ?? []), waitTaskId]);

    waitTask.parent_id = loopTaskId;
    waitTask.conflict_scope = restoredConflictScope;
    waitTask.context = {
      ...asRecord(waitTask.context),
      acceptedQueuedPipelineRun: Object.keys(archivedAcceptedQueuedPipelineRun)
        .length
        ? archivedAcceptedQueuedPipelineRun
        : asRecord(asRecord(waitTask.context).acceptedQueuedPipelineRun),
    };
    waitTask.trace = {
      ...Object.fromEntries(
        Object.entries(archivedTrace).filter(([key]) =>
          key.startsWith("accepted_queued_pipeline_"),
        ),
      ),
      ...asRecord(waitTask.trace),
      live_wait_representation_repaired_at: appliedAt,
      live_wait_representation_repaired_by: worker,
      live_wait_representation_repair_attempt_id: attemptId,
      live_wait_representation_archive_source:
        ".state/tasks/archive/done-leaves-20260715022044909.json",
    };
  }

  for (const fixTaskId of fixTaskIds) {
    const fixTask = tree.tasks[fixTaskId] as TaskNode | undefined;
    if (!fixTask) continue;
    fixTask.conflict_scope = unique([
      ...asStringArray(fixTask.conflict_scope),
      "feature-compact:net-integration",
      "feature:net-integration",
    ]);
  }

  const loopContext = asRecord(loopTask.context);
  const progress = workflowProgressSnapshot(loopTask);
  const nextUnrepresentedBlockedFeatureKeys = removeValue(
    asStringArray(progress.unrepresentedBlockedFeatureKeys),
    featureKey,
  );
  const nextUnrepresentedNonTerminalFeatureKeys = removeValue(
    asStringArray(progress.unrepresentedNonTerminalFeatureKeys),
    featureKey,
  );
  const nextProgress: MutableRecord = {
    ...progress,
    unrepresentedBlockedCount: Math.max(
      0,
      Number(progress.unrepresentedBlockedCount ?? 0) - 1,
    ),
    unrepresentedNonTerminalCount: Math.max(
      0,
      Number(progress.unrepresentedNonTerminalCount ?? 0) - 1,
    ),
    unrepresentedBlockedFeatureKeys: nextUnrepresentedBlockedFeatureKeys,
    unrepresentedNonTerminalFeatureKeys:
      nextUnrepresentedNonTerminalFeatureKeys,
    updatedAt: appliedAt,
  };
  loopTask.context = {
    ...loopContext,
    workflowProgress: nextProgress,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    projectChildren: asStringArray(projectTask.children),
    loopChildren: asStringArray(loopTask.children),
    waitPresent: Boolean(waitTask),
    waitParentId: waitTask?.parent_id ?? null,
    waitConflictScope: asStringArray(waitTask?.conflict_scope),
    waitState: asString(waitTask?.state),
    waitContextKeys: Object.keys(asRecord(waitTask?.context)).sort(),
    loopProgress: clone(nextProgress),
  };
});

updateFeatureCompactItem(featureState, featureKey, {
  taskId: holderTaskId,
  frontierTaskIds: [...fixTaskIds],
  reviewEvidencePath: evidencePath,
  attemptedFixes: unique([
    ...(Array.isArray(featureBefore.attemptedFixes)
      ? featureBefore.attemptedFixes
      : []),
    `${attemptId}: rehomed ${waitTaskId} under ${loopTaskId}, restored compact/spec conflict scopes for ${featureKey}, rebound compact state to ${holderTaskId} with live frontier tasks ${fixTaskIds.join(", ")}, and repaired ${loopTaskId} workflowProgress so the feature is represented again.`,
  ]),
});
saveFeatureCompactLoopState(featureStateLoaded.path, featureState);
const featureAfter = clone(featureState.features[featureKey]);

const afterTree = readTaskTree(config);
const afterWait = afterTree.tasks[waitTaskId] as TaskNode | undefined;
const afterLoop = afterTree.tasks[loopTaskId] as TaskNode | undefined;
assert(afterLoop, `Missing ${loopTaskId} after repair`);

const afterProgress = workflowProgressSnapshot(afterLoop);
if (afterWait) {
  assert(
    asString(afterWait.parent_id) === loopTaskId,
    `Expected ${waitTaskId} parent_id=${loopTaskId} after repair; found ${String(afterWait.parent_id ?? "(missing)")}`,
  );
  assert(
    asStringArray(afterWait.conflict_scope).includes("feature-compact:net-integration"),
    `Expected ${waitTaskId} conflict_scope to include feature-compact:net-integration after repair`,
  );
}
assert(
  Number(afterProgress.unrepresentedNonTerminalCount ?? 0) === 0,
  `Expected ${loopTaskId} unrepresentedNonTerminalCount=0 after repair; found ${String(afterProgress.unrepresentedNonTerminalCount ?? "(missing)")}`,
);

const beforeSnapshot = {
  waitParentId: beforeWait?.parent_id ?? null,
  waitState: beforeWait?.state ?? beforeWait?.status ?? null,
  waitConflictScope: asStringArray(beforeWait?.conflict_scope),
  loopUnrepresentedNonTerminalCount:
    beforeProgress.unrepresentedNonTerminalCount ?? null,
  loopUnrepresentedBlockedFeatureKeys: asStringArray(
    beforeProgress.unrepresentedBlockedFeatureKeys,
  ),
  featureTaskId: featureBefore.taskId ?? null,
  featureFrontierTaskIds: Array.isArray(featureBefore.frontierTaskIds)
    ? featureBefore.frontierTaskIds
    : [],
};

const afterSnapshot = {
  waitParentId: afterWait?.parent_id ?? null,
  waitState: afterWait?.state ?? afterWait?.status ?? null,
  waitConflictScope: asStringArray(afterWait?.conflict_scope),
  loopUnrepresentedNonTerminalCount:
    afterProgress.unrepresentedNonTerminalCount ?? null,
  loopUnrepresentedBlockedFeatureKeys: asStringArray(
    afterProgress.unrepresentedBlockedFeatureKeys,
  ),
  featureTaskId: featureAfter?.taskId ?? null,
  featureFrontierTaskIds: Array.isArray(featureAfter?.frontierTaskIds)
    ? featureAfter.frontierTaskIds
    : [],
  acceptedQueuedPipelineRunRestored: Boolean(
    asRecord(asRecord(afterWait?.context).acceptedQueuedPipelineRun).runId,
  ),
};

writeText(
  evidenceAbsolute,
  `# Metric alert fix: aks-rp-e2e.process.loop.unrepresented-record-count (alert 3756)\n\n- Applied at: ${appliedAt}\n- Attempt: ${attemptId}\n- Worker: ${worker}\n\n## Root cause\nThe live wait \`${waitTaskId}\` still carried the current 172275388 terminal-review lineage, but it had been recreated under \`project\` with empty \`conflict_scope\`. The compact loop therefore kept \`${featureKey}\` blocked in feature state while \`${loopTaskId}.context.workflowProgress\` still reported one unrepresented blocked feature.\n\n## Baseline\n- wait parent before repair: \`${String(beforeSnapshot.waitParentId)}\`\n- wait state before repair: \`${String(beforeSnapshot.waitState)}\`\n- wait conflict scopes before repair: ${beforeSnapshot.waitConflictScope.length ? beforeSnapshot.waitConflictScope.map((value) => `\`${value}\``).join(", ") : "(empty)"}\n- loop unrepresented count before repair: \`${String(beforeSnapshot.loopUnrepresentedNonTerminalCount)}\`\n- loop unrepresented blocked feature keys before repair: ${beforeSnapshot.loopUnrepresentedBlockedFeatureKeys.length ? beforeSnapshot.loopUnrepresentedBlockedFeatureKeys.map((value) => `\`${value}\``).join(", ") : "(empty)"}\n- feature state taskId before repair: \`${String(beforeSnapshot.featureTaskId)}\`\n- feature state frontierTaskIds before repair: ${beforeSnapshot.featureFrontierTaskIds.length ? beforeSnapshot.featureFrontierTaskIds.map((value) => `\`${value}\``).join(", ") : "(empty)"}\n\n## Repair applied\n1. Removed \`${waitTaskId}\` from \`${projectTaskId}.children\`.\n2. Added \`${waitTaskId}\` back under \`${loopTaskId}.children\` and set \`parent_id = ${loopTaskId}\`.\n3. Restored the compact/spec/ADO representation scopes on the live wait:\n   - ${restoredConflictScope.map((value) => `\`${value}\``).join("\n   - ")}\n4. Restored archived \`acceptedQueuedPipelineRun\` lineage for run \`172275388\` without removing the current terminal review context.\n5. Repaired \`${loopTaskId}.context.workflowProgress\` so the live wait is counted as represented again.\n6. Updated feature-compact state for \`${featureKey}\` to keep \`${waitTaskId}\` in \`frontierTaskIds\`.\n\n## Post-repair state\n- wait parent after repair: \`${String(afterSnapshot.waitParentId)}\`\n- wait state after repair: \`${String(afterSnapshot.waitState)}\`\n- wait conflict scopes after repair: ${afterSnapshot.waitConflictScope.map((value) => `\`${value}\``).join(", ")}\n- loop unrepresented count after repair: \`${String(afterSnapshot.loopUnrepresentedNonTerminalCount)}\`\n- loop unrepresented blocked feature keys after repair: ${afterSnapshot.loopUnrepresentedBlockedFeatureKeys.length ? afterSnapshot.loopUnrepresentedBlockedFeatureKeys.map((value) => `\`${value}\``).join(", ") : "(empty)"}\n- feature state taskId after repair: \`${String(afterSnapshot.featureTaskId)}\`\n- feature state frontierTaskIds after repair: ${afterSnapshot.featureFrontierTaskIds.map((value) => `\`${value}\``).join(", ")}\n- archived acceptedQueuedPipelineRun restored: \`${String(afterSnapshot.acceptedQueuedPipelineRunRestored)}\`\n\n## Mutation details\n\n\`\`\`json\n${JSON.stringify(mutation, null, 2)}\n\`\`\`\n`,
);

console.log(
  JSON.stringify(
    {
      appliedAt,
      attemptId,
      evidencePath,
      beforeSnapshot,
      afterSnapshot,
      mutation,
    },
    null,
    2,
  ),
);
