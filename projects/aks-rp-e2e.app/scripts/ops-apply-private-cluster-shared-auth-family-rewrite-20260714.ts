import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type SpecRepair = {
  specId: string;
  runId: string;
  oldTaskId: string;
};

const attemptId =
  "a_ops_apply-private-cluster-shared-auth-family-rewrite-20260714_20260714023550";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const appMemoPath =
  "evidence/archive/ops-apply-private-cluster-shared-auth-family-rewrite-20260714.md";
const specLoopTaskId = "aks-spec-verification-loop";
const compactLoopTaskId = "aks-feature-compact-loop";
const compactFeatureKey = "private-cluster";
const compactHolderTaskId =
  "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix";
const stewardTaskId =
  "ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711-owner-normalized";
const familyPathId = "shared-authenticated-artifact-result-recovery-family-20260712";
const familyCarrierTaskId =
  "hold-spec-private-cluster-shared-auth-run-pair-family-20260714";
const splitBackOutRule =
  "If only one represented branch sharpens later, split that changed branch back out into its own exact holder (or sharper returned wait) while the unchanged sibling stays on this family carrier or its direct successor; do not reopen an unchanged rerun for both branches together.";
const apply = process.argv.includes("--apply");
const repairedAt = new Date().toISOString();
const specRepairs: SpecRepair[] = [
  {
    specId: "spec.private-cluster.vnet-integration-shared-apiserver-subnet",
    runId: "28840446579",
    oldTaskId:
      "hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h",
  },
  {
    specId: "spec.private-cluster.vnet-integration-update-public-second-hop",
    runId: "28671841561",
    oldTaskId:
      "hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h",
  },
] as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

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

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

function stableUnique(values: string[]): string[] {
  return unique(values).sort((a, b) => a.localeCompare(b));
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function summarizeState(task: TaskNode | undefined) {
  const blocker = asRecord(task?.blocker);
  const waitingFor = asRecord(blocker.waiting_for);
  return {
    id: task?.id ?? null,
    parent_id: asString(task?.parent_id) || null,
    state: asString(task?.state) || asString(task?.status) || null,
    resolution: asString((task as MutableRecord | undefined)?.resolution) || null,
    goal: asString(task?.goal) || null,
    representedSpecIds: asStringArray(asRecord(task?.context).representedSpecIds),
    representedRunIds: asStringArray(asRecord(task?.context).representedRunIds),
    blocker: {
      condition: asString(blocker.condition) || null,
      owner: asString(blocker.owner) || null,
      blocked_at: asString(blocker.blocked_at) || null,
      next_check_at: asString(blocker.next_check_at) || null,
      fallback_at: asString(blocker.fallback_at) || null,
      resume_condition: asString(blocker.resume_condition) || null,
      waiting_for: {
        type: asString(waitingFor.type) || null,
        taskId: asString(waitingFor.taskId) || null,
        pathId: asString(waitingFor.pathId) || null,
        approvalId: asString(waitingFor.approvalId) || null,
        waitId: asString(waitingFor.waitId) || null,
      },
    },
  };
}

const treeBefore = readTaskTree(config);
const specLoopTaskBefore = treeBefore.tasks[specLoopTaskId];
const compactHolderTaskBefore = treeBefore.tasks[compactHolderTaskId];
const stewardTaskBefore = treeBefore.tasks[stewardTaskId];
if (!specLoopTaskBefore) throw new Error(`Missing task ${specLoopTaskId}`);
if (!compactHolderTaskBefore) throw new Error(`Missing task ${compactHolderTaskId}`);
if (!stewardTaskBefore) throw new Error(`Missing task ${stewardTaskId}`);

const stewardBlocker = asRecord(stewardTaskBefore.blocker);
if (asString(asRecord(stewardBlocker.waiting_for).pathId) !== familyPathId) {
  throw new Error(
    `Expected ${stewardTaskId} pathId=${familyPathId}; found ${asString(asRecord(stewardBlocker.waiting_for).pathId) || "(missing)"}`,
  );
}

const oldTasksBefore = specRepairs.map((repair) => {
  const task = treeBefore.tasks[repair.oldTaskId];
  if (!task) throw new Error(`Missing task ${repair.oldTaskId}`);
  return { repair, task };
});

const specLoopPath = defaultSpecLoopStatePath(appDir);
const mirrorSpecLoopPath = resolve(projectDir, ".state/spec-loop/state.json");
const specState = readJson<SpecLoopState>(specLoopPath);
const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const compactFeatureBefore = compactState.features[compactFeatureKey];
if (!compactFeatureBefore) {
  throw new Error(`Missing compact feature state for ${compactFeatureKey}`);
}

const compactTaskBefore = treeBefore.tasks[compactHolderTaskId];
const compactFrontierBefore = asStringArray(compactFeatureBefore.frontierTaskIds);
for (const { oldTaskId } of specRepairs) {
  if (!compactFrontierBefore.includes(oldTaskId)) {
    throw new Error(
      `Expected compact frontierTaskIds to include ${oldTaskId}; current frontierTaskIds=${JSON.stringify(compactFrontierBefore)}`,
    );
  }
}

const earliestBlockedAt = oldTasksBefore
  .map(({ task }) => asString(asRecord(task.blocker).blocked_at))
  .filter(Boolean)
  .sort()[0] ?? repairedAt;

const familyWaitingFor = {
  ...asRecord(stewardBlocker.waiting_for),
  taskId: familyCarrierTaskId,
  pathId: familyPathId,
  representedSpecIds: specRepairs.map((repair) => repair.specId),
  representedRunIds: specRepairs.map((repair) => repair.runId),
};

const familyBlocker = {
  condition:
    `Aligned to governing steward ${stewardTaskId}: no matching returned project.approval.submitted decision, no app-visible same-lineage artifact/result bundle for runs ${specRepairs.map((repair) => repair.runId).join(" and ")}, and no reviewed auth-capable helper/runtime recovery evidence for pathId ${familyPathId}. Preserve both private-cluster same-run branches under one exact shared-auth family carrier without reopening an unchanged rerun.`,
  category: asString(stewardBlocker.category) || "external-wait",
  owner: asString(stewardBlocker.owner) || "human",
  blocked_at: earliestBlockedAt,
  waiting_for: familyWaitingFor,
  observed_by: asRecord(stewardBlocker.observed_by),
  observation_method:
    `Planner/app-ops should reconcile the exact shared-family approval return or equivalent reviewed same-lineage bundle/diagnosis for runs ${specRepairs.map((repair) => repair.runId).join(" and ")} into this carrier. ${splitBackOutRule}`,
  next_check_at: asString(stewardBlocker.next_check_at) || repairedAt,
  resume_condition:
    `Resume when project.approval.submitted carries the exact shared-family approvalId/waitId, when a reviewed same-lineage bundle appears for either run ${specRepairs[0].runId} or ${specRepairs[1].runId}, when reviewed helper/result evidence materially changes one represented branch, or when the steward review window reaches unchanged. ${splitBackOutRule}`,
  fallback_at: asString(stewardBlocker.fallback_at) || repairedAt,
  fallback_action:
    `If no same-lineage return lands by fallback, keep this family carrier aligned to ${stewardTaskId} and refresh only with sharper reviewed same-lineage evidence. ${splitBackOutRule}`,
};

const familyTaskPlan: TaskNode = {
  id: familyCarrierTaskId,
  parent_id: specLoopTaskId,
  state: "blocked",
  status: "blocked",
  kind: "domain_leaf",
  priority: "P2",
  owner: "aks-explorer",
  children: [],
  goal:
    "Preserve one exact shared-auth blocked family carrier for the private-cluster same-run pair while run 28840446579 result visibility and run 28671841561 artifact visibility both remain governed by shared-authenticated-artifact-result-recovery-family-20260712.",
  inputs: [],
  outputs: stableUnique(
    oldTasksBefore.flatMap(({ task }) => asStringArray(task.outputs)),
  ),
  acceptance: [
    "One blocked family carrier preserves only spec.private-cluster.vnet-integration-shared-apiserver-subnet run 28840446579 and spec.private-cluster.vnet-integration-update-public-second-hop run 28671841561 under shared-authenticated-artifact-result-recovery-family-20260712.",
    "Resume only when a reviewed same-lineage bundle/decision/helper materially changes one represented branch, and do not reopen an unchanged rerun for both branches together.",
    splitBackOutRule,
  ],
  forbidden: [],
  conflict_scope: specRepairs.map((repair) => `spec:${repair.specId}`),
  depends_on: [],
  context: {
    representedSpecIds: specRepairs.map((repair) => repair.specId),
    representedRunIds: specRepairs.map((repair) => repair.runId),
    replacedTaskIds: specRepairs.map((repair) => repair.oldTaskId),
    governingStewardTaskId: stewardTaskId,
    splitBackOutRule,
  },
  blocker: familyBlocker,
  trace: {
    created_at: repairedAt,
    created_by:
      "ops-apply-private-cluster-shared-auth-family-rewrite-20260714-script",
    created_from_attempt_id: attemptId,
  },
};

const compactHolderBlockerBefore = asRecord(compactTaskBefore.blocker);
const compactFrontierAfter = compactFrontierBefore.filter(
  (taskId) => !specRepairs.some((repair) => repair.oldTaskId === taskId),
);
compactFrontierAfter.push(familyCarrierTaskId);
const compactFrontierDesired = stableUnique(compactFrontierAfter);

const compactSummaryAfter =
  `Rebound the private-cluster compact mixed-frontier shared-auth branch to ${familyCarrierTaskId}, which now represents spec.private-cluster.vnet-integration-shared-apiserver-subnet run ${specRepairs[0].runId} plus spec.private-cluster.vnet-integration-update-public-second-hop run ${specRepairs[1].runId} under ${familyPathId}, while the BYO UDR prerequisite and update-private-second-hop nonlive residue remain unchanged.`;

const compactBlockedReasonAfter =
  (asString(compactFeatureBefore.blockedReason) ||
    asString(compactHolderBlockerBefore.condition) ||
    "Private-cluster compact remains a mixed frontier.")
    .replace(specRepairs[0].oldTaskId, familyCarrierTaskId)
    .replace(specRepairs[1].oldTaskId, familyCarrierTaskId)
    .replace(
      "update-public-second-hop artifact visibility",
      "shared-auth run-pair visibility family",
    );

const compactOwnerReasonAfter =
  (asString(compactFeatureBefore.ownerReason) ||
    "Private-cluster compact remains a represented mixed residual frontier.") +
  ` The shared-auth branch is now carried once by ${familyCarrierTaskId} for runs ${specRepairs.map((repair) => repair.runId).join(" and ")}.`;

const compactVerificationBlockerAfter =
  `Do not rerun unchanged. ${familyCarrierTaskId} now carries the shared-auth same-run visibility pair for runs ${specRepairs.map((repair) => repair.runId).join(" and ")} under ${familyPathId}; the BYO UDR prerequisite and update-private-second-hop nonlive frontier remain unchanged.`;

const compactRetryReasonAfter =
  asString(familyBlocker.resume_condition) ||
  asString(compactFeatureBefore.retryReason) ||
  null;

const specBefore = specRepairs.map((repair) => {
  const current = specState.specs[repair.specId];
  if (!current) {
    throw new Error(`Missing spec state for ${repair.specId}`);
  }
  const review = asRecord(current.review);
  return {
    specId: repair.specId,
    runId: repair.runId,
    before: {
      taskId: current.taskId ?? null,
      resumeCondition: current.resumeCondition ?? null,
      pendingReviewTaskId:
        typeof review.pendingReviewTaskId === "string"
          ? review.pendingReviewTaskId
          : null,
      pendingReviewRunId:
        typeof review.pendingReviewRunId === "string"
          ? review.pendingReviewRunId
          : null,
      updatedAt: current.updatedAt ?? null,
    },
  };
});

for (const item of specBefore) {
  const matchingRepair = specRepairs.find((repair) => repair.specId === item.specId);
  if (!matchingRepair) continue;
  if (item.before.taskId !== matchingRepair.oldTaskId) {
    throw new Error(
      `Unexpected current taskId for ${item.specId}: ${item.before.taskId} (expected ${matchingRepair.oldTaskId})`,
    );
  }
}

const dryRunPlan = {
  attemptId,
  apply,
  toolGapBeforeRepair: {
    taskTreeCommands:
      "task-tree update-text / refresh-blocked-wait can rewrite existing task metadata, but they cannot create one new family carrier and retire two old waits while rebinding both spec-loop rows and the compact frontier in one bounded primitive.",
    specLoopCommand:
      "scripts/spec-loop.ts bind-task can only rewrite one spec-loop taskId at a time and has no paired compact-loop frontier rewrite or retired-task replacement operation.",
    requiredAppTooling:
      `A dedicated app-side rewrite script that can safely compute the private-cluster family carrier, then (when a planner/app-ops owner chooses to apply it) create ${familyCarrierTaskId}, retire ${specRepairs.map((repair) => repair.oldTaskId).join(" and ")}, and update spec-loop plus compact-loop bindings together.` ,
  },
  governingSteward: summarizeState(stewardTaskBefore),
  currentSpecWaits: oldTasksBefore.map(({ task }) => summarizeState(task)),
  desiredFamilyCarrier: summarizeState(familyTaskPlan),
  specLoopRebinds: specBefore.map((item) => ({
    specId: item.specId,
    runId: item.runId,
    before: item.before,
    after: {
      taskId: familyCarrierTaskId,
      pendingReviewTaskId: familyCarrierTaskId,
    },
  })),
  compactLoopRebind: {
    featureKey: compactFeatureKey,
    before: {
      taskId: compactFeatureBefore.taskId ?? null,
      frontierTaskIds: compactFeatureBefore.frontierTaskIds ?? null,
      nextCheckAt: compactFeatureBefore.nextCheckAt ?? null,
      fallbackAt: compactFeatureBefore.fallbackAt ?? null,
      reviewEvidencePath: compactFeatureBefore.reviewEvidencePath ?? null,
    },
    after: {
      taskId: compactFeatureBefore.taskId ?? null,
      frontierTaskIds: compactFrontierDesired,
      nextCheckAt: familyBlocker.next_check_at,
      fallbackAt: familyBlocker.fallback_at,
      reviewEvidencePath: appMemoPath,
      summary: compactSummaryAfter,
    },
  },
  replaceRetirements: specRepairs.map((repair) => ({
    oldTaskId: repair.oldTaskId,
    replacementTaskId: familyCarrierTaskId,
    resolution: "replaced",
  })),
  splitBackOutRule,
  plannerApplyCommand:
    `cd ${appDir} && APP_DIR=${appDir} PROJECT_DIR=${projectDir} WORKER=app-ops bun run ./scripts/ops-apply-private-cluster-shared-auth-family-rewrite-20260714.ts --apply`,
};

if (!apply) {
  console.log(JSON.stringify(dryRunPlan, null, 2));
  process.exit(0);
}

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[specLoopTaskId];
  if (!loopTask) throw new Error(`Missing task ${specLoopTaskId} during apply`);

  const existingFamily = tree.tasks[familyCarrierTaskId];
  if (!existingFamily) {
    tree.tasks[familyCarrierTaskId] = familyTaskPlan;
    const children = asStringArray(loopTask.children);
    if (!children.includes(familyCarrierTaskId)) {
      loopTask.children = [...children, familyCarrierTaskId];
    }
  } else {
    Object.assign(existingFamily, familyTaskPlan, {
      trace: {
        ...asRecord(existingFamily.trace),
        ...asRecord(familyTaskPlan.trace),
      },
      context: {
        ...asRecord(existingFamily.context),
        ...asRecord(familyTaskPlan.context),
      },
    });
  }

  for (const repair of specRepairs) {
    const task = tree.tasks[repair.oldTaskId];
    if (!task) throw new Error(`Missing task ${repair.oldTaskId} during apply`);
    task.state = "done";
    task.status = "done";
    (task as MutableRecord).resolution = "replaced";
    (task as MutableRecord).done_at = repairedAt;
    (task as MutableRecord).done_by =
      "ops-apply-private-cluster-shared-auth-family-rewrite-20260714-script";
    (task as MutableRecord).result =
      `Replaced by ${familyCarrierTaskId} so runs ${specRepairs.map((item) => item.runId).join(" and ")} are carried once under ${familyPathId}.`;
    delete (task as MutableRecord).blocker;
    task.trace = {
      ...asRecord(task.trace),
      replaced_at: repairedAt,
      replaced_by:
        "ops-apply-private-cluster-shared-auth-family-rewrite-20260714-script",
      replacement_task_id: familyCarrierTaskId,
      replacement_summary:
        `Retired duplicate private-cluster shared-auth wait in favor of ${familyCarrierTaskId}.`,
    };
    task.context = {
      ...asRecord(task.context),
      replacementTaskIds: [familyCarrierTaskId],
      replacedByTaskId: familyCarrierTaskId,
      splitBackOutRule,
    };
  }

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const applySpecState = readJson<SpecLoopState>(specLoopPath);
for (const repair of specRepairs) {
  const current = applySpecState.specs[repair.specId];
  if (!current) throw new Error(`Missing spec ${repair.specId} during apply`);
  const review = asRecord(current.review);
  review.pendingReviewTaskId = familyCarrierTaskId;
  review.pendingReviewObservedAt = repairedAt;
  review.pendingReviewReason =
    "shared-auth family carrier rewrite preserved same-run pair under one exact wait";
  updateSpecLoopSpec(applySpecState, repair.specId, {
    taskId: familyCarrierTaskId,
    review,
  });
}
saveSpecLoopState(
  specLoopPath,
  applySpecState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const applyCompactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const applyCompactState = applyCompactLoaded.state;
const currentCompact = applyCompactState.features[compactFeatureKey];
if (!currentCompact) {
  throw new Error(`Missing compact feature ${compactFeatureKey} during apply`);
}
const evidencePaths = stableUnique([
  appMemoPath,
  ...asStringArray(currentCompact.evidencePaths),
]);
updateFeatureCompactItem(applyCompactState, compactFeatureKey, {
  status: "blocked",
  retryable: false,
  taskId: compactHolderTaskId,
  frontierTaskIds: compactFrontierDesired,
  retryReason: compactRetryReasonAfter,
  blockedReason: compactBlockedReasonAfter,
  waitingFor:
    (currentCompact.waitingFor ??
      (asRecord(compactHolderBlockerBefore.waiting_for) as MutableRecord)) || null,
  waitingCondition:
    asString(currentCompact.waitingCondition) ||
    asString(compactHolderBlockerBefore.resume_condition) ||
    null,
  observedBy:
    (currentCompact.observedBy ??
      (asRecord(compactHolderBlockerBefore.observed_by) as MutableRecord)) || null,
  observationMethod:
    asString(currentCompact.observationMethod) ||
    asString(compactHolderBlockerBefore.observation_method) ||
    null,
  nextCheckAt: asString(familyBlocker.next_check_at) || null,
  blockerOwner:
    asString(currentCompact.blockerOwner) ||
    asString(compactHolderBlockerBefore.owner) ||
    null,
  fallbackAt: asString(familyBlocker.fallback_at) || null,
  fallbackAction:
    asString(currentCompact.fallbackAction) ||
    asString(compactHolderBlockerBefore.fallback_action) ||
    null,
  reviewEvidencePath: appMemoPath,
  evidencePaths,
  ownerReason: compactOwnerReasonAfter,
  verificationBlocker: compactVerificationBlockerAfter,
  summary: compactSummaryAfter,
  lastCheckedAt: repairedAt,
});
saveFeatureCompactLoopState(applyCompactLoaded.path, applyCompactState);

const appliedTree = readTaskTree(config);
const appliedSpecState = readJson<SpecLoopState>(specLoopPath);
const appliedCompactState = readJson<Record<string, unknown>>(applyCompactLoaded.path);
const appliedPrivateCluster = asRecord(asRecord(appliedCompactState.features)[compactFeatureKey]);

console.log(
  JSON.stringify(
    {
      ...dryRunPlan,
      applied: true,
      familyCarrierAfter: summarizeState(appliedTree.tasks[familyCarrierTaskId]),
      retiredTasksAfter: specRepairs.map((repair) => summarizeState(appliedTree.tasks[repair.oldTaskId])),
      specLoopAfter: specRepairs.map((repair) => {
        const spec = appliedSpecState.specs[repair.specId];
        const review = asRecord(spec.review);
        return {
          specId: repair.specId,
          taskId: spec.taskId ?? null,
          pendingReviewTaskId:
            typeof review.pendingReviewTaskId === "string"
              ? review.pendingReviewTaskId
              : null,
          updatedAt: spec.updatedAt ?? null,
        };
      }),
      compactLoopAfter: {
        taskId: asString(appliedPrivateCluster.taskId) || null,
        frontierTaskIds: asStringArray(appliedPrivateCluster.frontierTaskIds),
        nextCheckAt: asString(appliedPrivateCluster.nextCheckAt) || null,
        fallbackAt: asString(appliedPrivateCluster.fallbackAt) || null,
        reviewEvidencePath: asString(appliedPrivateCluster.reviewEvidencePath) || null,
      },
    },
    null,
    2,
  ),
);
