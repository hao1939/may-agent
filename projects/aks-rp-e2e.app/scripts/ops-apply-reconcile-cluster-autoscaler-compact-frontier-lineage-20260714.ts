import { mkdirSync, writeFileSync } from "node:fs";
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
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

const attemptId =
  "a_ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714_20260714224157";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const worker = process.env.WORKER ?? "app-ops";
const repairedAt = new Date().toISOString();
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "cluster-autoscaler";
const holderTaskId =
  "hold-compact-cluster-autoscaler-five-carrier-frontier-20260714";
const memoPath =
  "evidence/archive/ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714.md";
const retiredReviewTaskId =
  "ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713";
const representedTaskIds = [
  "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
  "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
  "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
  "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
  "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
] as const;
const nextCheckAt = "2026-07-15T20:40:00Z";
const fallbackAt = "2026-07-16T20:40:00Z";
const blockerCondition =
  "Compact cluster-autoscaler remains package-partial only because the exact five governed downstream carriers are still unresolved: wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708, wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708, hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708, hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708, and hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709. The prior compact-facing pointer referenced retired review leaf ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713, so the app must preserve one sharp compact-facing holder over those same five live carriers instead of reopening a broad rerun.";
const resumeCondition =
  "Resume only when accepted evidence materially changes one of the five governed downstream carriers, when a published repo-local cluster-autoscaler compact/runtime/spec repair changes that exact frontier, or when this five-carrier compact-facing holder is replaced by a sharper same-lineage projection.";
const fallbackAction =
  "If the same five-carrier frontier still holds at fallback time, refresh this exact compact-facing holder from the current downstream waits and same-lineage evidence instead of reopening an unchanged broad compact rerun.";
const ownerReason =
  "All feature-owned specs are already selected into the compact package, so the remaining controller-visible cluster-autoscaler compact frontier is the exact five-carrier downstream wait family rather than missing package membership or a truthful broad rerun candidate.";
const summary =
  "Restored a sharp compact-facing cluster-autoscaler holder over the exact five governed downstream carriers and repointed feature-compact state away from the retired review leaf.";
const lastSummary =
  "Current cluster-autoscaler compact partial is represented by one exact compact-facing five-carrier holder over the unchanged local-storage, mincount, row49 overscale, row50 FIPS, and provisioning-request downstream waits. No broad compact rerun is truthful. See evidence/archive/ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714.md.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

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

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function writeMemo(content: string) {
  const absolute = resolve(appDir, memoPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

const { state: compactState, path: compactStatePath } =
  loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 1,
    refreshFromProject: false,
  });

const featureBefore = compactState.features[featureKey];
if (!featureBefore) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

const beforeTaskId = asString(featureBefore.taskId) || null;
const beforeFrontierTaskIds = asStringArray(featureBefore.frontierTaskIds);
const beforeNextCheckAt = asString(featureBefore.nextCheckAt) || null;
const beforeFallbackAt = asString(featureBefore.fallbackAt) || null;

const treeResult = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) throw new Error(`Task not found: ${loopTaskId}`);

  const representedTaskDetails = representedTaskIds.map((taskId) => {
    const task = tree.tasks[taskId];
    if (!task) throw new Error(`Represented frontier task missing: ${taskId}`);
    if (task.state !== "blocked") {
      throw new Error(
        `Represented frontier task must stay blocked: ${taskId}=${String(task.state)}`,
      );
    }
    const blocker = asRecord(task.blocker);
    return {
      id: taskId,
      goal: task.goal ?? null,
      nextCheckAt: asString(blocker.next_check_at) || null,
      fallbackAt: asString(blocker.fallback_at) || null,
    };
  });

  const existing = tree.tasks[holderTaskId];
  const holder: TaskNode =
    existing ??
    ({
      id: holderTaskId,
      parent_id: loopTaskId,
      state: "blocked",
      status: "blocked",
      kind: "domain_leaf",
      priority: "P2",
      owner: "aks-explorer",
      children: [],
      goal:
        "Hold compact feature cluster-autoscaler on the exact five-carrier package-partial frontier until one represented downstream carrier materially changes.",
      inputs: [
        "feature:cluster-autoscaler",
        "errorClass:package-partial",
        "target:staging",
        "state:.state/feature-compact-loop/state.json",
      ],
      outputs: [".state/feature-compact-loop/state.json", "evidence/archive/"],
      acceptance: [
        "The holder remains blocked only while the exact five represented cluster-autoscaler downstream carriers remain true.",
        "The holder names exactly the five governed downstream carrier ids and no retired review leaf.",
        "Resume by reopening only the changed cluster-autoscaler branch when one represented carrier materially changes instead of broad-rerunning the whole compact package.",
      ],
      forbidden: [],
      conflict_scope: [
        "feature-compact:cluster-autoscaler",
        "feature:cluster-autoscaler",
        "feature-compact-wait:package-partial",
      ],
      depends_on: [],
      trace: {
        created_at: repairedAt,
        created_by: worker,
      },
    } as TaskNode);

  holder.parent_id = loopTaskId;
  holder.state = "blocked";
  holder.status = "blocked";
  holder.owner = "aks-explorer";
  holder.goal =
    "Hold compact feature cluster-autoscaler on the exact five-carrier package-partial frontier until one represented downstream carrier materially changes.";
  holder.inputs = [
    "feature:cluster-autoscaler",
    "errorClass:package-partial",
    "target:staging",
    "state:.state/feature-compact-loop/state.json",
  ];
  holder.outputs = [".state/feature-compact-loop/state.json", "evidence/archive/"];
  holder.acceptance = [
    "The holder remains blocked only while the exact five represented cluster-autoscaler downstream carriers remain true.",
    "The holder names exactly the five governed downstream carrier ids and no retired review leaf.",
    "Resume by reopening only the changed cluster-autoscaler branch when one represented carrier materially changes instead of broad-rerunning the whole compact package.",
  ];
  holder.conflict_scope = [
    "feature-compact:cluster-autoscaler",
    "feature:cluster-autoscaler",
    "feature-compact-wait:package-partial",
  ];
  holder.context = {
    ...asRecord(holder.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    compactFrontierTaskIds: [...representedTaskIds],
    frontierTaskIds: [...representedTaskIds],
    retiredCompactTaskId: retiredReviewTaskId,
    reviewEvidencePath: memoPath,
  };
  holder.blocker = {
    condition: blockerCondition,
    category: "external-wait",
    owner: "aks-explorer",
    blocked_at:
      asString(asRecord(holder.blocker).blocked_at) ||
      asString(featureBefore.blockedAt) ||
      repairedAt,
    waiting_for: {
      type: "compact.frontier.changed",
      taskId: holderTaskId,
      featureKey,
      target: "staging",
      errorClass: "package-partial",
      scope: "feature-compact",
      frontierTaskIds: [...representedTaskIds],
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
    observation_method:
      "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    resume_condition: resumeCondition,
    next_check_at: nextCheckAt,
    fallback_at: fallbackAt,
    fallback_action: fallbackAction,
  };
  holder.result = summary;
  holder.trace = {
    ...asRecord(holder.trace),
    cluster_autoscaler_compact_holder_restored_at: repairedAt,
    cluster_autoscaler_compact_holder_restored_by: worker,
    cluster_autoscaler_compact_holder_restore_attempt_id: attemptId,
    represented_frontier_task_ids: [...representedTaskIds],
  };

  tree.tasks[holderTaskId] = holder;
  const loopChildren = asStringArray(loopTask.children);
  if (!loopChildren.includes(holderTaskId)) {
    loopTask.children = [...loopChildren, holderTaskId];
  }

  const loopContext = asRecord(loopTask.context);
  const workflowProgress = asRecord(loopContext.workflowProgress);
  const representedFeatureKeys = uniqueSorted([
    ...asStringArray(workflowProgress.representedFeatureKeys),
    featureKey,
  ]);
  const holderWasMissing = !existing || !loopChildren.includes(holderTaskId);
  const previousBlockedWaitChildren =
    typeof workflowProgress.blockedWaitChildren === "number"
      ? workflowProgress.blockedWaitChildren
      : 0;
  const previousBlockedWaitBlockedCount =
    typeof workflowProgress.blockedWaitBlockedCount === "number"
      ? workflowProgress.blockedWaitBlockedCount
      : 0;
  const nextBlockedWaitChildren = holderWasMissing
    ? previousBlockedWaitChildren + 1
    : previousBlockedWaitChildren;
  const nextBlockedWaitBlockedCount = holderWasMissing
    ? previousBlockedWaitBlockedCount + 1
    : previousBlockedWaitBlockedCount;
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
  const nextUnrepresentedBlockedCount =
    typeof workflowProgress.unrepresentedBlockedCount === "number"
      ? workflowProgress.unrepresentedBlockedCount
      : 0;
  const nextUnrepresentedNonTerminalCount =
    typeof workflowProgress.unrepresentedNonTerminalCount === "number"
      ? workflowProgress.unrepresentedNonTerminalCount
      : 0;
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
    representedFeatureKeys,
    blockedWaitChildren: nextBlockedWaitChildren,
    blockedWaitBlockedCount: nextBlockedWaitBlockedCount,
    noRefillNow: noRefillNow ? true : undefined,
    reason: noRefillNow
      ? "feature-compact loop has no runnable planner or support children; the remaining frontier is exact blocked wait stewardship until a stated resume signal lands"
      : asString(workflowProgress.reason) ||
        "feature-compact loop state still has non-terminal features",
    updatedAt: repairedAt,
  };
  loopTask.context = loopContext;

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    holderCreated: !existing,
    representedTaskDetails,
    loopChildrenContainsHolder: asStringArray(loopTask.children).includes(
      holderTaskId,
    ),
    workflowProgress: loopContext.workflowProgress,
  };
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  taskId: holderTaskId,
  frontierTaskIds: [...representedTaskIds],
  retryable: false,
  retryReason: resumeCondition,
  blockedReason: blockerCondition,
  waitingFor: {
    type: "compact.frontier.changed",
    taskId: holderTaskId,
    featureKey,
    target: "staging",
    errorClass: "package-partial",
    scope: "feature-compact",
    frontierTaskIds: [...representedTaskIds],
  },
  waitingCondition: resumeCondition,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction,
  ownerReason,
  lastSummary,
  summary,
  reviewEvidencePath: memoPath,
  evidencePaths: unique([memoPath, ...(featureBefore.evidencePaths ?? [])]),
  attemptedFixes: unique([
    ...(featureBefore.attemptedFixes ?? []),
    `Restored compact-facing holder ${holderTaskId} over the unchanged five governed downstream carriers and repointed controller-visible state away from ${retiredReviewTaskId} in worker attempt ${attemptId}.`,
  ]),
  resumeCondition,
  resumeAction:
    "Reset this feature compact record to pending only after one of the named five carriers materially changes or this holder is replaced by a sharper same-lineage projection.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "package-partial",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  lastCheckedAt: repairedAt,
  updatedAt: repairedAt,
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const featureAfter = compactState.features[featureKey];
if (!featureAfter) {
  throw new Error(`Feature state missing after update: ${featureKey}`);
}

const memo = `# App apply: cluster-autoscaler compact frontier lineage repair — 2026-07-14

- Task: \`ops-apply-reconcile-cluster-autoscaler-compact-frontier-lineage-20260714\`
- Attempt: \`${attemptId}\`
- Applied at: \`${repairedAt}\`
- Holder: \`${holderTaskId}\`
- Retired compact pointer removed: \`${retiredReviewTaskId}\`
- Feature row: \`${featureKey}\` in \`.state/feature-compact-loop/state.json\`

## Baseline before repair

- \`features.cluster-autoscaler.taskId\` pointed at retired review leaf \`${beforeTaskId}\`.
- \`features.cluster-autoscaler.frontierTaskIds\` still preserved the exact five governed downstream carriers: ${beforeFrontierTaskIds.map((taskId) => `\`${taskId}\``).join(", ")}.
- \`features.cluster-autoscaler.nextCheckAt\` was \`${beforeNextCheckAt}\` and \`fallbackAt\` was \`${beforeFallbackAt}\`, earlier than the slowest surviving governed carrier window.
- No live compact-facing blocked holder existed for cluster-autoscaler under \`aks-feature-compact-loop\`.

## Applied repair

Restored one sharp compact-facing blocked holder under \`aks-feature-compact-loop\` and repointed controller-visible compact state to it.

### Exact represented downstream carriers

${representedTaskIds.map((taskId) => `- \`${taskId}\``).join("\n")}

### Holder contract

- Goal: Preserve the exact five-carrier cluster-autoscaler compact frontier until one represented downstream carrier materially changes.
- Blocker owner: \`aks-explorer\`
- Next check: \`${nextCheckAt}\`
- Fallback: \`${fallbackAt}\`
- Resume condition: ${resumeCondition}

## Before → after highlights

- Feature taskId: ${JSON.stringify(beforeTaskId)} → ${JSON.stringify(featureAfter.taskId ?? null)}
- Feature frontierTaskIds: ${JSON.stringify(beforeFrontierTaskIds)} → ${JSON.stringify(featureAfter.frontierTaskIds ?? null)}
- Feature nextCheckAt: ${JSON.stringify(beforeNextCheckAt)} → ${JSON.stringify(featureAfter.nextCheckAt ?? null)}
- Feature fallbackAt: ${JSON.stringify(beforeFallbackAt)} → ${JSON.stringify(featureAfter.fallbackAt ?? null)}
- Feature reviewEvidencePath: ${JSON.stringify(featureBefore.reviewEvidencePath ?? null)} → ${JSON.stringify(featureAfter.reviewEvidencePath ?? null)}

## Result

The live app-owned compact state no longer points at retired review leaf \`${retiredReviewTaskId}\`. Instead it points at live holder \`${holderTaskId}\`, while \`frontierTaskIds\` continues to preserve only the exact five governed downstream carrier ids with no reopened broad cluster-autoscaler rerun.
`;

writeMemo(memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      holderTaskId,
      featureKey,
      beforeTaskId,
      afterTaskId: featureAfter.taskId ?? null,
      beforeFrontierTaskIds,
      afterFrontierTaskIds: featureAfter.frontierTaskIds ?? null,
      beforeNextCheckAt,
      afterNextCheckAt: featureAfter.nextCheckAt ?? null,
      beforeFallbackAt,
      afterFallbackAt: featureAfter.fallbackAt ?? null,
      memoPath,
      treeResult,
    },
    null,
    2,
  ),
);
