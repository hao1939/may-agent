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

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const loopTaskId = "aks-feature-compact-loop";
const featureMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/ops-reconcile-unpublished-change-count-dirty-tree-attribution-20260713.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-unpublished-change-count-dirty-tree-attribution-20260713-state-repair.md";
const attemptId =
  "a_ops-apply-reconcile-unpublished-change-count-dirty-tree-attribution-2026_20260713104800";

const featureCompactLeafId =
  "domain/reconcile-feature-compact-consumed-pass-history-and-model-projection-writeback-20260713";
const rpResidualLeafId =
  "domain/reconcile-rp-cluster-lifecycle-residual-frontier-writeback-20260713";
const netIntegrationFrontierWaitId =
  "wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702";

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const now = new Date().toISOString();

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});

const netBefore = compactState.features["net-integration"];
if (!netBefore) {
  throw new Error("Compact feature net-integration not found");
}

const rpBefore = compactState.features["rp-cluster-lifecycle"];
if (!rpBefore) {
  throw new Error("Compact feature rp-cluster-lifecycle not found");
}

updateFeatureCompactItem(compactState, "net-integration", {
  frontierTaskIds: unique([
    featureCompactLeafId,
    netIntegrationFrontierWaitId,
    ...(netBefore.frontierTaskIds ?? []),
  ]),
  reviewEvidencePath: appMemoPath,
  evidencePaths: unique([
    ...(netBefore.evidencePaths ?? []),
    netBefore.reviewEvidencePath ?? null,
    appMemoPath,
    featureMemoPath,
  ]),
  summary:
    "App-state repair added an exact publish/revert owner leaf for the feature-compact consumed-pass-history rollout and bound the compact-facing net-integration projection to that owner plus the existing exact outbound-udr wait, so the shared model/knowledge-map spillover is no longer anonymous dirty-state debt.",
  lastCheckedAt: now,
  attemptedFixes: unique([
    ...(netBefore.attemptedFixes ?? []),
    `${attemptId}: rebound net-integration compact frontierTaskIds to include ${featureCompactLeafId} plus exact wait ${netIntegrationFrontierWaitId}, and pointed reviewEvidencePath at ${appMemoPath} so the consumed-pass-history rollout/model spillover has a concrete current owner leaf.`,
  ]),
});

updateFeatureCompactItem(compactState, "rp-cluster-lifecycle", {
  frontierTaskIds: unique([
    rpResidualLeafId,
    ...(rpBefore.frontierTaskIds ?? []),
  ]),
  reviewEvidencePath: appMemoPath,
  evidencePaths: unique([
    ...(rpBefore.evidencePaths ?? []),
    rpBefore.reviewEvidencePath ?? null,
    appMemoPath,
    featureMemoPath,
  ]),
  summary:
    "App-state repair added an exact RP lifecycle residual writeback owner leaf alongside the preserved compact-facing frontier, so unpublished rp-cluster-lifecycle residue and the shared model/knowledge-map writeback now have a concrete visible owner without collapsing the stop-start or new-vnet waits.",
  lastCheckedAt: now,
  attemptedFixes: unique([
    ...(rpBefore.attemptedFixes ?? []),
    `${attemptId}: appended ${rpResidualLeafId} to rp-cluster-lifecycle compact frontierTaskIds and pointed reviewEvidencePath at ${appMemoPath} so the residual writeback/model spillover has a concrete current owner leaf without altering the existing stop-start/new-vnet frontier carriers.`,
  ]),
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const specLoopPath = defaultSpecLoopStatePath(appDir);
const specLoopState = JSON.parse(readFileSync(specLoopPath, "utf-8")) as SpecLoopState;

updateSpecLoopSpec(specLoopState, "spec.net-integration.multinic-standard", {
  taskId: featureCompactLeafId,
});
updateSpecLoopSpec(specLoopState, "spec.net-integration.natgw-v2-migration-v2-to-none", {
  taskId: featureCompactLeafId,
});
updateSpecLoopSpec(specLoopState, "spec.rp.operation-status-polling", {
  taskId: rpResidualLeafId,
});

saveSpecLoopState(specLoopPath, specLoopState);

console.log(
  JSON.stringify(
    {
      attemptId,
      appMemoPath,
      featureCompactLeafId,
      rpResidualLeafId,
      compactStatePath,
      specLoopPath,
      netIntegration: {
        taskId: compactState.features["net-integration"]?.taskId ?? null,
        frontierTaskIds:
          compactState.features["net-integration"]?.frontierTaskIds ?? null,
        reviewEvidencePath:
          compactState.features["net-integration"]?.reviewEvidencePath ?? null,
      },
      rpClusterLifecycle: {
        taskId: compactState.features["rp-cluster-lifecycle"]?.taskId ?? null,
        frontierTaskIds:
          compactState.features["rp-cluster-lifecycle"]?.frontierTaskIds ?? null,
        reviewEvidencePath:
          compactState.features["rp-cluster-lifecycle"]?.reviewEvidencePath ?? null,
      },
      specBindings: {
        "spec.net-integration.multinic-standard":
          specLoopState.specs["spec.net-integration.multinic-standard"]?.taskId ?? null,
        "spec.net-integration.natgw-v2-migration-v2-to-none":
          specLoopState.specs["spec.net-integration.natgw-v2-migration-v2-to-none"]?.taskId ?? null,
        "spec.rp.operation-status-polling":
          specLoopState.specs["spec.rp.operation-status-polling"]?.taskId ?? null,
      },
    },
    null,
    2,
  ),
);
