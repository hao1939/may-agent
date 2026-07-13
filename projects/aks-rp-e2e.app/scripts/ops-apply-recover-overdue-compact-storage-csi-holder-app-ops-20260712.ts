import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

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

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const holderTaskId =
  "hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707";
const memberWaitTaskId =
  "wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702";
const memoPath =
  "evidence/archive/ops-apply-recover-overdue-compact-storage-csi-holder-app-ops-20260712.md";

function blockerFor(taskId: string): BlockerRecord {
  const blocker = tree.tasks[taskId]?.blocker;
  if (!blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return blocker;
}

const holderBlocker = blockerFor(holderTaskId);
const memberWaitBlocker = blockerFor(memberWaitTaskId);

const { state, path: statePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const current = state.features["storage-csi"];
if (!current) {
  throw new Error("Missing storage-csi feature compact state record");
}

const evidencePaths = Array.from(
  new Set([...(current.evidencePaths ?? []), memoPath]),
);

updateFeatureCompactItem(state, "storage-csi", {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [memberWaitTaskId],
  blockedAt: holderBlocker.blocked_at ?? current.blockedAt ?? null,
  blockedReason:
    "Blocked only as the compact-facing storage-csi residual holder after restoring the accepted three-member frontier. The exact remaining compact members are spec.storage-csi.csidrivers, spec.storage-csi.file-nfs-unmount-boundary, and spec.storage-csi.mcr-mirror-monitor. Successor proof for spec.storage-csi.disk-resize and spec.storage-csi.disk-xfs is already consumed, so those two members must stay out of this compact-facing hold. Preserve wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702 only as the narrower MCR member wait beneath this holder; do not reopen a broad compact rerun.",
  waitingFor: (holderBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: holderBlocker.resume_condition ?? null,
  resumeCondition: holderBlocker.resume_condition ?? null,
  observedBy: (holderBlocker.observed_by ?? null) as
    | Record<string, unknown>
    | null,
  observationMethod: holderBlocker.observation_method ?? null,
  nextCheckAt: holderBlocker.next_check_at ?? null,
  blockerOwner: holderBlocker.owner ?? current.blockerOwner ?? null,
  fallbackAt: holderBlocker.fallback_at ?? null,
  fallbackAction: holderBlocker.fallback_action ?? current.fallbackAction ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary:
    "Restored the compact-facing storage-csi feature state to hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707 and preserved wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702 only as the narrower member wait. Disk-resize and disk-xfs stay consumed and must not be reopened by this holder.",
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
        frontierTaskIds: [memberWaitTaskId],
        waitingFor: holderBlocker.waiting_for ?? null,
        waitingCondition: holderBlocker.resume_condition ?? null,
        nextCheckAt: holderBlocker.next_check_at ?? null,
        fallbackAt: holderBlocker.fallback_at ?? null,
      },
      verifiedInputs: {
        holderTaskId,
        holderCondition: holderBlocker.condition ?? null,
        memberWaitTaskId,
        memberWaitCondition: memberWaitBlocker.condition ?? null,
      },
    },
    null,
    2,
  ),
);
