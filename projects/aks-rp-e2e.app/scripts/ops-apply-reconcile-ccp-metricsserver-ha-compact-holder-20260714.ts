import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

type CompactDiagnostics = {
  compactLiveReadiness?: {
    activeFrontierSpecIds?: unknown;
    excludedMembers?: Array<{
      specId?: unknown;
      reason?: unknown;
    }>;
  };
  selectionBlocker?: {
    kind?: unknown;
    resumeCondition?: unknown;
  };
};

type HaScalingSpec = {
  statusReason?: unknown;
  specStateReason?: unknown;
  nextAction?: unknown;
  resumeCondition?: unknown;
};

const attemptId =
  "a_ops-apply-reconcile-ccp-metricsserver-ha-compact-holder-20260714-state-r_20260714234004";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const loopTaskId = "aks-feature-compact-loop";
const featureKey = "ccp-metricsserver";
const retiredTaskId = "hold-compact-ccp-metricsserver-reviewed-exception-frontier";
const sharedWaitTaskId =
  "wait-compact-reviewed-exception-live-ready-policy-family-20260702";
const domainMemoPath =
  "evidence/archive/reconcile-ccp-metricsserver-ha-compact-holder-20260714.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-ccp-metricsserver-ha-compact-holder-20260714.md";
const diagnosticsPath = resolve(
  projectDir,
  "features/ccp-metricsserver/compact/staging.diagnostics.json",
);
const specPath = resolve(
  projectDir,
  "features/ccp-metricsserver/specs/ccp-metricsserver-ha-scaling.json",
);

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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

const diagnostics = readJson<CompactDiagnostics>(diagnosticsPath);
const haScalingSpec = readJson<HaScalingSpec>(specPath);
const activeFrontierSpecIds = asStringArray(
  diagnostics.compactLiveReadiness?.activeFrontierSpecIds,
);
const excludedReason =
  diagnostics.compactLiveReadiness?.excludedMembers?.find(
    (entry) => entry?.specId === "spec.ccp-metricsserver.ha-scaling",
  )?.reason ?? null;
const selectionResumeCondition = asString(
  diagnostics.selectionBlocker?.resumeCondition,
);
const specStatusReason = asString(haScalingSpec.statusReason);
const specStateReason = asString(haScalingSpec.specStateReason);
const specNextAction = asString(haScalingSpec.nextAction);
const specResumeCondition = asString(haScalingSpec.resumeCondition);

assert(
  activeFrontierSpecIds.length === 1 &&
    activeFrontierSpecIds[0] === "spec.ccp-metricsserver.ha-scaling",
  `Expected exact active frontier [spec.ccp-metricsserver.ha-scaling], found ${JSON.stringify(activeFrontierSpecIds)}`,
);
assert(selectionResumeCondition, "Missing compact selection resume condition");
assert(specStatusReason, "Missing spec statusReason for ccp-metricsserver ha-scaling");
assert(specStateReason, "Missing spec specStateReason for ccp-metricsserver ha-scaling");
assert(specNextAction, "Missing spec nextAction for ccp-metricsserver ha-scaling");
assert(specResumeCondition, "Missing spec resumeCondition for ccp-metricsserver ha-scaling");

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
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
assert(compactBefore, `Missing feature-compact state for ${featureKey}`);
assert(
  compactBefore.taskId === retiredTaskId || compactBefore.taskId === sharedWaitTaskId,
  `Compact state for ${featureKey} points at ${compactBefore.taskId ?? "(null)"}, expected ${retiredTaskId} or ${sharedWaitTaskId}`,
);
assert(
  typeof compactBefore.ownerReason === "string" &&
    compactBefore.ownerReason.includes("authoritative") &&
    compactBefore.ownerReason.includes("enable-metrics-server-ha=true"),
  `Compact state for ${featureKey} no longer preserves the stale target-authority wording this task is meant to replace`,
);

const treeBefore = readTaskTree(config);
const retiredBefore = treeBefore.tasks[retiredTaskId];
const sharedWaitBefore = treeBefore.tasks[sharedWaitTaskId];
assert(retiredBefore, `Missing live holder ${retiredTaskId}`);
assert(sharedWaitBefore, `Missing shared wait ${sharedWaitTaskId}`);
assert(
  retiredBefore.state === "blocked" &&
    typeof retiredBefore.goal === "string" &&
    retiredBefore.goal.includes("target-specific staging authority surface"),
  `Retired holder ${retiredTaskId} no longer has the expected target-authority wording`,
);
assert(
  typeof sharedWaitBefore.goal === "string" &&
    sharedWaitBefore.goal.includes("ccp-coredns") &&
    !sharedWaitBefore.goal.includes("ccp-metricsserver"),
  `Shared wait ${sharedWaitTaskId} is not in the expected pre-apply scope`,
);

const blockedReason = [
  "Do not rerun unchanged; ccp-metricsserver remains compact-partial only because spec.ccp-metricsserver.ha-scaling is a reviewed-exception member intentionally excluded by the default live-ready filter.",
  `Current compact diagnostics regenerate the exact residue as ${activeFrontierSpecIds.join(", ")} under repo-local-live-ready-filter, with no remaining unsent target-authority ask. See ${appMemoPath}.`,
  "repo-local-live-ready-filter",
  "All 3 active feature-owned specs are already selected into the compact package, but the current live-ready filter intentionally quarantines spec.ccp-metricsserver.ha-scaling as settled reviewed-exception/non-live conditional coverage while resource-metrics-api and upgrade-survival remain the live-ready members.",
  selectionResumeCondition,
].join("\n");
const ownerReason =
  "All 3 active feature-owned specs are already selected into the compact package, but the current live-ready filter intentionally quarantines spec.ccp-metricsserver.ha-scaling as settled reviewed-exception/non-live conditional coverage. No target-specific staging authority chase remains; the residue now matches the shared reviewed-exception/live-ready policy family.";
const stateSummary =
  `${attemptId}: rebound ccp-metricsserver from stale target-authority holder ${retiredTaskId} to shared reviewed-exception/live-ready policy wait ${sharedWaitTaskId}; spec.ccp-metricsserver.ha-scaling remains quarantined non-live conditional coverage, not an unsent external ask.`;
const waitingCondition = selectionResumeCondition;
const waitingFor = {
  type: "compact.live-ready.policy",
  taskId: sharedWaitTaskId,
  featureKey,
  target: "staging",
  scope: "reviewed-exception-live-ready-family",
};
const fallbackAction =
  "If the same reviewed-exception/live-ready policy wait remains true at fallback, refresh the shared family evidence or escalate that policy owner; do not restore target-authority wording or rerun ccp-metricsserver unchanged.";

const mutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const retired = tree.tasks[retiredTaskId];
  const sharedWait = tree.tasks[sharedWaitTaskId];

  assert(retired, `Missing live holder ${retiredTaskId}`);
  assert(sharedWait, `Missing shared wait ${sharedWaitTaskId}`);

  const sharedBlocker = asRecord(sharedWait.blocker);
  const sharedContext = asRecord(sharedWait.context);
  const sharedTrace = asRecord(sharedWait.trace);
  const sharedScopes = unique([
    ...asStringArray(sharedWait.conflict_scope),
    "feature:ccp-metricsserver",
  ]);
  const sharedOutputs = unique([
    ...asStringArray(sharedWait.outputs),
    ".state/feature-compact-loop/state.json",
    appMemoPath,
  ]);

  sharedWait.goal =
    "Represent the shared residual reviewed-exception/live-ready policy wait for ccp-coredns, ccp-metricsserver, kms-etcd-encryption, planned-maintenance, and ossku-migration until accepted member reclassification or an intentional compact live-ready policy change occurs; keep the separate exact same-spec machines-agentpool run-review wait outside this family and do not compress unrelated split-frontier families back into this carrier.";
  sharedWait.outputs = sharedOutputs;
  sharedWait.conflict_scope = sharedScopes;
  sharedWait.acceptance = [
    "One exact blocked leaf preserves the residual reviewed-exception/live-ready policy family across ccp-coredns, ccp-metricsserver, kms-etcd-encryption, planned-maintenance, and ossku-migration with accepted same-lineage evidence.",
    "Resume only on accepted reviewed-exception member reclassification or an intentional compact live-ready policy change; do not blind-rerun this family or reopen feature-local target-authority wording once the residue is only compact-policy governed.",
  ];
  sharedWait.blocker = {
    ...sharedBlocker,
    condition:
      "Blocked only while the residual reviewed-exception members in ccp-coredns, ccp-metricsserver, kms-etcd-encryption, planned-maintenance, and ossku-migration remain intentionally excluded from the compact live-ready subset. The 2026-07-14 ccp-metricsserver reconciliation memo confirmed that spec.ccp-metricsserver.ha-scaling is already settled as non-live conditional reviewed-exception coverage, so this carrier now truthfully includes that repo-local policy residue while the separate same-spec machines-agentpool run-review wait and unrelated split-frontier features remain outside this family.",
    resume_condition:
      "Resume when accepted evidence reclassifies those reviewed-exception members, a future accepted repo-local target/config authority change explicitly promotes ccp-metricsserver HA into live-ready coverage, or a human-approved compact live-ready policy change broadens this carrier family; do not reopen the separate same-spec machines-agentpool run-review wait through this shared holder.",
    fallback_action:
      "If the reviewed-exception live-ready policy wait is still true at fallback time, keep one exact family wait with fresh evidence or replace it with one exact owner recovery/escalation successor instead of leaving this holder overdue; do not recreate a ccp-metricsserver target-authority wait unless materially new authority work is actually sent.",
  };
  sharedWait.context = {
    ...sharedContext,
    familyFeatureKeys: unique([
      ...asStringArray(sharedContext.familyFeatureKeys),
      "ccp-coredns",
      "ccp-metricsserver",
      "kms-etcd-encryption",
      "planned-maintenance",
      "ossku-migration",
    ]),
    reviewEvidencePath: appMemoPath,
    domainEvidencePath: domainMemoPath,
    lastAddedFeatureKey: featureKey,
  };
  sharedWait.trace = {
    ...sharedTrace,
    ccp_metricsserver_family_rebind_applied_at: appliedAt,
    ccp_metricsserver_family_rebind_applied_by: worker,
    ccp_metricsserver_family_rebind_attempt_id: attemptId,
  };
  sharedWait.result =
    `${attemptId}: expanded ${sharedWaitTaskId} to include ccp-metricsserver as shared reviewed-exception/live-ready policy residue and retired the stale feature-local target-authority holder ${retiredTaskId}.`;

  saveTaskTreeWithKanbanSnapshot(config, tree);

  return {
    sharedWaitGoal: sharedWait.goal,
    sharedWaitConflictScope: [...sharedScopes],
    sharedWaitCondition: asRecord(sharedWait.blocker).condition ?? null,
  };
});

const retiredDone = markTaskDone(config, {
  taskId: retiredTaskId,
  resolution: "replaced",
  summary:
    `Retired stale feature-local target-authority holder ${retiredTaskId} and replaced it with shared reviewed-exception/live-ready policy wait ${sharedWaitTaskId}; see ${appMemoPath}.`,
});

const retiredAfter = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const retired = tree.tasks[retiredTaskId];
  assert(retired, `Retired task ${retiredTaskId} disappeared after mark-done`);
  retired.outputs = unique([
    ...asStringArray(retired.outputs),
    ".state/feature-compact-loop/state.json",
    appMemoPath,
  ]);
  retired.result =
    `Replaced stale target-authority holder ${retiredTaskId} with shared reviewed-exception/live-ready policy wait ${sharedWaitTaskId}. ccp-metricsserver no longer waits on an unsent staging authority surface; see ${appMemoPath}.`;
  retired.context = {
    ...asRecord(retired.context),
    replacementTaskId: sharedWaitTaskId,
    reviewEvidencePath: appMemoPath,
    domainEvidencePath: domainMemoPath,
    replacedBySharedPolicyWait: true,
  };
  retired.trace = {
    ...asRecord(retired.trace),
    compact_holder_replaced_at: appliedAt,
    compact_holder_replaced_by: worker,
    compact_holder_replacement_task_id: sharedWaitTaskId,
    compact_holder_replacement_attempt_id: attemptId,
  };
  saveTaskTreeWithKanbanSnapshot(config, tree);
  return {
    state: retired.state,
    status: retired.status,
    resolution: retired.resolution,
    result: retired.result,
  };
});

const attemptedFixes = unique([
  ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
  `${attemptId}: rebound ${featureKey} from stale target-authority holder ${retiredTaskId} to shared reviewed-exception/live-ready policy wait ${sharedWaitTaskId}.`,
]);
const evidencePaths = unique([
  ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
  diagnosticsPath.replace(`${projectDir}/`, ""),
  specPath.replace(`${projectDir}/`, ""),
  domainMemoPath,
  appMemoPath,
]);

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  retryReason: waitingCondition,
  taskId: sharedWaitTaskId,
  frontierTaskIds: [],
  ownerReason,
  attemptedFixes,
  nextStepClassification: "shared-reviewed-exception-live-ready-policy-wait",
  resumeCondition: specResumeCondition,
  blockedReason,
  waitingFor,
  waitingCondition,
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this compact-facing reviewed-exception/live-ready policy wait and only return ccp-metricsserver to runnable work when accepted reclassification, accepted target/config authority change, or compact-policy change materially changes the named residue.",
  nextCheckAt: compactBefore.nextCheckAt ?? "2026-07-15T00:30:00Z",
  blockerOwner: "human",
  fallbackAt: compactBefore.fallbackAt ?? "2026-07-15T18:30:00Z",
  fallbackAction,
  resumeAction:
    "Reset this feature compact record to pending only after accepted reclassification, accepted target/config authority change, or compact live-ready policy change materially changes the named residue.",
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
  lastCheckedAt: appliedAt,
  evidencePaths,
  reviewEvidencePath: appMemoPath,
  verificationBlocker:
    "No truthful rerun candidate remains in this compact slice because spec.ccp-metricsserver.ha-scaling is intentionally quarantined by the reviewed-exception live-ready policy until accepted reclassification, accepted target/config authority change, or compact-policy change occurs.",
  summary: stateSummary,
  lastSummary: stateSummary,
  rootCauseClassification: "repo-local-live-ready-filter",
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const { state: compactAfter } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const featureAfter = compactAfter.features[featureKey];
assert(featureAfter, `Missing compact state for ${featureKey} after save`);
assert(
  featureAfter.taskId === sharedWaitTaskId,
  `Expected ${featureKey} taskId=${sharedWaitTaskId}, found ${featureAfter.taskId ?? "(null)"}`,
);
assert(
  featureAfter.ownerReason?.includes("No target-specific staging authority chase remains") ?? false,
  `Feature ownerReason did not switch away from target-authority wording`,
);
assert(
  featureAfter.waitingFor?.type === "compact.live-ready.policy",
  `Feature waitingFor.type was not rewritten to compact.live-ready.policy`,
);

const memo = `# App apply: reconcile ccp-metricsserver HA compact holder — 2026-07-14

- Task: \`ops-apply-reconcile-ccp-metricsserver-ha-compact-holder-20260714-state-r\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Retired holder: \`${retiredTaskId}\`
- Shared wait: \`${sharedWaitTaskId}\`
- Feature row: \`${featureKey}\` in \`.state/feature-compact-loop/state.json\`

## Authority used

- Domain memo: \`${domainMemoPath}\`
- Compact diagnostics: \`features/ccp-metricsserver/compact/staging.diagnostics.json\`
- HA spec metadata: \`features/ccp-metricsserver/specs/ccp-metricsserver-ha-scaling.json\`

## Baseline before apply

- Live holder goal still waited for a target-specific staging authority surface to prove whether \`enable-metrics-server-ha=true\` is expected.
- Shared reviewed-exception/live-ready family wait still named only ccp-coredns, kms-etcd-encryption, planned-maintenance, and ossku-migration.
- Compact state for \`${featureKey}\` still pointed at \`${retiredTaskId}\` with ownerReason/waitingCondition centered on authoritative target-specific HA proof.

## Applied repair

### Retired stale feature-local holder

Marked \`${retiredTaskId}\` done with resolution \`replaced\` and recorded \`${sharedWaitTaskId}\` as its replacement carrier.

### Expanded the shared family wait

Updated \`${sharedWaitTaskId}\` so its goal, acceptance, conflict scope, blocker text, and evidence pointers now include \`${featureKey}\` as another reviewed-exception/live-ready policy residue.

### Rebound compact-loop state

Updated the controller-visible compact row for \`${featureKey}\` from a target-authority frontier to the shared reviewed-exception/live-ready policy wait.

## Before → after highlights

### Shared wait goal
- Before: ${JSON.stringify(sharedWaitBefore.goal ?? null)}
- After: ${JSON.stringify(mutation.sharedWaitGoal)}

### Feature taskId
- Before: ${JSON.stringify(compactBefore.taskId ?? null)}
- After: ${JSON.stringify(featureAfter.taskId ?? null)}

### Feature errorClass
- Before: ${JSON.stringify(compactBefore.errorClass ?? null)}
- After: ${JSON.stringify(featureAfter.errorClass ?? null)}

### Feature ownerReason
- Before: ${JSON.stringify(compactBefore.ownerReason ?? null)}
- After: ${JSON.stringify(featureAfter.ownerReason ?? null)}

### Feature waitingFor
- Before: ${JSON.stringify(compactBefore.waitingFor ?? null)}
- After: ${JSON.stringify(featureAfter.waitingFor ?? null)}

### Feature reviewEvidencePath
- Before: ${JSON.stringify(compactBefore.reviewEvidencePath ?? null)}
- After: ${JSON.stringify(featureAfter.reviewEvidencePath ?? null)}

## Domain facts preserved

- Active frontier spec ids: ${JSON.stringify(activeFrontierSpecIds)}
- Compact selection resume condition: ${JSON.stringify(selectionResumeCondition)}
- HA spec statusReason: ${JSON.stringify(specStatusReason)}
- HA spec specStateReason: ${JSON.stringify(specStateReason)}
- HA spec nextAction: ${JSON.stringify(specNextAction)}
- HA spec resumeCondition: ${JSON.stringify(specResumeCondition)}
- Compact excluded-member reason: ${JSON.stringify(excludedReason)}

## Result

\`${featureKey}\` no longer waits on an unsent external target-authority surface. The live app-owned tree and compact-loop state now represent the remaining residue as shared reviewed-exception/live-ready policy work under \`${sharedWaitTaskId}\`.
`;

writeText(resolve(appDir, appMemoPath), memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      retiredDone,
      retiredAfter,
      sharedWaitGoal: mutation.sharedWaitGoal,
      featureTaskId: featureAfter.taskId,
      featureErrorClass: featureAfter.errorClass,
      featureWaitingFor: featureAfter.waitingFor,
      featureReviewEvidencePath: featureAfter.reviewEvidencePath,
    },
    null,
    2,
  ),
);
