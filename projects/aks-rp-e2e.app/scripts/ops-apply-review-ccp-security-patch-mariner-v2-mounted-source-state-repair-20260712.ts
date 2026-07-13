import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
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

type TaskNode = {
  blocker?: {
    condition?: string;
    waiting_for?: Record<string, unknown>;
    observed_by?: Record<string, unknown>;
    observation_method?: string;
    resume_condition?: string;
    next_check_at?: string;
    fallback_at?: string;
    fallback_action?: string;
  };
};

type TaskTree = {
  tasks: Record<string, TaskNode>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const attemptId =
  "a_ops-apply-ops-apply-review-ccp-security-patch-mariner-v2-mounted-source-_20260712170146";
const repairedAt = new Date().toISOString();
const evidencePath =
  "evidence/archive/ops-apply-review-ccp-security-patch-mariner-v2-mounted-source-state-repair-20260712.md";
const domainReviewPath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-review-ccp-security-patch-mariner-v2-mounted-source-rehome-20260712.md";
const specId = "spec.ccp-security-patch.mariner-v2-prod-mtc";
const windowsSpecIds = [
  "spec.ccp-security-patch.windows2022-prod-mtc",
  "spec.ccp-security-patch.windows2025-prod-mtc",
];
const featureKey = "ccp-security-patch-os-variants";
const reclassifyTaskId =
  "reclassify-ccp-security-patch-mariner-v2-mounted-source-retire-or-alias-20260712";
const windowsWaitTaskId =
  "wait-ccp-security-patch-reviewed-exception-owner-response-20260708";
const holderTaskId =
  "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier";

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

const holderBlocker = blocker(holderTaskId);

const compactStateLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactStateLoaded.state;

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId, reclassifyTaskId, windowsWaitTaskId],
  retryable: false,
  retryReason: holderBlocker.resume_condition ?? null,
  blockedReason: holderBlocker.condition ?? null,
  waitingFor: {
    type: "split-frontier",
    featureKey,
    representedTaskIds: [reclassifyTaskId, windowsWaitTaskId],
    representedSpecIds: [specId, ...windowsSpecIds],
  },
  waitingCondition: holderBlocker.resume_condition ?? null,
  observedBy: (holderBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: holderBlocker.observation_method ?? null,
  nextCheckAt: holderBlocker.next_check_at ?? null,
  blockerOwner: "operator",
  fallbackAt: holderBlocker.fallback_at ?? null,
  fallbackAction: holderBlocker.fallback_action ?? null,
  reviewEvidencePath: evidencePath,
  summary:
    "Refreshed the compact CCP security-patch frontier to one split representation: the holder stays taskId, frontierTaskIds now name the MarinerV2 reclassification successor plus the narrowed Windows owner/source-authority wait.",
  updatedAt: repairedAt,
  lastCheckedAt: repairedAt,
});
saveFeatureCompactLoopState(compactStateLoaded.path, compactState);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;

updateSpecLoopSpec(specState, specId, {
  status: "pending",
  taskId: reclassifyTaskId,
  successorDisposition: "source-grounded-nonlive-hold",
  successorEvidencePath: domainReviewPath,
  successorStateReason:
    "Mounted-source review plus the reviewed rerun ceiling show that MarinerV2 is no longer a truthful default live-ready CCP security-patch carrier: 28678450306 still fails with InvalidOSSKU on the current surface, and mounted CCP prod source still lacks an authoritative MarinerV2 security-patch scenario. The live spec frontier is now the exact reclassification successor rather than the shared Windows owner-response wait.",
  resumeCondition:
    "Resume only after reclassify-ccp-security-patch-mariner-v2-mounted-source-retire-or-alias-20260712 either retires or aliases the legacy MarinerV2 branch, or after accepted same-surface evidence authors a corrected mounted-source-backed Mariner/AzureLinux successor carrier. Do not rerun the unchanged MarinerV2 carrier.",
  review: {
    classification: "source_grounded_nonlive",
    lastRootCause:
      "Mounted-source review confirms no authoritative prod MarinerV2 CCP security-patch scenario, while the reviewed Linux-pair rerun still fails cluster create with InvalidOSSKU on the current surface.",
    lastAction:
      "Bind this spec to the exact MarinerV2 reclassification successor and remove it from the shared Windows owner-response wait lineage. Do not rerun the unchanged carrier.",
    reviewedAt: repairedAt,
  },
});

saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      evidencePath,
      specStatePath,
      compactStatePath: defaultFeatureCompactLoopStatePath(appDir),
      repaired: {
        specId,
        specTaskId: specState.specs[specId]?.taskId ?? null,
        specSuccessorDisposition:
          specState.specs[specId]?.successorDisposition ?? null,
        featureKey,
        compactTaskId: compactState.features[featureKey]?.taskId ?? null,
        compactFrontierTaskIds:
          compactState.features[featureKey]?.frontierTaskIds ?? null,
        compactWaitingFor:
          compactState.features[featureKey]?.waitingFor ?? null,
      },
    },
    null,
    2,
  ),
);
