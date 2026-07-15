import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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

type JsonRecord = Record<string, unknown>;

type PathSummaryItem = {
  id?: string;
  status?: string;
  verdictFinal?: boolean;
  retestCondition?: string;
  blockerNote?: string;
};

const attemptId =
  "a_ops-apply-reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residu_20260714172226";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();

const specId = "spec.vpa.cert-renewal-runtime";
const staleTaskId = "verify-spec-vpa-cert-renewal-runtime";
const staleRunId = "28348086962";
const featureKey = "workload-autoscaler";
const compactTaskId = "hold-compact-workload-autoscaler-package-partial-frontier";
const memoRelative =
  "evidence/archive/ops-apply-reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residue-20260714.md";
const memoAbsolute = resolve(appDir, memoRelative);
const domainEvidenceAbsolute =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residue-20260714.md";
const compactEvidenceRelative =
  "../aks-rp-e2e/evidence/archive/domain-reconcile-spec-loop-vpa-cert-renewal-runtime-stale-pass-residue-20260714.md";

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

const specStateLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const specState = specStateLoaded.state;
const beforeSpec = specState.specs[specId];
if (!beforeSpec) {
  throw new Error(`Missing spec-loop row ${specId}`);
}
if (beforeSpec.status !== "pass") {
  throw new Error(`Expected ${specId}.status=pass; found ${beforeSpec.status}`);
}
if (beforeSpec.taskId !== staleTaskId) {
  throw new Error(
    `Expected ${specId}.taskId=${staleTaskId}; found ${beforeSpec.taskId ?? "null"}`,
  );
}
if (beforeSpec.lastRunId !== staleRunId) {
  throw new Error(
    `Expected ${specId}.lastRunId=${staleRunId}; found ${beforeSpec.lastRunId ?? "null"}`,
  );
}

const specFilePath = resolve(
  projectDir,
  "features/workload-autoscaler/specs/vpa-cert-renewal-runtime.json",
);
const domainSpec = readJson<JsonRecord>(specFilePath);
if (domainSpec.status !== "blocked") {
  throw new Error(
    `Expected domain spec status blocked; found ${String(domainSpec.status ?? "null")}`,
  );
}

const pathSummaryPath = resolve(
  projectDir,
  "model/knowledge-map/views/path-summary.json",
);
const pathSummarySource = readJson<unknown>(pathSummaryPath);
const pathSummaryItems = Array.isArray(pathSummarySource)
  ? pathSummarySource
  : (asRecord(pathSummarySource).items as unknown[]) ??
    (asRecord(pathSummarySource).paths as unknown[]) ??
    [];
const pathSummary = (pathSummaryItems as unknown[])
  .map((item) => asRecord(item) as PathSummaryItem)
  .find(
    (item) =>
      item.id ===
      "path.vpa-cert-renewal.source-equivalent-cronjob.blocked-reconciler",
  );
if (!pathSummary) {
  throw new Error("Missing VPA cert-renewal path-summary item");
}
if (pathSummary.status !== "blocked") {
  throw new Error(
    `Expected path-summary blocked; found ${String(pathSummary.status ?? "null")}`,
  );
}
if (pathSummary.verdictFinal !== true) {
  throw new Error(
    `Expected path-summary verdictFinal=true; found ${String(pathSummary.verdictFinal ?? "null")}`,
  );
}

const topLevelResultPath = resolve(
  appDir,
  ".state/spec-loop/artifacts/28348086962/aks-rp-e2e-28348086962-spec-test-results/test-results/single-vpa-cert-renewal-runtime_254203/result.json",
);
const runnerResultPath = resolve(
  appDir,
  ".state/spec-loop/artifacts/28348086962/aks-rp-e2e-28348086962-spec-test-results/test-results/single-vpa-cert-renewal-runtime_254203/artifacts/vpa-cert-renewal-runtime/spec-runner/result.json",
);
const modelProposalPath = resolve(
  appDir,
  ".state/spec-loop/artifacts/28348086962/aks-rp-e2e-28348086962-spec-test-results/test-results/single-vpa-cert-renewal-runtime_254203/artifacts/vpa-cert-renewal-runtime/spec-runner/model-proposal.json",
);

const topLevelResult = readJson<JsonRecord>(topLevelResultPath);
const runnerResult = readJson<JsonRecord>(runnerResultPath);
const modelProposal = readJson<JsonRecord>(modelProposalPath);
const runnerStdout = String(runnerResult.stdout ?? "");
if (String(topLevelResult.status ?? "") !== "passed") {
  throw new Error(
    `Expected top-level archived result passed; found ${String(topLevelResult.status ?? "null")}`,
  );
}
if (!runnerStdout.includes("Blocked: Environment preflight failed. local: az account show failed")) {
  throw new Error("Expected archived runner stdout to include preflight blocker");
}
const proposalOps = Array.isArray(asRecord(modelProposal.changes).featurePathUpdates)
  ? ((asRecord(modelProposal.changes).featurePathUpdates as unknown[]) ?? []).map(
      (entry) => asRecord(entry),
    )
  : [];
const passProposal = proposalOps.find(
  (operation) =>
    operation.pathId ===
      "path.vpa-cert-renewal.source-equivalent-cronjob.blocked-reconciler" &&
    operation.newStatus === "pass",
);
if (!passProposal) {
  throw new Error("Expected archived model proposal to contain the stale pass recommendation");
}

updateSpecLoopSpec(specState, specId, {
  status: "pending",
  taskId: null,
  review: {
    classification: "source_equivalent_evidence_ceiling",
    lastRootCause:
      "Archived run 28348086962 never produced harvested source-equivalent cert-renewal assertions; its visible pass was fallback classifier residue while scenario stdout recorded 'Blocked: Environment preflight failed. local: az account show failed.' Accepted packet/spec/model authority still keeps the CronJob/manual-Job branch blocked.",
    lastAction:
      "Keep pending under the accepted source-equivalent evidence ceiling bundle, leave the compact holder unchanged, do not apply the archived pass-shaped model proposal, and do not rerun unchanged.",
    reviewedAt: checkedAt,
  },
  successorDisposition: "source-equivalent-evidence-ceiling",
  successorEvidencePath: memoAbsolute,
  successorStateReason:
    "Archived run 28348086962 was fallback pass residue: the wrapper surfaces reported 'Scenario test completed without parsed artifact summary,' but the scenario stdout says 'Blocked: Environment preflight failed. local: az account show failed.' Current packet/spec/model authority still preserves the CronJob-gated source-equivalent branch as blocked, so this spec should surface pending evidence-ceiling review rather than pass.",
  resumeCondition:
    "Resume only when a target build or environment exposes CronJob kube-system/vpa-webhook-tls-reconciler for the accepted source-equivalent branch, or accepted source authority explicitly declares legacy overlay-vpa-cert-webhook-check equivalent for this exact path. Do not rerun unchanged.",
  catalogStatus: beforeSpec.catalogStatus ?? "blocked",
  catalogSpecState: beforeSpec.catalogSpecState ?? "ready",
  terminalDisposition: false,
});

const afterSpecRecord = specState.specs[specId] as JsonRecord;
afterSpecRecord.normalizedFromStatus = beforeSpec.status;
afterSpecRecord.normalizedAt = checkedAt;

const mirrorSpecLoopPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specStateLoaded.path,
  specState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);
const afterSpec = specState.specs[specId];

const compactStateLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactStateLoaded.state;
const beforeFeature = compactState.features[featureKey];
if (!beforeFeature) {
  throw new Error(`Missing feature-compact row ${featureKey}`);
}
if (beforeFeature.status !== "blocked") {
  throw new Error(
    `Expected feature ${featureKey} to remain blocked; found ${beforeFeature.status}`,
  );
}
if (beforeFeature.taskId !== compactTaskId) {
  throw new Error(
    `Expected feature ${featureKey}.taskId=${compactTaskId}; found ${beforeFeature.taskId ?? "null"}`,
  );
}

updateFeatureCompactItem(compactState, featureKey, {
  evidencePaths: unique([
    ...(Array.isArray(beforeFeature.evidencePaths) ? beforeFeature.evidencePaths : []),
    memoRelative,
    compactEvidenceRelative,
  ]),
  lastCheckedAt: checkedAt,
});
saveFeatureCompactLoopState(compactStateLoaded.path, compactState);
const afterFeature = compactState.features[featureKey];

const memoBody = `# App state repair — spec-loop VPA cert-renewal stale pass residue

- Attempt: ${attemptId}
- Applied at: ${checkedAt}
- Supported mechanism: app-local TypeScript repair script using spec-loop/feature-compact store helpers (no hand-edited JSON)
- Spec: ${specId}
- Feature compact holder preserved: ${compactTaskId}
- Domain evidence authority: ${domainEvidenceAbsolute}

## Repair result

Normalized the controller-visible spec-loop row for \`${specId}\` away from stale pass/run \`${staleRunId}\` residue.

Applied changes:

- changed spec-loop \`status\` from \`pass\` to \`pending\`
- cleared stale spec-loop \`taskId\` \`${staleTaskId}\`
- preserved blocked catalog posture plus explicit evidence-ceiling reasoning
- preserved the no-unchanged-rerun resume condition
- left workload-autoscaler compact holder \`${compactTaskId}\` blocked and unchanged, adding only this audit memo to compact evidence paths

Not changed:

- no cloud rerun
- no packet/spec/model rewrite
- no application of the archived run's pass-shaped model proposal

## Before spec-loop row

\`\`\`json
${JSON.stringify(
  {
    status: beforeSpec.status,
    taskId: beforeSpec.taskId,
    lastRunId: beforeSpec.lastRunId,
    catalogStatus: beforeSpec.catalogStatus ?? null,
    catalogSpecState: beforeSpec.catalogSpecState ?? null,
    review: beforeSpec.review ?? null,
  },
  null,
  2,
)}
\`\`\`

## After spec-loop row

\`\`\`json
${JSON.stringify(
  {
    status: afterSpec.status,
    taskId: afterSpec.taskId ?? null,
    lastRunId: afterSpec.lastRunId,
    catalogStatus: afterSpec.catalogStatus ?? null,
    catalogSpecState: afterSpec.catalogSpecState ?? null,
    successorDisposition: afterSpec.successorDisposition ?? null,
    successorEvidencePath: afterSpec.successorEvidencePath ?? null,
    successorStateReason: afterSpec.successorStateReason ?? null,
    resumeCondition: afterSpec.resumeCondition ?? null,
    review: afterSpec.review ?? null,
    normalizedFromStatus: (afterSpec as unknown as JsonRecord).normalizedFromStatus ?? null,
    normalizedAt: (afterSpec as unknown as JsonRecord).normalizedAt ?? null,
  },
  null,
  2,
)}
\`\`\`

## Stale pass residue facts preserved

- archived top-level result status: \`${String(topLevelResult.status ?? "null")}\`
- archived runner stdout includes: \`Blocked: Environment preflight failed. local: az account show failed\`
- archived model proposal still recommends \`path.vpa-cert-renewal.source-equivalent-cronjob.blocked-reconciler -> pass\` and remains unapplied

## Authority that remains blocked

### Domain spec

\`\`\`json
${JSON.stringify(
  {
    id: domainSpec.id ?? null,
    status: domainSpec.status ?? null,
    specState: domainSpec.specState ?? null,
    notes: domainSpec.notes ?? null,
  },
  null,
  2,
)}
\`\`\`

### Path summary

\`\`\`json
${JSON.stringify(pathSummary, null, 2)}
\`\`\`

## Feature compact row after audit trail refresh

\`\`\`json
${JSON.stringify(
  {
    status: afterFeature?.status ?? null,
    taskId: afterFeature?.taskId ?? null,
    frontierTaskIds: afterFeature?.frontierTaskIds ?? null,
    retryReason: afterFeature?.retryReason ?? null,
    resumeCondition: afterFeature?.resumeCondition ?? null,
    reviewEvidencePath: afterFeature?.reviewEvidencePath ?? null,
    evidencePaths: afterFeature?.evidencePaths ?? null,
    lastCheckedAt: afterFeature?.lastCheckedAt ?? null,
  },
  null,
  2,
)}
\`\`\`

## Bottom line

The app-owned spec-loop row no longer advertises run \`${staleRunId}\` as a truthful pass or keeps the nonexistent active holder \`${staleTaskId}\`. The accepted source-equivalent blocked ceiling remains authoritative, packet/spec/model stay blocked, workload-autoscaler compact stays on the same blocked holder, and no cloud rerun was performed.
`;
writeText(memoAbsolute, memoBody);

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      memoPath: memoAbsolute,
      specStatePath: specStateLoaded.path,
      mirrorSpecLoopPath: existsSync(mirrorSpecLoopPath) ? mirrorSpecLoopPath : null,
      featureCompactStatePath: compactStateLoaded.path,
      beforeSpec: {
        status: beforeSpec.status,
        taskId: beforeSpec.taskId,
        lastRunId: beforeSpec.lastRunId,
      },
      afterSpec: {
        status: afterSpec.status,
        taskId: afterSpec.taskId ?? null,
        lastRunId: afterSpec.lastRunId,
        successorDisposition: afterSpec.successorDisposition ?? null,
      },
      afterFeature: {
        status: afterFeature?.status ?? null,
        taskId: afterFeature?.taskId ?? null,
        lastCheckedAt: afterFeature?.lastCheckedAt ?? null,
      },
    },
    null,
    2,
  ),
);
