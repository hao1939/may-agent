import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
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
const featureKey = "node-ephemeral-os-disk";
const holderTaskId =
  "wait-compact-node-ephemeral-os-disk-resourcedisk-authority-or-reclassify-20260703";
const specId = "spec.node-ephemeral-disk.resource-placement";
const attemptId =
  "a_ops-apply-repair-node-ephemeral-os-disk-compact-state-representation-202_20260711204449";
const repairedAt = new Date().toISOString();
const nextCheckAt = "2026-07-12T20:30:00Z";
const fallbackAt = "2026-07-13T20:30:00Z";
const blockerCondition =
  'Blocked on the exact explicit public managed-cluster create boundary for compact node-ephemeral-os-disk: the current carrier sends agentPoolProfiles[].osDiskPlacement=ResourceDisk, but preserved live compact artifact 28598014702 still fails on API 2026-03-02-preview with HTTP 400 / UnmarshalError / json: unknown field "osDiskPlacement". Mounted handwritten e2ev3 source still proves only the adjacent CacheDisk scenario, and mounted public managed-cluster schema/model surfaces still omit osDiskPlacement from ManagedClusterAgentPoolProfileProperties. Keep the separately verified omitted-field sibling spec.node-ephemeral-disk.auto-resource-placement out of this wait\'s resume condition.';
const resumeCondition =
  "Resume when authoritative evidence changes the exact explicit managed-cluster create contract for agentPoolProfiles[].osDiskPlacement=ResourceDisk, or when owner-approved reclassification removes this explicit branch from the compact live frontier. The already verified omitted-field sibling is not itself a resume trigger.";
const fallbackAction =
  "If the explicit ResourceDisk create boundary is still unchanged at fallback, refresh this exact wait again with current mounted-source and exact-path artifact evidence, or replace it only with an owner-approved explicit-branch reclassification or escalation successor; do not reopen an unchanged rerun and do not collapse the explicit branch into the derived sibling.";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const { state: compactState } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const feature = compactState.features[featureKey];
if (!feature) throw new Error(`Compact state missing feature ${featureKey}`);

const result = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);

  const existing = tree.tasks[holderTaskId];
  const holderExisted = Boolean(existing);
  const holderInChildren = asStringArray(loopTask.children).includes(holderTaskId);
  const blockedAt = asString(feature.blockedAt) || "2026-07-03T00:48:26.477Z";

  const holderTask: TaskNode = existing ?? {
    id: holderTaskId,
    parent_id: loopTaskId,
    state: "blocked",
    status: "blocked",
    kind: "domain_leaf",
    priority: "P2",
    owner: "aks-explorer",
    children: [],
    goal:
      "Hold the compact node-ephemeral-os-disk branch only on the explicit managed-cluster create boundary that sends ResourceDisk placement until authoritative support or accepted reclassification changes that live-ready frontier.",
    inputs: [
      `feature:${featureKey}`,
      `spec:${specId}`,
      "errorClass:reviewed-exception",
      "target:staging",
      "state:.state/feature-compact-loop/state.json",
    ],
    outputs: [
      ".state/feature-compact-loop/state.json",
      "evidence/archive/",
    ],
    acceptance: [
      "The restored compact-facing wait is bound to spec.node-ephemeral-disk.resource-placement rather than the verified omitted-field sibling.",
      "The wait preserves the exact explicit ResourceDisk create blocker, resume condition, next_check_at, fallback_at, and fallback action from the reviewed repair memo.",
    ],
    forbidden: [],
    conflict_scope: [
      `feature-compact:${featureKey}`,
      `feature:${featureKey}`,
      "feature-compact-wait:reviewed-exception",
      `spec:${specId}`,
    ],
    depends_on: [],
    context: {
      featureCompactExactWait: true,
      featureKey,
      specId,
      representedSpecIds: [specId],
      errorClass: "reviewed-exception",
      target: "staging",
    },
    blocker: {
      condition: blockerCondition,
      category: "external-wait",
      owner: "human",
      blocked_at: blockedAt,
      waiting_for: {
        type: "evidence.available",
        taskId: holderTaskId,
      },
      observed_by: {
        workflow: "project-planner",
        schedule: "blocked-frontier-owner-review",
        trigger: "project.planning.requested",
      },
      observation_method:
        "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
      next_check_at: nextCheckAt,
      resume_condition: resumeCondition,
      fallback_at: fallbackAt,
      fallback_action: fallbackAction,
    },
    trace: {
      created_at: blockedAt,
      created_by: "app-ops-script",
    },
  };

  holderTask.parent_id = loopTaskId;
  holderTask.state = "blocked";
  holderTask.status = "blocked";
  holderTask.owner = "aks-explorer";
  holderTask.blocker = {
    condition: blockerCondition,
    category: "external-wait",
    owner: "human",
    blocked_at: blockedAt,
    waiting_for: {
      type: "evidence.available",
      taskId: holderTaskId,
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-owner-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    next_check_at: nextCheckAt,
    resume_condition: resumeCondition,
    fallback_at: fallbackAt,
    fallback_action: fallbackAction,
  };
  holderTask.context = {
    ...asRecord(holderTask.context),
    featureCompactExactWait: true,
    featureKey,
    specId,
    representedSpecIds: [specId],
    errorClass: "reviewed-exception",
    target: "staging",
  };
  delete (holderTask as Record<string, unknown>).done_at;
  delete (holderTask as Record<string, unknown>).done_by;
  delete (holderTask as Record<string, unknown>).resolution;
  holderTask.result =
    "Restored exact blocked compact holder for spec.node-ephemeral-disk.resource-placement after stale sibling-based closure removed the only truthful compact-facing wait.";
  holderTask.trace = {
    ...asRecord(holderTask.trace),
    node_ephemeral_compact_holder_restored_at: repairedAt,
    node_ephemeral_compact_holder_restored_by: "app-ops-script",
    node_ephemeral_compact_holder_restore_attempt_id: attemptId,
    node_ephemeral_compact_holder_restore_reason:
      "Compact state still blocks node-ephemeral-os-disk on the explicit ResourceDisk create branch, so the archived stale-sibling closure was reversed by restoring the exact blocked holder.",
  };
  tree.tasks[holderTaskId] = holderTask;

  const loopChildren = asStringArray(loopTask.children);
  if (!loopChildren.includes(holderTaskId)) {
    loopTask.children = [...loopChildren, holderTaskId];
  }

  const loopContext = asRecord(loopTask.context);
  const workflowProgress = asRecord(loopContext.workflowProgress);
  const previousUnrepresentedBlockedKeys = asStringArray(
    workflowProgress.unrepresentedBlockedFeatureKeys,
  );
  const previousUnrepresentedNonTerminalKeys = asStringArray(
    workflowProgress.unrepresentedNonTerminalFeatureKeys,
  );
  const previousRepresentedFeatureKeys = asStringArray(
    workflowProgress.representedFeatureKeys,
  );
  const removedFromBlocked = previousUnrepresentedBlockedKeys.includes(featureKey)
    ? 1
    : 0;
  const removedFromNonTerminal = previousUnrepresentedNonTerminalKeys.includes(
    featureKey,
  )
    ? 1
    : 0;
  const nextUnrepresentedBlockedFeatureKeys = previousUnrepresentedBlockedKeys.filter(
    (value) => value !== featureKey,
  );
  const nextUnrepresentedNonTerminalFeatureKeys = previousUnrepresentedNonTerminalKeys.filter(
    (value) => value !== featureKey,
  );
  const nextRepresentedFeatureKeys = uniqueSorted([
    ...previousRepresentedFeatureKeys,
    featureKey,
  ]);
  const previousBlockedWaitBlockedCount =
    typeof workflowProgress.blockedWaitBlockedCount === "number"
      ? workflowProgress.blockedWaitBlockedCount
      : 0;
  const previousBlockedWaitChildren =
    typeof workflowProgress.blockedWaitChildren === "number"
      ? workflowProgress.blockedWaitChildren
      : 0;
  const nextBlockedWaitBlockedCount =
    previousBlockedWaitBlockedCount + (holderExisted || holderInChildren ? 0 : 1);
  const nextBlockedWaitChildren =
    previousBlockedWaitChildren + (holderExisted || holderInChildren ? 0 : 1);
  const pending =
    typeof workflowProgress.pending === "number" ? workflowProgress.pending : 0;
  const running =
    typeof workflowProgress.running === "number" ? workflowProgress.running : 0;
  const blocked =
    typeof workflowProgress.blocked === "number" ? workflowProgress.blocked : 0;
  const openChildren =
    typeof workflowProgress.openChildren === "number"
      ? workflowProgress.openChildren
      : 0;
  const openSupportChildren =
    typeof workflowProgress.openSupportChildren === "number"
      ? workflowProgress.openSupportChildren
      : 0;
  const nextUnrepresentedBlockedCount = Math.max(
    0,
    (typeof workflowProgress.unrepresentedBlockedCount === "number"
      ? workflowProgress.unrepresentedBlockedCount
      : 0) - removedFromBlocked,
  );
  const nextUnrepresentedNonTerminalCount = Math.max(
    0,
    (typeof workflowProgress.unrepresentedNonTerminalCount === "number"
      ? workflowProgress.unrepresentedNonTerminalCount
      : 0) - removedFromNonTerminal,
  );
  const noRefillNow =
    pending === 0 &&
    running === 0 &&
    openChildren === 0 &&
    openSupportChildren === 0 &&
    nextUnrepresentedNonTerminalCount === 0 &&
    blocked > 0 &&
    nextBlockedWaitChildren > 0;

  loopContext.workflowProgress = {
    ...workflowProgress,
    blockedWaitBlockedCount: nextBlockedWaitBlockedCount,
    blockedWaitChildren: nextBlockedWaitChildren,
    unrepresentedBlockedCount: nextUnrepresentedBlockedCount,
    unrepresentedNonTerminalCount: nextUnrepresentedNonTerminalCount,
    unrepresentedBlockedFeatureKeys: nextUnrepresentedBlockedFeatureKeys,
    unrepresentedNonTerminalFeatureKeys: nextUnrepresentedNonTerminalFeatureKeys,
    representedFeatureKeys: nextRepresentedFeatureKeys,
    noRefillNow: noRefillNow ? true : undefined,
    reason: noRefillNow
      ? "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands"
      : asString(workflowProgress.reason) ||
        "feature-compact loop state still has non-terminal features",
    updatedAt: repairedAt,
  };
  loopTask.context = loopContext;

  compactState.features[featureKey] = {
    ...feature,
    status: "blocked",
    errorClass: "reviewed-exception",
    retryable: false,
    retryReason:
      "Resume when authoritative ResourceDisk create support is available for the exact compact managed-cluster create path that sends agentPoolProfiles[].osDiskPlacement=ResourceDisk, or when an accepted reclassification/rehoming removes this branch from the default compact live frontier.",
    taskId: holderTaskId,
    frontierTaskIds: [holderTaskId],
    rootCauseClassification:
      "reviewed-exception-explicit-osdiskplacement-create-shape-unsupported",
    nextStepClassification:
      "Keep the explicit ResourceDisk create carrier blocked and continue only on authoritative support recovery or accepted branch reclassification.",
    resumeCondition,
    blockedAt,
    blockedReason: blockerCondition,
    waitingFor: {
      type: "evidence.available",
      taskId: holderTaskId,
    },
    waitingCondition: resumeCondition,
    observedBy: {
      workflow: "project-planner",
      schedule: "blocked-frontier-owner-review",
      trigger: "project.planning.requested",
    },
    observationMethod:
      "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    nextCheckAt,
    blockerOwner: "human",
    fallbackAt,
    fallbackAction,
    resumeAction:
      "Reset this feature compact record to pending only after the named wait condition changes.",
    blockedScope: {
      kind: "feature",
      ids: [featureKey],
    },
    blockedFingerprint: {
      errorClass: "reviewed-exception",
      target: "staging",
      branch: "dev",
      featureKey,
    },
    lastCheckedAt: repairedAt,
    evidencePaths: uniqueSorted([
      ...asStringArray(feature.evidencePaths),
      "evidence/archive/review-compact-terminal-run-frontier-wave-b-20260706.md",
      ".state/feature-compact-loop/artifacts/28598014702/aks-rp-e2e-28598014702-test-results/test-results/feature-compact-node-ephemeral-os-disk-staging_141004/result.json",
      "features/node-ephemeral-os-disk/compact/staging.diagnostics.json",
      "features/node-ephemeral-os-disk/compact/staging.summary.md",
      "/app/projects/aks-rp-e2e/evidence/archive/repair-node-ephemeral-os-disk-compact-state-representation-20260711.md",
    ]),
    reviewEvidencePath:
      "/app/projects/aks-rp-e2e/evidence/archive/repair-node-ephemeral-os-disk-compact-state-representation-20260711.md",
    verificationBlocker:
      "Do not rerun unchanged: the explicit ResourceDisk create carrier remains blocked on reviewed HTTP 400 / UnmarshalError / json: unknown field \"osDiskPlacement\" evidence until authoritative support or accepted explicit-branch reclassification lands.",
    summary:
      "Restored node-ephemeral-os-disk to one exact compact-facing blocked holder for spec.node-ephemeral-disk.resource-placement so the compact loop now represents the reviewed explicit ResourceDisk create frontier.",
    updatedAt: repairedAt,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  saveFeatureCompactLoopState(compactStatePath, compactState);

  return {
    attemptId,
    repairedAt,
    holderTaskId,
    holderExisted,
    holderInChildren,
    loopChildrenContainsHolder: asStringArray(loopTask.children).includes(holderTaskId),
    workflowProgress: loopContext.workflowProgress,
    compactFeatureTaskId: compactState.features[featureKey]?.taskId ?? null,
    compactFeatureFrontierTaskIds:
      compactState.features[featureKey]?.frontierTaskIds ?? null,
    compactFeatureNextCheckAt:
      compactState.features[featureKey]?.nextCheckAt ?? null,
    compactFeatureFallbackAt:
      compactState.features[featureKey]?.fallbackAt ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
