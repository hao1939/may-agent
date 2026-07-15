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
  "a_ops-apply-reconcile-network-cni-holder-after-reviewed-publish-20260714-s_20260714183832";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-feature-compact-loop";
const featureKey = "network-cni";
const holderTaskId = "hold-compact-network-cni-package-partial-frontier-20260709i";
const reviewedMemoPath =
  "evidence/archive/ops-reconcile-network-cni-holder-after-reviewed-publish-20260714.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-network-cni-holder-after-reviewed-publish-20260714.md";
const appMemoAbsolute = resolve(appDir, appMemoPath);

const reviewedCheckpointCommit =
  "deb3f77023843d92d1322373b536236ab94dc9af";

const activeFrontierSpecIds = [
  "spec.network-cni.azure-overlay-agic-vm-prerelease",
  "spec.network-cni.azure-overlay-dual-stack",
  "spec.network-cni.kubenet-network-policy-calico",
  "spec.network-cni.none-byo-cni-vm-prerelease-lifecycle",
  "spec.network-cni.vm-prerelease-azure-npm-matrix",
  "spec.network-cni.vm-prerelease-azure-overlay-multi-subnet-matrix",
  "spec.network-cni.vm-prerelease-azure-overlay-upgrade-matrix",
  "spec.network-cni.vm-prerelease-calico-eno-migration-matrix",
  "spec.network-cni.vm-prerelease-calico-matrix",
  "spec.network-cni.vm-prerelease-cilium-matrix",
  "spec.network-cni.vm-prerelease-npm-uninstall-matrix",
  "spec.network-swift-v1.dynamic-ip-allocation",
] as const;

const removedFromFrontierSpecIds = [
  "spec.network-cni.azure-overlay-ilpip",
  "spec.network-cni.vm-prerelease-overlay-cilium-dualstack",
] as const;

const consumedPassHistorySpecIds = [
  "spec.network-cni.azure-overlay-dual-stack-migration",
  "spec.network-cni.azure-overlay-podcidr-expansion",
] as const;

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
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

const activeFrontierList = activeFrontierSpecIds.join(", ");
const consumedPassHistoryList = consumedPassHistorySpecIds.join(", ");
const removedFromFrontierList = removedFromFrontierSpecIds.join(", ");
const staleHolderGoalBeforeApply =
  "Preserve one exact compact network-cni family wait that names the current 14-member active blocked frontier and keeps dual-stack-migration plus podCIDR-expansion only as consumed pass history, not active blocked residue.";
const staleHolderBlockerConditionBeforeApply =
  "Current compact/spec-loop/spec-file evidence says the exact active network-cni compact frontier is the 14-member set spec.network-cni.azure-overlay-agic-vm-prerelease, spec.network-cni.azure-overlay-dual-stack, spec.network-cni.azure-overlay-ilpip, spec.network-cni.kubenet-network-policy-calico, spec.network-cni.none-byo-cni-vm-prerelease-lifecycle, spec.network-cni.vm-prerelease-azure-npm-matrix, spec.network-cni.vm-prerelease-azure-overlay-multi-subnet-matrix, spec.network-cni.vm-prerelease-azure-overlay-upgrade-matrix, spec.network-cni.vm-prerelease-calico-eno-migration-matrix, spec.network-cni.vm-prerelease-calico-matrix, spec.network-cni.vm-prerelease-cilium-matrix, spec.network-cni.vm-prerelease-npm-uninstall-matrix, spec.network-cni.vm-prerelease-overlay-cilium-dualstack, spec.network-swift-v1.dynamic-ip-allocation. Preserve spec.network-cni.azure-overlay-dual-stack-migration, spec.network-cni.azure-overlay-podcidr-expansion only as consumed pass history because repo writeback is already complete for both and they are no longer active blocked compact residue.";
const staleFeatureOwnerReasonBeforeApply =
  "All 69 active feature-owned specs remain selected into the compact package, and the maintained compact artifacts now split the controller-visible residue into 14 active-frontier blocked members (spec.network-cni.azure-overlay-agic-vm-prerelease, spec.network-cni.azure-overlay-dual-stack, spec.network-cni.azure-overlay-ilpip, spec.network-cni.kubenet-network-policy-calico, spec.network-cni.none-byo-cni-vm-prerelease-lifecycle, spec.network-cni.vm-prerelease-azure-npm-matrix, spec.network-cni.vm-prerelease-azure-overlay-multi-subnet-matrix, spec.network-cni.vm-prerelease-azure-overlay-upgrade-matrix, spec.network-cni.vm-prerelease-calico-eno-migration-matrix, spec.network-cni.vm-prerelease-calico-matrix, spec.network-cni.vm-prerelease-cilium-matrix, spec.network-cni.vm-prerelease-npm-uninstall-matrix, spec.network-cni.vm-prerelease-overlay-cilium-dualstack, spec.network-swift-v1.dynamic-ip-allocation) plus 2 consumed pass-history members (spec.network-cni.azure-overlay-dual-stack-migration, spec.network-cni.azure-overlay-podcidr-expansion). No truthful broad rerun or writeback-drift holder remains.";

const holderGoal =
  "Preserve one exact compact network-cni family wait that names the current 12-member active blocked frontier and keeps dual-stack-migration plus podCIDR-expansion only as consumed pass history, not active blocked residue.";
const holderAcceptance = [
  "The holder names the current exact 12-member network-cni compact frontier and excludes spec.network-cni.azure-overlay-ilpip plus spec.network-cni.vm-prerelease-overlay-cilium-dualstack from active blocked residue.",
  "spec.network-cni.azure-overlay-dual-stack-migration and spec.network-cni.azure-overlay-podcidr-expansion stay preserved only as consumed pass history, not as active blocked compact residue.",
  "Resume only when one of the 12 active-frontier members materially changes, or materially new same-path verification intent reopens one of the consumed pass-history members; do not rerun the broad compact package unchanged.",
];
const blockerCondition =
  `Current compact/spec-loop/spec-file evidence says the exact active network-cni compact frontier is the 12-member set ${activeFrontierList}. Preserve ${consumedPassHistoryList} only as consumed pass history because reviewed publish checkpoint ${reviewedCheckpointCommit} already moved ${removedFromFrontierList} to ready live-admitted status.`;
const resumeCondition =
  `Resume only when one of the 12 active-frontier members materially changes, is reclassified, or is replaced by sharper same-lineage evidence, or when materially new same-path verification intent reopens ${consumedPassHistoryList}. Do not rerun the broad compact package unchanged.`;
const fallbackAction =
  "If unchanged at fallback, keep or refresh this exact 12-member network-cni frontier holder from the latest same-lineage evidence; do not restore stale 14-member frontier wording, and do not reopen an unchanged broad compact rerun.";
const ownerReason =
  `All 69 active feature-owned specs remain selected into the compact package, and the reviewed publish checkpoint now leaves controller-visible residue as 12 active-frontier blocked members (${activeFrontierList}) plus 2 consumed pass-history members (${consumedPassHistoryList}). ${removedFromFrontierList} are already ready/live-admitted rather than blocked frontier residue.`;
const lastSummary =
  `Current network-cni compact partial is the exact 12-member active frontier (${activeFrontierList}); ${consumedPassHistoryList} remain preserved only as consumed pass history after reviewed publish checkpoint ${reviewedCheckpointCommit}. ${removedFromFrontierList} are no longer active frontier members. No broad compact rerun is truthful. See ${appMemoPath}.`;
const nextStepClassification =
  "preserve the exact 12-member network-cni active frontier while dual-stack-migration and podCIDR-expansion remain non-active consumed pass history";
const featureSummary =
  `${attemptId}: rewrote the live network-cni compact holder projection from the stale 14-member frontier to the exact 12-member frontier and kept passive capacity-wait wording absent.`;
const verificationBlocker =
  `An unchanged full-package rerun would still overclaim live readiness while network-cni regenerates as partial with the exact 12-member active frontier (${activeFrontierList}). ${consumedPassHistoryList} are already consumed pass history after reviewed publish checkpoint ${reviewedCheckpointCommit}, and ${removedFromFrontierList} are already ready/live-admitted, so do not treat any of those four specs as active blocked residue or queue unchanged reruns without materially new same-path verification intent.`;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId];
assert(holderBefore, `Missing holder task ${holderTaskId}`);
const holderBeforeTrace = asRecord(holderBefore.trace);
const holderBeforeActiveFrontier = asStringArray(
  holderBeforeTrace.active_frontier_spec_ids,
);
const holderBeforeWasStale14 =
  holderBeforeActiveFrontier.length === 14 &&
  removedFromFrontierSpecIds.every((specId) =>
    holderBeforeActiveFrontier.includes(specId),
  );
const holderBeforeAlreadyCurrent12 =
  holderBeforeActiveFrontier.length === 12 &&
  removedFromFrontierSpecIds.every(
    (specId) => !holderBeforeActiveFrontier.includes(specId),
  );
assert(
  holderBeforeWasStale14 || holderBeforeAlreadyCurrent12,
  `Expected holder frontier to be either stale 14-member or current 12-member shape, found ${holderBeforeActiveFrontier.length} members`,
);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  if (!holder) throw new Error(`Missing holder task ${holderTaskId}`);

  const blocker = asRecord(holder.blocker);
  const blockedAt =
    typeof blocker.blocked_at === "string" && blocker.blocked_at.trim()
      ? blocker.blocked_at
      : appliedAt;

  holder.state = "blocked";
  holder.status = "blocked";
  holder.goal = holderGoal;
  holder.outputs = unique([
    ...(holder.outputs ?? []),
    ".state/feature-compact-loop/state.json",
    reviewedMemoPath,
    appMemoPath,
  ]);
  holder.acceptance = holderAcceptance;
  const holderContext = asRecord(holder.context);
  delete holderContext.domainEvidencePath;
  holder.context = {
    ...holderContext,
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    activeFrontierSpecIds: [...activeFrontierSpecIds],
    consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
    frontierTaskIds: [holderTaskId],
    reviewEvidencePath: appMemoPath,
    reconcileMemoPath: reviewedMemoPath,
    reviewedCheckpointCommit,
  };
  holder.blocker = {
    ...blocker,
    condition: blockerCondition,
    category:
      typeof blocker.category === "string" && blocker.category.trim()
        ? blocker.category
        : "blocked-wait",
    owner:
      typeof blocker.owner === "string" && blocker.owner.trim()
        ? blocker.owner
        : "aks-explorer",
    blocked_at: blockedAt,
    waiting_for: {
      type: "frontier.changed",
      taskId: holderTaskId,
      featureKey,
      scope: "active-frontier-12",
    },
    observed_by:
      Object.keys(asRecord(blocker.observed_by)).length > 0
        ? asRecord(blocker.observed_by)
        : {
            workflow: "project-planner",
            schedule: "blocked-frontier-app-ops-review",
            trigger: "project.planning.requested",
          },
    observation_method:
      typeof blocker.observation_method === "string" &&
      blocker.observation_method.trim()
        ? blocker.observation_method
        : "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    next_check_at:
      typeof blocker.next_check_at === "string" && blocker.next_check_at.trim()
        ? blocker.next_check_at
        : "2026-07-15T18:30:00Z",
    resume_condition: resumeCondition,
    fallback_at:
      typeof blocker.fallback_at === "string" && blocker.fallback_at.trim()
        ? blocker.fallback_at
        : "2026-07-16T18:30:00Z",
    fallback_action: fallbackAction,
    resume_at:
      typeof blocker.next_check_at === "string" && blocker.next_check_at.trim()
        ? blocker.next_check_at
        : "2026-07-15T18:30:00Z",
  };
  holder.result =
    `${attemptId}: holder now preserves the exact 12-member active network-cni frontier, excludes ${removedFromFrontierList} from active residue, and keeps ${consumedPassHistoryList} only as consumed pass history after reviewed publish reconciliation.`;
  holder.trace = {
    ...asRecord(holder.trace),
    network_cni_reviewed_publish_reconcile_applied_at: appliedAt,
    network_cni_reviewed_publish_reconcile_applied_by: worker,
    reviewed_publish_checkpoint_commit: reviewedCheckpointCommit,
    active_frontier_spec_ids: [...activeFrontierSpecIds],
    removed_from_active_frontier_spec_ids: [...removedFromFrontierSpecIds],
    consumed_pass_history_spec_ids: [...consumedPassHistorySpecIds],
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return tree.tasks[holderTaskId];
});

const compactStateLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactStateLoaded.state;
const beforeFeature = compactState.features[featureKey];
assert(beforeFeature, `Missing feature compact row for ${featureKey}`);
assert(
  ["14-member active frontier", "12-member active frontier"].some((needle) =>
    String(beforeFeature.lastSummary ?? "").includes(needle),
  ),
  "Expected feature compact row to contain either stale 14-member or current 12-member frontier wording before apply",
);

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  retryable: false,
  retryReason: resumeCondition,
  lastSummary,
  rootCauseClassification:
    beforeFeature.rootCauseClassification ?? "repo-local-live-ready-filter",
  ownerReason,
  attemptedFixes: unique([
    ...(beforeFeature.attemptedFixes ?? []),
    `${attemptId}: rewrote controller-visible network-cni holder wording from the stale 14-member frontier to the exact 12-member frontier after reviewed publish checkpoint ${reviewedCheckpointCommit}.`,
  ]),
  nextStepClassification,
  resumeCondition,
  blockedReason: blockerCondition,
  waitingFor: {
    type: "frontier.changed",
    taskId: holderTaskId,
    featureKey,
    scope: "active-frontier-12",
  },
  waitingCondition: resumeCondition,
  observedBy:
    (treeMutation.blocker as Record<string, unknown> | undefined)?.observed_by as
      | Record<string, unknown>
      | undefined,
  observationMethod:
    typeof (treeMutation.blocker as Record<string, unknown> | undefined)
      ?.observation_method === "string"
      ? ((treeMutation.blocker as Record<string, unknown>).observation_method as string)
      : null,
  nextCheckAt:
    typeof (treeMutation.blocker as Record<string, unknown> | undefined)
      ?.next_check_at === "string"
      ? ((treeMutation.blocker as Record<string, unknown>).next_check_at as string)
      : null,
  blockerOwner:
    typeof (treeMutation.blocker as Record<string, unknown> | undefined)?.owner ===
    "string"
      ? ((treeMutation.blocker as Record<string, unknown>).owner as string)
      : null,
  fallbackAt:
    typeof (treeMutation.blocker as Record<string, unknown> | undefined)
      ?.fallback_at === "string"
      ? ((treeMutation.blocker as Record<string, unknown>).fallback_at as string)
      : null,
  fallbackAction,
  resumeAction:
    beforeFeature.resumeAction ??
    "Reset this feature compact record to pending only after the named wait condition changes.",
  blockedScope: beforeFeature.blockedScope ?? { kind: "feature", ids: [featureKey] },
  blockedFingerprint:
    beforeFeature.blockedFingerprint ?? {
      errorClass: "package-partial",
      target: "staging",
      branch: "dev",
      featureKey,
    },
  lastCheckedAt: appliedAt,
  evidencePaths: unique([
    ...(beforeFeature.evidencePaths ?? []),
    reviewedMemoPath,
    appMemoPath,
    "features/network-cni/compact/staging.summary.md",
    "features/network-cni/compact/staging.diagnostics.json",
    "features/network-cni/specs/network-cni-azure-overlay-ilpip.json",
    "features/network-cni/specs/network-cni-vm-prerelease-overlay-cilium-dualstack.json",
  ]),
  reviewEvidencePath: appMemoPath,
  verificationBlocker,
  summary: featureSummary,
});

saveFeatureCompactLoopState(compactStateLoaded.path, compactState);
const compactAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
assert(compactAfter, `Missing compact row ${featureKey} after save`);

const memo = `# App apply: reconcile network-cni holder after reviewed publish — 2026-07-14

- Task: \`ops-apply-reconcile-network-cni-holder-after-reviewed-publish-20260714-s\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Holder: \`${holderTaskId}\`
- Feature row: \`${featureKey}\` in \`.state/feature-compact-loop/state.json\`
- Reviewed memo authority: \`${reviewedMemoPath}\`
- Reviewed publish checkpoint: \`${reviewedCheckpointCommit}\`

## Applied repair

Updated the live app-owned compact holder and feature-compact-loop row from the stale **14-member** wording to the exact **12-member** frontier recorded in the reviewed memo.

### Removed from the active frontier

${removedFromFrontierSpecIds.map((specId) => `- ${specId}`).join("\n")}

### Active frontier members after apply

${activeFrontierSpecIds.map((specId) => `- ${specId}`).join("\n")}

### Consumed pass history preserved after apply

${consumedPassHistorySpecIds.map((specId) => `- ${specId}`).join("\n")}

## Before → after highlights

### Holder goal
- Before (reviewed memo / initial live state): ${JSON.stringify(staleHolderGoalBeforeApply)}
- After: ${JSON.stringify(holderGoal)}

### Holder blocker condition
- Before (reviewed memo / initial live state): ${JSON.stringify(staleHolderBlockerConditionBeforeApply)}
- After: ${JSON.stringify(blockerCondition)}

### Holder waiting_for scope
- Before (reviewed memo / initial live state): ${JSON.stringify("active-frontier-14")}
- After: ${JSON.stringify(asRecord(asRecord(treeMutation.blocker).waiting_for).scope ?? null)}

### Feature frontierTaskIds
- Before (initial live state): ${JSON.stringify([])}
- After: ${JSON.stringify(compactAfter.frontierTaskIds ?? null)}

### Feature ownerReason
- Before (reviewed memo / initial live state): ${JSON.stringify(staleFeatureOwnerReasonBeforeApply)}
- After: ${JSON.stringify(compactAfter.ownerReason ?? null)}

### Feature reviewEvidencePath
- Before (initial live state): ${JSON.stringify("evidence/archive/ops-apply-network-cni-dualstack-podcidr-writeback-alignment-20260714.md")}
- After: ${JSON.stringify(compactAfter.reviewEvidencePath ?? null)}

## Verification notes

- No reviewer-capacity wording was restored.
- The holder still preserves only \`spec.network-cni.azure-overlay-dual-stack-migration\` and \`spec.network-cni.azure-overlay-podcidr-expansion\` as consumed pass history.
- The holder and the feature row now both use the \`active-frontier-12\` wait scope and 12-member frontier wording.
- No \`.state/spec-loop/state.json\` mutation was required because the reviewed memo changed only the app-owned holder/feature-compact representation, not any spec-loop record.
`;
writeText(appMemoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      reviewedMemoPath,
      holder: {
        taskId: holderTaskId,
        goal: treeMutation.goal,
        blocker: treeMutation.blocker,
        activeFrontierSpecIds: asRecord(treeMutation.trace).active_frontier_spec_ids,
        consumedPassHistorySpecIds: asRecord(treeMutation.trace)
          .consumed_pass_history_spec_ids,
      },
      feature: {
        featureKey,
        taskId: compactAfter.taskId,
        frontierTaskIds: compactAfter.frontierTaskIds,
        retryReason: compactAfter.retryReason,
        ownerReason: compactAfter.ownerReason,
        reviewEvidencePath: compactAfter.reviewEvidencePath,
        updatedAt: compactAfter.updatedAt,
      },
    },
    null,
    2,
  ),
);
