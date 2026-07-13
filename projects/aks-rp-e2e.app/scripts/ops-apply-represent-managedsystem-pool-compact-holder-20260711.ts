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
import { readTaskTree, withTreeLock, type TaskNode } from "../workflows/lib/task-tree-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "managedsystem-pool";
const holderTaskId =
  "hold-compact-managedsystem-pool-adjacent-cli-client-surface-frontier-20260711";
const attemptId =
  "a_ops-apply-represent-managedsystem-pool-compact-holder-20260711_20260711191500";
const repairedAt = new Date().toISOString();

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

const blockerOwner = asString(feature.blockerOwner) || "aks-explorer";
const waitingFor = asRecord(feature.waitingFor);
const nextCheckAt = asString(feature.nextCheckAt) || "2026-07-12T18:00:00Z";
const fallbackAt = asString(feature.fallbackAt) || "2026-07-13T18:00:00Z";
const blockerCondition =
  asString(feature.blockedReason) ||
  asString(feature.waitingCondition) ||
  `Hold compact feature ${featureKey} until the exact adjacent CLI/client-surface frontier changes.`;
const resumeCondition =
  asString(feature.resumeCondition) ||
  `Resume compact proof for ${featureKey} only after the named adjacent CLI/client-surface frontier materially changes.`;
const observationMethod =
  asString(feature.observationMethod) ||
  "On each compact-loop tick, preserve this exact adjacent CLI wait unless one of the named resume triggers is evidenced.";
const observedBy = asRecord(feature.observedBy);
const outputs = [".state/feature-compact-loop/state.json", "evidence/archive/"];
const inputs = [
  `feature:${featureKey}`,
  `errorClass:${asString(feature.errorClass) || "adjacent-cli-client-surface-external-fix-wait"}`,
  `target:${asString((waitingFor as Record<string, unknown>).target) || "staging"}`,
  "branch:dev",
  "state:.state/feature-compact-loop/state.json",
];

const result = withTreeLock(config, () => {
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
    owner: blockerOwner,
    children: [],
    goal:
      "Hold compact feature managedsystem-pool on exact adjacent CLI/client-surface external-fix wait until the named condition changes.",
    inputs,
    outputs,
    acceptance: [
      "The feature remains blocked only while the exact adjacent CLI/client-surface condition is still true.",
      "Resume by resetting this feature to runnable compact work only after the named adjacent CLI/client-surface frontier materially changes.",
      "Do not broad-rerun the feature or family while the same input and compact fingerprint remain unchanged.",
    ],
    conflict_scope: [
      "feature-compact:managedsystem-pool",
      "feature:managedsystem-pool",
      "feature-compact-wait:adjacent-cli-client-surface-external-fix-wait",
    ],
    context: {
      featureCompactExactWait: true,
      featureKey,
      errorClass:
        asString(feature.errorClass) ||
        "adjacent-cli-client-surface-external-fix-wait",
      target: asString(waitingFor.target) || "staging",
    },
    blocker: {
      condition: blockerCondition,
      category: "external-wait",
      owner: blockerOwner,
      blocked_at: asString(feature.blockedAt) || repairedAt,
      waiting_for: waitingFor,
      observed_by:
        Object.keys(observedBy).length > 0
          ? observedBy
          : {
              workflow: "feature-compact-loop-controller",
              trigger: "project.task.tick",
            },
      observation_method: observationMethod,
      next_check_at: nextCheckAt,
      resume_condition: resumeCondition,
      fallback_at: fallbackAt,
      fallback_action:
        asString(feature.fallbackAction) ||
        "If the same wait remains true, refresh evidence or replace the holder with a narrower exact wait.",
    },
    trace: {
      created_at: repairedAt,
      created_by: "app-ops-script",
      managedsystem_compact_holder_restored_at: repairedAt,
      managedsystem_compact_holder_restored_by: "app-ops-script",
      managedsystem_compact_holder_restore_attempt_id: attemptId,
    },
  };

  task.state = "blocked";
  task.status = "blocked";
  task.owner = blockerOwner;
  task.parent_id = loopTaskId;
  task.blocker = {
    condition: blockerCondition,
    category: "external-wait",
    owner: blockerOwner,
    blocked_at: asString(feature.blockedAt) || repairedAt,
    waiting_for: waitingFor,
    observed_by:
      Object.keys(observedBy).length > 0
        ? observedBy
        : {
            workflow: "feature-compact-loop-controller",
            trigger: "project.task.tick",
          },
    observation_method: observationMethod,
    next_check_at: nextCheckAt,
    resume_condition: resumeCondition,
    fallback_at: fallbackAt,
    fallback_action:
      asString(feature.fallbackAction) ||
      "If the same wait remains true, refresh evidence or replace the holder with a narrower exact wait.",
  };
  task.context = {
    ...asRecord(task.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass:
      asString(feature.errorClass) ||
      "adjacent-cli-client-surface-external-fix-wait",
    target: asString(waitingFor.target) || "staging",
  };
  task.trace = {
    ...asRecord(task.trace),
    managedsystem_compact_holder_restored_at: repairedAt,
    managedsystem_compact_holder_restored_by: "app-ops-script",
    managedsystem_compact_holder_restore_attempt_id: attemptId,
  };
  tree.tasks[holderTaskId] = task;

  const loopChildren = asStringArray(loopTask.children);
  if (!loopChildren.includes(holderTaskId)) {
    loopTask.children = [...loopChildren, holderTaskId];
  }

  const loopContext = asRecord(loopTask.context);
  const workflowProgress = asRecord(loopContext.workflowProgress);
  const unrepresentedBlockedFeatureKeys = asStringArray(
    workflowProgress.unrepresentedBlockedFeatureKeys,
  ).filter((value) => value !== featureKey);
  const unrepresentedNonTerminalFeatureKeys = asStringArray(
    workflowProgress.unrepresentedNonTerminalFeatureKeys,
  ).filter((value) => value !== featureKey);
  const representedFeatureKeys = uniqueSorted([
    ...asStringArray(workflowProgress.representedFeatureKeys),
    featureKey,
  ]);
  const previousUnrepresentedBlockedCount =
    typeof workflowProgress.unrepresentedBlockedCount === "number"
      ? workflowProgress.unrepresentedBlockedCount
      : 0;
  const previousUnrepresentedNonTerminalCount =
    typeof workflowProgress.unrepresentedNonTerminalCount === "number"
      ? workflowProgress.unrepresentedNonTerminalCount
      : 0;
  const previousBlockedWaitBlockedCount =
    typeof workflowProgress.blockedWaitBlockedCount === "number"
      ? workflowProgress.blockedWaitBlockedCount
      : 0;
  const previousBlockedWaitChildren =
    typeof workflowProgress.blockedWaitChildren === "number"
      ? workflowProgress.blockedWaitChildren
      : 0;
  const holderWasMissing = !existing || !loopChildren.includes(holderTaskId);
  const nextBlockedWaitBlockedCount =
    previousBlockedWaitBlockedCount + (holderWasMissing ? 1 : 0);
  const nextBlockedWaitChildren =
    previousBlockedWaitChildren + (holderWasMissing ? 1 : 0);
  const pending =
    typeof workflowProgress.pending === "number" ? workflowProgress.pending : 0;
  const running =
    typeof workflowProgress.running === "number" ? workflowProgress.running : 0;
  const openChildren =
    typeof workflowProgress.openChildren === "number"
      ? workflowProgress.openChildren
      : 0;
  const openSupportChildren =
    typeof workflowProgress.openSupportChildren === "number"
      ? workflowProgress.openSupportChildren
      : 0;
  const blocked =
    typeof workflowProgress.blocked === "number" ? workflowProgress.blocked : 0;
  const nextUnrepresentedBlockedCount = Math.max(
    0,
    previousUnrepresentedBlockedCount - (asStringArray(workflowProgress.unrepresentedBlockedFeatureKeys).includes(featureKey) ? 1 : 0),
  );
  const nextUnrepresentedNonTerminalCount = Math.max(
    0,
    previousUnrepresentedNonTerminalCount - (asStringArray(workflowProgress.unrepresentedNonTerminalFeatureKeys).includes(featureKey) ? 1 : 0),
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
    unrepresentedBlockedFeatureKeys,
    unrepresentedNonTerminalFeatureKeys,
    representedFeatureKeys,
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
    taskId: holderTaskId,
    frontierTaskIds: [holderTaskId],
    updatedAt: repairedAt,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  saveFeatureCompactLoopState(compactStatePath, compactState);

  return {
    attemptId,
    repairedAt,
    holderTaskId,
    featureKey,
    taskCreated: !existing,
    loopChildrenContainsHolder: asStringArray(loopTask.children).includes(holderTaskId),
    workflowProgress: loopContext.workflowProgress,
    compactFeatureTaskId: compactState.features[featureKey]?.taskId ?? null,
    compactFeatureFrontierTaskIds:
      compactState.features[featureKey]?.frontierTaskIds ?? null,
  };
});

console.log(JSON.stringify(result, null, 2));
