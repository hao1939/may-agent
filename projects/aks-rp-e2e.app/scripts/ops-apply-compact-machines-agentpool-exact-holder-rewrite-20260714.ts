import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  markTaskDone,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

const attemptId =
  "a_ops_apply-compact-machines-agentpool-exact-holder-rewrite-20260714_20260714023522";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-apply-compact-machines-agentpool-exact-holder-rewrite-20260714.md";
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "machines-agentpool";
const retiredTaskId =
  "hold-compact-machines-agentpool-package-partial-frontier-202607090638";
const successorTaskId =
  "wait-compact-machines-agentpool-run-28809049156-review-20260714";
const familyWaitTaskId =
  "wait-compact-reviewed-exception-live-ready-policy-family-20260702";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactBefore = compactState.features[featureKey];
assert(compactBefore, `Missing compact state for ${featureKey}`);

const treeBefore = readTaskTree(config);
const retiredBefore = treeBefore.tasks[retiredTaskId];
const familyWait = treeBefore.tasks[familyWaitTaskId];
assert(retiredBefore, `Missing live surrogate holder ${retiredTaskId}`);
assert(familyWait, `Missing reviewed-exception family wait ${familyWaitTaskId}`);
assert(
  compactBefore.taskId === retiredTaskId || compactBefore.taskId === successorTaskId,
  `Compact state for ${featureKey} points at ${compactBefore.taskId ?? "(null)"}, expected ${retiredTaskId} or existing successor ${successorTaskId}`,
);
assert(
  typeof compactBefore.blockedReason === "string" &&
    compactBefore.blockedReason.includes("28809049156"),
  `Compact state for ${featureKey} no longer preserves run 28809049156 facts`,
);
assert(
  typeof compactBefore.waitingCondition === "string" &&
    compactBefore.waitingCondition.includes("28809049156"),
  `Compact state for ${featureKey} no longer preserves the exact resume boundary`,
);
assert(
  typeof retiredBefore.goal === "string" &&
    retiredBefore.goal.includes("same-spec") &&
    retiredBefore.goal.includes("reviewed-exception siblings"),
  `Surrogate holder ${retiredTaskId} no longer has the expected exact-holder semantics`,
);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const parent = tree.tasks[loopTaskId];
  const retired = tree.tasks[retiredTaskId];
  const existingSuccessor = tree.tasks[successorTaskId];
  const family = tree.tasks[familyWaitTaskId];

  assert(parent, `Missing loop task ${loopTaskId}`);
  assert(retired, `Missing live surrogate holder ${retiredTaskId}`);
  assert(family, `Missing reviewed-exception family wait ${familyWaitTaskId}`);

  const successorGoal =
    "Preserve the exact same-spec compact rerun result 28809049156 for spec.nap.default-machines-pool-cleanup-no-machine-crud while the reviewed-exception siblings stay on their shared family wait, without reopening an unchanged broad compact rerun.";

  const successorTask: TaskNode = {
    ...clone(retired),
    id: successorTaskId,
    parent_id: loopTaskId,
    state: "blocked",
    status: "blocked",
    kind: retired.kind ?? "domain_leaf",
    owner: retired.owner ?? "product-owner",
    goal: successorGoal,
    children: [],
    outputs: unique([
      ...asStringArray(retired.outputs),
      memoPath,
    ]),
    context: {
      ...(retired.context && typeof retired.context === "object" && !Array.isArray(retired.context)
        ? clone(retired.context)
        : {}),
      featureCompactExactWait: true,
      replacementOfTaskId: retiredTaskId,
      exactRunId: "28809049156",
      exactSpecId: "spec.nap.default-machines-pool-cleanup-no-machine-crud",
      reviewedExceptionFamilyTaskId: familyWaitTaskId,
    },
    blocker:
      retired.blocker && typeof retired.blocker === "object" && !Array.isArray(retired.blocker)
        ? clone(retired.blocker)
        : retired.blocker,
    trace: {
      ...(retired.trace && typeof retired.trace === "object" && !Array.isArray(retired.trace)
        ? clone(retired.trace)
        : {}),
      created_at: appliedAt,
      created_by: "app-ops-apply-script",
      replacement_of_task_id: retiredTaskId,
      current_attempt_id: undefined,
      worker_started_attempt_id: undefined,
      blocked_wait_refreshed_at: undefined,
      blocked_wait_refreshed_by: undefined,
      blocked_wait_refresh_summary: undefined,
      previous_nonterminal_status: undefined,
    },
    result:
      `${attemptId}: created fresh exact same-spec successor ${successorTaskId} from ${retiredTaskId} for run 28809049156 while keeping reviewed-exception siblings on ${familyWaitTaskId}.`,
    resolution: undefined,
    done_at: undefined,
    done_by: undefined,
  };

  const parentChildren = asStringArray(parent.children);
  const beforeParentChildren = [...parentChildren];
  const hadSuccessor = Boolean(existingSuccessor);

  tree.tasks[successorTaskId] = successorTask;
  parent.children = [...new Set([...parentChildren, successorTaskId])];

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    hadSuccessor,
    beforeParentChildren,
    afterParentChildren: asStringArray(parent.children),
    successorTask: clone(tree.tasks[successorTaskId]),
    retiredTaskBefore: clone(retired),
    familyWaitGoal: family.goal ?? null,
  };
});

const retiredMarkedDone = markTaskDone(config, {
  taskId: retiredTaskId,
  resolution: "replaced",
  summary:
    `Replaced surrogate compact holder ${retiredTaskId} with fresh exact same-spec wait ${successorTaskId} for run 28809049156. The reviewed-exception siblings remain on ${familyWaitTaskId}; see ${memoPath}.`,
});

const retiredAfter = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const retired = tree.tasks[retiredTaskId];
  assert(retired, `Retired task ${retiredTaskId} disappeared after mark-done`);
  retired.result =
    `Replaced surrogate compact holder ${retiredTaskId} with fresh exact same-spec wait ${successorTaskId} for run 28809049156. The reviewed-exception siblings remain on ${familyWaitTaskId}; see ${memoPath}.`;
  retired.trace = {
    ...(retired.trace && typeof retired.trace === "object" && !Array.isArray(retired.trace)
      ? clone(retired.trace)
      : {}),
    compact_holder_projection_replacement_task_ids: [successorTaskId],
    compact_holder_projection_replaced_at: appliedAt,
    compact_holder_projection_replaced_by: "app-ops-apply-script",
  };
  retired.context = {
    ...(retired.context && typeof retired.context === "object" && !Array.isArray(retired.context)
      ? clone(retired.context)
      : {}),
    replacementTaskId: successorTaskId,
    reviewedExceptionFamilyTaskId: familyWaitTaskId,
  };
  saveTaskTreeWithKanbanSnapshot(config, tree);
  return clone(retired);
});

const attemptedFixes = unique([
  ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
  `${attemptId}: replaced surrogate compact holder ${retiredTaskId} with fresh exact same-spec wait ${successorTaskId} while preserving reviewed-exception family wait ${familyWaitTaskId}.`,
]);
const evidencePaths = unique([
  ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
  memoPath,
]);
const summary =
  `${attemptId}: replaced surrogate compact holder ${retiredTaskId} with fresh exact same-spec wait ${successorTaskId} for run 28809049156 while leaving reviewed-exception siblings on ${familyWaitTaskId}.`;

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: successorTaskId,
  frontierTaskIds: Array.isArray(compactBefore.frontierTaskIds)
    ? compactBefore.frontierTaskIds
    : [],
  retryReason: compactBefore.retryReason ?? compactBefore.resumeCondition ?? null,
  ownerReason: compactBefore.ownerReason ?? null,
  attemptedFixes,
  nextStepClassification: compactBefore.nextStepClassification ?? null,
  resumeCondition: compactBefore.resumeCondition ?? compactBefore.waitingCondition ?? null,
  blockedReason: compactBefore.blockedReason ?? null,
  waitingFor: compactBefore.waitingFor ?? null,
  waitingCondition: compactBefore.waitingCondition ?? compactBefore.resumeCondition ?? null,
  observedBy: compactBefore.observedBy ?? null,
  observationMethod: compactBefore.observationMethod ?? null,
  nextCheckAt: compactBefore.nextCheckAt ?? null,
  blockerOwner: compactBefore.blockerOwner ?? null,
  fallbackAt: compactBefore.fallbackAt ?? null,
  fallbackAction: compactBefore.fallbackAction ?? null,
  resumeAction:
    compactBefore.resumeAction ??
    "Reset this feature compact record to pending only after the named wait condition changes.",
  blockedScope: compactBefore.blockedScope ?? null,
  blockedFingerprint: compactBefore.blockedFingerprint ?? null,
  lastCheckedAt: appliedAt,
  evidencePaths,
  reviewEvidencePath: memoPath,
  verificationBlocker: compactBefore.verificationBlocker ?? null,
  summary,
  lastSummary: summary,
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const compactAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  statePath: compactStatePath,
  refreshFromProject: false,
}).state.features[featureKey];
assert(compactAfter, `Missing compact state for ${featureKey} after rewrite`);

const memo = `# App-ops apply — compact machines-agentpool exact holder rewrite (2026-07-14)

Task: \`ops/apply-compact-machines-agentpool-exact-holder-rewrite-20260714\`
Attempt: \`${attemptId}\`
Applied at: \`${appliedAt}\`

## Result

Replaced surrogate compact holder \`${retiredTaskId}\` with fresh exact same-spec wait \`${successorTaskId}\` for \`spec.nap.default-machines-pool-cleanup-no-machine-crud\`.

The rewritten exact holder preserves the same run-28809049156 blocker facts and keeps the separate reviewed-exception lineage on \`${familyWaitTaskId}\`; no broad compact rerun was reopened.

## Affected task ids

- Retired surrogate: \`${retiredTaskId}\`
- Fresh exact successor: \`${successorTaskId}\`
- Preserved reviewed-exception family wait: \`${familyWaitTaskId}\`

## Preserved resume / retest boundary

- Exact blocker source: run \`28809049156\`
- Exact spec: \`spec.nap.default-machines-pool-cleanup-no-machine-crud\`
- Resume boundary: \`${compactAfter.waitingCondition ?? compactAfter.resumeCondition ?? "(missing)"}\`
- Family separation retained: reviewed-exception siblings stay represented only by \`${familyWaitTaskId}\`

## Live task-tree mutation

### Successor holder after apply

\`\`\`json
${JSON.stringify(
  {
    id: treeMutation.successorTask.id,
    state: treeMutation.successorTask.state,
    owner: treeMutation.successorTask.owner,
    goal: treeMutation.successorTask.goal,
    context: treeMutation.successorTask.context,
    blocker: treeMutation.successorTask.blocker,
    outputs: treeMutation.successorTask.outputs,
  },
  null,
  2,
)}
\`\`\`

### Retired surrogate after apply

\`\`\`json
${JSON.stringify(
  {
    id: retiredAfter.id,
    state: retiredAfter.state,
    resolution: retiredAfter.resolution,
    result: retiredAfter.result,
    context: retiredAfter.context,
    trace: retiredAfter.trace,
  },
  null,
  2,
)}
\`\`\`

## Compact loop state linkage after apply

\`\`\`json
${JSON.stringify(
  {
    taskId: compactAfter.taskId ?? null,
    frontierTaskIds: compactAfter.frontierTaskIds ?? null,
    blockedReason: compactAfter.blockedReason ?? null,
    waitingCondition: compactAfter.waitingCondition ?? null,
    reviewEvidencePath: compactAfter.reviewEvidencePath ?? null,
    summary: compactAfter.summary ?? null,
  },
  null,
  2,
)}
\`\`\`

## Tooling note

No general app-tooling repair was required. This apply step used the existing app runtime/task-tree APIs to create one successor exact holder, rebind the compact-loop state record to it, and retire the surrogate with replacement evidence.
`;

const memoAbsolute = resolve(appDir, memoPath);
mkdirSync(dirname(memoAbsolute), { recursive: true });
writeFileSync(memoAbsolute, `${memo}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      memoPath,
      retiredTaskId,
      successorTaskId,
      familyWaitTaskId,
      treeMutation: {
        hadSuccessor: treeMutation.hadSuccessor,
        beforeParentChildren: treeMutation.beforeParentChildren,
        afterParentChildren: treeMutation.afterParentChildren,
      },
      retiredMarkedDone: {
        id: retiredMarkedDone.id,
        state: retiredMarkedDone.state,
        resolution: retiredMarkedDone.resolution,
      },
      compactBefore: {
        taskId: compactBefore.taskId ?? null,
        waitingCondition: compactBefore.waitingCondition ?? null,
        reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
      },
      compactAfter: {
        taskId: compactAfter.taskId ?? null,
        waitingCondition: compactAfter.waitingCondition ?? null,
        reviewEvidencePath: compactAfter.reviewEvidencePath ?? null,
      },
    },
    null,
    2,
  ),
);
