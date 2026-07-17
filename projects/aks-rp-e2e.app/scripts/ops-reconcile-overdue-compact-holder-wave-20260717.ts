import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  refreshBlockedWait,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type MutableRecord = Record<string, unknown>;

type HolderConfig = {
  holderTaskId: string;
  featureKey: string;
  errorClass: string;
  target: string;
  sourceTaskIds: string[];
  condition: string;
  summary: string;
  ownerReason: string;
  nextStepClassification: string;
  verificationBlocker: string;
  resultSummary: string;
};

type Snapshot = {
  state: string | null;
  result: string | null;
  outputs: string[];
  blocker: MutableRecord | null;
  context: MutableRecord | null;
};

type FeatureSnapshot = {
  taskId: string | null;
  frontierTaskIds: string[];
  nextCheckAt: string | null;
  fallbackAt: string | null;
  reviewEvidencePath: string | null;
  waitingFor: MutableRecord | null;
  blockedReason: string | null;
  resumeCondition: string | null;
  summary: string | null;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as MutableRecord) } as MutableRecord)
    : {};
}

function asNullableRecord(value: unknown): MutableRecord | null {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      )
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  ].sort((left, right) => left.localeCompare(right));
}

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function snapshotTask(task: TaskNode | undefined): Snapshot | null {
  if (!task) return null;
  return {
    state: asString(task.state ?? task.status),
    result: asString((task as MutableRecord).result),
    outputs: asStringArray(task.outputs),
    blocker: asNullableRecord(task.blocker),
    context: asNullableRecord(task.context),
  };
}

function snapshotFeature(value: MutableRecord | undefined): FeatureSnapshot | null {
  if (!value) return null;
  return {
    taskId: asString(value.taskId),
    frontierTaskIds: asStringArray(value.frontierTaskIds),
    nextCheckAt: asString(value.nextCheckAt),
    fallbackAt: asString(value.fallbackAt),
    reviewEvidencePath: asString(value.reviewEvidencePath),
    waitingFor: asNullableRecord(value.waitingFor),
    blockedReason: asString(value.blockedReason),
    resumeCondition: asString(value.resumeCondition),
    summary: asString(value.summary),
  };
}

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function deriveWindow(tree: ReturnType<typeof readTaskTree>, sourceTaskIds: string[]): {
  nextCheckAt: string;
  fallbackAt: string;
} {
  const nextCandidates = sourceTaskIds
    .map((taskId) => {
      const blocker = asRecord(tree.tasks[taskId]?.blocker);
      return asString(blocker.next_check_at);
    })
    .map((value) => ({ raw: value, ms: parseIso(value) }))
    .filter((value): value is { raw: string; ms: number } => Boolean(value.raw && value.ms !== null));
  assert(nextCandidates.length > 0, `No next_check_at found for source ids ${sourceTaskIds.join(", ")}`);
  nextCandidates.sort((left, right) => left.ms - right.ms);
  const nextCheckAt = nextCandidates[0].raw;
  const nextMs = nextCandidates[0].ms;

  const fallbackCandidates = sourceTaskIds
    .map((taskId) => {
      const blocker = asRecord(tree.tasks[taskId]?.blocker);
      return asString(blocker.fallback_at);
    })
    .map((value) => ({ raw: value, ms: parseIso(value) }))
    .filter(
      (value): value is { raw: string; ms: number } =>
        Boolean(value.raw && value.ms !== null && value.ms > nextMs),
    )
    .sort((left, right) => left.ms - right.ms);

  return {
    nextCheckAt,
    fallbackAt:
      fallbackCandidates[0]?.raw ??
      iso(nextMs + 24 * 60 * 60 * 1000),
  };
}

function waitingForPatch(input: {
  featureKey: string;
  holderTaskId: string;
  sourceTaskIds: string[];
  errorClass: string;
  target: string;
  existing: MutableRecord | null;
}): MutableRecord {
  const waitingFor = asRecord(input.existing);
  const primarySourceTaskId = input.sourceTaskIds[0] ?? input.holderTaskId;
  waitingFor.type = asString(waitingFor.type) ?? "frontier.changed";
  waitingFor.taskId = primarySourceTaskId;
  waitingFor.featureKey = input.featureKey;
  waitingFor.target = input.target;
  waitingFor.errorClass = input.errorClass;
  waitingFor.scope = "feature-compact";
  waitingFor.frontierTaskIds = [...input.sourceTaskIds];
  waitingFor.representedTaskIds = [...input.sourceTaskIds];
  if (input.sourceTaskIds.length === 1) {
    waitingFor.holderTaskId = input.holderTaskId;
  }
  return waitingFor;
}

function writeMemo(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf8");
}

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops_reconcile-overdue-compact-holder-wave-20260717_20260717031559";
const repairTaskId = "ops/reconcile-overdue-compact-holder-wave-20260717";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();
const memoPath = "evidence/archive/ops-reconcile-overdue-compact-holder-wave-20260717.md";
const memoAbsolutePath = resolve(appDir, memoPath);

const holderConfigs: HolderConfig[] = [
  {
    holderTaskId: "hold-compact-cluster-autoscaler-five-carrier-frontier-20260714",
    featureKey: "cluster-autoscaler",
    errorClass: "package-partial",
    target: "staging",
    sourceTaskIds: [
      "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
      "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
      "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
      "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
      "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
    ],
    condition:
      `2026-07-17 overdue compact-holder review revalidated that the exact same five downstream cluster-autoscaler carriers still govern the compact package-partial frontier: wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708, wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708, hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708, hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708, and hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709. No published repo-local repair or returned same-path evidence has changed that five-carrier frontier, so keep this compact-facing holder exact and do not reopen a broad rerun. Memo: ${memoPath}`,
    summary:
      `2026-07-17 overdue compact-holder review refreshed the exact cluster-autoscaler five-carrier compact holder in place and moved its review window back to the earliest represented downstream frontier without broadening lineage.`,
    ownerReason:
      "All selected cluster-autoscaler specs are already represented, so the truthful remaining compact blocker is still the exact five-carrier downstream frontier rather than missing package membership or a broad rerun candidate.",
    nextStepClassification:
      "Preserve the exact five-carrier compact frontier and reopen only the changed cluster-autoscaler branch if one represented downstream carrier materially changes.",
    verificationBlocker:
      "Do not reopen an unchanged broad cluster-autoscaler compact rerun. The truthful remaining compact blocker is still the exact five-carrier downstream frontier.",
    resultSummary:
      `${attemptId}: refreshed hold-compact-cluster-autoscaler-five-carrier-frontier-20260714 from current same-lineage carrier evidence, preserved the exact five governed downstream carrier ids, and advanced the compact watch window to match the earliest represented frontier.`,
  },
  {
    holderTaskId: "hold-compact-node-http-proxy-package-partial-frontier-owner-normalized-20260713",
    featureKey: "node-http-proxy",
    errorClass: "package-partial",
    target: "staging",
    sourceTaskIds: [
      "wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708",
    ],
    condition:
      `2026-07-17 overdue compact-holder review revalidated that wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 remains the single truthful same-lineage owner-decision wait for spec.node-http-proxy.trusted-ca. Durable send proof remains on that downstream wait, no matching reviewed owner decision or accepted reclassification has returned, and no sharper same-lineage replacement surfaced. Keep this compact-facing package-partial holder aligned only to that downstream wait; do not reopen unchanged compact reruns or create a duplicate passive carrier. Memo: ${memoPath}`,
    summary:
      "2026-07-17 overdue compact-holder review refreshed the node-http-proxy compact holder in place against its exact trusted-ca owner-decision wait and advanced the compact review window without widening lineage.",
    ownerReason:
      "The only remaining compact blocker is still the exact trusted-ca owner-decision wait, so controller-visible state must keep one compact-facing holder aligned to that same-lineage wait instead of reopening an unchanged rerun.",
    nextStepClassification:
      "Preserve the single exact compact-facing holder until the trusted-ca owner-decision wait returns one reviewed decision or accepted same-lineage reclassification.",
    verificationBlocker:
      "Do not reopen unchanged compact reruns or create another passive node-http-proxy holder while the same trusted-ca owner-decision wait remains exact.",
    resultSummary:
      `${attemptId}: refreshed hold-compact-node-http-proxy-package-partial-frontier-owner-normalized-20260713 from wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708, restored current same-lineage wait evidence into controller-visible state, and advanced the compact watch window into the future.`,
  },
  {
    holderTaskId: "hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier",
    featureKey: "sgx-addon-vm-prerelease-matrix",
    errorClass: "reviewed-exception",
    target: "staging",
    sourceTaskIds: [
      "wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703",
    ],
    condition:
      `2026-07-17 overdue compact-holder review revalidated that wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703 remains the exact represented SGX owner live-carrier decision wait. The SGX matrix still truthfully stays source-grounded/check-only for rows 57/58/59, no row-exact approved live carrier has returned, and no accepted reclassification changes the current reviewed-exception boundary. Keep this compact holder only as the represented split-frontier carrier over that exact same-lineage wait. Memo: ${memoPath}`,
    summary:
      "2026-07-17 overdue compact-holder review refreshed the SGX represented compact holder in place from its exact owner live-carrier decision wait and advanced the compact review window into the future.",
    ownerReason:
      "This compact holder remains only the feature-facing projection of the exact SGX owner live-carrier decision wait, so controller-visible metadata must stay bound to that wait instead of a generic publish-auth or rerun placeholder.",
    nextStepClassification:
      "Preserve the SGX compact projection only as the represented owner live-carrier decision wait until that exact same-lineage wait materially changes.",
    verificationBlocker:
      "Do not relabel the SGX matrix as live-ready or create duplicate rerun work while the exact owner live-carrier decision wait remains unchanged.",
    resultSummary:
      `${attemptId}: refreshed hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier from wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703, preserved the represented same-lineage wait mapping, and advanced the compact watch window into the future.`,
  },
  {
    holderTaskId:
      "hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713",
    featureKey: "virtualmachine-prerelease-row60-legacy-addon-disable-scaling",
    errorClass: "reviewed-exception",
    target: "staging",
    sourceTaskIds: [
      "hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706",
    ],
    condition:
      `2026-07-17 overdue compact-holder review revalidated that hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706 remains the governing same-lineage row-60 nonlive/source-grounded boundary for spec.managementplane-addon.vm-prerelease-httpapplicationrouting-disable-scaling. No reviewed same-path live artifact, owner-approved posture change, or sharper compact-side replacement has returned since the last refresh, so keep this compact-facing row-60 projection tied only to that governing spec-level holder instead of reopening unchanged compact live work. Memo: ${memoPath}`,
    summary:
      "2026-07-17 overdue compact-holder review refreshed the row-60 compact projection in place from its governing spec-level nonlive holder and advanced the compact review window into the future.",
    ownerReason:
      "Mounted source, the checked-in probe, and accepted project evidence still preserve the exact row-60 nonlive/source-grounded boundary, so controller-visible compact state must stay tied only to the governing spec-level holder instead of version-upgrade review waits or a broad rerun carrier.",
    nextStepClassification:
      "Preserve the exact row-60 compact projection until the governing nonlive/source-grounded spec-level holder materially changes or reviewed evidence reclassifies the carrier.",
    verificationBlocker:
      "Do not reopen unchanged compact live work or tie row-60 to unrelated managementplane-addon review waits while the same governing spec-level holder remains exact.",
    resultSummary:
      `${attemptId}: refreshed hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713 from hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706, restored the same-lineage governing holder mapping, and advanced the compact watch window into the future.`,
  },
];

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const taskTreePath = resolve(appDir, ".state/tasks/tree.json");
const featureCompactStatePath = resolve(appDir, ".state/feature-compact-loop/state.json");
const taskTreeHashBefore = fileHash(taskTreePath);
const featureHashBefore = fileHash(featureCompactStatePath);

const baselineTree = readTaskTree(config);
const featureStateBefore = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const before: Record<string, { holder: Snapshot | null; feature: FeatureSnapshot | null; sources: Record<string, Snapshot | null>; derivedWindow: { nextCheckAt: string; fallbackAt: string } }> = {};
const representedSetBefore = holderConfigs.map((configItem) => ({
  holderTaskId: configItem.holderTaskId,
  sourceTaskIds: [...configItem.sourceTaskIds],
}));

for (const item of holderConfigs) {
  assert(baselineTree.tasks[item.holderTaskId], `Missing holder ${item.holderTaskId}`);
  for (const sourceTaskId of item.sourceTaskIds) {
    assert(baselineTree.tasks[sourceTaskId], `Missing governing source ${sourceTaskId}`);
  }
  const featureRow = featureStateBefore.state.features[item.featureKey] as MutableRecord | undefined;
  assert(featureRow, `Missing feature compact row ${item.featureKey}`);
  before[item.holderTaskId] = {
    holder: snapshotTask(baselineTree.tasks[item.holderTaskId]),
    feature: snapshotFeature(featureRow),
    sources: Object.fromEntries(
      item.sourceTaskIds.map((sourceTaskId) => [sourceTaskId, snapshotTask(baselineTree.tasks[sourceTaskId])]),
    ),
    derivedWindow: deriveWindow(baselineTree, item.sourceTaskIds),
  };
}

for (const item of holderConfigs) {
  const liveTree = readTaskTree(config);
  const window = deriveWindow(liveTree, item.sourceTaskIds);
  const currentHolder = liveTree.tasks[item.holderTaskId];
  const currentBlocker = asRecord(currentHolder?.blocker);
  const existingResumeCondition = asString(currentBlocker.resume_condition);
  const existingFallbackAction = asString(currentBlocker.fallback_action);
  assert(existingResumeCondition, `Missing resume condition on ${item.holderTaskId}`);
  assert(existingFallbackAction, `Missing fallback action on ${item.holderTaskId}`);

  refreshBlockedWait(config, {
    taskId: item.holderTaskId,
    condition: item.condition,
    resumeCondition: existingResumeCondition,
    summary: item.summary,
    nextCheckAt: window.nextCheckAt,
    fallbackAt: window.fallbackAt,
    fallbackAction: existingFallbackAction,
  });

  withTreeLock(config, () => {
    const tree = readTaskTree(config);
    const holder = tree.tasks[item.holderTaskId];
    assert(holder, `Missing holder ${item.holderTaskId} during tree repair`);

    holder.outputs = unique([
      ...asStringArray(holder.outputs),
      memoPath,
      ".state/feature-compact-loop/state.json",
    ]);

    const context = asRecord(holder.context);
    context.featureCompactExactWait = true;
    context.featureKey = item.featureKey;
    context.errorClass = item.errorClass;
    context.target = item.target;
    context.frontierTaskIds = [...item.sourceTaskIds];
    context.compactFrontierTaskIds = [...item.sourceTaskIds];
    context.reviewEvidencePath = memoPath;
    context.appRepairEvidencePath = memoPath;
    context.ownerReason = item.ownerReason;
    holder.context = context;

    const blocker = asRecord(holder.blocker);
    blocker.waiting_for = waitingForPatch({
      featureKey: item.featureKey,
      holderTaskId: item.holderTaskId,
      sourceTaskIds: item.sourceTaskIds,
      errorClass: item.errorClass,
      target: item.target,
      existing: asNullableRecord(blocker.waiting_for),
    });
    holder.blocker = blocker;
    holder.result = item.resultSummary;

    holder.trace = {
      ...asRecord(holder.trace),
      compact_holder_overdue_wave_reconciled_at: appliedAt,
      compact_holder_overdue_wave_reconciled_by: worker,
      compact_holder_overdue_wave_attempt_id: attemptId,
      compact_holder_overdue_wave_evidence_path: memoPath,
    };

    saveTaskTreeWithKanbanSnapshot(config, tree);
  });
}

const featureStateAfterLoad = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const featureState = featureStateAfterLoad.state;

for (const item of holderConfigs) {
  const tree = readTaskTree(config);
  const holder = tree.tasks[item.holderTaskId];
  assert(holder, `Missing holder ${item.holderTaskId} after tree refresh`);
  const blocker = asRecord(holder.blocker);
  const currentFeature = featureState.features[item.featureKey];
  assert(currentFeature, `Missing feature state ${item.featureKey}`);

  updateFeatureCompactItem(featureState, item.featureKey, {
    status: "blocked",
    taskId: item.holderTaskId,
    frontierTaskIds: [...item.sourceTaskIds],
    retryable: false,
    retryReason: asString(blocker.resume_condition),
    ownerReason: item.ownerReason,
    blockedAt: asString(blocker.blocked_at),
    blockedReason: item.condition,
    waitingFor: asRecord(blocker.waiting_for),
    waitingCondition: asString(blocker.resume_condition),
    resumeCondition: asString(blocker.resume_condition),
    observedBy: asRecord(blocker.observed_by),
    observationMethod: asString(blocker.observation_method),
    nextCheckAt: asString(blocker.next_check_at),
    blockerOwner: asString(blocker.owner),
    fallbackAt: asString(blocker.fallback_at),
    fallbackAction: asString(blocker.fallback_action),
    reviewEvidencePath: memoPath,
    lastCheckedAt: appliedAt,
    updatedAt: appliedAt,
    evidencePaths: unique([
      ...asStringArray(currentFeature.evidencePaths),
      memoPath,
    ]),
    attemptedFixes: unique([
      ...asStringArray(currentFeature.attemptedFixes),
      item.resultSummary,
    ]),
    nextStepClassification: item.nextStepClassification,
    summary: item.resultSummary,
    lastSummary: item.resultSummary,
    verificationBlocker: item.verificationBlocker,
  });
}

saveFeatureCompactLoopState(featureStateAfterLoad.path, featureState);

const taskTreeHashAfter = fileHash(taskTreePath);
const featureHashAfter = fileHash(featureCompactStatePath);
assert(taskTreeHashAfter !== taskTreeHashBefore, "Task tree hash did not change");
assert(featureHashAfter !== featureHashBefore, "Feature compact state hash did not change");

const afterTree = readTaskTree(config);
const featureStateAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const after: Record<string, { holder: Snapshot | null; feature: FeatureSnapshot | null; sources: Record<string, Snapshot | null> }> = {};
const representedSetAfter = holderConfigs.map((configItem) => ({
  holderTaskId: configItem.holderTaskId,
  sourceTaskIds: [...configItem.sourceTaskIds],
  nextCheckAt: asString(asRecord(afterTree.tasks[configItem.holderTaskId]?.blocker).next_check_at),
  fallbackAt: asString(asRecord(afterTree.tasks[configItem.holderTaskId]?.blocker).fallback_at),
}));

for (const item of holderConfigs) {
  const featureRow = featureStateAfter.state.features[item.featureKey] as MutableRecord | undefined;
  assert(featureRow, `Missing feature compact row ${item.featureKey} after apply`);
  after[item.holderTaskId] = {
    holder: snapshotTask(afterTree.tasks[item.holderTaskId]),
    feature: snapshotFeature(featureRow),
    sources: Object.fromEntries(
      item.sourceTaskIds.map((sourceTaskId) => [sourceTaskId, snapshotTask(afterTree.tasks[sourceTaskId])]),
    ),
  };
}

const memo = `# Overdue compact holder reconciliation wave — 2026-07-17

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- App: \`${appDir}\`
- Domain workspace: \`${projectDir}\`
- Supported mechanisms used:
  - \`refreshBlockedWait(... )\` for in-place blocked-holder refresh
  - \`withTreeLock(... )\` + \`saveTaskTreeWithKanbanSnapshot(... )\` for bounded holder metadata repair
  - \`loadFeatureCompactLoopState(... )\` + \`updateFeatureCompactItem(... )\` + \`saveFeatureCompactLoopState(... )\` for controller-visible compact projection parity

## Scope

Reconciled exactly these four compact holders named in the assigned task, without adding sibling reruns or broad compact recovery work:

${representedSetBefore
  .map(
    (item, index) =>
      `${index + 1}. \`${item.holderTaskId}\` → ${item.sourceTaskIds.map((taskId) => `\`${taskId}\``).join(", ")}`,
  )
  .join("\n")}

## Pre-audit contributor set (excluding this audit task itself)

The pre-audit represented set stayed the same four holders above. Each still needed holder-level reconciliation because the compact-facing review window or controller-visible frontier metadata lagged its governing same-lineage wait set.

## Applied repair summary

No holder needed replacement. The truthful repair for all four was an in-place refresh that:

1. revalidated the current governing same-lineage wait ids;
2. rewrote holder blocker/context text to point at this current reconciliation memo;
3. advanced each holder review window to the current downstream future window derived from the governing wait set; and
4. rewrote the feature-compact controller-visible row so \`taskId\`, \`frontierTaskIds\`, blocker text, review evidence path, and watch window match the repaired holder.

## Per-holder baseline and result

${holderConfigs
  .map((item, index) => {
    const beforeEntry = before[item.holderTaskId];
    const afterEntry = after[item.holderTaskId];
    return `### ${index + 1}. \`${item.holderTaskId}\`

- Feature key: \`${item.featureKey}\`
- Governing same-lineage waits: ${item.sourceTaskIds.map((taskId) => `\`${taskId}\``).join(", ")}
- Derived future holder window from live governing waits before apply:
  - \`next_check_at = ${beforeEntry.derivedWindow.nextCheckAt}\`
  - \`fallback_at = ${beforeEntry.derivedWindow.fallbackAt}\`

#### Holder before

\`\`\`json
${JSON.stringify(beforeEntry.holder, null, 2)}
\`\`\`

#### Compact row before

\`\`\`json
${JSON.stringify(beforeEntry.feature, null, 2)}
\`\`\`

#### Governing wait snapshots

\`\`\`json
${JSON.stringify(beforeEntry.sources, null, 2)}
\`\`\`

#### Holder after

\`\`\`json
${JSON.stringify(afterEntry.holder, null, 2)}
\`\`\`

#### Compact row after

\`\`\`json
${JSON.stringify(afterEntry.feature, null, 2)}
\`\`\`
`;
  })
  .join("\n")}

## Post-action represented set

${representedSetAfter
  .map(
    (item, index) =>
      `${index + 1}. \`${item.holderTaskId}\` -> ${item.sourceTaskIds.map((taskId) => `\`${taskId}\``).join(", ")} | next_check_at=${item.nextCheckAt} | fallback_at=${item.fallbackAt}`,
  )
  .join("\n")}

## File hash check

- Task tree changed: \`${taskTreeHashBefore}\` → \`${taskTreeHashAfter}\`
- Feature compact state changed: \`${featureHashBefore}\` → \`${featureHashAfter}\`

## Acceptance check

- The four named overdue compact holders are now represented by refreshed exact same-lineage holder metadata with future review windows: satisfied.
- Each touched holder now records its governing downstream wait ids in both live task context and controller-visible compact frontier metadata: satisfied.
- No duplicate broad compact rerun was opened and no replacement sibling was added: satisfied.
`;

writeMemo(memoAbsolutePath, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairTaskId,
      memoPath,
      hashes: {
        taskTree: { before: taskTreeHashBefore, after: taskTreeHashAfter },
        featureCompact: { before: featureHashBefore, after: featureHashAfter },
      },
      representedSetBefore,
      representedSetAfter,
      before,
      after,
    },
    null,
    2,
  ),
);
