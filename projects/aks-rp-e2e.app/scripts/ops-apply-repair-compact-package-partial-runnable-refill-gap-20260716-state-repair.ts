import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createTask,
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type TaskSnapshot = {
  id: string | null;
  state: string | null;
  parentId: string | null;
  goal: string | null;
  blocker: {
    condition: string | null;
    owner: string | null;
    nextCheckAt: string | null;
    fallbackAt: string | null;
    resumeCondition: string | null;
    waitingFor: JsonRecord | null;
  };
};

type FeatureSnapshot = {
  taskId: string | null;
  frontierTaskIds: string[];
  reviewEvidencePath: string | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  waitingFor: JsonRecord | null;
  ownerReason: string | null;
  blockedReason: string | null;
  lastSummary: string | null;
  summary: string | null;
};

type SpecSnapshot = {
  status: string | null;
  taskId: string | null;
  lastRunId: string | null;
  lastResultPath: string | null;
  review: JsonRecord | null;
};

const attemptId =
  "a_ops-apply-repair-compact-package-partial-runnable-refill-gap-20260716-state-repair_20260716144708";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const featureKey = "network-cni";
const compactLoopTaskId = "aks-feature-compact-loop";
const compactReviewTaskId = "reconcile-compact-loop-package-partial";
const replacementHolderTaskId =
  "hold-compact-network-cni-package-partial-frontier-20260716r";
const retiredHolderTaskId = "hold-compact-network-cni-package-partial-frontier-20260709i";
const retiredIlpipTaskId =
  "domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714";
const row94WaitTaskId =
  "wait-spec-network-cni-azure-overlay-dual-stack-row94-live-surface-20260702";
const sharedSubnetWaitTaskId =
  "wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703";
const calicoEnoHolderTaskId =
  "hold-spec-network-cni-vm-prerelease-calico-eno-row192-196-frontier-20260710";
const ciliumPreviewBlockedTaskId =
  "domain/review-network-cni-cilium-preview-upgrade-rerun-172487147-terminal-blocked";
const ilpipSpecId = "spec.network-cni.azure-overlay-ilpip";
const dualStackSpecId = "spec.network-cni.azure-overlay-dual-stack";
const ciliumPreviewSpecId = "spec.network-cni.cilium-preview-upgrade";
const dualstackSubnetSpecId =
  "spec.network-cni.vm-prerelease-overlay-cilium-dualstack";
const calicoEnoSpecId = "spec.network-cni.vm-prerelease-calico-eno-migration-matrix";

const compactStatePath = resolve(appDir, ".state/feature-compact-loop/state.json");
const specLoopStatePath = resolve(appDir, ".state/spec-loop/state.json");
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-apply-repair-compact-package-partial-runnable-refill-gap-20260716-state-repair.md",
);
const evidencePathRelative =
  "evidence/archive/ops-apply-repair-compact-package-partial-runnable-refill-gap-20260716-state-repair.md";
const reviewedMemoPath =
  "evidence/archive/ops-repair-compact-package-partial-runnable-refill-gap-20260716.md";
const specLoopRepairMemoPath =
  "evidence/archive/ops-apply-reconcile-spec-loop-pending-network-cni-state-repair-20260716.md";
const terminalReviewMemoPath =
  "evidence/archive/reconcile-compact-loop-package-partial-network-cni-terminal-run-172352561-review-20260716.md";
const ilpipPassEvidencePath =
  "evidence/archive/domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714-network-cni-azure-overlay-ilpip.json";
const ilpipPassMemoPath =
  "../aks-rp-e2e/evidence/archive/domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714.md";
const diagnosticsPath = "features/network-cni/compact/staging.diagnostics.json";
const summaryPath = "features/network-cni/compact/staging.summary.md";

const activeFrontierSpecIds = [
  "spec.network-cni.azure-overlay-agic-vm-prerelease",
  dualStackSpecId,
  ilpipSpecId,
  "spec.network-cni.kubenet-network-policy-calico",
  "spec.network-cni.none-byo-cni-vm-prerelease-lifecycle",
  "spec.network-cni.vm-prerelease-azure-npm-matrix",
  "spec.network-cni.vm-prerelease-azure-overlay-multi-subnet-matrix",
  "spec.network-cni.vm-prerelease-azure-overlay-upgrade-matrix",
  calicoEnoSpecId,
  "spec.network-cni.vm-prerelease-calico-matrix",
  "spec.network-cni.vm-prerelease-cilium-matrix",
  "spec.network-cni.vm-prerelease-npm-uninstall-matrix",
  dualstackSubnetSpecId,
  "spec.network-swift-v1.dynamic-ip-allocation",
] as const;

const consumedPassHistorySpecIds = [
  "spec.network-cni.azure-overlay-dual-stack-migration",
  "spec.network-cni.azure-overlay-podcidr-expansion",
] as const;

const liveExactHolderTaskIds = [
  row94WaitTaskId,
  sharedSubnetWaitTaskId,
  calicoEnoHolderTaskId,
  ciliumPreviewBlockedTaskId,
] as const;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as JsonRecord) } as JsonRecord)
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

function sortedUnique(values: Array<string | null | undefined>): string[] {
  return unique(values).sort((a, b) => a.localeCompare(b));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf-8");
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function isoMin(values: Array<string | null | undefined>, fallback: string): string {
  const timestamps = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (timestamps.length === 0) return fallback;
  return new Date(timestamps[0]!).toISOString();
}

function taskSnapshot(task: TaskNode | undefined): TaskSnapshot | null {
  if (!task) return null;
  const blocker = asRecord(task.blocker);
  return {
    id: asString(task.id) || null,
    state: asString(task.state) || asString((task as JsonRecord).status) || null,
    parentId: asString(task.parent_id) || null,
    goal: asString(task.goal) || null,
    blocker: {
      condition: asString(blocker.condition) || null,
      owner: asString(blocker.owner) || null,
      nextCheckAt: asString(blocker.next_check_at) || null,
      fallbackAt: asString(blocker.fallback_at) || null,
      resumeCondition: asString(blocker.resume_condition) || null,
      waitingFor:
        Object.keys(asRecord(blocker.waiting_for)).length > 0
          ? asRecord(blocker.waiting_for)
          : null,
    },
  };
}

function featureSnapshot(
  feature: FeatureCompactItemState | undefined,
): FeatureSnapshot | null {
  if (!feature) return null;
  return {
    taskId: feature.taskId ?? null,
    frontierTaskIds: [...(feature.frontierTaskIds ?? [])],
    reviewEvidencePath: feature.reviewEvidencePath ?? null,
    nextCheckAt: feature.nextCheckAt ?? null,
    fallbackAt: feature.fallbackAt ?? null,
    waitingFor:
      Object.keys(asRecord(feature.waitingFor)).length > 0
        ? asRecord(feature.waitingFor)
        : null,
    ownerReason: feature.ownerReason ?? null,
    blockedReason: feature.blockedReason ?? null,
    lastSummary: feature.lastSummary ?? null,
    summary: feature.summary ?? null,
  };
}

function specSnapshot(spec: JsonRecord | undefined): SpecSnapshot {
  const review = asRecord(spec?.review);
  return {
    status: asString(spec?.status) || null,
    taskId: asString(spec?.taskId) || null,
    lastRunId: asString(spec?.lastRunId) || null,
    lastResultPath: asString(spec?.lastResultPath) || null,
    review: Object.keys(review).length > 0 ? review : null,
  };
}

const treeBefore = readTaskTree(config);
const featureLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = featureLoaded.state;
const featureBefore = compactState.features[featureKey];
assert(featureBefore, `Missing compact feature state for ${featureKey}`);

const specLoop = readJson<{ specs: Record<string, JsonRecord> }>(specLoopStatePath);
const ilpipSpecBefore = specSnapshot(specLoop.specs[ilpipSpecId]);
assert(ilpipSpecBefore.status === "pass", `${ilpipSpecId} must already be pass in spec-loop state`);
assert(!ilpipSpecBefore.taskId, `${ilpipSpecId} must not point at a live task id in spec-loop state`);

const diagnostics = readJson<{
  packageStatus?: unknown;
  compactLiveReadiness?: {
    readySpecIds?: unknown;
    activeFrontierSpecIds?: unknown;
    consumedPassHistorySpecIds?: unknown;
  };
  liveDispatchGate?: { allowed?: unknown; reason?: unknown };
}>(resolve(projectDir, diagnosticsPath));
const readySpecIds = asStringArray(
  asRecord(diagnostics.compactLiveReadiness).readySpecIds,
);
const diagnosticsFrontierSpecIds = asStringArray(
  asRecord(diagnostics.compactLiveReadiness).activeFrontierSpecIds,
);
const diagnosticsConsumedSpecIds = asStringArray(
  asRecord(diagnostics.compactLiveReadiness).consumedPassHistorySpecIds,
);
assert(asString(diagnostics.packageStatus) === "partial", "network-cni diagnostics must remain partial");
assert(readySpecIds.length === 53, `Expected 53 ready specs, found ${readySpecIds.length}`);
assert(diagnosticsFrontierSpecIds.length === 14, `Expected 14 active frontier specs, found ${diagnosticsFrontierSpecIds.length}`);
assert(diagnosticsConsumedSpecIds.length === 2, `Expected 2 consumed pass-history specs, found ${diagnosticsConsumedSpecIds.length}`);

const liveExactTasksBefore = liveExactHolderTaskIds.map((taskId) => {
  const task = treeBefore.tasks[taskId];
  assert(task, `Missing required live exact holder ${taskId}`);
  return task;
});
const compactReviewTaskBefore = treeBefore.tasks[compactReviewTaskId];
assert(compactReviewTaskBefore, `Missing review task ${compactReviewTaskId}`);
assert(
  !treeBefore.tasks[retiredHolderTaskId],
  `${retiredHolderTaskId} unexpectedly exists live before repair`,
);
assert(
  !treeBefore.tasks[retiredIlpipTaskId],
  `${retiredIlpipTaskId} unexpectedly exists live before repair`,
);

const holderNextCheckAt = isoMin(
  liveExactTasksBefore.map((task) =>
    asString(asRecord(task.blocker).next_check_at) || null,
  ),
  new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
);
const holderFallbackAt = isoMin(
  liveExactTasksBefore.map((task) =>
    asString(asRecord(task.blocker).fallback_at) || null,
  ),
  new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
);

const holderGoal =
  "Preserve one exact compact network-cni package-partial family wait while current compact diagnostics still advertise a 14-member active frontier, routing the live blocked surfaces through exact same-lineage holders and retiring stale dead task ids instead of reopening an unchanged broad compact rerun.";
const holderAcceptance = [
  "The holder preserves the current network-cni compact authority (53 ready specs, 14 active-frontier specs, 2 consumed pass-history specs, packageStatus=partial, liveDispatchGate.allowed=false) without pointing at missing task ids.",
  `The holder names the exact current live downstream holders ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, and ${ciliumPreviewBlockedTaskId}, while recording that ${ilpipSpecId} already normalized to pass from archived authenticated-launcher evidence and therefore does not justify recreating ${retiredIlpipTaskId} as a blocked holder.`,
  `The holder keeps ${consumedPassHistorySpecIds.join(", ")} as consumed pass history only and does not reopen a broad unchanged network-cni compact rerun.`,
] as const;
const holderCondition =
  `Current compact diagnostics still advertise a 14-member active frontier (${activeFrontierSpecIds.join(", ")}) with ${readySpecIds.length} ready specs and ${diagnosticsConsumedSpecIds.length} consumed pass-history members (${consumedPassHistorySpecIds.join(", ")}), but the old family holder ${retiredHolderTaskId} and old ILPIP downstream carrier ${retiredIlpipTaskId} are not live. Primary app evidence now shows ${ilpipSpecId} already normalized to pass from archived same-spec authenticated-launcher evidence (${ilpipPassEvidencePath}), so this replacement family holder must preserve the remaining exact live blocked surfaces through ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, and ${ciliumPreviewBlockedTaskId} instead of recreating stale dead ids or reopening an unchanged broad rerun.`;
const holderResumeCondition =
  `Resume only when one of ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, or ${ciliumPreviewBlockedTaskId} materially changes the same-lineage frontier, when compact diagnostics regenerate to retire or reclassify the inherited 14-member active frontier, or when materially new same-path verification intent reopens ${consumedPassHistorySpecIds.join(", ")}. Do not recreate ${retiredIlpipTaskId} as blocked work unless the archived pass is explicitly disproved.`;
const holderFallbackAction =
  `If unchanged at fallback, refresh this exact family holder from the latest same-lineage blocked holders plus archived ILPIP pass evidence; do not restore ${retiredHolderTaskId}, do not recreate ${retiredIlpipTaskId} as blocked work, and do not dispatch a broad unchanged compact rerun.`;
const holderObservationMethod =
  "Scheduled blocked-frontier app-ops review checks the exact live holders plus archived ILPIP pass evidence and must unblock, replace, or keep this family holder with fresh proof.";

if (!treeBefore.tasks[replacementHolderTaskId]) {
  createTask(config, {
    id: replacementHolderTaskId,
    parentId: compactLoopTaskId,
    state: "backlog",
    priority: "P2",
    owner: "aks-explorer",
    goal: holderGoal,
    inputs: [
      reviewedMemoPath,
      specLoopRepairMemoPath,
      terminalReviewMemoPath,
      diagnosticsPath,
      compactStatePath,
      specLoopStatePath,
    ],
    outputs: [
      ".state/feature-compact-loop/state.json",
      evidencePathRelative,
      reviewedMemoPath,
      specLoopRepairMemoPath,
      terminalReviewMemoPath,
    ],
    acceptance: [...holderAcceptance],
    conflict_scope: [
      "feature-compact:network-cni",
      "feature:network-cni",
      "feature-compact-wait:package-partial",
    ],
    context: {
      featureCompactExactWait: true,
      featureKey,
      errorClass: "package-partial",
      target: "staging",
      sourceReviewTaskId: compactReviewTaskId,
      sourceReviewEvidencePath: terminalReviewMemoPath,
      diagnosticsPath,
      summaryPath,
      activeFrontierSpecIds: [...activeFrontierSpecIds],
      consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
      downstreamCarrierTaskIds: [...liveExactHolderTaskIds],
      retiredTaskIds: [retiredHolderTaskId, retiredIlpipTaskId],
      archivedPassSpecIds: [ilpipSpecId],
      archivedPassEvidencePath: ilpipPassEvidencePath,
      specLoopRepairEvidencePath: specLoopRepairMemoPath,
      reviewEvidencePath: evidencePathRelative,
    },
  });
}

const treeAfter = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[replacementHolderTaskId] as TaskNode | undefined;
  assert(holder, `Missing replacement holder ${replacementHolderTaskId}`);
  holder.state = "blocked";
  (holder as JsonRecord).status = "blocked";
  holder.kind = "domain_leaf";
  holder.priority = "P2";
  holder.owner = "aks-explorer";
  holder.goal = holderGoal;
  holder.acceptance = [...holderAcceptance];
  holder.outputs = sortedUnique([
    ...asStringArray(holder.outputs),
    ".state/feature-compact-loop/state.json",
    evidencePathRelative,
    reviewedMemoPath,
    specLoopRepairMemoPath,
    terminalReviewMemoPath,
  ]);
  holder.conflict_scope = sortedUnique([
    ...asStringArray(holder.conflict_scope),
    "feature-compact:network-cni",
    "feature:network-cni",
    "feature-compact-wait:package-partial",
  ]);
  holder.context = {
    ...asRecord(holder.context),
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    sourceReviewTaskId: compactReviewTaskId,
    sourceReviewEvidencePath: terminalReviewMemoPath,
    diagnosticsPath,
    summaryPath,
    activeFrontierSpecIds: [...activeFrontierSpecIds],
    consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
    downstreamCarrierTaskIds: [...liveExactHolderTaskIds],
    retiredTaskIds: [retiredHolderTaskId, retiredIlpipTaskId],
    archivedPassSpecIds: [ilpipSpecId],
    archivedPassEvidencePath: ilpipPassEvidencePath,
    specLoopRepairEvidencePath: specLoopRepairMemoPath,
    reviewEvidencePath: evidencePathRelative,
    compactAuthority: {
      readyCount: readySpecIds.length,
      activeFrontierCount: diagnosticsFrontierSpecIds.length,
      consumedPassHistoryCount: diagnosticsConsumedSpecIds.length,
      packageStatus: diagnostics.packageStatus,
      liveDispatchAllowed: asRecord(diagnostics.liveDispatchGate).allowed,
    },
  };
  holder.blocker = {
    ...asRecord(holder.blocker),
    condition: holderCondition,
    category: asString(asRecord(holder.blocker).category) || "external-wait",
    owner: "aks-explorer",
    blocked_at: asString(asRecord(holder.blocker).blocked_at) || appliedAt,
    waiting_for: {
      type: "frontier.changed",
      taskId: replacementHolderTaskId,
      featureKey,
      scope: "active-frontier-14",
      representedSpecIds: [...activeFrontierSpecIds],
      consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
      downstreamCarrierTaskIds: [...liveExactHolderTaskIds],
      retiredTaskIds: [retiredHolderTaskId, retiredIlpipTaskId],
    },
    observed_by: {
      workflow: "project-planner",
      schedule: "blocked-frontier-app-ops-review",
      trigger: "project.planning.requested",
    },
    observation_method: holderObservationMethod,
    next_check_at: holderNextCheckAt,
    resume_condition: holderResumeCondition,
    fallback_at: holderFallbackAt,
    fallback_action: holderFallbackAction,
    resume_at: holderNextCheckAt,
  };
  (holder as JsonRecord).result =
    `${attemptId}: replacement family holder now preserves the network-cni package-partial frontier with live exact holder ids and archived ILPIP pass evidence instead of the dead ${retiredHolderTaskId} / ${retiredIlpipTaskId} pointers.`;
  holder.trace = {
    ...asRecord(holder.trace),
    compact_representation_repaired_at: appliedAt,
    compact_representation_repaired_by: worker,
    retired_family_holder_task_id: retiredHolderTaskId,
    retired_ilpip_task_id: retiredIlpipTaskId,
    downstream_carrier_task_ids: [...liveExactHolderTaskIds],
    archived_pass_spec_ids: [ilpipSpecId],
  };
  saveTaskTreeWithKanbanSnapshot(config, tree);
  return readTaskTree(config);
});

const featureWaitingFor = {
  type: "frontier.changed",
  taskId: replacementHolderTaskId,
  featureKey,
  scope: "active-frontier-14",
  representedSpecIds: [...activeFrontierSpecIds],
  consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
  downstreamCarrierTaskIds: [...liveExactHolderTaskIds],
};

const featureOwnerReason =
  `Current compact diagnostics still advertise ${readySpecIds.length} ready specs, ${diagnosticsFrontierSpecIds.length} active-frontier specs (${activeFrontierSpecIds.join(", ")}), and ${diagnosticsConsumedSpecIds.length} consumed pass-history members (${consumedPassHistorySpecIds.join(", ")}) for network-cni. App-owned repair now represents the live exact blocked surfaces through ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, and ${ciliumPreviewBlockedTaskId}; ${ilpipSpecId} already normalized to pass from archived authenticated-launcher evidence, so it is preserved as exact pass history rather than recreated as blocked work.`;
const featureBlockedReason =
  `Current compact diagnostics still advertise the 14-member active network-cni package-partial frontier, but the controller-visible repair no longer points at missing ids: ${replacementHolderTaskId} now represents the family, live exact holders are ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, and ${ciliumPreviewBlockedTaskId}, and ${ilpipSpecId} is retired from blocked-work representation because spec-loop state already normalized it to pass from archived same-spec authenticated-launcher evidence.`;
const featureLastSummary =
  `Replacement holder ${replacementHolderTaskId} now preserves the network-cni compact family representation with live exact holder ids (${liveExactHolderTaskIds.join(", ")}) and archived ILPIP pass evidence; controller-visible compact state no longer points at missing family or ILPIP task ids.`;
const featureResumeCondition =
  `Resume only when one of ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, or ${ciliumPreviewBlockedTaskId} materially changes the exact same-lineage frontier, when compact diagnostics regenerate to retire or reclassify the inherited 14-member active frontier, or when materially new same-path verification intent reopens ${consumedPassHistorySpecIds.join(", ")}. Do not dispatch a broad unchanged compact rerun.`;
const featureFallbackAction =
  `If unchanged at fallback, refresh ${replacementHolderTaskId} from the latest exact live holders and archived ILPIP pass evidence; do not restore stale missing family/ILPIP task ids as active work, and do not widen into a broad unchanged compact rerun.`;
const featureSummary =
  `${attemptId}: created ${replacementHolderTaskId}, switched network-cni compact state to live exact holder ids, aligned future watch windows to those live holders, and preserved ILPIP as archived exact pass evidence rather than recreating a stale blocked carrier.`;
const featureVerificationBlocker =
  `An unchanged full-package rerun would still overclaim live readiness while compact diagnostics remain partial with ${diagnosticsFrontierSpecIds.length} active-frontier members. The truthful controller-visible representation is now ${replacementHolderTaskId} plus ${row94WaitTaskId}, ${sharedSubnetWaitTaskId}, ${calicoEnoHolderTaskId}, and ${ciliumPreviewBlockedTaskId}; ${ilpipSpecId} already has archived same-spec pass evidence and should not be reopened as blocked work without contradictory new evidence.`;

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: replacementHolderTaskId,
  frontierTaskIds: [replacementHolderTaskId, ...liveExactHolderTaskIds],
  reviewEvidencePath: evidencePathRelative,
  nextCheckAt: holderNextCheckAt,
  fallbackAt: holderFallbackAt,
  blockerOwner: "aks-explorer",
  waitingFor: featureWaitingFor,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod: holderObservationMethod,
  ownerReason: featureOwnerReason,
  blockedReason: featureBlockedReason,
  lastSummary: featureLastSummary,
  retryReason: featureResumeCondition,
  resumeCondition: featureResumeCondition,
  fallbackAction: featureFallbackAction,
  nextStepClassification:
    "preserve exact family representation with live downstream holders and archived ILPIP pass evidence",
  summary: featureSummary,
  verificationBlocker: featureVerificationBlocker,
  evidencePaths: sortedUnique([
    ...(featureBefore.evidencePaths ?? []),
    evidencePathRelative,
    reviewedMemoPath,
    specLoopRepairMemoPath,
    terminalReviewMemoPath,
  ]),
  attemptedFixes: sortedUnique([
    ...(featureBefore.attemptedFixes ?? []),
    "2026-07-16 representation repair replaced dead network-cni compact holder/id pointers with a live family holder plus exact downstream holder ids and archived ILPIP pass evidence.",
  ]),
  lastCheckedAt: appliedAt,
});

saveFeatureCompactLoopState(featureLoaded.path, compactState);

const treeVerified = readTaskTree(config);
const compactVerified = readJson<{ features: Record<string, FeatureCompactItemState> }>(compactStatePath);
const holderAfter = taskSnapshot(treeVerified.tasks[replacementHolderTaskId]);
const featureAfter = featureSnapshot(compactVerified.features[featureKey]);
assert(holderAfter, `Replacement holder ${replacementHolderTaskId} missing after save`);
assert(featureAfter, `Feature ${featureKey} missing after save`);
assert(featureAfter.taskId === replacementHolderTaskId, `Feature taskId was not updated to ${replacementHolderTaskId}`);
assert(
  JSON.stringify(featureAfter.waitingFor).includes(replacementHolderTaskId),
  `Feature waitingFor does not reference ${replacementHolderTaskId}`,
);
assert(featureAfter.nextCheckAt === holderNextCheckAt, "Feature nextCheckAt mismatch");
assert(featureAfter.fallbackAt === holderFallbackAt, "Feature fallbackAt mismatch");

const baseline = {
  retiredHolderTask: taskSnapshot(treeBefore.tasks[retiredHolderTaskId]),
  retiredIlpipTask: taskSnapshot(treeBefore.tasks[retiredIlpipTaskId]),
  compactReviewTask: taskSnapshot(compactReviewTaskBefore),
  liveExactHolders: Object.fromEntries(
    liveExactHolderTaskIds.map((taskId) => [taskId, taskSnapshot(treeBefore.tasks[taskId])]),
  ),
  feature: featureSnapshot(featureBefore),
  ilpipSpec: ilpipSpecBefore,
};

const verification = {
  replacementHolder: holderAfter,
  feature: featureAfter,
  ilpipSpec: specSnapshot(readJson<{ specs: Record<string, JsonRecord> }>(specLoopStatePath).specs[ilpipSpecId]),
};

writeText(
  evidencePath,
  `# App apply — compact package-partial runnable refill gap representation repair — 2026-07-16\n\n- Task: \`ops-apply-repair-compact-package-partial-runnable-refill-gap-20260716-state-repair\`\n- Attempt: \`${attemptId}\`\n- Applied at: \`${appliedAt}\`\n- App: \`${appDir}\`\n\n## Scope\n\nApplied the app-owned representation repair through supported app mechanisms:\n\n- created replacement family holder \`${replacementHolderTaskId}\` under \`${compactLoopTaskId}\`\n- refreshed \`.state/feature-compact-loop/state.json\` for feature \`${featureKey}\` so it no longer cites dead ids \`${retiredHolderTaskId}\` / \`${retiredIlpipTaskId}\`\n- aligned family watch windows to the live exact holders \`${liveExactHolderTaskIds.join(", ")}\`\n- did **not** recreate a blocked ILPIP launcher holder because primary spec-loop evidence already normalizes \`${ilpipSpecId}\` to pass from archived authenticated-launcher live proof\n\n## Supported mechanisms used\n\n- \`createTask(config, ...)\` for the replacement family holder\n- \`withTreeLock(...)\` + \`saveTaskTreeWithKanbanSnapshot(...)\` for live task-tree mutation\n- \`loadFeatureCompactLoopState(...)\` + \`updateFeatureCompactItem(...)\` + \`saveFeatureCompactLoopState(...)\` for app-owned compact state repair\n\n## Baseline before apply\n\n### Missing ids\n\n- retired family holder live state: \`${JSON.stringify(baseline.retiredHolderTask)}\`\n- retired ILPIP carrier live state: \`${JSON.stringify(baseline.retiredIlpipTask)}\`\n\n### Current exact live holders\n\n\`${JSON.stringify(baseline.liveExactHolders, null, 2)}\`\n\n### Network-cni compact feature row before\n\n\`${JSON.stringify(baseline.feature, null, 2)}\`\n\n### ILPIP spec-loop authority before\n\n\`${JSON.stringify(baseline.ilpipSpec, null, 2)}\`\n\nThe ILPIP spec-loop row already showed \`status=pass\`, \`taskId=null\`, and archived authenticated-launcher result path \`${ilpipPassEvidencePath}\`, so recreating \`${retiredIlpipTaskId}\` as blocked work would have contradicted primary app evidence.\n\n## Applied repair\n\n1. Created replacement family holder \`${replacementHolderTaskId}\` to preserve the compact package-partial frontier with live exact holder ids instead of the dead \`${retiredHolderTaskId}\` pointer.\n2. Repointed feature \`${featureKey}\` from review leaf \`${compactReviewTaskId}\` / dead waitingFor ids to the replacement holder plus live exact downstream holders.\n3. Refreshed feature-level \`nextCheckAt\` / \`fallbackAt\` to \`${holderNextCheckAt}\` / \`${holderFallbackAt}\`, aligned to the earliest current downstream wait windows.\n4. Preserved ILPIP only as archived exact pass evidence from \`${ilpipPassEvidencePath}\`; no new blocked ILPIP holder was created because the ARM-authenticated-launcher blocker is not current anymore in app-owned spec-loop state.\n\n## Verification after apply\n\n### Replacement holder\n\n\`${JSON.stringify(verification.replacementHolder, null, 2)}\`\n\n### Feature-compact row\n\n\`${JSON.stringify(verification.feature, null, 2)}\`\n\n### ILPIP spec-loop authority remains pass\n\n\`${JSON.stringify(verification.ilpipSpec, null, 2)}\`\n\n## Acceptance check\n\n- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied.\n- Affected branch records the exact restored holder/state pointer with evidence: satisfied via \`${replacementHolderTaskId}\`, refreshed compact-loop state, and the live exact holder ids above.\n- No broad unchanged compact rerun or live review-leaf mutation was performed: satisfied.\n`,
);

console.log(
  JSON.stringify(
    {
      evidencePath: evidencePathRelative,
      replacementHolderTaskId,
      holderNextCheckAt,
      holderFallbackAt,
      featureTaskId: featureAfter.taskId,
      featureFrontierTaskIds: featureAfter.frontierTaskIds,
    },
    null,
    2,
  ),
);
