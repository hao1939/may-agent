import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

const memoPath =
  "evidence/archive/ops-apply-net-integration-promotion-candidate-reclassification-20260711.md";
const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const privateRepairTaskId =
  "net-integration-outbound-migration-natgw-to-none-private-source-policy-repair";
const executeReadyTaskId =
  "net-integration-outbound-migration-none-to-lb-standalone-execute-ready-review";
const featureKey = "net-integration";
const refreshedAt = "2026-07-11T23:30:00.000Z";
const fallbackAt = "2026-07-12T17:30:00.000Z";

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
  frontierTaskIds: [holderTaskId, privateRepairTaskId, executeReadyTaskId],
  retryable: false,
  retryReason: holderBlocker.resume_condition ?? null,
  blockedReason: holderBlocker.condition ?? null,
  waitingFor: (holderBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: holderBlocker.resume_condition ?? null,
  observedBy: (holderBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: holderBlocker.observation_method ?? null,
  nextCheckAt: holderBlocker.next_check_at ?? refreshedAt,
  blockerOwner: "operator",
  fallbackAt: holderBlocker.fallback_at ?? fallbackAt,
  fallbackAction: holderBlocker.fallback_action ?? null,
  reviewEvidencePath: memoPath,
  summary:
    "Accepted 2026-07-11 promotion-candidate decomposition now removes spec.net-integration.multinic-standard and spec.net-integration.natgw-v2-migration-v2-to-none from the execute-ready subset, preserves net-integration-outbound-migration-natgw-to-none-private-source-policy-repair as the bounded repair lane, and keeps only spec.net-integration.outbound-migration-none-to-lb as the standalone execute-ready candidate.",
  updatedAt: refreshedAt,
  lastCheckedAt: refreshedAt,
});
saveFeatureCompactLoopState(compactStateLoaded.path, compactState);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;

updateSpecLoopSpec(specState, "spec.net-integration.multinic-standard", {
  status: "pending",
  taskId: null,
  successorDisposition: "source-grounded-nonlive-hold",
  successorEvidencePath: "/app/projects/aks-rp-e2e/evidence/archive/domain-net-integration-promotion-candidate-reclassification-20260711.md",
  successorStateReason:
    "Accepted 2026-07-11 net-integration promotion-candidate review reclassified this row out of the compact execute-ready subset: current checked-in metadata and local policy results preserve spec.net-integration.multinic-standard as an intentional source-check-only/nonlive carrier rather than a truthful standalone live candidate.",
  resumeCondition:
    "Resume only after accepted same-surface evidence intentionally promotes spec.net-integration.multinic-standard from source-grounded/nonlive into an exact live-capable carrier that passes local private-source and live-admission policy checks. Until then keep it out of the execute-ready compact subset and do not dispatch it standalone.",
  review: {
    classification: "source_grounded_nonlive",
    lastRootCause:
      "Current checked-in spec metadata still marks this branch draft/source-grounded with noExecutionCoverageClaim=true, private-source policy passes, and live admission correctly rejects standalone dispatch as source-check-only/nonlive.",
    lastAction:
      "Keep pending as a source-grounded/nonlive carrier and remove it from the compact execute-ready promotion slice. Do not rerun or dispatch it standalone until an exact live-capable carrier is intentionally authored and revalidated.",
    reviewedAt: refreshedAt,
  },
});

updateSpecLoopSpec(specState, "spec.net-integration.natgw-v2-migration-v2-to-none", {
  status: "pending",
  taskId: null,
  successorDisposition: "source-grounded-nonlive-hold",
  successorEvidencePath: "/app/projects/aks-rp-e2e/evidence/archive/domain-net-integration-promotion-candidate-reclassification-20260711.md",
  successorStateReason:
    "Accepted 2026-07-11 net-integration promotion-candidate review reclassified this row out of the compact execute-ready subset: current checked-in metadata and accepted prior reconciliation evidence preserve spec.net-integration.natgw-v2-migration-v2-to-none as a source-check-only/nonlive, source-backed-only contradiction branch rather than a truthful standalone live candidate.",
  resumeCondition:
    "Resume only after accepted same-surface evidence intentionally promotes spec.net-integration.natgw-v2-migration-v2-to-none from source-grounded/nonlive into an exact live-capable carrier that passes local private-source and live-admission policy checks. Until then keep it out of the execute-ready compact subset and do not dispatch it standalone.",
  review: {
    classification: "source_grounded_nonlive",
    lastRootCause:
      "Current checked-in spec metadata still marks this branch draft/source-grounded with noExecutionCoverageClaim=true, live admission correctly rejects standalone dispatch as source-check-only/nonlive, and accepted prior evidence still preserves a source-backed/public-contradiction ceiling rather than a truthful live carrier.",
    lastAction:
      "Keep pending as a source-grounded/nonlive contradiction carrier and remove it from the compact execute-ready promotion slice. Do not rerun or dispatch it standalone until an exact live-capable carrier is intentionally authored and revalidated.",
    reviewedAt: refreshedAt,
  },
});

saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      memoPath,
      holderTaskId,
      featureKey,
      frontierTaskIds: [holderTaskId, privateRepairTaskId, executeReadyTaskId],
      compactStatePath: compactStateLoaded.path,
      specStatePath,
      reclassifiedSpecIds: [
        "spec.net-integration.multinic-standard",
        "spec.net-integration.natgw-v2-migration-v2-to-none",
      ],
    },
    null,
    2,
  ),
);
