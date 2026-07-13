import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const memoPath =
  "evidence/archive/ops-apply-recover-shared-auth-runtime-owner-return-family-20260711d-stat.md";
const refreshedAt = "2026-07-11T20:00:00Z";

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

updateFeatureCompactItem(state, "node-confidential-vm", {
  taskId: "ops/wait-node-confidential-vm-snp-pool-run-28672036322-artifact-recovery-owner-return-20260710",
  reviewEvidencePath: memoPath,
  nextCheckAt: refreshedAt,
  lastCheckedAt: refreshedAt,
  summary:
    "Shared auth/runtime dependent projection refresh: node-confidential-vm remains represented by the exact run-28672036322 owner-return wait under the shared family steward, with compact-visible next-check timing refreshed to 2026-07-11T20:00:00Z.",
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      path,
      featureKey: "node-confidential-vm",
      taskId:
        state.features["node-confidential-vm"]?.taskId ?? null,
      nextCheckAt:
        state.features["node-confidential-vm"]?.nextCheckAt ?? null,
      lastCheckedAt:
        state.features["node-confidential-vm"]?.lastCheckedAt ?? null,
      reviewEvidencePath:
        state.features["node-confidential-vm"]?.reviewEvidencePath ?? null,
    },
    null,
    2,
  ),
);
