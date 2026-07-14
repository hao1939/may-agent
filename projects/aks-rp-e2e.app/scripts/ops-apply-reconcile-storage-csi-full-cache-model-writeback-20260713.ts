import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type TaskTree = {
  tasks: Record<
    string,
    {
      blocker?: {
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
      state?: string;
    }
  >;
};

type SpecLoopState = {
  specs: Record<string, Record<string, unknown>>;
};

type EvidenceEntry = {
  id: string;
  kind: string;
  path: string;
  summary: string;
  [key: string]: unknown;
};

type ModelShape = {
  updatedAt?: string;
  evidence?: EvidenceEntry[];
  paths?: Array<Record<string, unknown>>;
  featurePaths?: Array<Record<string, unknown>>;
  features?: Array<Record<string, unknown>>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const now = new Date().toISOString();
const reviewRecordedAt = "2026-07-08T12:32:03Z";
const runDate = "2026-07-08";
const runId = "171343304";
const runUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171343304";
const resultPath =
  "workspace/reconcile-spec-loop-pending-storage-csi-4/20260708T114017Z/artifacts/slice-01-test-results/runs/test-results/test_20260708085106370_nb7crw_238609/artifacts/storage-csi-full-cache-os-disk-negative/spec-runner/result.json";
const domainMemoPath =
  "evidence/archive/domain-update-storage-csi-full-cache-os-disk-negative-model-posture-20260713.md";
const appMemoPath =
  "evidence/archive/ops-apply-reconcile-storage-csi-drained-nonpass-frontier-20260713.md";
const reviewedEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/review-spec-loop-storage-csi-pass-writeback-run-171343304-20260708.md";
const runEvidenceId =
  "spec-storage-csi-full-cache-os-disk-negative-run-171343304-pass-20260708";
const domainArtifactId =
  "domain-update-storage-csi-full-cache-os-disk-negative-model-posture-20260713";
const fullCacheSpecId = "spec.storage-csi.full-cache-os-disk-negative";
const fullCachePathId = "path.storage-csi.full-cache-os-disk-negative";
const fullCacheFeatureId = "storage-csi-full-cache-os-disk-negative";
const storageCsiHolderTaskId =
  "hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707";
const mcrWaitTaskId =
  "wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function pushUniqueEvidenceEntry(entries: EvidenceEntry[], next: EvidenceEntry): void {
  const index = entries.findIndex((entry) => entry.id === next.id);
  if (index >= 0) {
    entries[index] = next;
    return;
  }
  entries.push(next);
}

function replaceInlineEvidence(
  evidence: unknown,
  replacements: EvidenceEntry[],
): EvidenceEntry[] {
  const current = Array.isArray(evidence)
    ? evidence.filter((entry): entry is EvidenceEntry => Boolean(entry && typeof entry === "object"))
    : [];
  const kept = current.filter(
    (entry) => !replacements.some((replacement) => replacement.id === entry.id),
  );
  return [...kept, ...replacements];
}

const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = readJson<TaskTree>(treePath);
const storageHolderBlocker = tree.tasks[storageCsiHolderTaskId]?.blocker;
const mcrWait = tree.tasks[mcrWaitTaskId];
if (!storageHolderBlocker) {
  throw new Error(`Missing blocker for ${storageCsiHolderTaskId}`);
}
if (!mcrWait || mcrWait.state !== "blocked") {
  throw new Error(`${mcrWaitTaskId} is not currently blocked`);
}

const specLoopPath = resolve(appDir, ".state/spec-loop/state.json");
const specLoop = readJson<SpecLoopState>(specLoopPath);
const fullCacheSpec = specLoop.specs[fullCacheSpecId];
const mcrSpec = specLoop.specs["spec.storage-csi.mcr-mirror-monitor"];
if (!fullCacheSpec) {
  throw new Error(`Missing spec-loop record for ${fullCacheSpecId}`);
}
if (fullCacheSpec.status !== "pass") {
  throw new Error(`${fullCacheSpecId} expected pass, got ${String(fullCacheSpec.status)}`);
}
if (String(fullCacheSpec.successorRunId ?? "") !== runId) {
  throw new Error(
    `${fullCacheSpecId} expected successorRunId ${runId}, got ${String(fullCacheSpec.successorRunId ?? null)}`,
  );
}
if (String(fullCacheSpec.successorEvidencePath ?? "") !== reviewedEvidencePath) {
  throw new Error(
    `${fullCacheSpecId} successorEvidencePath drifted from reviewed authority`,
  );
}
if (!mcrSpec || String(mcrSpec.taskId ?? "") !== mcrWaitTaskId) {
  throw new Error(`spec.storage-csi.mcr-mirror-monitor no longer points at ${mcrWaitTaskId}`);
}

const modelPath = resolve(projectDir, "model/knowledge-map/model.json");
const model = readJson<ModelShape>(modelPath);
const legacyPath = model.paths?.find((entry) => entry.id === fullCachePathId);
const featurePath = model.featurePaths?.find((entry) => entry.id === fullCachePathId);
const feature = model.features?.find((entry) => entry.id === fullCacheFeatureId);
if (!legacyPath || !featurePath || !feature) {
  throw new Error(`Missing legacy path, featurePath, or feature for ${fullCachePathId}`);
}
if (legacyPath.status !== "unknown" || featurePath.status !== "unknown") {
  throw new Error(`Expected stale unknown posture before writeback for ${fullCachePathId}`);
}

const runEvidenceEntry: EvidenceEntry = {
  id: runEvidenceId,
  kind: "run-result",
  path: resultPath,
  summary:
    "Exact Azure DevOps same-path pass for path.storage-csi.full-cache-os-disk-negative: run 171343304 reached the mounted 4-vCPU full-cache negative carrier and returned the expected FullCacheVMSizeNotInCandidateList rejection.",
};
const domainArtifactEntry: EvidenceEntry = {
  id: domainArtifactId,
  kind: "artifact",
  path: domainMemoPath,
  summary:
    "Accepted model/path-summary writeback for path.storage-csi.full-cache-os-disk-negative: preserve stale-carrier history as lineage only and normalize the current maintained posture to pass from exact same-path Azure DevOps run 171343304.",
};

model.evidence = Array.isArray(model.evidence) ? model.evidence : [];
pushUniqueEvidenceEntry(model.evidence, runEvidenceEntry);
pushUniqueEvidenceEntry(model.evidence, domainArtifactEntry);

Object.assign(legacyPath, {
  runId,
  status: "pass",
  diagnosis: "product_pass",
  classification: {
    category: "product",
    subcategory: "exact-same-spec-live-pass",
    detail:
      "Azure DevOps run 171343304 exercised the repaired mounted 4-vCPU full-cache negative carrier and returned the expected FullCacheVMSizeNotInCandidateList rejection.",
  },
  lastRunId: runId,
  lastRunStatus: "pass",
  lastRunAt: reviewRecordedAt,
  remediationStatus: "n/a-product-pass",
  rootCauseClass: "none",
  verdictFinal: true,
  evidenceSummary:
    "The earlier stale-carrier contradiction is now historical lineage only. Exact Azure DevOps run 171343304 proved the canonical mounted 4-vCPU EnableOSDiskFullCaching=true request is rejected with FullCacheVMSizeNotInCandidateList, so the strongest truthful posture is product pass.",
  statusReason:
    "Exact Azure DevOps same-path rerun 171343304 supersedes the older stale-carrier contradiction posture. It exercised the repaired mounted 4-vCPU full-cache negative request and returned the expected FullCacheVMSizeNotInCandidateList rejection, so this path is no longer truthfully modeled as unknown or awaiting another unchanged rerun.",
  notes:
    "Canonical exact contract remains the mounted 4-vCPU EnableOSDiskFullCaching=true negative carrier. Older Standard_B2s + 256GB evidence stays as lineage for the stale-carrier contradiction that preceded the repaired same-path rerun, but run 171343304 is now the governing witness for this path.",
  ceilingCategory: "none",
  ceilingGate: "",
  nextAction:
    "No unchanged rerun is implied. Reopen only if a materially changed build, target, API surface, or contradictory future evidence requires fresher same-path verification beyond Azure DevOps run 171343304.",
  terminal: false,
  verdict: "pass",
  updatedAt: now,
  evidenceRef: resultPath,
  lastExecution: reviewRecordedAt,
  resumeCondition:
    "No unchanged rerun is implied. Resume only if an owner requests fresher same-path live verification on a materially changed build, target, API surface, or mounted-source contract beyond verified pass run 171343304.",
});
delete legacyPath.blocker;
legacyPath.evidence = replaceInlineEvidence(legacyPath.evidence, [runEvidenceEntry, domainArtifactEntry]);

const featurePathEvidence = Array.isArray(featurePath.evidence)
  ? featurePath.evidence.filter((value): value is string => typeof value === "string")
  : [];
featurePath.evidence = uniqueStrings([...featurePathEvidence, runEvidenceId, domainArtifactId]);
featurePath.behavior = [
  {
    variable: "cluster.create.rejected",
    expected: "true",
    observed: "true",
    alignment: "match",
    evidence: [runEvidenceId],
    verdictImpact: "claim",
    note:
      "Exact Azure DevOps run 171343304 exercised the repaired mounted 4-vCPU full-cache negative request and observed RP rejection rather than successful cluster creation.",
  },
  {
    variable: "rp.error.code",
    expected: "FullCacheVMSizeNotInCandidateList",
    observed: "FullCacheVMSizeNotInCandidateList",
    alignment: "match",
    evidence: [runEvidenceId],
    verdictImpact: "claim",
    note:
      "Exact Azure DevOps run 171343304 surfaced the expected mounted negative-boundary rejection code FullCacheVMSizeNotInCandidateList.",
  },
];
Object.assign(featurePath, {
  status: "pass",
  statusReason:
    "Exact Azure DevOps same-path rerun 171343304 supersedes the older stale-carrier contradiction posture. It exercised the repaired mounted 4-vCPU EnableOSDiskFullCaching=true request and returned the expected FullCacheVMSizeNotInCandidateList rejection, so the current truthful posture is pass rather than unknown-with-rerun-gate.",
  summary:
    "Exact same-path Azure DevOps run 171343304 passed the mounted 4-vCPU full-cache negative contract by rejecting the request with FullCacheVMSizeNotInCandidateList.",
  lastRunId: runId,
  lastRunStatus: "pass",
  lastRunDiagnosis: "product_pass",
  updatedAt: now,
  verdict: {
    staging: "pass",
    stagingDate: runDate,
    stagingRunId: runId,
    diagnosis: "product_pass",
    claimsPassed: 2,
    claimsTotal: 2,
    notes:
      "Exact Azure DevOps rerun 171343304 reached the mounted 4-vCPU full-cache negative boundary and observed the expected FullCacheVMSizeNotInCandidateList rejection.",
  },
  stagingVerdict: "pass",
  stagingVerdictClassification: "product_pass",
  stagingVerdictSummary:
    "Exact Azure DevOps rerun 171343304 closed the repaired mounted 4-vCPU full-cache negative boundary with the expected FullCacheVMSizeNotInCandidateList rejection.",
  stagingVerdictRunId: runId,
  stagingVerdictDate: runDate,
  lastRunDate: runDate,
  lastRunAt: reviewRecordedAt,
  notes:
    "Canonical exact contract remains the mounted handwritten 4-vCPU EnableOSDiskFullCaching=true request. Historical Standard_B2s + 256GB evidence remains useful lineage for the stale-carrier contradiction, but exact Azure DevOps run 171343304 is now the governing witness for the maintained path posture.",
  retestCondition:
    "No unchanged rerun is implied. Reopen only if a materially changed build, target, API surface, or contradictory future evidence requires fresher same-path verification beyond Azure DevOps run 171343304.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if an owner requests fresher same-path live verification on a materially changed build, target, API surface, or mounted-source contract beyond verified pass run 171343304.",
  evidenceSummary:
    "Accepted stale-carrier review lineage remains useful history, but the decisive artifact is exact Azure DevOps run 171343304. That same-path rerun proved the canonical mounted 4-vCPU full-cache negative contract by returning FullCacheVMSizeNotInCandidateList, so the maintained posture is product pass.",
  verdictFinal: true,
  classification: "product_pass",
  diagnosisDate: runDate,
  testedAt: reviewRecordedAt,
  blockerNote:
    "None. The previously modeled same-carrier rerun gap is closed by exact Azure DevOps run 171343304.",
  nextAction:
    "No unchanged rerun is implied. Reopen only if a materially changed build, target, API surface, or contradictory future evidence requires fresher same-path verification beyond Azure DevOps run 171343304.",
  ceilingCategory: "none",
  ceilingGate: "",
  terminal: false,
});
if (Array.isArray(featurePath.assertions)) {
  featurePath.assertions = featurePath.assertions.map((assertion) => {
    if (assertion && typeof assertion === "object") {
      return { ...assertion, status: "match" };
    }
    return assertion;
  });
}

const replacementFeatureEvidence = [
  {
    id: runEvidenceId,
    kind: "run-result",
    path: resultPath,
    runId,
    runUrl,
    status: "pass",
    diagnosis: "product_pass",
    timestamp: reviewRecordedAt,
    summary:
      "Exact Azure DevOps same-path rerun 171343304 passed the mounted 4-vCPU full-cache negative contract by returning FullCacheVMSizeNotInCandidateList.",
  },
  {
    id: domainArtifactId,
    kind: "artifact",
    path: domainMemoPath,
    summary:
      "Accepted model/path-summary writeback for the full-cache negative path: preserve stale-carrier history as lineage only and normalize the current maintained posture to pass from exact same-path Azure DevOps run 171343304.",
  },
];
feature.evidence = replaceInlineEvidence(feature.evidence, replacementFeatureEvidence);
Object.assign(feature, {
  status: "pass",
  verdict: "product_pass",
  verdictDetail:
    "Exact Azure DevOps same-path rerun 171343304 exercised the repaired mounted 4-vCPU full-cache negative carrier and returned the expected FullCacheVMSizeNotInCandidateList rejection.",
  lastVerifiedAt: reviewRecordedAt,
  retestCondition: null,
  statusReason:
    "Mounted Scenario_Full_Cache_OsDisk_Negative is now closed by exact Azure DevOps run 171343304. That same-path rerun exercised the repaired 4-vCPU EnableOSDiskFullCaching=true request and returned FullCacheVMSizeNotInCandidateList, so the current feature posture is pass rather than stale product-gap residue.",
  notes:
    "Canonical mounted boundary remains the 4-vCPU EnableOSDiskFullCaching=true rejection path. Historical Standard_B2s + 256GB evidence remains lineage for the stale-carrier contradiction only; exact Azure DevOps run 171343304 is now the governing witness.",
  failureClassification: null,
});

model.updatedAt = now;
writeJson(modelPath, model);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const storageCsiState = compactState.features["storage-csi"];
if (!storageCsiState) {
  throw new Error("Missing storage-csi feature-compact state");
}
if (storageCsiState.taskId !== storageCsiHolderTaskId) {
  throw new Error(
    `storage-csi feature-compact holder drifted: expected ${storageCsiHolderTaskId}, got ${String(storageCsiState.taskId ?? null)}`,
  );
}

updateFeatureCompactItem(compactState, "storage-csi", {
  status: "blocked",
  taskId: storageCsiHolderTaskId,
  frontierTaskIds: Array.isArray(storageCsiState.frontierTaskIds)
    ? storageCsiState.frontierTaskIds
    : [mcrWaitTaskId],
  blockedAt: storageHolderBlocker.blocked_at ?? storageCsiState.blockedAt ?? null,
  blockedReason:
    storageHolderBlocker.condition ?? storageCsiState.blockedReason ?? null,
  waitingFor: (storageHolderBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: storageHolderBlocker.resume_condition ?? null,
  resumeCondition: storageHolderBlocker.resume_condition ?? null,
  observedBy: (storageHolderBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: storageHolderBlocker.observation_method ?? null,
  nextCheckAt: storageHolderBlocker.next_check_at ?? null,
  blockerOwner: storageHolderBlocker.owner ?? storageCsiState.blockerOwner ?? null,
  fallbackAt: storageHolderBlocker.fallback_at ?? null,
  fallbackAction: storageHolderBlocker.fallback_action ?? storageCsiState.fallbackAction ?? null,
  reviewEvidencePath: appMemoPath,
  evidencePaths: uniqueStrings([...(storageCsiState.evidencePaths ?? []), appMemoPath]),
  summary:
    "Refreshed the storage-csi compact-facing residual holder after writing back the exact same-path full-cache pass from Azure DevOps run 171343304 into the domain model. The compact residual frontier remains only spec.storage-csi.csidrivers, spec.storage-csi.file-nfs-unmount-boundary, and spec.storage-csi.mcr-mirror-monitor, with wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702 preserved unchanged as the narrower MCR member wait.",
  lastSummary:
    "Full-cache exact same-path pass run 171343304 is now written back into the domain model/path-summary surfaces, while the compact-facing storage-csi residual frontier remains the exact three-member set headed by the unchanged MCR direct-registry wait.",
  ownerReason:
    "The full-cache exact same-path pass is now represented in domain model/path-summary surfaces, so it remains outside the compact residual frontier. Controller-visible compact state should continue to represent only the accepted three-member residual set: csidrivers, file-nfs-unmount-boundary, and mcr-mirror-monitor, with the existing direct-registry MCR wait preserved unchanged beneath the holder.",
  verificationBlocker:
    "Do not reopen full-cache or create a duplicate wait. Exact Azure DevOps run 171343304 already closes path.storage-csi.full-cache-os-disk-negative; the only remaining storage-csi residual members are csidrivers, file-nfs-unmount-boundary, and mcr-mirror-monitor, with wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702 unchanged as the narrower MCR wait.",
  attemptedFixes: [
    ...(storageCsiState.attemptedFixes ?? []),
    `Wrote back full-cache exact same-path pass run ${runId} into model/knowledge-map/model.json and refreshed controller-visible storage-csi compact evidence pointers during ${now} without changing the existing MCR direct-registry wait.`,
  ],
  lastCheckedAt: now,
});
saveFeatureCompactLoopState(compactStatePath, compactState);

const afterFeaturePath = model.featurePaths?.find((entry) => entry.id === fullCachePathId);
const afterLegacyPath = model.paths?.find((entry) => entry.id === fullCachePathId);
const afterFeature = model.features?.find((entry) => entry.id === fullCacheFeatureId);
const afterCompact = compactState.features["storage-csi"];

console.log(
  JSON.stringify(
    {
      modelPath,
      compactStatePath,
      appMemoPath,
      domainMemoPath,
      specLoopAuthority: {
        specId: fullCacheSpecId,
        status: fullCacheSpec.status,
        successorRunId: fullCacheSpec.successorRunId ?? null,
        successorEvidencePath: fullCacheSpec.successorEvidencePath ?? null,
      },
      legacyPath: {
        status: afterLegacyPath?.status ?? null,
        lastRunId: afterLegacyPath?.lastRunId ?? null,
        verdict: afterLegacyPath?.verdict ?? null,
      },
      featurePath: {
        status: afterFeaturePath?.status ?? null,
        lastRunId: afterFeaturePath?.lastRunId ?? null,
        classification: afterFeaturePath?.classification ?? null,
        nextAction: afterFeaturePath?.nextAction ?? null,
      },
      feature: {
        status: afterFeature?.status ?? null,
        verdict: afterFeature?.verdict ?? null,
      },
      compactState: {
        taskId: afterCompact?.taskId ?? null,
        reviewEvidencePath: afterCompact?.reviewEvidencePath ?? null,
        nextCheckAt: afterCompact?.nextCheckAt ?? null,
      },
      preservedMcrWait: {
        taskId: mcrWaitTaskId,
        state: mcrWait.state ?? null,
        resumeCondition: tree.tasks[mcrWaitTaskId]?.blocker?.resume_condition ?? null,
      },
    },
    null,
    2,
  ),
);
