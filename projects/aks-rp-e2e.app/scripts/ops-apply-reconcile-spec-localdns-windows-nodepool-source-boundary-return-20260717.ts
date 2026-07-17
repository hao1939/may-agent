import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
} from "../workflows/lib/spec-loop-store.ts";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();

const featureKey = "localdns";
const specId = "spec.localdns.windows-nodepool";
const taskId = "hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712";
const latestEvidenceAbsolute =
  "/app/projects/aks-rp-e2e/evidence/archive/reconcile-spec-localdns-windows-nodepool-source-boundary-return-20260717.md";
const latestEvidenceRelative =
  "evidence/archive/reconcile-spec-localdns-windows-nodepool-source-boundary-return-20260717.md";
const replayEvidenceRelative =
  "evidence/archive/reconcile-spec-localdns-windows-nodepool-source-boundary-return-20260717-localdns-windows-nodepool.json";
const legacyEvidenceRelative =
  "evidence/archive/domain-reconcile-localdns-windows-nodepool-mounted-source-verdict-20260714.md";

const lastRootCause =
  "2026-07-17 memo/replay revalidated the exact Windows LocalDNS unsupported/nonlive ceiling: mounted source still has no handwritten Windows LocalDNS scenario, AgentBaker still omits LocalDNS labels on Windows pools and machines, validator tests still reject LocalDNS Required on Windows and skip auto-default support, the checked-in replay remains intentionally check-only and blocks live execute, and no stronger authoritative Windows LocalDNS support signal is available locally to overturn that boundary.";
const lastAction =
  `Keep pending under ${taskId}. Do not rerun unchanged or dispatch live; resume only after authoritative mounted-source or product evidence materially changes the Windows LocalDNS support boundary.`;
const successorStateReason =
  `Represented by ${taskId}: preserve the exact Windows LocalDNS unsupported/nonlive boundary because mounted source still lacks a Windows LocalDNS scenario, AgentBaker still omits Windows LocalDNS labels, validator tests still reject/skip Windows LocalDNS support, the checked-in replay intentionally blocks live execute, and no stronger authoritative support signal is available locally.`;
const resumeCondition =
  "Resume only when authoritative mounted-source or product evidence materially changes the Windows LocalDNS boundary: a new handwritten Windows LocalDNS scenario, validator support for LocalDNS on Windows, AgentBaker/label support for Windows pools or machines, or an equivalent reviewed support signal that overturns the current unsupported ceiling.";

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const beforeSpec = specState.specs[specId];
if (!beforeSpec) {
  throw new Error(`Missing spec-loop row for ${specId}`);
}

updateSpecLoopSpec(specState, specId, {
  status: "pending",
  taskId,
  review: {
    classification: "reviewed_exception_unsupported_product_boundary",
    lastRootCause,
    lastAction,
    reviewedAt: checkedAt,
  },
  successorDisposition: "reviewed-exception-unsupported-nonlive-evidence-ceiling",
  successorEvidencePath: latestEvidenceAbsolute,
  successorStateReason,
  resumeCondition,
  catalogStatus: beforeSpec.catalogStatus ?? "blocked",
  catalogSpecState: beforeSpec.catalogSpecState ?? "reviewed-exception",
  terminalDisposition: true,
});

saveSpecLoopState(specStatePath, specState);
const afterSpec = specState.specs[specId];

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const beforeFeature = compactState.features[featureKey];
if (!beforeFeature) {
  throw new Error(`Missing feature-compact row for ${featureKey}`);
}

const evidencePaths = Array.from(
  new Set(
    [
      ...(Array.isArray(beforeFeature.evidencePaths) ? beforeFeature.evidencePaths : []),
      legacyEvidenceRelative,
      latestEvidenceRelative,
      replayEvidenceRelative,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ),
);

updateFeatureCompactItem(compactState, featureKey, {
  evidencePaths,
  lastCheckedAt: checkedAt,
});

saveFeatureCompactLoopState(compactStatePath, compactState);
const afterFeature = compactState.features[featureKey];

console.log(
  JSON.stringify(
    {
      checkedAt,
      specId,
      taskId,
      before: {
        specTaskId: beforeSpec.taskId ?? null,
        successorEvidencePath: beforeSpec.successorEvidencePath ?? null,
        review: beforeSpec.review ?? null,
        featureEvidencePaths: beforeFeature.evidencePaths ?? null,
      },
      after: {
        specTaskId: afterSpec?.taskId ?? null,
        successorEvidencePath: afterSpec?.successorEvidencePath ?? null,
        review: afterSpec?.review ?? null,
        featureEvidencePaths: afterFeature?.evidencePaths ?? null,
      },
    },
    null,
    2,
  ),
);
