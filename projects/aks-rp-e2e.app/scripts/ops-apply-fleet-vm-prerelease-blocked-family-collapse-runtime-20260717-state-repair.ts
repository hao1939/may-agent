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
import { readTaskTree, withTreeLock } from "../workflows/lib/task-tree-store.ts";

const survivingHolderId =
  "hold-spec-loop-pending-fleet-vm-prerelease-umbrella-nonlive-20260705b";
const duplicateHolderId =
  "hold-spec-fleet-vm-prerelease-rpapi-auto-upgrade-matrix-lineage-only-frontier-20260707";
const compactHolderId =
  "hold-compact-fleet-reviewed-exception-split-frontier-20260709";
const featureKey = "fleet";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});
const compactStateFile = resolve(appDir, ".state/feature-compact-loop/state.json");
const loopTaskId = "aks-feature-compact-loop";
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-apply-fleet-vm-prerelease-blocked-family-collapse-runtime-20260717-state-repair.md",
);
const repairedAt = new Date().toISOString();

type MutableRecord = Record<string, unknown>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MutableRecord)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

const newCompactGoal =
  "Preserve one visible compact-facing Fleet reviewed-exception holder that scopes only the current same-surface reviewed-exception membership while reusing the preserved hubless contract wait and the single shared VM prerelease mounted-source nonlive holder, without reopening broad Fleet reruns or recreating a generic integrity-repair task.";
const newCompactAcceptance = [
  "One blocked compact-facing Fleet holder remains visible from the compact/runtime Fleet surface and scopes only the current reviewed-exception membership from features/fleet/compact/staging.summary.md.",
  `The holder explicitly binds spec.fleet.hubless-rpapi-lifecycle to hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708 unchanged unless current evidence changes it, and binds spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix directly through ${survivingHolderId} as the single mounted-source lineage-only/nonlive holder.`,
];
const newCompactBlocker =
  `2026-07-17 owner-side blocked-family collapse apply rechecked ../aks-rp-e2e/features/fleet/compact/staging.summary.md and preserved the same exact two-member Fleet reviewed-exception frontier: spec.fleet.hubless-rpapi-lifecycle and spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix. The same summary still keeps spec.fleet.auto-upgrade-generate-matrix and spec.fleet.updaterun-windows-virtualmachines on the separate accepted-environment-blocked frontier, so they do not belong on this holder. The truthful downstream holders are now hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708 and ${survivingHolderId}; the duplicate lineage-only residue ${duplicateHolderId} was retired because the shared mounted-source nonlive boundary already lives on ${survivingHolderId}. Keep this compact holder visible while that exact two-member reviewed-exception frontier remains unchanged; do not reopen a broad Fleet rerun or recreate a generic lineage-repair task.`;
const newFeatureOwnerReason =
  `Fleet no longer has one generic compact error. The reviewed live artifact still leaves two separate frontiers: the hubless branch reached update/readback in compact run 28621132999 and verifier run 171368699, where the only nonpass was fleet-update-readback-valid on unchanged fleet-configuration-version despite matching update tags, so the truthful next step remains same-path expectation/carrier reconciliation with no unchanged rerun. The remaining independent frontier is that vm-prerelease-rpapi-auto-upgrade-matrix stays a reviewed-exception mounted-source/nonlive carrier, now represented directly through ${survivingHolderId} as the single shared holder for both controller-visible spec-loop state and compact reuse.`;
const newFeatureNextStepClassification =
  `preserve the exact Fleet reviewed-exception split frontier and re-review only if same-path evidence or owner judgment materially changes one of the preserved downstream waits or membership; do not recreate duplicate vm-prerelease lineage holders while ${survivingHolderId} remains the truthful shared carrier.`;
const newFeatureResumeCondition =
  `Resume only when an authoritative owner decision, changed same-path evidence, or a truthful compact frontier reclassification materially changes one of the exact downstream waits or the compact reviewed-exception membership; for the VM-prerelease branch that means a material change to the mounted-source/product boundary currently carried by ${survivingHolderId}.`;
const newFeatureBlockedReason =
  `2026-07-17 owner-side collapse apply confirmed the exact compact-facing Fleet reviewed-exception split frontier remains truthful: features/fleet/compact/staging.summary.md still preserves only spec.fleet.hubless-rpapi-lifecycle and spec.fleet.vm-prerelease-rpapi-auto-upgrade-matrix on this holder, the preserved downstream waits are hold-spec-fleet-hubless-rpapi-version-progression-contract-frontier-20260708 and ${survivingHolderId}, and no current same-lineage evidence justifies reopening a broad Fleet rerun wait or recreating duplicate VM-prerelease lineage residue.`;
const newFeatureVerificationBlocker =
  `Do not reopen a broad Fleet rerun wait or recreate duplicate vm-prerelease lineage holders; keep the exact reviewed-exception holder until same-lineage evidence materially changes.`;
const newFeatureSummary =
  `Owner-side state repair retargeted Fleet compact reuse from ${duplicateHolderId} to ${survivingHolderId} and preserved the exact two-member reviewed-exception frontier without reopening a broad Fleet rerun wait.`;

const baseline: Record<string, unknown> = {};
const after: Record<string, unknown> = {};

withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const compactTask = tree.tasks[compactHolderId];
  const survivingTask = tree.tasks[survivingHolderId];
  const duplicateTask = tree.tasks[duplicateHolderId];

  assert(compactTask, `Missing task ${compactHolderId}`);
  assert(survivingTask, `Missing task ${survivingHolderId}`);
  assert(duplicateTask, `Missing task ${duplicateHolderId}`);

  const compactContext = asRecord(compactTask.context);
  const beforeReuses = asStringArray(compactContext.reusesTaskIds);
  baseline.compactReusesTaskIds = beforeReuses;
  baseline.compactAcceptance = compactTask.acceptance;
  baseline.compactBlocker = compactTask.blocker;
  baseline.compactGoal = compactTask.goal;

  const nextReuses = beforeReuses.map((taskId) =>
    taskId === duplicateHolderId ? survivingHolderId : taskId,
  );
  assert(
    nextReuses.includes(survivingHolderId),
    `Expected ${compactHolderId} reusesTaskIds to include ${survivingHolderId}`,
  );
  assert(
    !nextReuses.includes(duplicateHolderId),
    `Expected ${compactHolderId} reusesTaskIds to stop including ${duplicateHolderId}`,
  );

  compactContext.reusesTaskIds = nextReuses;
  compactTask.context = compactContext;
  compactTask.goal = newCompactGoal;
  compactTask.acceptance = newCompactAcceptance;
  compactTask.blocker = {
    ...(asRecord(compactTask.blocker) as MutableRecord),
    condition: newCompactBlocker,
  };

  after.compactReusesTaskIds = nextReuses;
  after.compactAcceptance = compactTask.acceptance;
  after.compactBlocker = compactTask.blocker;
  after.compactGoal = compactTask.goal;

  saveTaskTreeWithKanbanSnapshot(config, tree);
});

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  statePath: compactStateFile,
  refreshFromProject: false,
});
const fleet = compactState.features[featureKey];
assert(fleet, `Missing feature compact state for ${featureKey}`);
baseline.featureBlockedReason = fleet.blockedReason ?? null;
baseline.featureOwnerReason = fleet.ownerReason ?? null;
updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: compactHolderId,
  ownerReason: newFeatureOwnerReason,
  nextStepClassification: newFeatureNextStepClassification,
  resumeCondition: newFeatureResumeCondition,
  waitingCondition: newFeatureResumeCondition,
  blockedReason: newFeatureBlockedReason,
  verificationBlocker: newFeatureVerificationBlocker,
  summary: newFeatureSummary,
  lastCheckedAt: repairedAt,
});
saveFeatureCompactLoopState(compactStatePath, compactState);
const fleetAfter = compactState.features[featureKey];
after.featureBlockedReason = fleetAfter.blockedReason ?? null;
after.featureOwnerReason = fleetAfter.ownerReason ?? null;

after.repairedAt = repairedAt;
mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(
  evidencePath,
  `# Ops apply — Fleet VM prerelease blocked-family collapse runtime state repair — ${repairedAt}\n\n` +
    `Applied the owner-side runtime mutation for the Fleet VM prerelease blocked-family collapse.\n\n` +
    `## Baseline\n\n` +
    `- compact holder reusesTaskIds before: ${JSON.stringify(baseline.compactReusesTaskIds)}\n` +
    `- compact holder goal before: ${JSON.stringify(baseline.compactGoal)}\n` +
    `- fleet compact blockedReason before: ${JSON.stringify(baseline.featureBlockedReason)}\n\n` +
    `## Applied changes\n\n` +
    `- Replaced ${duplicateHolderId} with ${survivingHolderId} in ${compactHolderId}.context.reusesTaskIds.\n` +
    `- Refreshed ${compactHolderId} goal/acceptance/blocker text so the VM-prerelease member binds directly through ${survivingHolderId}.\n` +
    `- Refreshed feature-compact state for fleet so ownerReason/blockedReason/waitingCondition no longer describe the duplicate holder as a preserved downstream wait.\n\n` +
    `## After\n\n` +
    `- compact holder reusesTaskIds after: ${JSON.stringify(after.compactReusesTaskIds)}\n` +
    `- compact holder goal after: ${JSON.stringify(after.compactGoal)}\n` +
    `- fleet compact blockedReason after: ${JSON.stringify(after.featureBlockedReason)}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      repairedAt,
      compactHolderId,
      survivingHolderId,
      duplicateHolderId,
      compactReusesTaskIdsBefore: baseline.compactReusesTaskIds,
      compactReusesTaskIdsAfter: after.compactReusesTaskIds,
      evidencePath,
    },
    null,
    2,
  ),
);
