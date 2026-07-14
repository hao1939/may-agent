import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { loadSpecLoopState } from "../workflows/lib/spec-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();

const memoPath =
  "evidence/archive/ops-repair-localdns-compact-frontier-projection-drift-20260714.md";

const featureKey = "localdns";
const quotaTaskId = "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708";
const residualTaskId = "wait-localdns-create-http400-residual-family-return-20260704";
const windowsTaskId =
  "hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712";
const autoDefaultTaskId =
  "hold-spec-localdns-autodefault-fresh-create-136-cilium-environment-frontier-20260714";
const hostsPluginTaskId =
  "wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703";

const expectedFrontierTaskIds = [quotaTaskId, residualTaskId, windowsTaskId];

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const compactBefore = compactState.features[featureKey];
if (!compactBefore) {
  throw new Error(`Missing feature-compact state for ${featureKey}`);
}

const priorEvidencePaths = Array.isArray(compactBefore.evidencePaths)
  ? compactBefore.evidencePaths.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    )
  : [];
const evidencePaths = Array.from(new Set([memoPath, ...priorEvidencePaths]));

const priorAttemptedFixes = Array.isArray(compactBefore.attemptedFixes)
  ? compactBefore.attemptedFixes
  : [];
const repairNote =
  "Confirmed the quota-narrowing reconciliation keeps LocalDNS compact frontierTaskIds limited to the exact three compact-facing blocker families and excludes the spec-only auto-default plus hosts-plugin waits.";
const attemptedFixes = priorAttemptedFixes.includes(repairNote)
  ? priorAttemptedFixes
  : [...priorAttemptedFixes, repairNote];

const compactSummary =
  "LocalDNS compact projection is constrained to the three compact-facing downstream blocker families confirmed by the 2026-07-14 quota-narrowing reconciliation: managed-cluster quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive. Auto-default and hosts-plugin remain spec-only waits outside the compact-facing frontier.";

updateFeatureCompactItem(compactState, featureKey, {
  frontierTaskIds: expectedFrontierTaskIds,
  reviewEvidencePath: memoPath,
  evidencePaths,
  attemptedFixes,
  lastCheckedAt: checkedAt,
  summary: compactSummary,
  lastSummary: compactSummary,
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const compactAfter = compactState.features[featureKey];

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});

const cni = specState.specs["spec.localdns.cni-matrix"];
const networkPolicy = specState.specs["spec.localdns.network-policy-coexistence"];
const autoDefault = specState.specs["spec.localdns.auto-default"];
const hostsPlugin = specState.specs["spec.localdns.hosts-plugin"];
const windows = specState.specs["spec.localdns.windows-nodepool"];
if (!cni || !networkPolicy || !autoDefault || !hostsPlugin || !windows) {
  throw new Error("Missing expected LocalDNS spec-loop rows");
}

console.log(
  JSON.stringify(
    {
      checkedAt,
      memoPath,
      compactStatePath,
      specStatePath,
      before: {
        frontierTaskIds: compactBefore.frontierTaskIds ?? null,
        reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
      },
      after: {
        frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
        reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
        summary: compactAfter?.summary ?? null,
      },
      excludedCompactWaits: {
        autoDefaultTaskId,
        hostsPluginTaskId,
        autoDefaultPresentInFrontier:
          compactAfter?.frontierTaskIds?.includes(autoDefaultTaskId) ?? false,
        hostsPluginPresentInFrontier:
          compactAfter?.frontierTaskIds?.includes(hostsPluginTaskId) ?? false,
      },
      specLoopBindings: {
        cniMatrix: {
          taskId: cni.taskId ?? null,
          status: cni.status ?? null,
        },
        networkPolicyCoexistence: {
          taskId: networkPolicy.taskId ?? null,
          status: networkPolicy.status ?? null,
        },
        windowsNodepool: {
          taskId: windows.taskId ?? null,
          status: windows.status ?? null,
        },
        autoDefault: {
          taskId: autoDefault.taskId ?? null,
          status: autoDefault.status ?? null,
        },
        hostsPlugin: {
          taskId: hostsPlugin.taskId ?? null,
          status: hostsPlugin.status ?? null,
        },
      },
    },
    null,
    2,
  ),
);
