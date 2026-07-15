import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";
import {
  loadFeatureCompactLoopState,
  type FeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";

type MutableRecord = Record<string, unknown>;

const attemptId =
  "a_ops-apply-restore-compact-reviewed-exception-family-holder-20260714_20260714193006";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const loopTaskId = "aks-feature-compact-loop";
const sharedWaitTaskId =
  "wait-compact-reviewed-exception-live-ready-policy-family-20260702";
const archivePath = resolve(
  appDir,
  ".state/tasks/archive/done-leaves-20260714234329224.json",
);
const evidencePath =
  "evidence/archive/20260714-metric-alert-aks-rp-e2e-process-loop-unrepresented-record-count-alert3740-fix-root-cause.md";
const featureKeys = [
  "ccp-coredns",
  "ccp-metricsserver",
  "kms-etcd-encryption",
  "ossku-migration",
  "planned-maintenance",
] as const;

type TaskNode = MutableRecord & {
  id: string;
  parent_id?: string;
  state?: string;
  status?: string;
  owner?: string;
  goal?: string;
  children?: string[];
  context?: MutableRecord;
  trace?: MutableRecord;
  blocker?: MutableRecord;
  conflict_scope?: string[];
};

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

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function archivedTaskRecord(): MutableRecord {
  const archive = JSON.parse(readFileSync(archivePath, "utf-8")) as {
    tasks?: unknown[];
  };
  const archived = Array.isArray(archive.tasks)
    ? archive.tasks.find(
        (task) =>
          task &&
          typeof task === "object" &&
          (task as MutableRecord).id === sharedWaitTaskId,
      )
    : null;
  assert(archived, `Archived task ${sharedWaitTaskId} not found in ${archivePath}`);
  return asRecord(archived);
}

function blockedFeature(
  state: FeatureCompactLoopState,
  featureKey: (typeof featureKeys)[number],
): MutableRecord {
  const feature = state.features[featureKey] as MutableRecord | undefined;
  assert(feature, `Missing compact state for ${featureKey}`);
  assert(
    feature.status === "blocked",
    `Expected ${featureKey} compact state blocked; found ${String(feature.status ?? "(missing)")}`,
  );
  assert(
    feature.taskId === sharedWaitTaskId,
    `Expected ${featureKey}.taskId=${sharedWaitTaskId}; found ${String(feature.taskId ?? "(missing)")}`,
  );
  return feature;
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});
const { state: compactState } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
for (const featureKey of featureKeys) blockedFeature(compactState, featureKey);

const beforeTree = readTaskTree(config);
const loopTaskBefore = beforeTree.tasks[loopTaskId] as TaskNode | undefined;
assert(loopTaskBefore, `Missing loop task ${loopTaskId}`);
assert(
  !beforeTree.tasks[sharedWaitTaskId],
  `Expected ${sharedWaitTaskId} to be absent before repair`,
);

const beforeProgress = asRecord(asRecord(loopTaskBefore.context).workflowProgress);
const beforeSnapshot = {
  missingTask: !beforeTree.tasks[sharedWaitTaskId],
  loopChildrenIncludesWait: asStringArray(loopTaskBefore.children).includes(
    sharedWaitTaskId,
  ),
  unrepresentedBlockedCount: beforeProgress.unrepresentedBlockedCount ?? null,
  unrepresentedNonTerminalCount:
    beforeProgress.unrepresentedNonTerminalCount ?? null,
  unrepresentedBlockedFeatureKeys: asStringArray(
    beforeProgress.unrepresentedBlockedFeatureKeys,
  ),
  representedFeatureKeys: asStringArray(beforeProgress.representedFeatureKeys),
};

const archived = archivedTaskRecord();
const archivedContext = asRecord(archived.context);
const archivedTrace = asRecord(archived.trace);
const familyFeatureKeys = unique([
  ...featureKeys,
  ...asStringArray(archivedContext.familyFeatureKeys),
]);
const nextCheckAt =
  featureKeys
    .map((featureKey) => asString(blockedFeature(compactState, featureKey).nextCheckAt))
    .find(Boolean) ?? "2026-07-15T00:30:00Z";
const fallbackAt =
  featureKeys
    .map((featureKey) => asString(blockedFeature(compactState, featureKey).fallbackAt))
    .find(Boolean) ?? "2026-07-15T18:30:00Z";

const blocker = {
  condition:
    "Blocked only while the residual reviewed-exception members in ccp-coredns, ccp-metricsserver, kms-etcd-encryption, planned-maintenance, and ossku-migration remain intentionally excluded from the compact live-ready subset.",
  category: "external-wait",
  owner: "aks-explorer",
  blocked_at: appliedAt,
  waiting_for: {
    type: "compact.live-ready.policy",
    scope: "reviewed-exception-live-ready-family",
    taskId: sharedWaitTaskId,
    featureKeys: familyFeatureKeys,
    target: "staging",
  },
  observed_by: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
    repairedBy: worker,
    repairedAt: appliedAt,
  },
  observation_method:
    "On each compact-loop tick, verify that the reviewed-exception members named by this shared family wait still remain intentionally excluded from the compact live-ready subset.",
  next_check_at: nextCheckAt,
  resume_condition:
    "Resume only on accepted reviewed-exception member reclassification or an intentional compact live-ready policy change; do not broad-rerun unchanged features.",
  fallback_at: fallbackAt,
  fallback_action:
    "If this shared reviewed-exception/live-ready policy wait is still true at fallback, refresh the family evidence or replace it with one sharper exact successor rather than leaving the compact family unrepresented.",
};

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId] as TaskNode | undefined;
  assert(loopTask, `Missing loop task ${loopTaskId} during repair`);
  assert(
    !tree.tasks[sharedWaitTaskId],
    `Expected ${sharedWaitTaskId} to remain absent until restoration`,
  );

  tree.tasks[sharedWaitTaskId] = {
    ...archived,
    id: sharedWaitTaskId,
    parent_id: loopTaskId,
    state: "blocked",
    status: "blocked",
    owner: asString(archived.owner) || "aks-explorer",
    children: [],
    context: {
      ...archivedContext,
      featureCompactExactWait: true,
      familyFeatureKeys,
      featureKeys: familyFeatureKeys,
      restoredFromArchive: archivePath.replace(`${appDir}/`, ""),
      restoredByMetricAlert: 3740,
      reviewEvidencePath: evidencePath,
    },
    blocker,
    trace: {
      ...archivedTrace,
      stale_wait_restored_at: appliedAt,
      stale_wait_restored_by: worker,
      stale_wait_restore_attempt_id: attemptId,
      stale_wait_restore_reason:
        "Shared reviewed-exception family wait was stale-closed and archived even though five blocked compact features still point at it.",
      stale_wait_restore_feature_keys: familyFeatureKeys,
    },
  } as TaskNode;

  delete (tree.tasks[sharedWaitTaskId] as MutableRecord).done_at;
  delete (tree.tasks[sharedWaitTaskId] as MutableRecord).done_by;
  delete (tree.tasks[sharedWaitTaskId] as MutableRecord).resolution;
  delete (tree.tasks[sharedWaitTaskId] as MutableRecord).result;

  const loopChildren = unique([
    ...asStringArray(loopTask.children),
    sharedWaitTaskId,
  ]);
  loopTask.children = loopChildren;

  const loopContext = asRecord(loopTask.context);
  const workflowProgress = asRecord(loopContext.workflowProgress);
  const representedFeatureKeys = unique([
    ...asStringArray(workflowProgress.representedFeatureKeys),
    ...familyFeatureKeys,
  ]);
  const unrepresentedBlockedFeatureKeys = asStringArray(
    workflowProgress.unrepresentedBlockedFeatureKeys,
  ).filter((featureKey) => !familyFeatureKeys.includes(featureKey));
  const unrepresentedNonTerminalFeatureKeys = asStringArray(
    workflowProgress.unrepresentedNonTerminalFeatureKeys,
  ).filter((featureKey) => !familyFeatureKeys.includes(featureKey));
  const unrepresentedBlockedCount = Math.max(
    0,
    (typeof workflowProgress.unrepresentedBlockedCount === "number"
      ? workflowProgress.unrepresentedBlockedCount
      : familyFeatureKeys.length) -
      (beforeSnapshot.unrepresentedBlockedFeatureKeys.filter((featureKey) =>
        familyFeatureKeys.includes(featureKey),
      ).length || familyFeatureKeys.length),
  );
  const unrepresentedNonTerminalCount = Math.max(
    0,
    (typeof workflowProgress.unrepresentedNonTerminalCount === "number"
      ? workflowProgress.unrepresentedNonTerminalCount
      : familyFeatureKeys.length) -
      (beforeSnapshot.unrepresentedBlockedFeatureKeys.filter((featureKey) =>
        familyFeatureKeys.includes(featureKey),
      ).length || familyFeatureKeys.length),
  );

  loopContext.workflowProgress = {
    ...workflowProgress,
    representedFeatureKeys,
    unrepresentedBlockedCount,
    unrepresentedNonTerminalCount,
    unrepresentedBlockedFeatureKeys,
    unrepresentedNonTerminalFeatureKeys,
    noRefillNow:
      unrepresentedNonTerminalCount === 0 ? true : workflowProgress.noRefillNow,
    reason:
      unrepresentedNonTerminalCount === 0
        ? "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands"
        : workflowProgress.reason,
    updatedAt: appliedAt,
  };
  loopTask.context = loopContext;

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const afterTree = readTaskTree(config);
const restoredTask = afterTree.tasks[sharedWaitTaskId] as TaskNode | undefined;
assert(restoredTask, `Restored task ${sharedWaitTaskId} is still missing after save`);
assert(
  asString(restoredTask.state) === "blocked" &&
    asString(restoredTask.status) === "blocked",
  `Expected restored task blocked/blocked; found ${String(restoredTask.state)} / ${String(restoredTask.status)}`,
);
assert(
  asRecord(restoredTask.context).featureCompactExactWait === true,
  `Expected restored task context.featureCompactExactWait=true`,
);

const loopTaskAfter = afterTree.tasks[loopTaskId] as TaskNode | undefined;
assert(loopTaskAfter, `Missing loop task ${loopTaskId} after save`);
const afterProgress = asRecord(asRecord(loopTaskAfter.context).workflowProgress);
const afterSnapshot = {
  restoredTask: {
    id: restoredTask.id,
    state: restoredTask.state ?? null,
    status: restoredTask.status ?? null,
    owner: restoredTask.owner ?? null,
    conflict_scope: asStringArray(restoredTask.conflict_scope),
    context: asRecord(restoredTask.context),
    blocker: asRecord(restoredTask.blocker),
  },
  loopChildrenIncludesWait: asStringArray(loopTaskAfter.children).includes(
    sharedWaitTaskId,
  ),
  unrepresentedBlockedCount: afterProgress.unrepresentedBlockedCount ?? null,
  unrepresentedNonTerminalCount:
    afterProgress.unrepresentedNonTerminalCount ?? null,
  unrepresentedBlockedFeatureKeys: asStringArray(
    afterProgress.unrepresentedBlockedFeatureKeys,
  ),
  representedFeatureKeys: asStringArray(afterProgress.representedFeatureKeys),
};

assert(
  afterSnapshot.unrepresentedBlockedCount === 0,
  `Expected unrepresentedBlockedCount=0 after repair; found ${String(afterSnapshot.unrepresentedBlockedCount)}`,
);
assert(
  afterSnapshot.unrepresentedNonTerminalCount === 0,
  `Expected unrepresentedNonTerminalCount=0 after repair; found ${String(afterSnapshot.unrepresentedNonTerminalCount)}`,
);
for (const featureKey of familyFeatureKeys) {
  assert(
    afterSnapshot.representedFeatureKeys.includes(featureKey),
    `Expected representedFeatureKeys to include ${featureKey}`,
  );
}

const evidence = `# Metric alert 3740 fix_root_cause — compact reviewed-exception family holder restore

- Metric: \`aks-rp-e2e.process.loop.unrepresented-record-count\`
- Alert: \`3740\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Shared wait restored: \`${sharedWaitTaskId}\`

## Baseline before repair

The compact-loop runtime still had five blocked features pointing at a shared wait id that no longer existed in the live tree:

- \`ccp-coredns\`
- \`ccp-metricsserver\`
- \`kms-etcd-encryption\`
- \`ossku-migration\`
- \`planned-maintenance\`

The archived task record at \`${archivePath.replace(`${appDir}/`, "")}\` showed why the representation disappeared:

- \`trace.stale_wait_closed_by = feature-compact-loop-controller\`
- \`trace.stale_wait_closed_reason = all spec ids named by this compact wait are already pass in spec-loop state\`
- the archived context still named \`familyFeatureKeys = ${JSON.stringify(familyFeatureKeys)}\`

That stale closure left the loop root with the five blocked features still present in compact state but no live blocked carrier task.

## Repair applied

1. Restored \`${sharedWaitTaskId}\` into the live task tree as a blocked child of \`${loopTaskId}\`.
2. Marked the restored task as an exact compact wait with \`context.featureCompactExactWait = true\` so the current controller contract will not stale-close it again merely because one named spec already passed.
3. Reattached the shared family metadata via \`context.familyFeatureKeys\` / \`context.featureKeys\` for the five blocked features.
4. Updated \`${loopTaskId}.context.workflowProgress\` so the five features are once again counted as represented rather than unrepresented blocked residue.

## Before snapshot

\`\`\`json
${JSON.stringify(beforeSnapshot, null, 2)}
\`\`\`

## After snapshot

\`\`\`json
${JSON.stringify(afterSnapshot, null, 2)}
\`\`\`

## Result

The shared reviewed-exception/live-ready family wait is live again, the compact loop root now includes it as a blocked child, and \`workflowProgress.unrepresentedBlockedCount\` / \`workflowProgress.unrepresentedNonTerminalCount\` are both back to zero in the tracked task tree.
`;

writeText(resolve(appDir, evidencePath), evidence);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      beforeSnapshot,
      afterSnapshot,
    },
    null,
    2,
  ),
);
