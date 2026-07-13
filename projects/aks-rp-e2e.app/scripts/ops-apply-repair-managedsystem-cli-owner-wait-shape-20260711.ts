import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  taskTreeConfig,
  saveTaskTreeWithKanbanSnapshot,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "managedsystem-pool";
const holderTaskId =
  "hold-compact-managedsystem-pool-adjacent-cli-client-surface-frontier-20260711";
const attemptId =
  "a_ops-apply-repair-managedsystem-cli-owner-wait-shape-20260711-state-repai_20260711191141";
const evidencePath =
  "evidence/archive/ops-apply-repair-managedsystem-cli-owner-wait-shape-20260711-state-repair.md";
const priorMemoPath =
  "evidence/archive/ops-repair-managedsystem-cli-owner-wait-shape-20260711.md";
const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const checkedAt = new Date().toISOString();

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

const waitingFor = {
  type: "project.approval.requested",
  featureKey,
  specId: "spec.managedsystem.cli-create-variant",
  pathId: "path.managedsystem.cli-create-default-payload",
  externalTool: "aks-preview",
  holderTaskId,
  packetPath: priorMemoPath,
  sendProofStatus: "missing",
  requestedBoundedOutcomes: [
    "fixed-cli-surface",
    "approved-alternate-invocation-shape",
    "explicit-retirement-rehome",
  ],
};

const blockerCondition =
  "Blocked because spec.managedsystem.cli-create-variant remains an adjacent non-canonical aks-preview ManagedSystem CLI default-payload carrier and no durable send proof exists yet for the exact owner ask on path.managedsystem.cli-create-default-payload. Send the bounded owner packet recorded in evidence/archive/ops-repair-managedsystem-cli-owner-wait-shape-20260711.md and keep broad compact reruns closed while awaiting either send proof or a returned bounded owner outcome.";
const resumeCondition =
  "Resume only when durable send proof exists for the exact aks-preview ManagedSystem CLI default-payload owner ask, or when the same-lineage owner returns one bounded outcome: a fixed aks-preview build strips the disallowed defaults, an owner confirms a contract-safe alternate CLI invocation shape, or an explicit owner decision rehomes/retires spec.managedsystem.cli-create-variant from the compact frontier.";
const fallbackAction =
  "If no same-lineage send proof exists by fallback, create or route one bounded exact owner-ask packet for the aks-preview ManagedSystem CLI default-payload lineage instead of preserving passive adjacent-wait wording or reopening a broad compact rerun.";
const observationMethod =
  "On each compact-loop tick or owner-return audit, first check for exact send proof (project.approval.requested, message.created, or approval-dispatch evidence) for path.managedsystem.cli-create-default-payload; if send proof exists, replace this send-required holder with one exact owner-response wait on the same lineage.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const { state } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const feature = state.features[featureKey];
if (!feature) throw new Error(`Compact feature not found: ${featureKey}`);

const taskResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);

  const existing = tree.tasks[holderTaskId];
  const task: TaskNode = existing ?? {
    id: holderTaskId,
    parent_id: loopTaskId,
    state: "blocked",
    status: "blocked",
    kind: "domain_leaf",
    priority: "P2",
    owner: "aks-explorer",
    children: [],
    goal:
      "Hold compact feature managedsystem-pool on one exact send-required owner-facing ask for the adjacent aks-preview ManagedSystem CLI default-payload lineage until durable send proof or a same-lineage bounded owner outcome lands.",
    inputs: [
      "feature:managedsystem-pool",
      "errorClass:adjacent-cli-client-surface-external-fix-wait",
      "target:staging",
      "branch:dev",
      "state:.state/feature-compact-loop/state.json",
    ],
    outputs: [".state/feature-compact-loop/state.json", "evidence/archive/"],
    acceptance: [
      "The feature remains blocked only while no durable send proof exists yet for the exact aks-preview ManagedSystem CLI default-payload owner ask, or while the same-lineage owner has not yet returned one bounded outcome.",
      "Resume by replacing this send-required holder with one exact owner-response wait only after durable send proof exists, or by resetting the feature to runnable compact work only after the returned owner outcome materially changes the adjacent carrier.",
      "Do not broad-rerun managedsystem-pool or restore spec.managedsystem.cli-create-variant as a promotion candidate while the same CLI default-payload shape remains unchanged.",
    ],
    conflict_scope: [
      "feature-compact:managedsystem-pool",
      "feature:managedsystem-pool",
      "feature-compact-wait:adjacent-cli-client-surface-external-fix-wait",
    ],
    context: {
      featureCompactExactWait: true,
      featureKey,
      errorClass: "adjacent-cli-client-surface-external-fix-wait",
      target: "staging",
      ownerActionState: "send-required",
      pathId: "path.managedsystem.cli-create-default-payload",
    },
    trace: {
      created_at: checkedAt,
      created_by: "app-ops-script",
    },
  };

  task.parent_id = loopTaskId;
  task.state = "blocked";
  task.status = "blocked";
  task.owner = "aks-explorer";
  task.goal =
    "Hold compact feature managedsystem-pool on one exact send-required owner-facing ask for the adjacent aks-preview ManagedSystem CLI default-payload lineage until durable send proof or a same-lineage bounded owner outcome lands.";
  task.acceptance = [
    "The feature remains blocked only while no durable send proof exists yet for the exact aks-preview ManagedSystem CLI default-payload owner ask, or while the same-lineage owner has not yet returned one bounded outcome.",
    "Resume by replacing this send-required holder with one exact owner-response wait only after durable send proof exists, or by resetting the feature to runnable compact work only after the returned owner outcome materially changes the adjacent carrier.",
    "Do not broad-rerun managedsystem-pool or restore spec.managedsystem.cli-create-variant as a promotion candidate while the same CLI default-payload shape remains unchanged.",
  ];
  task.outputs = [".state/feature-compact-loop/state.json", "evidence/archive/"];
  task.blocker = {
    condition: blockerCondition,
    category: "external-wait",
    owner: "aks-explorer",
    blocked_at: "2026-07-11T18:00:00Z",
    waiting_for: waitingFor,
    observed_by: {
      workflow: "feature-compact-loop-controller",
      trigger: "project.task.tick",
    },
    observation_method: observationMethod,
    next_check_at: "2026-07-12T18:00:00Z",
    resume_condition: resumeCondition,
    fallback_at: "2026-07-13T18:00:00Z",
    fallback_action: fallbackAction,
  };
  task.context = {
    ...asRecord(task.context),
    featureCompactExactWait: true,
    evidence: [priorMemoPath, evidencePath],
    featureKey,
    errorClass: "adjacent-cli-client-surface-external-fix-wait",
    target: "staging",
    ownerActionState: "send-required",
    pathId: "path.managedsystem.cli-create-default-payload",
  };
  task.trace = {
    ...asRecord(task.trace),
    managedsystem_owner_wait_shape_repaired_at: checkedAt,
    managedsystem_owner_wait_shape_repaired_by: "app-ops-script",
    managedsystem_owner_wait_shape_repair_attempt_id: attemptId,
  };

  tree.tasks[holderTaskId] = task;

  const loopChildren = asStringArray(loopTask.children);
  if (!loopChildren.includes(holderTaskId)) {
    loopTask.children = [...loopChildren, holderTaskId];
  }

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    taskCreated: !existing,
    loopChildrenContainsHolder: asStringArray(loopTask.children).includes(holderTaskId),
  };
});

const attemptedFixes = [
  ...(feature.attemptedFixes ?? []),
  "Repaired managedsystem-pool compact state and live holder to one send-required owner-ask contract for the adjacent aks-preview ManagedSystem CLI default-payload lineage, replacing stale helper linkage and passive external-fix wording without reopening a broad compact rerun.",
];

const evidencePaths = unique([
  ...(feature.evidencePaths ?? []),
  priorMemoPath,
  evidencePath,
  "features/managedsystem-pool/compact/staging.summary.md",
  "features/managedsystem-pool/compact/staging.diagnostics.json",
]);

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  errorClass: "adjacent-cli-client-surface-external-fix-wait",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  retryReason:
    "Resume only when durable send proof exists for the exact aks-preview ManagedSystem CLI default-payload owner ask, or the same-lineage owner returns one bounded outcome: fixed CLI surface, approved contract-safe alternate invocation shape, or explicit retirement/rehome. Do not reopen the unchanged broad managedsystem-pool compact rerun.",
  rootCauseClassification:
    "non-canonical-adjacent-cli-client-surface-send-required-owner-ask",
  ownerReason:
    "spec.managedsystem.cli-create-variant remains an adjacent non-canonical aks-preview CLI request-construction/default-payload carrier. No durable send proof exists yet for the exact owner ask on path.managedsystem.cli-create-default-payload, so the truthful compact state is a send-required owner-ask contract rather than a passive external-fix wait or a sent owner-response wait.",
  attemptedFixes,
  nextStepClassification:
    "preserve one exact send-required owner-ask contract for the managedsystem CLI default-payload lineage until send proof or a returned bounded owner outcome lands; do not reopen a broad compact rerun",
  resumeCondition,
  blockedReason: blockerCondition,
  waitingFor,
  waitingCondition:
    "Wait first for durable send proof for the exact owner ask on path.managedsystem.cli-create-default-payload; once send proof exists, replace this holder with one exact owner-response wait on the same lineage instead of reopening a broad rerun.",
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod,
  blockerOwner: "aks-explorer",
  nextCheckAt: "2026-07-12T18:00:00Z",
  fallbackAt: "2026-07-13T18:00:00Z",
  fallbackAction,
  resumeAction:
    "Replace this holder with one exact owner-response wait only after durable send proof exists, or reset the compact frontier only after one of the named owner outcomes is evidenced.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "adjacent-cli-client-surface-external-fix-wait",
    featureKey,
    specId: "spec.managedsystem.cli-create-variant",
    pathId: "path.managedsystem.cli-create-default-payload",
    target: "staging",
    branch: "dev",
  },
  lastCheckedAt: checkedAt,
  evidencePaths,
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    "Do not rerun unchanged. This branch stays adjacent/non-canonical until exact send proof exists for the owner ask or the same-lineage owner returns one bounded decision.",
  summary:
    "managedsystem-pool now records spec.managedsystem.cli-create-variant as one exact send-required owner-ask contract for the adjacent aks-preview ManagedSystem CLI default-payload lineage; stale helper linkage is removed and broad compact reruns stay closed.",
});

saveFeatureCompactLoopState(compactStatePath, state);

console.log(
  JSON.stringify(
    {
      featureKey,
      taskId: state.features[featureKey]?.taskId ?? null,
      frontierTaskIds: state.features[featureKey]?.frontierTaskIds ?? null,
      waitingFor: state.features[featureKey]?.waitingFor ?? null,
      reviewEvidencePath: state.features[featureKey]?.reviewEvidencePath ?? null,
      nextCheckAt: state.features[featureKey]?.nextCheckAt ?? null,
      fallbackAt: state.features[featureKey]?.fallbackAt ?? null,
      checkedAt,
      ...taskResult,
    },
    null,
    2,
  ),
);
