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
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

type MutableRecord = Record<string, unknown>;

type TaskSnapshot = {
  id: string | null;
  state: string | null;
  status: string | null;
  goal: string | null;
  acceptance: string[];
  outputs: string[];
  conflict_scope: string[];
  blocker: {
    condition: string | null;
    owner: string | null;
    next_check_at: string | null;
    fallback_at: string | null;
    resume_condition: string | null;
    waiting_for: Record<string, unknown> | null;
  };
  context: Record<string, unknown>;
};

type SpecSnapshot = {
  taskId: string | null;
  successorDisposition: string | null;
  successorEvidencePath: string | null;
  successorStateReason: string | null;
  resumeCondition: string | null;
  review: Record<string, unknown> | null;
};

type FeatureSnapshot = {
  taskId: string | null;
  frontierTaskIds: string[];
  ownerReason: string | null;
  lastSummary: string | null;
  nextStepClassification: string | null;
  resumeCondition: string | null;
  blockedReason: string | null;
  waitingFor: Record<string, unknown> | null;
  reviewEvidencePath: string | null;
  verificationBlocker: string | null;
};

const attemptId =
  "a_ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714-state_20260714215509";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const appliedAt = new Date().toISOString();

const compactLoopTaskId = "aks-feature-compact-loop";
const specLoopTaskId = "aks-spec-verification-loop";
const featureKey = "network-cni";
const holderTaskId = "hold-compact-network-cni-package-partial-frontier-20260709i";
const sharedSubnetWaitTaskId =
  "wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703";
const ilpipFollowupTaskId =
  "domain/retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714";
const dualstackSpecId =
  "spec.network-cni.vm-prerelease-overlay-cilium-dualstack";
const ilpipSpecId = "spec.network-cni.azure-overlay-ilpip";
const ilpipPriorTaskId =
  "domain/verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714";

const reviewedMemoPath =
  "evidence/archive/ops-reconcile-network-cni-single-spec-live-blockers-20260714.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714.md";
const dualstackDomainMemoRelative =
  "evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md";
const dualstackDomainMemoAbsolute = resolve(projectDir, dualstackDomainMemoRelative);
const dualstackDomainMemoAppRelative =
  "../aks-rp-e2e/evidence/archive/domain-verify-network-cni-vm-prerelease-overlay-cilium-dualstack-single-spec-live-verification-20260714.md";
const ilpipDomainMemoRelative =
  "evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md";
const ilpipDomainMemoAbsolute = resolve(projectDir, ilpipDomainMemoRelative);
const ilpipDomainMemoAppRelative =
  "../aks-rp-e2e/evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-single-spec-live-verification-20260714.md";
const ilpipReadyCarrierMemo =
  "evidence/archive/domain-verify-network-cni-azure-overlay-ilpip-ready-carrier-20260714.md";
const ilpipFollowupOutput =
  "evidence/archive/domain-retry-network-cni-azure-overlay-ilpip-single-spec-live-verification-authenticated-launcher-20260714.md";

const activeFrontierSpecIds = [
  "spec.network-cni.azure-overlay-agic-vm-prerelease",
  "spec.network-cni.azure-overlay-dual-stack",
  ilpipSpecId,
  "spec.network-cni.kubenet-network-policy-calico",
  "spec.network-cni.none-byo-cni-vm-prerelease-lifecycle",
  "spec.network-cni.vm-prerelease-azure-npm-matrix",
  "spec.network-cni.vm-prerelease-azure-overlay-multi-subnet-matrix",
  "spec.network-cni.vm-prerelease-azure-overlay-upgrade-matrix",
  "spec.network-cni.vm-prerelease-calico-eno-migration-matrix",
  "spec.network-cni.vm-prerelease-calico-matrix",
  "spec.network-cni.vm-prerelease-cilium-matrix",
  "spec.network-cni.vm-prerelease-npm-uninstall-matrix",
  dualstackSpecId,
  "spec.network-swift-v1.dynamic-ip-allocation",
] as const;

const consumedPassHistorySpecIds = [
  "spec.network-cni.azure-overlay-dual-stack-migration",
  "spec.network-cni.azure-overlay-podcidr-expansion",
] as const;

const holderGoal =
  "Preserve one exact compact network-cni family wait that names the current 14-member active blocked frontier, sharpens spec.network-cni.vm-prerelease-overlay-cilium-dualstack to the shared subnet-authorization carrier, sharpens spec.network-cni.azure-overlay-ilpip to one exact authenticated-launcher follow-up leaf, and keeps dual-stack-migration plus podCIDR-expansion only as consumed pass history.";
const holderAcceptance = [
  "The holder names the current exact 14-member network-cni compact frontier and no longer says spec.network-cni.azure-overlay-ilpip or spec.network-cni.vm-prerelease-overlay-cilium-dualstack are already ready/live-admitted.",
  `spec.network-cni.vm-prerelease-overlay-cilium-dualstack stays represented only through ${sharedSubnetWaitTaskId}, and spec.network-cni.azure-overlay-ilpip stays represented only through ${ilpipFollowupTaskId}.`,
  "spec.network-cni.azure-overlay-dual-stack-migration and spec.network-cni.azure-overlay-podcidr-expansion stay preserved only as consumed pass history, not as active blocked compact residue, and no broad network-cni compact rerun is reopened.",
] as const;
const holderBlockerCondition =
  `Current compact/spec-loop/spec-file evidence says the exact active network-cni compact frontier is the 14-member set ${activeFrontierSpecIds.join(", ")}. Preserve ${consumedPassHistorySpecIds.join(", ")} only as consumed pass history because accepted 2026-07-14 same-spec live verification now proves ${dualstackSpecId} is governed by ${sharedSubnetWaitTaskId} and ${ilpipSpecId} is governed by ${ilpipFollowupTaskId}, not ready/live-admitted status.`;
const holderResumeCondition =
  `Resume only when one of the 14 active-frontier members materially changes, when ${sharedSubnetWaitTaskId} or ${ilpipFollowupTaskId} materially changes the exact downstream carrier truth for ${dualstackSpecId} or ${ilpipSpecId}, or when materially new same-path verification intent reopens ${consumedPassHistorySpecIds.join(", ")}. Do not rerun the broad compact package unchanged.`;
const holderFallbackAction =
  "If unchanged at fallback, keep or refresh this exact 14-member network-cni frontier holder from the latest same-lineage evidence; do not restore stale 12-member ready/live-admitted wording and do not reopen an unchanged broad compact rerun.";
const featureOwnerReason =
  `All 69 active feature-owned specs remain selected into the compact package, and the accepted 2026-07-14 single-spec live verification leaves now place controller-visible network-cni residue at 14 active-frontier blocked members (${activeFrontierSpecIds.join(", ")}) plus 2 consumed pass-history members (${consumedPassHistorySpecIds.join(", ")}). ${dualstackSpecId} is a create-time subnet-authorization family member under ${sharedSubnetWaitTaskId}, and ${ilpipSpecId} is an exact authenticated-launcher follow-up under ${ilpipFollowupTaskId}, not ready/live-admitted residue.`;
const featureLastSummary =
  `Current network-cni compact partial is the exact 14-member active frontier (${activeFrontierSpecIds.join(", ")}); ${dualstackSpecId} is routed through ${sharedSubnetWaitTaskId}, ${ilpipSpecId} is routed through ${ilpipFollowupTaskId}, and ${consumedPassHistorySpecIds.join(", ")} remain consumed pass history only. No broad compact rerun is truthful. See ${appMemoPath}.`;
const featureNextStepClassification =
  "preserve the exact 14-member network-cni active frontier while routing dualstack through the shared subnet-authorization carrier and ILPIP through the exact authenticated-launcher follow-up leaf";
const featureSummary =
  `${attemptId}: restored the live network-cni compact frontier to 14 active blocked members, mapped ${dualstackSpecId} to ${sharedSubnetWaitTaskId}, and created ${ilpipFollowupTaskId} for ${ilpipSpecId}.`;
const featureVerificationBlocker =
  `An unchanged full-package rerun would still overclaim live readiness while network-cni regenerates as partial with the exact 14-member active frontier (${activeFrontierSpecIds.join(", ")}). ${dualstackSpecId} now belongs only to the exact shared subnet-authorization wait family ${sharedSubnetWaitTaskId}, ${ilpipSpecId} now belongs only to the exact authenticated-launcher follow-up ${ilpipFollowupTaskId}, and ${consumedPassHistorySpecIds.join(", ")} remain consumed pass history; do not reopen a broad rerun or keep stale ready/live-admitted wording.`;

const waitGoal =
  `Hold the shared create-time subnet authorization blocker for spec.serverless-virtual-nodes.addonv2-aci-connector, spec.serverless-virtual-nodes.virtual-node-addon, and ${dualstackSpecId} until a reviewed identity/subnet join-permission change materially changes the create surface, then trigger exactly one bounded same-path rerun per dedicated carrier.`;
const waitAcceptance = [
  `The leaf records the exact affected specs spec.serverless-virtual-nodes.addonv2-aci-connector, spec.serverless-virtual-nodes.virtual-node-addon, and ${dualstackSpecId}.`,
  "The leaf records the exact blocker family as create-time LinkedAuthorizationFailed on Microsoft.Network/virtualNetworks/subnets/join/action under the shared identity/node-subnet permission surface, not runtime readiness.",
  "The leaf states that no bounded repo-local repair remains first and that the only truthful resume trigger is a reviewed identity/subnet join-permission change on the same surface.",
  `When that signal lands, the next verification step is one bounded same-path rerun per dedicated carrier for spec.serverless-virtual-nodes.addonv2-aci-connector, spec.serverless-virtual-nodes.virtual-node-addon, and ${dualstackSpecId} before any maintained verdict surface changes.`,
] as const;
const waitBlockerCondition =
  `2026-07-14 network-cni/serverless shared subnet authorization review revalidated the exact create-time subnet authorization frontier for spec.serverless-virtual-nodes.addonv2-aci-connector, spec.serverless-virtual-nodes.virtual-node-addon, and ${dualstackSpecId}: the reviewed dedicated carriers still stop at LinkedAuthorizationFailed on Microsoft.Network/virtualNetworks/subnets/join/action under the shared identity/node-subnet permission surface before any runtime readiness assertions become verdict-bearing. For ${dualstackSpecId}, the accepted row-95/default live attempt reached ARM create, persisted the exact overlay+cilium+dual-stack+VirtualMachines request shape, and then failed on that same subnet join/action boundary. No bounded repo-local carrier repair remains first.`;
const waitResumeCondition =
  `Resume only when a reviewed identity/subnet join-permission change materially changes the create-time authorization frontier for the unchanged dedicated carriers; then rerun spec.serverless-virtual-nodes.addonv2-aci-connector, spec.serverless-virtual-nodes.virtual-node-addon, and ${dualstackSpecId} once each on the same dedicated carrier path and review artifacts before changing maintained verdict surfaces.`;
const waitFallbackAction =
  `If the shared subnet-authorization wait is still true at fallback time, keep one exact shared blocker for spec.serverless-virtual-nodes.addonv2-aci-connector, spec.serverless-virtual-nodes.virtual-node-addon, and ${dualstackSpecId} with a fresh owner-review timestamp or replace it with one exact owner/input-change successor; do not broaden it into runtime-readiness work.`;

const ilpipFollowupGoal =
  `Rerun one bounded single-spec live verification for ${ilpipSpecId} using the already-reviewed mutation-gated carrier from an ARM-authenticated staging launcher, then capture either the exact create/CNS/Linux+Windows ILPIP witness result or the sharper post-auth same-surface blocker.`;
const ilpipFollowupAcceptance = [
  `The task uses ${ilpipReadyCarrierMemo} plus ${ilpipDomainMemoRelative} as the exact packet/history for ${ilpipSpecId} and reruns only that same mutation-gated carrier from an ARM-authenticated launcher.`,
  `The task does not widen into a broad network-cni compact rerun or passive shared-auth wait; it either records same-spec create/CNS/Linux+Windows IPv4 ILPIP witness evidence or one sharper post-auth blocker for ${ilpipSpecId} only.`,
] as const;

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
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
  ].sort((a, b) => a.localeCompare(b));
}

function appendAttemptedFix(
  values: string[] | null | undefined,
  next: string,
): string[] {
  return unique([...(values ?? []), next]);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function taskSnapshot(task: TaskNode | undefined): TaskSnapshot | null {
  if (!task) return null;
  const blocker = asRecord(task.blocker);
  return {
    id: asString(task.id) || null,
    state: asString(task.state) || null,
    status: asString((task as MutableRecord).status) || null,
    goal: asString(task.goal) || null,
    acceptance: asStringArray(task.acceptance),
    outputs: asStringArray(task.outputs),
    conflict_scope: asStringArray(task.conflict_scope),
    blocker: {
      condition: asString(blocker.condition) || null,
      owner: asString(blocker.owner) || null,
      next_check_at: asString(blocker.next_check_at) || null,
      fallback_at: asString(blocker.fallback_at) || null,
      resume_condition: asString(blocker.resume_condition) || null,
      waiting_for:
        Object.keys(asRecord(blocker.waiting_for)).length > 0
          ? asRecord(blocker.waiting_for)
          : null,
    },
    context: asRecord(task.context),
  };
}

function specSnapshot(state: SpecLoopState, specId: string): SpecSnapshot {
  const spec = state.specs[specId] ?? {};
  return {
    taskId: asString((spec as MutableRecord).taskId) || null,
    successorDisposition:
      asString((spec as MutableRecord).successorDisposition) || null,
    successorEvidencePath:
      asString((spec as MutableRecord).successorEvidencePath) || null,
    successorStateReason:
      asString((spec as MutableRecord).successorStateReason) || null,
    resumeCondition: asString((spec as MutableRecord).resumeCondition) || null,
    review:
      Object.keys(asRecord((spec as MutableRecord).review)).length > 0
        ? asRecord((spec as MutableRecord).review)
        : null,
  };
}

function featureSnapshot(feature: MutableRecord | undefined): FeatureSnapshot {
  const value = feature ?? {};
  return {
    taskId: asString(value.taskId) || null,
    frontierTaskIds: asStringArray(value.frontierTaskIds),
    ownerReason: asString(value.ownerReason) || null,
    lastSummary: asString(value.lastSummary) || null,
    nextStepClassification: asString(value.nextStepClassification) || null,
    resumeCondition: asString(value.resumeCondition) || null,
    blockedReason: asString(value.blockedReason) || null,
    waitingFor:
      Object.keys(asRecord(value.waitingFor)).length > 0
        ? asRecord(value.waitingFor)
        : null,
    reviewEvidencePath: asString(value.reviewEvidencePath) || null,
    verificationBlocker: asString(value.verificationBlocker) || null,
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const treeBefore = readTaskTree(config);
const holderBefore = treeBefore.tasks[holderTaskId] as TaskNode | undefined;
const waitBefore = treeBefore.tasks[sharedSubnetWaitTaskId] as TaskNode | undefined;
const ilpipLeafBefore = treeBefore.tasks[ilpipFollowupTaskId] as TaskNode | undefined;
assert(holderBefore, `Task not found: ${holderTaskId}`);
assert(waitBefore, `Task not found: ${sharedSubnetWaitTaskId}`);

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const featureBefore = compactState.features[featureKey];
assert(featureBefore, `Missing feature-compact record for ${featureKey}`);

const specLoopPath = defaultSpecLoopStatePath(appDir);
const mirrorSpecLoopPath = resolve(projectDir, ".state/spec-loop/state.json");
const specLoop = JSON.parse(readFileSync(specLoopPath, "utf-8")) as SpecLoopState;
assert(specLoop.specs[dualstackSpecId], `Missing spec-loop record for ${dualstackSpecId}`);
assert(specLoop.specs[ilpipSpecId], `Missing spec-loop record for ${ilpipSpecId}`);

const holderBeforeSnapshot = taskSnapshot(holderBefore);
const waitBeforeSnapshot = taskSnapshot(waitBefore);
const ilpipLeafBeforeSnapshot = taskSnapshot(ilpipLeafBefore);
const dualstackBeforeSnapshot = specSnapshot(specLoop, dualstackSpecId);
const ilpipBeforeSnapshot = specSnapshot(specLoop, ilpipSpecId);
const featureBeforeSnapshot = featureSnapshot(featureBefore as unknown as MutableRecord);

if (!ilpipLeafBefore) {
  createTask(config, {
    id: ilpipFollowupTaskId,
    parentId: specLoopTaskId,
    state: "backlog",
    priority: "P2",
    owner: "aks-explorer",
    goal: ilpipFollowupGoal,
    inputs: [ilpipReadyCarrierMemo, ilpipDomainMemoRelative],
    outputs: [ilpipFollowupOutput],
    acceptance: [...ilpipFollowupAcceptance],
    conflict_scope: [`spec:${ilpipSpecId}`],
    context: {
      specId: ilpipSpecId,
      predecessorTaskId: ilpipPriorTaskId,
      predecessorEvidencePath: ilpipDomainMemoRelative,
      authRequirement: "ARM-authenticated launcher on the same staging target inputs",
      sourceRepairMemo: reviewedMemoPath,
    },
  });
}

const treeAfterMutation = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holder = tree.tasks[holderTaskId] as TaskNode | undefined;
  const waitTask = tree.tasks[sharedSubnetWaitTaskId] as TaskNode | undefined;
  const ilpipLeaf = tree.tasks[ilpipFollowupTaskId] as TaskNode | undefined;
  assert(holder, `Task not found during mutation: ${holderTaskId}`);
  assert(waitTask, `Task not found during mutation: ${sharedSubnetWaitTaskId}`);
  assert(ilpipLeaf, `Task not found during mutation: ${ilpipFollowupTaskId}`);

  const holderBlocker = asRecord(holder.blocker);
  const holderContext = asRecord(holder.context);
  holder.state = "blocked";
  (holder as MutableRecord).status = "blocked";
  holder.goal = holderGoal;
  holder.acceptance = [...holderAcceptance];
  holder.outputs = unique([
    ...asStringArray(holder.outputs),
    ".state/feature-compact-loop/state.json",
    ".state/spec-loop/state.json",
    reviewedMemoPath,
    appMemoPath,
  ]);
  holder.context = {
    ...holderContext,
    featureCompactExactWait: true,
    featureKey,
    errorClass: "package-partial",
    target: "staging",
    activeFrontierSpecIds: [...activeFrontierSpecIds],
    consumedPassHistorySpecIds: [...consumedPassHistorySpecIds],
    downstreamCarrierTaskIds: [sharedSubnetWaitTaskId, ilpipFollowupTaskId],
    frontierTaskIds: [holderTaskId],
    reviewEvidencePath: appMemoPath,
    reconcileMemoPath: reviewedMemoPath,
  };
  holder.blocker = {
    ...holderBlocker,
    condition: holderBlockerCondition,
    category: asString(holderBlocker.category) || "blocked-wait",
    owner: asString(holderBlocker.owner) || "aks-explorer",
    blocked_at: asString(holderBlocker.blocked_at) || appliedAt,
    waiting_for: {
      type: "frontier.changed",
      taskId: holderTaskId,
      featureKey,
      scope: "active-frontier-14",
      representedSpecIds: [ilpipSpecId, dualstackSpecId],
      downstreamCarrierTaskIds: [sharedSubnetWaitTaskId, ilpipFollowupTaskId],
    },
    observed_by:
      Object.keys(asRecord(holderBlocker.observed_by)).length > 0
        ? asRecord(holderBlocker.observed_by)
        : {
            workflow: "project-planner",
            schedule: "blocked-frontier-app-ops-review",
            trigger: "project.planning.requested",
          },
    observation_method:
      asString(holderBlocker.observation_method) ||
      "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    next_check_at: asString(holderBlocker.next_check_at) || "2026-07-15T18:45:00Z",
    resume_condition: holderResumeCondition,
    fallback_at: asString(holderBlocker.fallback_at) || "2026-07-16T18:45:00Z",
    fallback_action: holderFallbackAction,
    resume_at: asString(holderBlocker.next_check_at) || "2026-07-15T18:45:00Z",
  };
  (holder as MutableRecord).result =
    `${attemptId}: holder now preserves the exact 14-member active network-cni frontier, routes ${dualstackSpecId} through ${sharedSubnetWaitTaskId}, and routes ${ilpipSpecId} through ${ilpipFollowupTaskId} instead of stale ready/live-admitted wording.`;
  holder.trace = {
    ...asRecord(holder.trace),
    network_cni_single_spec_live_blockers_reconciled_at: appliedAt,
    network_cni_single_spec_live_blockers_reconciled_by: worker,
    active_frontier_spec_ids: [...activeFrontierSpecIds],
    consumed_pass_history_spec_ids: [...consumedPassHistorySpecIds],
    downstream_carrier_task_ids: [sharedSubnetWaitTaskId, ilpipFollowupTaskId],
  };

  const waitBlocker = asRecord(waitTask.blocker);
  const waitContext = asRecord(waitTask.context);
  waitTask.state = "blocked";
  (waitTask as MutableRecord).status = "blocked";
  waitTask.goal = waitGoal;
  waitTask.acceptance = [...waitAcceptance];
  waitTask.outputs = unique([
    ...asStringArray(waitTask.outputs),
    dualstackDomainMemoAbsolute,
    appMemoPath,
  ]);
  waitTask.conflict_scope = unique([
    ...asStringArray(waitTask.conflict_scope),
    `spec:${dualstackSpecId}`,
    "feature:network-cni",
  ]);
  waitTask.context = {
    ...waitContext,
    representedSpecIds: [
      "spec.serverless-virtual-nodes.addonv2-aci-connector",
      "spec.serverless-virtual-nodes.virtual-node-addon",
      dualstackSpecId,
    ],
    representedFeatureKeys: ["serverless-virtual-nodes", featureKey],
    reviewEvidencePath: appMemoPath,
  };
  waitTask.blocker = {
    ...waitBlocker,
    condition: waitBlockerCondition,
    category: asString(waitBlocker.category) || "external-wait",
    owner: asString(waitBlocker.owner) || "human",
    blocked_at: asString(waitBlocker.blocked_at) || appliedAt,
    waiting_for: {
      ...asRecord(waitBlocker.waiting_for),
      type: "evidence.available",
      taskId: sharedSubnetWaitTaskId,
      representedSpecIds: [
        "spec.serverless-virtual-nodes.addonv2-aci-connector",
        "spec.serverless-virtual-nodes.virtual-node-addon",
        dualstackSpecId,
      ],
    },
    observed_by:
      Object.keys(asRecord(waitBlocker.observed_by)).length > 0
        ? asRecord(waitBlocker.observed_by)
        : {
            workflow: "project-planner",
            schedule: "blocked-frontier-owner-review",
            trigger: "project.planning.requested",
          },
    observation_method:
      asString(waitBlocker.observation_method) ||
      "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    next_check_at: asString(waitBlocker.next_check_at) || "2026-07-15T18:00:00Z",
    resume_condition: waitResumeCondition,
    fallback_at: asString(waitBlocker.fallback_at) || "2026-07-16T18:00:00Z",
    fallback_action: waitFallbackAction,
  };
  (waitTask as MutableRecord).result =
    `${attemptId}: extended the shared subnet-authorization wait to carry ${dualstackSpecId} alongside the two serverless-virtual-nodes specs.`;
  waitTask.trace = {
    ...asRecord(waitTask.trace),
    network_cni_dualstack_attached_at: appliedAt,
    network_cni_dualstack_attached_by: worker,
  };

  const leafContext = asRecord(ilpipLeaf.context);
  const existingLeafState = asString(ilpipLeaf.state);
  ilpipLeaf.state = existingLeafState === "active" ? "active" : "backlog";
  (ilpipLeaf as MutableRecord).status = ilpipLeaf.state;
  ilpipLeaf.goal = ilpipFollowupGoal;
  ilpipLeaf.acceptance = [...ilpipFollowupAcceptance];
  ilpipLeaf.outputs = unique([...asStringArray(ilpipLeaf.outputs), ilpipFollowupOutput]);
  ilpipLeaf.conflict_scope = unique([
    ...asStringArray(ilpipLeaf.conflict_scope),
    `spec:${ilpipSpecId}`,
  ]);
  ilpipLeaf.context = {
    ...leafContext,
    specId: ilpipSpecId,
    predecessorTaskId: ilpipPriorTaskId,
    predecessorEvidencePath: ilpipDomainMemoRelative,
    authRequirement: "ARM-authenticated launcher on the same staging target inputs",
    sourceRepairMemo: reviewedMemoPath,
  };
  ilpipLeaf.trace = {
    ...asRecord(ilpipLeaf.trace),
    authenticated_launcher_followup_reconciled_at: appliedAt,
    authenticated_launcher_followup_reconciled_by: worker,
    authenticated_launcher_followup_attempt_id: attemptId,
  };

  saveTaskTreeWithKanbanSnapshot(config, tree);
  return tree;
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  lastSummary: featureLastSummary,
  ownerReason: featureOwnerReason,
  nextStepClassification: featureNextStepClassification,
  resumeCondition: holderResumeCondition,
  blockedReason: holderBlockerCondition,
  waitingFor: {
    type: "frontier.changed",
    taskId: holderTaskId,
    featureKey,
    scope: "active-frontier-14",
    representedSpecIds: [ilpipSpecId, dualstackSpecId],
    downstreamCarrierTaskIds: [sharedSubnetWaitTaskId, ilpipFollowupTaskId],
  },
  waitingCondition: holderResumeCondition,
  observedBy: {
    workflow: "project-planner",
    schedule: "blocked-frontier-app-ops-review",
    trigger: "project.planning.requested",
  },
  observationMethod:
    "Scheduled blocked-frontier app-ops review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
  nextCheckAt: "2026-07-15T18:45:00Z",
  blockerOwner: "aks-explorer",
  fallbackAt: "2026-07-16T18:45:00Z",
  fallbackAction: holderFallbackAction,
  resumeAction:
    "Reset this feature compact record to pending only after the named wait condition changes.",
  blockedScope: { kind: "feature", ids: [featureKey] },
  blockedFingerprint: {
    errorClass: "package-partial",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  lastCheckedAt: appliedAt,
  evidencePaths: unique([
    ...asStringArray((featureBefore as MutableRecord).evidencePaths),
    ilpipDomainMemoAppRelative,
    dualstackDomainMemoAppRelative,
    reviewedMemoPath,
    appMemoPath,
  ]),
  reviewEvidencePath: appMemoPath,
  verificationBlocker: featureVerificationBlocker,
  summary: featureSummary,
  attemptedFixes: appendAttemptedFix(
    asStringArray((featureBefore as MutableRecord).attemptedFixes),
    `${attemptId}: restored ${ilpipSpecId} and ${dualstackSpecId} to the active network-cni compact frontier, routed ${dualstackSpecId} to ${sharedSubnetWaitTaskId}, created ${ilpipFollowupTaskId}, and synchronized controller-visible feature/spec-loop state to the accepted 2026-07-14 single-spec live blocker evidence.`,
  ),
});
saveFeatureCompactLoopState(compactLoaded.path, compactState);

updateSpecLoopSpec(specLoop, dualstackSpecId, {
  taskId: sharedSubnetWaitTaskId,
  review: {
    classification: "shared_subnet_authorization_create_time_blocker",
    lastRootCause:
      `Accepted 2026-07-14 same-spec live evidence now governs ${dualstackSpecId}: the row-95/default carrier reached ARM create, persisted the exact overlay+cilium+dual-stack+VirtualMachines request shape, and then failed with LinkedAuthorizationFailed on Microsoft.Network/virtualNetworks/subnets/join/action under the shared identity/node-subnet permission surface before runtime witness.`,
    lastAction:
      `Keep pending under ${sharedSubnetWaitTaskId}. Do not rerun unchanged; resume only after a reviewed identity/subnet join-permission change materially changes the create-time authorization surface.`,
    reviewedAt: appliedAt,
  },
  successorDisposition: "shared-subnet-authorization-create-time-blocker",
  successorEvidencePath: dualstackDomainMemoAbsolute,
  successorStateReason:
    `Accepted 2026-07-14 row-95/default live evidence shows ${dualstackSpecId} is not a ready/live-admitted compact residue: it reached ARM create, preserved the exact request shape, and then failed on create-time LinkedAuthorizationFailed / subnets/join/action before runtime witness, so the truthful successor carrier is ${sharedSubnetWaitTaskId}.`,
  resumeCondition:
    `Resume only after a reviewed change to the shared identity / node-subnet join permission surface materially changes the create-time authorization frontier; then rerun ${dualstackSpecId} once on the same dedicated carrier path and review artifacts before changing maintained verdict surfaces. Do not rerun unchanged before that signal.`,
});

updateSpecLoopSpec(specLoop, ilpipSpecId, {
  taskId: ilpipFollowupTaskId,
  review: {
    classification: "exact_authenticated_launcher_followup_required",
    lastRootCause:
      `Accepted 2026-07-14 same-spec live evidence now governs ${ilpipSpecId}: the mutation-gated carrier stopped at pre-mutation setup.arm-auth with No ARM token available, while the accepted ${dualstackSpecId} leaf on the same day disproves a universal staging-family auth outage by reaching real ARM create on its sharper second attempt.`,
    lastAction:
      `Keep pending behind ${ilpipFollowupTaskId}. Do not route this spec to a passive shared-auth wait or a broad compact rerun; the truthful next move is one exact rerun from an ARM-authenticated launcher on the same staging target inputs.`,
    reviewedAt: appliedAt,
  },
  successorDisposition: "exact-authenticated-launcher-followup-required",
  successorEvidencePath: ilpipDomainMemoAbsolute,
  successorStateReason:
    `Accepted 2026-07-14 live evidence shows ${ilpipSpecId} stopped at setup.arm-auth before any cloud mutation, so the truthful successor is the exact authenticated-launcher follow-up leaf ${ilpipFollowupTaskId} rather than a passive shared wait or renewed authoring step.`,
  resumeCondition:
    `Resume by dispatching ${ilpipFollowupTaskId} once an ARM-authenticated launcher is available for the same staging target inputs, or when that dedicated follow-up records a sharper post-auth same-surface result. Do not widen to a passive shared wait or a broad compact rerun.`,
});
saveSpecLoopState(specLoopPath, specLoop, [mirrorSpecLoopPath]);

const treeAfter = readTaskTree(config);
const holderAfter = treeAfter.tasks[holderTaskId] as TaskNode | undefined;
const waitAfter = treeAfter.tasks[sharedSubnetWaitTaskId] as TaskNode | undefined;
const ilpipLeafAfter = treeAfter.tasks[ilpipFollowupTaskId] as TaskNode | undefined;
const compactAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
const specLoopAfter = JSON.parse(readFileSync(specLoopPath, "utf-8")) as SpecLoopState;

const memo = `# App apply: reconcile network-cni single-spec live blockers — 2026-07-14

- Task: \`ops-apply-reconcile-network-cni-single-spec-live-blockers-20260714-state\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Holder: \`${holderTaskId}\`
- Shared wait carrier: \`${sharedSubnetWaitTaskId}\`
- New ILPIP follow-up leaf: \`${ilpipFollowupTaskId}\`

## Authority used

- Reviewed app memo: \`${reviewedMemoPath}\`
- Domain dualstack memo: \`${dualstackDomainMemoRelative}\`
- Domain ILPIP memo: \`${ilpipDomainMemoRelative}\`

## Applied repair

1. Restored \`${ilpipSpecId}\` and \`${dualstackSpecId}\` to the network-cni active compact frontier and rewrote the holder/feature-compact wording back to the exact **14-member** blocked frontier.
2. Attached \`${dualstackSpecId}\` to the exact shared create-time subnet-authorization carrier \`${sharedSubnetWaitTaskId}\`, including wait goal/acceptance/blocker metadata that now names this network-cni spec alongside the existing serverless pair.
3. Created/normalized the exact ILPIP authenticated-launcher retry leaf \`${ilpipFollowupTaskId}\` and pointed \`${ilpipSpecId}\` at that follow-up in spec-loop state.
4. Replaced both stale \`reviewed_nonlive_source_grounded_wait\` spec-loop representations with the sharper 2026-07-14 live-blocker representations.

## Before → after snapshots

### Holder task
- Before:
\`\`\`json
${JSON.stringify(holderBeforeSnapshot, null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(taskSnapshot(holderAfter), null, 2)}
\`\`\`

### Shared subnet-authorization wait carrier
- Before:
\`\`\`json
${JSON.stringify(waitBeforeSnapshot, null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(taskSnapshot(waitAfter), null, 2)}
\`\`\`

### ILPIP follow-up leaf
- Before:
\`\`\`json
${JSON.stringify(ilpipLeafBeforeSnapshot, null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(taskSnapshot(ilpipLeafAfter), null, 2)}
\`\`\`

### Spec-loop: \`${dualstackSpecId}\`
- Before:
\`\`\`json
${JSON.stringify(dualstackBeforeSnapshot, null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(specSnapshot(specLoopAfter, dualstackSpecId), null, 2)}
\`\`\`

### Spec-loop: \`${ilpipSpecId}\`
- Before:
\`\`\`json
${JSON.stringify(ilpipBeforeSnapshot, null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(specSnapshot(specLoopAfter, ilpipSpecId), null, 2)}
\`\`\`

### Feature-compact: \`${featureKey}\`
- Before:
\`\`\`json
${JSON.stringify(featureBeforeSnapshot, null, 2)}
\`\`\`
- After:
\`\`\`json
${JSON.stringify(featureSnapshot(compactAfter as unknown as MutableRecord), null, 2)}
\`\`\`

## Result

The live app-owned holder/feature-compact/spec-loop state no longer preserves the stale 12-member ready/live-admitted wording for ILPIP and dualstack. Instead:

- \`${dualstackSpecId}\` is again counted inside the active network-cni blocked frontier and now points to the exact shared subnet-authorization wait carrier \`${sharedSubnetWaitTaskId}\`.
- \`${ilpipSpecId}\` is again counted inside the active network-cni blocked frontier and now points to the exact authenticated-launcher follow-up leaf \`${ilpipFollowupTaskId}\`.
- \`${consumedPassHistorySpecIds.join("\`, \`")}\` remain consumed pass history only.
- No broad network-cni compact rerun was reopened.
`;

writeText(resolve(appDir, appMemoPath), memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      holder: taskSnapshot(holderAfter),
      sharedSubnetWait: taskSnapshot(waitAfter),
      ilpipFollowupLeaf: taskSnapshot(ilpipLeafAfter),
      dualstackSpec: specSnapshot(specLoopAfter, dualstackSpecId),
      ilpipSpec: specSnapshot(specLoopAfter, ilpipSpecId),
      feature: featureSnapshot(compactAfter as unknown as MutableRecord),
    },
    null,
    2,
  ),
);
