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
    resume_at?: string;
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
  "evidence/archive/ops-apply-review-trusted-access-ta-gateway-runtime-family-post-12z-20260711.md";
const specTaskId =
  "wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703";
const compactTaskId =
  "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705";
const featureKey = "trusted-access";
const specId = "spec.trusted-access.dataplane-token-gateway-runtime";
const refreshedAt = "2026-07-11T18:00:00Z";
const fallbackAt = "2026-07-12T18:00:00Z";

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

const specBlocker = blocker(specTaskId);
const compactBlocker = blocker(compactTaskId);

const refreshedSpecCondition =
  "2026-07-11 post-12:00Z accepted family review in /app/projects/aks-rp-e2e/evidence/archive/review-trusted-access-ta-gateway-runtime-family-post-12z-20260711.md reconfirmed this remains the exact spec-loop sibling of hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705: repeated repo-visible/runtime evidence still stops at *.ta.azmk8s.io TA gateway DNS/runtime reachability before any trusted-access dataplane product assertion, so no unchanged rerun from the current runtime is truthful.";
const refreshedCompactCondition =
  "2026-07-11 post-12:00Z accepted family review in /app/projects/aks-rp-e2e/evidence/archive/review-trusted-access-ta-gateway-runtime-family-post-12z-20260711.md reconfirmed this remains the exact compact sibling of wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703: repeated repo-visible/runtime evidence still stops at *.ta.azmk8s.io TA gateway DNS/runtime reachability before any trusted-access dataplane product assertion, so no unchanged compact rerun is truthful.";
const refreshedResumeCondition =
  "Resume only when accepted same-runtime or approved alternate-surface evidence materially changes *.ta.azmk8s.io reachability enough to let spec.trusted-access.dataplane-token-gateway-runtime reach gateway product behavior, or when accepted evidence reclassifies the carrier out of reviewed-exception.";
const refreshedFallbackAction =
  "If still blocked at fallback, refresh the surviving trusted-access compact/spec wait pair from current runtime evidence and keep the exact pair rather than restoring duplicate package-partial alias coverage.";

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;
updateSpecLoopSpec(specState, specId, {
  taskId: specTaskId,
  successorEvidencePath: "/app/projects/aks-rp-e2e/evidence/archive/reconcile-spec-loop-pending-trusted-access-followup-20260703.md",
  successorStateReason:
    "Accepted trusted-access family review after the 2026-07-11T12:00Z window keeps this spec on the exact spec wait because repeated repo-visible runtime evidence still stops at TA gateway DNS/runtime reachability before any dataplane product verdict. The app-side exact family refresh now aligns the downstream compact/spec pair to the 2026-07-11T18:00:00Z review window while preserving the same no-unchanged-rerun posture.",
  resumeCondition:
    "Resume only after accepted same-runtime evidence proves materially different *.ta.azmk8s.io reachability for the gateway-call path, or an approved alternate-surface / ADO-agent-equivalent / Microsoft-internal DNS execution lane changes that reachability contract enough to reach product behavior, or accepted evidence reclassifies the carrier out of reviewed-exception; do not rerun the unchanged spec before then.",
  review: {
    classification: "environment_blocker",
    lastRootCause:
      "Accepted post-12Z 2026-07-11 family review keeps this spec blocked before any TA gateway HTTP or Kubernetes product verdict because repeated repo-visible execution still reaches endpoint selection and token setup but then stops at *.ta.azmk8s.io DNS/runtime reachability failure for all gateway assertions.",
    lastAction:
      "Keep pending as a reviewed environment blocker on exact wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703, align the family to the 2026-07-11T18:00:00Z review window, and do not rerun unchanged.",
    reviewedAt: refreshedAt,
  },
});
saveSpecLoopState(specStatePath, specState);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: compactTaskId,
  frontierTaskIds: [compactTaskId, specTaskId],
  retryable: false,
  retryReason: refreshedResumeCondition,
  blockedReason: refreshedCompactCondition,
  waitingFor: (compactBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: refreshedResumeCondition,
  observedBy: (compactBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: compactBlocker.observation_method ?? null,
  nextCheckAt: refreshedAt,
  blockerOwner: "product-owner",
  fallbackAt,
  fallbackAction: refreshedFallbackAction,
  reviewEvidencePath: memoPath,
  summary:
    "Post-12Z trusted-access family refresh restores the exact compact/spec pair: keep hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705 plus wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703, and do not rerun unchanged while TA gateway DNS/runtime reachability still fails before dataplane product behavior.",
  updatedAt: refreshedAt,
  lastCheckedAt: refreshedAt,
});
saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      memoPath,
      spec: {
        specId,
        taskId: specTaskId,
        refreshedCondition: refreshedSpecCondition,
        refreshedResumeCondition,
        nextCheckAt: refreshedAt,
        fallbackAt,
      },
      compact: {
        featureKey,
        taskId: compactTaskId,
        frontierTaskIds: [compactTaskId, specTaskId],
        refreshedCondition: refreshedCompactCondition,
        refreshedResumeCondition,
        nextCheckAt: refreshedAt,
        fallbackAt,
      },
      paths: {
        specStatePath,
        compactStatePath,
      },
    },
    null,
    2,
  ),
);
