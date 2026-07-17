import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";
import {
  readTask,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type TaskSnapshot = {
  id: string;
  state: string | null;
  parentId: string | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  blockerCondition: string | null;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-network-cni-terminal-review-application-gap-20260717-state-repair_20260717045916";
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({ appDir, projectDir, worker, maxConcurrent: 1 });

const repairTaskId =
  "ops-apply-reconcile-network-cni-terminal-review-application-gap-20260717-state-repair";
const reviewedTaskId =
  "ops/reconcile-network-cni-terminal-review-application-gap-20260717";
const staleSourceTaskId = "reconcile-compact-loop-package-partial";
const featureKey = "network-cni";
const primaryCarrierTaskId =
  "hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710";
const secondaryCarrierTaskId =
  "wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703";
const acceptedRunId = "172352561";
const acceptedSpecId =
  "spec.network-cni.azure-overlay-dual-stack-windows2022";
const acceptedSpecLoopId = acceptedSpecId;
const acceptedTerminalReviewMemo =
  "evidence/archive/reconcile-compact-loop-package-partial-network-cni-terminal-run-172352561-review-a_reconcile-compact-loop-package-partial_20260717045400.md";
const reviewedMemoPath =
  "evidence/archive/ops-reconcile-network-cni-terminal-review-application-gap-20260717.md";
const applyMemoRelative =
  "evidence/archive/ops-apply-reconcile-network-cni-terminal-review-application-gap-20260717-state-repair.md";
const applyMemoPath = resolve(appDir, applyMemoRelative);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as JsonRecord) } as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf-8");
}

function blockerSnapshot(task: TaskNode | undefined): TaskSnapshot {
  const blocker = asRecord(task?.blocker);
  return {
    id: task?.id ?? "(missing)",
    state: asString(task?.state ?? task?.status),
    parentId: asString(task?.parent_id),
    nextCheckAt:
      asString(blocker.next_check_at) ?? asString(blocker.nextCheckAt) ?? null,
    fallbackAt:
      asString(blocker.fallback_at) ?? asString(blocker.fallbackAt) ?? null,
    blockerCondition: asString(blocker.condition),
  };
}

function specSnapshot(spec: SpecLoopSpecState | undefined): Record<string, unknown> | null {
  if (!spec) return null;
  return {
    status: spec.status,
    taskId: spec.taskId ?? null,
    lastRunId: spec.lastRunId ?? null,
    lastResultPath: spec.lastResultPath ?? null,
    successorDisposition: spec.successorDisposition ?? null,
    successorEvidencePath: spec.successorEvidencePath ?? null,
    successorStateReason: spec.successorStateReason ?? null,
    resumeCondition: spec.resumeCondition ?? null,
    review: spec.review ?? null,
    updatedAt: spec.updatedAt ?? null,
  };
}

function pickEarliest(values: Array<string | null | undefined>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  if (present.length === 0) return null;
  return [...present].sort()[0] ?? null;
}

function normalizeFeatureSnapshot(
  feature: FeatureCompactItemState | undefined,
): Record<string, unknown> | null {
  if (!feature) return null;
  return {
    status: feature.status,
    taskId: feature.taskId ?? null,
    frontierTaskIds: feature.frontierTaskIds ?? null,
    retryReason: feature.retryReason ?? null,
    ownerReason: feature.ownerReason ?? null,
    blockedReason: feature.blockedReason ?? null,
    waitingFor: feature.waitingFor ?? null,
    resumeCondition: feature.resumeCondition ?? null,
    nextCheckAt: feature.nextCheckAt ?? null,
    fallbackAt: feature.fallbackAt ?? null,
    reviewEvidencePath: feature.reviewEvidencePath ?? null,
    summary: feature.summary ?? null,
    lastSummary: feature.lastSummary ?? null,
    updatedAt: feature.updatedAt ?? null,
  };
}

const featureLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const featureState = featureLoaded.state;
const featureBefore = featureState.features[featureKey];
assert(featureBefore, `Missing feature-compact row for ${featureKey}`);

const staleSourceBefore = readTask(config, staleSourceTaskId) as TaskNode | undefined;
assert(staleSourceBefore, `Missing stale source task ${staleSourceTaskId}`);
const staleSourceBeforeState = asString(
  staleSourceBefore.state ?? staleSourceBefore.status,
);
assert(
  staleSourceBeforeState === "review" ||
    staleSourceBeforeState === "blocked" ||
    staleSourceBeforeState === "done",
  `Unexpected ${staleSourceTaskId} state ${String(staleSourceBeforeState ?? "(null)")}`,
);

const primaryCarrierBefore = readTask(config, primaryCarrierTaskId) as TaskNode | undefined;
const secondaryCarrierBefore = readTask(config, secondaryCarrierTaskId) as TaskNode | undefined;
assert(primaryCarrierBefore, `Missing live primary carrier ${primaryCarrierTaskId}`);
assert(secondaryCarrierBefore, `Missing live secondary carrier ${secondaryCarrierTaskId}`);
assert(
  asString(primaryCarrierBefore.state ?? primaryCarrierBefore.status) === "blocked",
  `${primaryCarrierTaskId} must remain blocked`,
);
assert(
  asString(secondaryCarrierBefore.state ?? secondaryCarrierBefore.status) === "blocked",
  `${secondaryCarrierTaskId} must remain blocked`,
);

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const acceptedSpecBefore = specLoaded.state.specs[acceptedSpecLoopId];
assert(acceptedSpecBefore, `Missing spec-loop row for ${acceptedSpecLoopId}`);
assert(
  acceptedSpecBefore.status === "pass",
  `${acceptedSpecLoopId} must stay pass; found ${String(acceptedSpecBefore.status ?? "(null)")}`,
);
assert(
  acceptedSpecBefore.taskId == null,
  `${acceptedSpecLoopId} should remain taskId=null; found ${String(acceptedSpecBefore.taskId ?? "(non-null)")}`,
);
assert(
  String(acceptedSpecBefore.lastRunId ?? "") === acceptedRunId,
  `${acceptedSpecLoopId} should remain lastRunId=${acceptedRunId}`,
);

const treeMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const stale = tree.tasks[staleSourceTaskId] as TaskNode | undefined;
  assert(stale, `Missing ${staleSourceTaskId} during tree repair`);
  const beforeState = asString(stale.state ?? stale.status);
  let changed = false;
  if (beforeState === "review") {
    stale.state = "blocked";
    (stale as JsonRecord).status = "blocked";
    const trace = asRecord(stale.trace);
    trace.review_application_repaired_at = appliedAt;
    trace.review_application_repaired_by = worker;
    trace.review_application_repair_attempt_id = attemptId;
    delete trace.current_attempt_id;
    delete trace.worker_started_attempt_id;
    delete trace.worker_started_at;
    stale.trace = trace as TaskNode["trace"];
    changed = true;
    saveTaskTreeWithKanbanSnapshot(config, tree);
  }
  return {
    changed,
    beforeState,
    afterState: asString(stale.state ?? stale.status),
  };
});

const featureBeforeTaskId = featureBefore.taskId ?? null;
const desiredFrontierTaskIds = [primaryCarrierTaskId, secondaryCarrierTaskId];
const nextCheckAt = pickEarliest([
  blockerSnapshot(primaryCarrierBefore).nextCheckAt,
  blockerSnapshot(secondaryCarrierBefore).nextCheckAt,
]);
const fallbackAt = pickEarliest([
  blockerSnapshot(primaryCarrierBefore).fallbackAt,
  blockerSnapshot(secondaryCarrierBefore).fallbackAt,
]);

const ownerReason =
  `Accepted run ${acceptedRunId} remains one-spec proof only for ${acceptedSpecId}, so controller-visible network-cni compact state must stop using ${staleSourceTaskId} as the family carrier. The truthful exact live carrier set is now ${primaryCarrierTaskId} for the remaining Calico→ENO rows 192-196 frontier plus ${secondaryCarrierTaskId} for the shared subnet-authorization blocker that still governs spec.network-cni.vm-prerelease-overlay-cilium-dualstack; do not broaden that single-spec pass into a family rerun or family-wide success claim.`;
const blockedReason =
  `${staleSourceTaskId} no longer belongs in features.${featureKey}.taskId after accepted review application. Current live task-tree state already keeps ${staleSourceTaskId} out of review as ${treeMutation.afterState ?? staleSourceBeforeState}, and the feature-level projection must point only at the exact live carriers ${primaryCarrierTaskId} and ${secondaryCarrierTaskId} while preserving run ${acceptedRunId} as ${acceptedSpecId}-only pass history.`;
const resumeCondition =
  `Resume only when ${primaryCarrierTaskId} or ${secondaryCarrierTaskId} materially changes the same-lineage frontier, or when accepted exact same-path evidence replaces one of those carriers. Preserve run ${acceptedRunId} as ${acceptedSpecId}-only pass history; do not reopen or broaden the unchanged network-cni package-partial family from that single-spec verdict.`;
const summary =
  `${attemptId}: drained stale source leaf ${staleSourceTaskId} from live review status ${treeMutation.beforeState ?? staleSourceBeforeState}→${treeMutation.afterState ?? staleSourceBeforeState} when needed and repointed features.${featureKey} to the truthful exact live carriers ${primaryCarrierTaskId} and ${secondaryCarrierTaskId} while preserving the ${acceptedRunId} one-spec pass for ${acceptedSpecId}.`;
const waitingFor = {
  type: "frontier.changed",
  taskId: primaryCarrierTaskId,
  featureKey,
  frontierTaskIds: [...desiredFrontierTaskIds],
  acceptedPassRunId: acceptedRunId,
  acceptedPassSpecIds: [acceptedSpecId],
};

updateFeatureCompactItem(featureState, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: primaryCarrierTaskId,
  frontierTaskIds: [...desiredFrontierTaskIds],
  waitingFor,
  waitingCondition: resumeCondition,
  ownerReason,
  blockedReason,
  retryReason: resumeCondition,
  resumeCondition,
  nextCheckAt,
  fallbackAt,
  blockerOwner: "aks-explorer",
  observedBy: featureBefore.observedBy ?? {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    featureBefore.observationMethod ??
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the exact carrier set with fresh evidence.",
  reviewEvidencePath: applyMemoRelative,
  summary,
  lastSummary: summary,
  nextStepClassification:
    "preserve exact two-carrier network-cni frontier while keeping run 172352561 as one-spec pass history only",
  verificationBlocker:
    `Do not restore ${staleSourceTaskId} or archived family holders as controller-visible carriers, and do not broaden run ${acceptedRunId} beyond ${acceptedSpecId}. The truthful live compact representation is ${primaryCarrierTaskId} plus ${secondaryCarrierTaskId}.`,
  evidencePaths: unique([
    ...(featureBefore.evidencePaths ?? []),
    applyMemoRelative,
    reviewedMemoPath,
    acceptedTerminalReviewMemo,
  ]),
  attemptedFixes: unique([
    ...(featureBefore.attemptedFixes ?? []),
    `${attemptId}: removed stale feature task pointer ${featureBeforeTaskId ?? "(null)"} and rebound network-cni compact state to ${primaryCarrierTaskId} + ${secondaryCarrierTaskId} while keeping run ${acceptedRunId} scoped to ${acceptedSpecId} only.`,
  ]),
  lastCheckedAt: appliedAt,
  updatedAt: appliedAt,
});

saveFeatureCompactLoopState(featureLoaded.path, featureState);

const featureAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
assert(featureAfter, `Missing feature row for ${featureKey} after save`);
assert(
  featureAfter.taskId === primaryCarrierTaskId,
  `Expected ${featureKey}.taskId=${primaryCarrierTaskId}, found ${String(featureAfter.taskId ?? "(null)")}`,
);
assert(
  JSON.stringify(featureAfter.frontierTaskIds ?? []) ===
    JSON.stringify(desiredFrontierTaskIds),
  `Unexpected frontierTaskIds after save: ${JSON.stringify(featureAfter.frontierTaskIds ?? null)}`,
);
assert(
  String(featureAfter.taskId ?? "") !== staleSourceTaskId &&
    !(featureAfter.frontierTaskIds ?? []).includes(staleSourceTaskId) &&
    asString(asRecord(featureAfter.waitingFor).taskId) !== staleSourceTaskId,
  `${featureKey} feature pointers still reference ${staleSourceTaskId}`,
);

const staleSourceAfter = readTask(config, staleSourceTaskId) as TaskNode | undefined;
assert(staleSourceAfter, `Missing ${staleSourceTaskId} after repair`);
const staleSourceAfterState = asString(
  staleSourceAfter.state ?? staleSourceAfter.status,
);
assert(
  staleSourceAfterState !== "review",
  `${staleSourceTaskId} must not remain review after repair`,
);

const acceptedSpecAfter = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
}).state.specs[acceptedSpecLoopId];
assert(acceptedSpecAfter, `Missing ${acceptedSpecLoopId} after repair`);
assert(
  acceptedSpecAfter.status === "pass" &&
    acceptedSpecAfter.taskId == null &&
    String(acceptedSpecAfter.lastRunId ?? "") === acceptedRunId,
  `${acceptedSpecLoopId} drifted during repair`,
);

const memo = `# App apply — reconcile network-cni terminal-review application gap state repair — 2026-07-17

- Task: \`${repairTaskId}\`
- Reviewed task: \`${reviewedTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Supported mechanisms: \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\` when the stale source leaf still reads \`review\`, plus \`loadFeatureCompactLoopState(... )\` + \`updateFeatureCompactItem(... )\` + \`saveFeatureCompactLoopState(... )\`

## Baseline before apply

### Stale source leaf

\`\`\`json
${JSON.stringify(
  {
    id: staleSourceTaskId,
    state: staleSourceBeforeState,
    result: asString(staleSourceBefore.result),
    blocker: asRecord(staleSourceBefore.blocker),
    trace: {
      exact_pipeline_wait_restored_at: asRecord(staleSourceBefore.trace).exact_pipeline_wait_restored_at ?? null,
      exact_pipeline_wait_run_id: asRecord(staleSourceBefore.trace).exact_pipeline_wait_run_id ?? null,
      review_summary: asRecord(staleSourceBefore.trace).review_summary ?? null,
    },
  },
  null,
  2,
)}
\`\`\`

### Feature-compact row before apply

\`\`\`json
${JSON.stringify(normalizeFeatureSnapshot(featureBefore), null, 2)}
\`\`\`

### Exact live carrier snapshots used for resynchronization

- Primary carrier \`${primaryCarrierTaskId}\`

\`\`\`json
${JSON.stringify(blockerSnapshot(primaryCarrierBefore), null, 2)}
\`\`\`

- Secondary carrier \`${secondaryCarrierTaskId}\`

\`\`\`json
${JSON.stringify(blockerSnapshot(secondaryCarrierBefore), null, 2)}
\`\`\`

### Preserved one-spec ADO verdict authority

\`\`\`json
${JSON.stringify(specSnapshot(acceptedSpecBefore), null, 2)}
\`\`\`

## Applied repair

1. Confirmed the accepted run-${acceptedRunId} verdict still remains one-spec only for \`${acceptedSpecId}\` by reading the app-owned spec-loop row.
2. If \`${staleSourceTaskId}\` was still \`review\`, moved it back to \`blocked\` in-place under the task-tree lock without inventing a new family holder; if it was already \`blocked\`, preserved that state and recorded the current-attempt memo instead.
3. Repointed \`features.${featureKey}.taskId\` away from \`${staleSourceTaskId}\` to feature-specific exact live carrier \`${primaryCarrierTaskId}\`.
4. Rewrote \`features.${featureKey}.frontierTaskIds\` to only the truthful live carrier pair \`${primaryCarrierTaskId}\`, \`${secondaryCarrierTaskId}\` and removed stale references to \`${staleSourceTaskId}\` plus archived holder lineage from the feature row.
5. Refreshed feature-level wait text, watch windows, evidence pointer, and summary so the projection preserves the run-${acceptedRunId} one-spec pass without broadening it into a family rerun or family-wide success claim.

## Verification after apply

### Stale source leaf after apply

\`\`\`json
${JSON.stringify(
  {
    id: staleSourceTaskId,
    state: staleSourceAfterState,
    result: asString(staleSourceAfter.result),
    trace: {
      review_application_repaired_at:
        asRecord(staleSourceAfter.trace).review_application_repaired_at ?? null,
      exact_pipeline_wait_restored_at:
        asRecord(staleSourceAfter.trace).exact_pipeline_wait_restored_at ?? null,
      exact_pipeline_wait_run_id:
        asRecord(staleSourceAfter.trace).exact_pipeline_wait_run_id ?? null,
    },
  },
  null,
  2,
)}
\`\`\`

### Feature-compact row after apply

\`\`\`json
${JSON.stringify(normalizeFeatureSnapshot(featureAfter), null, 2)}
\`\`\`

### Spec-loop Windows2022 row after apply (unchanged verdict)

\`\`\`json
${JSON.stringify(specSnapshot(acceptedSpecAfter), null, 2)}
\`\`\`

## Acceptance check

- \`bun run task-tree show ${staleSourceTaskId}\` must not report \`state=review\`: satisfied by the after-state above.
- \`.state/feature-compact-loop/state.json\` must not keep \`features.${featureKey}.taskId = ${staleSourceTaskId}\`: satisfied; it now points at \`${primaryCarrierTaskId}\`.
- The network-cni projection must preserve the run-${acceptedRunId} truth as \`${acceptedSpecId}\`-only pass: satisfied; the spec-loop row remains \`status=pass\`, \`taskId=null\`, \`lastRunId=${acceptedRunId}\`, while compact state now points only at the exact blocked carriers above.
`;

writeText(applyMemoPath, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      treeMutation,
      featureBeforeTaskId,
      featureAfterTaskId: featureAfter.taskId ?? null,
      featureBeforeFrontierTaskIds: featureBefore.frontierTaskIds ?? [],
      featureAfterFrontierTaskIds: featureAfter.frontierTaskIds ?? [],
      staleSourceBeforeState,
      staleSourceAfterState,
      nextCheckAt,
      fallbackAt,
      memoPath: applyMemoRelative,
    },
    null,
    2,
  ),
);
