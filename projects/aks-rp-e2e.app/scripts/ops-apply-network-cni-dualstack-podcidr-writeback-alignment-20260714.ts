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
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type DiagnosticsShape = {
  compactLiveReadiness?: {
    activeFrontierSpecIds?: unknown;
    consumedPassHistorySpecIds?: unknown;
  };
};

const attemptId =
  "a_ops-apply-network-cni-dualstack-podcidr-writeback-alignment-20260714-sta_20260714174731";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-feature-compact-loop";
const featureKey = "network-cni";
const holderTaskId = "hold-compact-network-cni-package-partial-frontier-20260709i";
const diagnosticsPath = resolve(
  projectDir,
  "features/network-cni/compact/staging.diagnostics.json",
);
const summaryPath = "features/network-cni/compact/staging.summary.md";
const domainMemoPath =
  "../aks-rp-e2e/evidence/archive/domain-network-cni-dualstack-podcidr-writeback-alignment-20260714.md";
const appMemoPath =
  "evidence/archive/ops-apply-network-cni-dualstack-podcidr-writeback-alignment-20260714.md";
const appMemoAbsolute = resolve(appDir, appMemoPath);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

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

const diagnostics = readJson<DiagnosticsShape>(diagnosticsPath);
const activeFrontierSpecIds = asStringArray(
  diagnostics.compactLiveReadiness?.activeFrontierSpecIds,
);
const consumedPassHistorySpecIds = asStringArray(
  diagnostics.compactLiveReadiness?.consumedPassHistorySpecIds,
);

const expectedConsumedPassHistory = [
  "spec.network-cni.azure-overlay-dual-stack-migration",
  "spec.network-cni.azure-overlay-podcidr-expansion",
].sort((a, b) => a.localeCompare(b));
assert(
  activeFrontierSpecIds.length === 14,
  `Expected 14 active frontier spec ids, found ${activeFrontierSpecIds.length}`,
);
assert(
  JSON.stringify([...consumedPassHistorySpecIds].sort((a, b) => a.localeCompare(b))) ===
    JSON.stringify(expectedConsumedPassHistory),
  `Consumed pass history mismatch: ${JSON.stringify(consumedPassHistorySpecIds)}`,
);

const activeFrontierList = activeFrontierSpecIds.join(", ");
const consumedPassHistoryList = consumedPassHistorySpecIds.join(", ");

const holderGoal =
  "Preserve one exact compact network-cni family wait that names the current 14-member active blocked frontier and keeps dual-stack-migration plus podCIDR-expansion only as consumed pass history, not active blocked residue.";
const holderAcceptance = [
  "The holder names the current exact 14-member network-cni compact frontier rather than stale writeback-drift wording for dual-stack-migration or podCIDR-expansion.",
  "spec.network-cni.azure-overlay-dual-stack-migration and spec.network-cni.azure-overlay-podcidr-expansion stay preserved only as consumed pass history, not as active blocked compact residue.",
  "Resume only when one of the 14 active-frontier members materially changes, or materially new same-path verification intent reopens one of the consumed pass-history members; do not rerun the broad compact package unchanged.",
];
const blockerCondition =
  `Current compact/spec-loop/spec-file evidence says the exact active network-cni compact frontier is the 14-member set ${activeFrontierList}. Preserve ${consumedPassHistoryList} only as consumed pass history because repo writeback is already complete for both and they are no longer active blocked compact residue.`;
const resumeCondition =
  `Resume only when one of the 14 active-frontier members materially changes, is reclassified, or is replaced by sharper same-lineage evidence, or when materially new same-path verification intent reopens ${consumedPassHistoryList}. Do not rerun the broad compact package unchanged.`;
const fallbackAction =
  "If unchanged at fallback, keep or refresh this exact 14-member network-cni frontier holder from the latest same-lineage evidence; do not restore stale writeback-drift wording or reopen an unchanged broad compact rerun.";
const ownerReason =
  `All 69 active feature-owned specs remain selected into the compact package, and the maintained compact artifacts now split the controller-visible residue into 14 active-frontier blocked members (${activeFrontierList}) plus 2 consumed pass-history members (${consumedPassHistoryList}). No truthful broad rerun or writeback-drift holder remains.`;
const lastSummary =
  `Current network-cni compact partial is the exact 14-member active frontier (${activeFrontierList}); ${consumedPassHistoryList} remain preserved only as consumed pass history after accepted repo writeback. No broad compact rerun is truthful. See ${appMemoPath}.`;
const nextStepClassification =
  "preserve the exact 14-member network-cni active frontier while dual-stack-migration and podCIDR-expansion remain non-active consumed pass history";
const featureSummary =
  `${attemptId}: rewrote the live network-cni compact holder projection to the exact 14-member active frontier and removed stale dual-stack-migration/podCIDR-expansion writeback-drift wording from controller-visible state.`;
const verificationBlocker =
  `An unchanged full-package rerun would still overclaim live readiness while network-cni regenerates as partial with the exact 14-member active frontier (${activeFrontierList}). ${consumedPassHistoryList} are already consumed pass history after accepted repo writeback, so do not treat them as active blocked residue or queue unchanged reruns without materially new same-path verification intent.`;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId];
assert(holderBefore, `Missing holder task ${holderTaskId}`);

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
  holder.outputs = unique([...(holder.outputs ?? []), ".state/feature-compact-loop/state.json", appMemoPath]);
  holder.acceptance = holderAcceptance;
  holder.context = {
    ...asRecord(holder.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    activeFrontierSpecIds: [...activeFrontierSpecIds],
    consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
    frontierTaskIds: [holderTaskId],
    reviewEvidencePath: appMemoPath,
    domainEvidencePath: domainMemoPath,
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
      scope: "active-frontier-14",
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
    `${attemptId}: holder now preserves the exact 14-member active network-cni frontier and treats ${consumedPassHistoryList} only as consumed pass history after repo writeback alignment.`;
  holder.trace = {
    ...asRecord(holder.trace),
    network_cni_writeback_alignment_applied_at: appliedAt,
    network_cni_writeback_alignment_applied_by: worker,
    active_frontier_spec_ids: [...activeFrontierSpecIds],
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

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  retryable: false,
  retryReason: resumeCondition,
  lastSummary,
  rootCauseClassification: beforeFeature.rootCauseClassification ?? "repo-local-mixed-terminal-and-promotion-frontier",
  ownerReason,
  attemptedFixes: unique([
    ...(beforeFeature.attemptedFixes ?? []),
    `${attemptId}: rewrote controller-visible network-cni holder wording to match 14 active-frontier members and 2 consumed pass-history members after accepted repo writeback.`,
  ]),
  nextStepClassification,
  resumeCondition,
  blockedReason: blockerCondition,
  waitingFor: {
    type: "frontier.changed",
    taskId: holderTaskId,
    featureKey,
    scope: "active-frontier-14",
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
    appMemoPath,
    domainMemoPath,
    summaryPath,
    "features/network-cni/compact/staging.diagnostics.json",
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

const memo = `# App apply: network-cni dual-stack/podCIDR writeback alignment — 2026-07-14\n\n- Task: \`ops-apply-network-cni-dualstack-podcidr-writeback-alignment-20260714-sta\`\n- Attempt: \`${attemptId}\`\n- Applied at: \`${appliedAt}\`\n- Holder: \`${holderTaskId}\`\n- Feature row: \`${featureKey}\` in \`.state/feature-compact-loop/state.json\`\n\n## Authority used\n\n- Domain memo: \`${domainMemoPath}\`\n- Compact summary: \`${summaryPath}\`\n- Compact diagnostics: \`features/network-cni/compact/staging.diagnostics.json\`\n\n## Applied repair\n\nUpdated the live app-owned compact holder and feature-compact-loop row so they now match the accepted repo writeback:\n\n- Active blocked frontier count: **${activeFrontierSpecIds.length}**\n- Consumed pass-history count: **${consumedPassHistorySpecIds.length}**\n- Consumed pass-history members only: ${consumedPassHistoryList}\n\n### Active frontier members\n\n${activeFrontierSpecIds.map((specId) => `- ${specId}`).join("\n")}\n\n## Before → after highlights\n\n### Holder goal\n- Before: ${JSON.stringify(holderBefore.goal ?? null)}\n- After: ${JSON.stringify(holderGoal)}\n\n### Holder blocker condition\n- Before: ${JSON.stringify(asRecord(holderBefore.blocker).condition ?? null)}\n- After: ${JSON.stringify(blockerCondition)}\n\n### Feature ownerReason\n- Before: ${JSON.stringify(beforeFeature.ownerReason ?? null)}\n- After: ${JSON.stringify(ownerReason)}\n\n### Feature resumeCondition\n- Before: ${JSON.stringify(beforeFeature.resumeCondition ?? null)}\n- After: ${JSON.stringify(resumeCondition)}\n\n### Feature reviewEvidencePath\n- Before: ${JSON.stringify(beforeFeature.reviewEvidencePath ?? null)}\n- After: ${JSON.stringify(compactAfter.reviewEvidencePath ?? null)}\n\n## Result\n\nThe live holder and the \`network-cni\` feature-compact-loop row no longer say accepted spec/model writeback is still needed for \`spec.network-cni.azure-overlay-dual-stack-migration\` or \`spec.network-cni.azure-overlay-podcidr-expansion\`. Both remain preserved only as consumed pass history, while the active blocked residue is the exact 14-member frontier above.\n`;
writeText(appMemoAbsolute, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      holder: {
        taskId: holderTaskId,
        goal: treeMutation.goal,
        blocker: treeMutation.blocker,
      },
      feature: {
        featureKey,
        taskId: compactAfter.taskId,
        frontierTaskIds: compactAfter.frontierTaskIds,
        ownerReason: compactAfter.ownerReason,
        resumeCondition: compactAfter.resumeCondition,
        reviewEvidencePath: compactAfter.reviewEvidencePath,
        updatedAt: compactAfter.updatedAt,
      },
      activeFrontierSpecIds,
      consumedPassHistorySpecIds,
    },
    null,
    2,
  ),
);
