import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { resolve } from "node:path";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);

const featureKey = "trusted-access";
const compactTaskId =
  "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705";
const specTaskId =
  "wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703";
const memoPath =
  "evidence/archive/ops-apply-reconcile-trusted-access-ta-gateway-runtime-family-duplication-20260711.md";
const attemptId =
  "a_ops-apply-reconcile-trusted-access-ta-gateway-runtime-family-duplication_20260711115233";
const checkedAt = new Date().toISOString();

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const before = state.features[featureKey];
if (!before) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

updateFeatureCompactItem(state, featureKey, {
  taskId: compactTaskId,
  frontierTaskIds: [specTaskId],
  status: "blocked",
  retryable: false,
  reviewEvidencePath: memoPath,
  summary:
    "Trusted-access runtime family contract normalized: taskId remains the exact compact holder hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705, while frontierTaskIds lists the additional exact downstream/sibling carrier wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703 instead of reviving the retired package-partial alias.",
  lastCheckedAt: checkedAt,
});

saveFeatureCompactLoopState(path, state);

const after = state.features[featureKey];

console.log(
  JSON.stringify(
    {
      attemptId,
      featureKey,
      statePath: path,
      before: {
        taskId: before.taskId ?? null,
        frontierTaskIds: before.frontierTaskIds ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
        summary: before.summary ?? null,
        updatedAt: before.updatedAt ?? null,
        lastCheckedAt: before.lastCheckedAt ?? null,
      },
      after: {
        taskId: after.taskId ?? null,
        frontierTaskIds: after.frontierTaskIds ?? null,
        reviewEvidencePath: after.reviewEvidencePath ?? null,
        summary: after.summary ?? null,
        updatedAt: after.updatedAt ?? null,
        lastCheckedAt: after.lastCheckedAt ?? null,
      },
    },
    null,
    2,
  ),
);
