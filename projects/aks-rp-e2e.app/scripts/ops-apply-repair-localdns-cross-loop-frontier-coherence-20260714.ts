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
  "evidence/archive/ops-apply-repair-localdns-cross-loop-frontier-coherence-20260714-state-r.md";

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
const attemptedFixes = [
  ...priorAttemptedFixes,
  "Shrank LocalDNS compact frontierTaskIds back to the exact compact-facing three-family projection so auto-default and hosts-plugin remain outside the controller-visible compact frontier.",
];

const compactSummary =
  "Repaired LocalDNS compact projection coherence so the controller-visible compact frontier again exposes only the three compact-facing downstream families: managed-cluster quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive. Auto-default and hosts-plugin remain valid separate non-compact waits outside the compact-facing frontier.";

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
if (!cni || !networkPolicy || !autoDefault || !hostsPlugin) {
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
      },
      after: {
        frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
        reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
        summary: compactAfter?.summary ?? null,
      },
      excludedCompactWaits: {
        autoDefaultTaskId,
        hostsPluginTaskId,
      },
      specLoopBindings: {
        cniMatrix: {
          taskId: cni.taskId ?? null,
          resumeCondition: cni.resumeCondition ?? null,
        },
        networkPolicyCoexistence: {
          taskId: networkPolicy.taskId ?? null,
          resumeCondition: networkPolicy.resumeCondition ?? null,
        },
        autoDefault: {
          taskId: autoDefault.taskId ?? null,
          resumeCondition: autoDefault.resumeCondition ?? null,
        },
        hostsPlugin: {
          taskId: hostsPlugin.taskId ?? null,
          resumeCondition: hostsPlugin.resumeCondition ?? null,
        },
      },
    },
    null,
    2,
  ),
);
