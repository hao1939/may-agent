import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { loadSpecLoopState } from "../workflows/lib/spec-loop-store.ts";

type BlockerRecord = {
  condition?: string;
  owner?: string;
  blocked_at?: string;
  waiting_for?: Record<string, unknown>;
  resume_condition?: string;
  observed_by?: Record<string, unknown>;
  observation_method?: string;
  next_check_at?: string;
  fallback_at?: string;
  fallback_action?: string;
};

type TaskTree = {
  tasks: Record<string, { blocker?: BlockerRecord }>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
const appliedAt = new Date().toISOString();

const holderTaskId =
  "hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707";
const memberWaitTaskId =
  "wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702";
const domainMemoPath =
  "evidence/archive/reconcile-compact-storage-csi-successor-pair-residual-frontier-return-20260717.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-compact-storage-csi-successor-pair-residual-frontier-return-20260717-state-repair.md";
const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-compact-storage-csi-successor-pair-residual-frontier-return-20260717-state-repair_20260717013937";

function blockerFor(taskId: string): BlockerRecord {
  const blocker = tree.tasks[taskId]?.blocker;
  if (!blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return blocker;
}

const holderBlocker = blockerFor(holderTaskId);
const memberWaitBlocker = blockerFor(memberWaitTaskId);
assert(
  holderBlocker.condition?.includes("Storage-csi now has 34 checked-in specs"),
  `Holder ${holderTaskId} is not on the refreshed 2026-07-17 blocker text`,
);
assert(
  holderBlocker.condition?.includes("spec.storage-csi.file-verify-nfs exists and is already a reviewed exact same-path pass"),
  `Holder ${holderTaskId} blocker is missing file-verify-nfs pass evidence`,
);
assert(
  memberWaitBlocker.condition?.includes("GET https://mcr.azk8s.cn/v2/ returning HTTP 403"),
  `Member wait ${memberWaitTaskId} no longer exposes the expected narrow MCR blocker`,
);

const { state, path: statePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const current = state.features["storage-csi"];
assert(current, "Missing storage-csi feature compact state record");

const specLoop = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
  refreshFromProject: false,
});
const mcrSpec = specLoop.state.specs["spec.storage-csi.mcr-mirror-monitor"] as
  | Record<string, unknown>
  | undefined;
const verifyNfsSpec = specLoop.state.specs["spec.storage-csi.file-verify-nfs"] as
  | Record<string, unknown>
  | undefined;
assert(mcrSpec, "Missing spec-loop entry for spec.storage-csi.mcr-mirror-monitor");
assert(verifyNfsSpec, "Missing spec-loop entry for spec.storage-csi.file-verify-nfs");
assert(
  mcrSpec.taskId === memberWaitTaskId,
  `Expected spec.storage-csi.mcr-mirror-monitor.taskId=${memberWaitTaskId}, found ${String(mcrSpec.taskId ?? "(null)")}`,
);
assert(
  verifyNfsSpec.status === "pass",
  `Expected spec.storage-csi.file-verify-nfs status=pass, found ${String(verifyNfsSpec.status ?? "(null)")}`,
);

const evidencePaths = unique([
  ...(current.evidencePaths ?? []),
  domainMemoPath,
  appMemoPath,
]);
const attemptedFixes = unique([
  ...(current.attemptedFixes ?? []),
  `${attemptId}: refreshed ${holderTaskId} wording/windows from 2026-07-17 residual-frontier return evidence, restored frontierTaskIds to ${memberWaitTaskId}, and preserved the exact three-member residual compact set with file-verify-nfs treated only as internal pass evidence beneath spec.storage-csi.file-nfs-unmount-boundary.`,
]);
const summary =
  `${attemptId}: refreshed storage-csi compact residual holder ${holderTaskId} to the 2026-07-17 current-head blocker text, preserved only spec.storage-csi.csidrivers / spec.storage-csi.file-nfs-unmount-boundary / spec.storage-csi.mcr-mirror-monitor in the compact residual set, and kept ${memberWaitTaskId} as the only exact narrower member wait.`;

updateFeatureCompactItem(state, "storage-csi", {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [memberWaitTaskId],
  retryable: false,
  retryReason: holderBlocker.resume_condition ?? current.retryReason ?? null,
  ownerReason:
    "Current-head storage-csi inventory is 34 specs because spec.storage-csi.file-verify-nfs now exists and already passed, but that pass only narrows the umbrella file-nfs boundary internally. Controller-visible compact state must keep the exact three-member residual holder on csidrivers, file-nfs-unmount-boundary, and mcr-mirror-monitor, while preserving wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702 only as the narrower MCR member wait beneath the holder.",
  blockedAt: holderBlocker.blocked_at ?? current.blockedAt ?? null,
  blockedReason: holderBlocker.condition ?? current.blockedReason ?? null,
  waitingFor: (holderBlocker.waiting_for ?? current.waitingFor ?? null) as Record<string, unknown> | null,
  waitingCondition: holderBlocker.resume_condition ?? current.waitingCondition ?? null,
  resumeCondition: holderBlocker.resume_condition ?? current.resumeCondition ?? null,
  observedBy: (holderBlocker.observed_by ?? current.observedBy ?? null) as Record<string, unknown> | null,
  observationMethod: holderBlocker.observation_method ?? current.observationMethod ?? null,
  nextCheckAt: holderBlocker.next_check_at ?? current.nextCheckAt ?? null,
  blockerOwner: holderBlocker.owner ?? current.blockerOwner ?? null,
  fallbackAt: holderBlocker.fallback_at ?? current.fallbackAt ?? null,
  fallbackAction: holderBlocker.fallback_action ?? current.fallbackAction ?? null,
  reviewEvidencePath: appMemoPath,
  evidencePaths,
  attemptedFixes,
  lastCheckedAt: appliedAt,
  updatedAt: appliedAt,
  nextStepClassification:
    "Preserve the exact three-member storage-csi residual compact frontier and do not reopen disk-resize or disk-xfs; only a materially changed csidrivers/file-nfs-unmount-boundary/mcr-mirror-monitor member or accepted reclassification should move this holder.",
  summary,
  lastSummary: summary,
  verificationBlocker:
    "Do not treat spec.storage-csi.file-verify-nfs pass state as a replacement for the umbrella file-nfs-unmount-boundary residual member, and do not reopen a broad compact rerun. The exact residual set remains csidrivers, file-nfs-unmount-boundary, and mcr-mirror-monitor, with wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702 preserved as the only exact narrower member wait.",
});

saveFeatureCompactLoopState(statePath, state);

console.log(
  JSON.stringify(
    {
      statePath,
      repaired: {
        featureKey: "storage-csi",
        previousTaskId: current.taskId ?? null,
        newTaskId: holderTaskId,
        previousFrontierTaskIds: current.frontierTaskIds ?? [],
        newFrontierTaskIds: [memberWaitTaskId],
        previousBlockedReason: current.blockedReason ?? null,
        newBlockedReason: holderBlocker.condition ?? null,
        previousReviewEvidencePath: current.reviewEvidencePath ?? null,
        newReviewEvidencePath: appMemoPath,
        nextCheckAt: holderBlocker.next_check_at ?? null,
        fallbackAt: holderBlocker.fallback_at ?? null,
      },
      verifiedInputs: {
        holderTaskId,
        holderCondition: holderBlocker.condition ?? null,
        memberWaitTaskId,
        memberWaitCondition: memberWaitBlocker.condition ?? null,
        mcrSpecTaskId: mcrSpec.taskId ?? null,
        verifyNfsStatus: verifyNfsSpec.status ?? null,
      },
    },
    null,
    2,
  ),
);
