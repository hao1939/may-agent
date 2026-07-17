import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type SpecSnapshot = {
  status: string | null;
  taskId: string | null;
  lastRunId: string | null;
  lastRunUrl: string | null;
  lastResultPath: string | null;
  diagnosis: string | null;
  inputFingerprint: string | null;
  errorFingerprint: string | null;
  successorDisposition: string | null;
  successorEvidencePath: string | null;
  successorStateReason: string | null;
  resumeCondition: string | null;
  review: JsonRecord | null;
};

type CompactSnapshot = {
  status: string | null;
  taskId: string | null;
  frontierTaskIds: string[] | null;
  retryReason: string | null;
  ownerReason: string | null;
  blockedReason: string | null;
  waitingForTaskId: string | null;
  waitingCondition: string | null;
  nextCheckAt: string | null;
  fallbackAt: string | null;
  fallbackAction: string | null;
  reviewEvidencePath: string | null;
  summary: string | null;
};

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717-state-repair_20260717033521";
const appliedAt = new Date().toISOString();
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const specLoopTaskId = "aks-spec-verification-loop";
const compactLoopTaskId = "aks-feature-compact-loop";
const publicCarrierTaskId = "reconcile-spec-loop-pending-rp-regional-quota";
const reviewedPublicationTaskId =
  "domain/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717";
const publicSpecId = "spec.rp-regional-quota.public-create-path";
const featureKey = "rp-regional-quota";
const runId = "172614503";
const runUrl =
  "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172614503";
const acceptedResultPath =
  "/app/projects/aks-rp-e2e/workspace/review-rp-regional-quota-public-create-path-run-172614503/20260717T0307Z/slice-01-test-results/runs/test-results/test_20260717020554418_ix39ht_645868/tests/rp-regional-quota-public-create-path.json";
const domainEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717.md";
const appEvidenceRelative =
  "evidence/archive/ops-apply-reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717-state-repair.md";
const appEvidencePath = resolve(appDir, appEvidenceRelative);
const specStatePath = resolve(appDir, ".state/spec-loop/state.json");
const specMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
const compactStatePath = resolve(appDir, ".state/feature-compact-loop/state.json");
const compactMirrorPath = resolve(projectDir, ".state/feature-compact-loop/state.json");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as JsonRecord) } as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map((entry) => (typeof entry === "string" && entry.trim() ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function snapshotSpec(spec: SpecLoopSpecState | undefined): SpecSnapshot {
  const review = asRecord(spec?.review);
  return {
    status: asString(spec?.status),
    taskId: asString(spec?.taskId),
    lastRunId: asString(spec?.lastRunId),
    lastRunUrl: asString(spec?.lastRunUrl),
    lastResultPath: asString(spec?.lastResultPath),
    diagnosis: asString(spec?.diagnosis),
    inputFingerprint: asString(spec?.inputFingerprint),
    errorFingerprint: asString(spec?.errorFingerprint),
    successorDisposition: asString(spec?.successorDisposition),
    successorEvidencePath: asString(spec?.successorEvidencePath),
    successorStateReason: asString(spec?.successorStateReason),
    resumeCondition: asString(spec?.resumeCondition),
    review: Object.keys(review).length > 0 ? review : null,
  };
}

function snapshotCompact(item: FeatureCompactItemState | undefined): CompactSnapshot {
  return {
    status: asString(item?.status),
    taskId: asString(item?.taskId),
    frontierTaskIds: asStringArray(item?.frontierTaskIds),
    retryReason: asString(item?.retryReason),
    ownerReason: asString(item?.ownerReason),
    blockedReason: asString(item?.blockedReason),
    waitingForTaskId: asString(asRecord(item?.waitingFor).taskId),
    waitingCondition: asString(item?.waitingCondition),
    nextCheckAt: asString(item?.nextCheckAt),
    fallbackAt: asString(item?.fallbackAt),
    fallbackAction: asString(item?.fallbackAction),
    reviewEvidencePath: asString(item?.reviewEvidencePath),
    summary: asString(item?.summary),
  };
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content}\n`, "utf-8");
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

const tree = readTaskTree(config);
const carrierTask = tree.tasks[publicCarrierTaskId];
assert(carrierTask, `Expected live task ${publicCarrierTaskId}`);
const reviewedTask = tree.tasks[reviewedPublicationTaskId];
const reviewedTaskState = reviewedTask ? String(reviewedTask.state ?? "") : "archived-or-absent";
const blocker = asRecord(carrierTask.blocker);
const blockerCondition = asString(blocker.condition) ?? "";
assert(
  !blockerCondition.includes(`current live same-spec companion follow-up is ${reviewedPublicationTaskId}`),
  `Live blocker still treats ${reviewedPublicationTaskId} as the current same-spec companion`,
);
assert(
  blockerCondition.includes(runId),
  `Live blocker does not mention refreshed run ${runId}`,
);
const resumeCondition =
  asString(blocker.resume_condition) ??
  "Resume only when the same staging subscription+region is again exhausted enough for the decisive managedClusters PUT quota-negative assertion, or when one reviewed same-surface exhausted target or other bounded source-equivalent successor is accepted for this exact carrier.";
const nextCheckAt = asString(blocker.next_check_at) ?? appliedAt;
const fallbackAt = asString(blocker.fallback_at) ?? appliedAt;
const fallbackAction =
  asString(blocker.fallback_action) ??
  "If no reviewed same-surface exhaustion proof appears by the refreshed review window, refresh only this exact exhausted-target wait from current quota/headroom evidence; do not rerun unchanged, do not reopen run 172614503 as a second live carrier, and do not collapse this wait into the shared westus2 capacity family.";

const specLoopLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});
const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 5,
  refreshFromProject: false,
});

const specBefore = specLoopLoaded.state.specs[publicSpecId];
const compactBefore = compactLoaded.state.features[featureKey];
assert(specBefore, `Missing spec-loop row ${publicSpecId}`);
assert(compactBefore, `Missing feature-compact row ${featureKey}`);

const beforeSpecSnapshot = snapshotSpec(specBefore);
const beforeCompactSnapshot = snapshotCompact(compactBefore);

const diagnosis =
  "Accepted Azure DevOps run 172614503 repeated the same preflight.target-usage 40/161 environment blocker on the unpublished normalized .test.ts lineage; the checked-in .ts carrier is now the explicit publication backport and the exact live wait remains reconcile-spec-loop-pending-rp-regional-quota.";
const inputFingerprint =
  "public-create-path: accepted run 172614503 executed features/rp-regional-quota/tests/rp-regional-quota-public-create-path.test.ts on sourceVersion 3367198b60c308dd1616b0906d3d5b6b00b27b27, while the checked-in features/rp-regional-quota/tests/rp-regional-quota-public-create-path.ts is the explicit publication backport for the same reviewed 40/161 verdict.";
const errorFingerprint =
  "public-create-path: missing-file-preflight on run 172334217 -> target-usage-exhausted 40/161 on run 172346097 -> same target-usage-exhausted 40/161 repeated on accepted run 172614503 publication-backport lineage.";
const successorStateReason =
  "Accepted run 172614503 reviewed the same public quota-negative carrier, repeated the same preflight.target-usage 40/161 environment blocker, and then backported that verdict onto the checked-in .ts publication surface without reopening a duplicate rerun. The truthful live frontier remains reconcile-spec-loop-pending-rp-regional-quota.";

updateSpecLoopSpec(specLoopLoaded.state, publicSpecId, {
  status: "pending",
  taskId: publicCarrierTaskId,
  lastRunId: runId,
  lastRunUrl: runUrl,
  lastResultPath: acceptedResultPath,
  diagnosis,
  inputFingerprint,
  errorFingerprint,
  successorDisposition: "accepted_same_surface_environment_wait",
  successorEvidencePath: domainEvidencePath,
  successorStateReason,
  resumeCondition,
  review: {
    classification: "accepted_same_surface_environment_wait",
    lastRootCause:
      "Accepted run 172614503 confirms the repo-local publication surface is no longer the limiting factor: the same public carrier reached live Azure preflight on the unpublished normalized lineage and stopped again because westus2 managedClusters usage was only 40/161, so the decisive quota-negative create assertion was not reached.",
    lastAction:
      "Refresh spec.rp-regional-quota.public-create-path onto reconcile-spec-loop-pending-rp-regional-quota using the accepted run 172614503 publication-backport lineage, remove the stale non-RP task pointer, and preserve one exact blocked carrier with no duplicate rerun.",
    reviewedAt: appliedAt,
    acceptedRunId: runId,
    acceptedResultPath,
    acceptedStatus: "error",
    acceptedByTaskId:
      "ops-apply-reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717-state-repair",
    acceptedAt: appliedAt,
  },
});

const compactRetryReason =
  "Resume only when reconcile-spec-loop-pending-rp-regional-quota changes the accepted public frontier after reviewed run 172614503, or when the compact live-ready filter contract itself materially changes.";
const compactOwnerReason =
  "Compact package still has one truthful active frontier (spec.rp-regional-quota.public-create-path). Accepted run 172614503 repeated the same 40/161 environment blocker on the unpublished normalized .test.ts lineage, and the checked-in .ts carrier now serves only as the publication backport for that verdict. The frontier is already represented by reconcile-spec-loop-pending-rp-regional-quota; no duplicate compact rerun or stale publication companion remains live.";
const compactBlockedReason =
  "Compact package excludes superseded raw-file lineage spec.rp-regional-quota.multi-cluster-source-equivalent; the only active compact frontier is spec.rp-regional-quota.public-create-path, and accepted run 172614503 preserved the same exact westus2 exhausted-target wait on reconcile-spec-loop-pending-rp-regional-quota via the checked-in publication backport.";

updateFeatureCompactItem(compactLoaded.state, featureKey, {
  status: "blocked",
  errorClass: "compact-error",
  retryable: false,
  retryReason: compactRetryReason,
  taskId: publicCarrierTaskId,
  frontierTaskIds: [publicCarrierTaskId],
  ownerReason: compactOwnerReason,
  nextStepClassification: "accepted-environment-blocked-frontier",
  blockedReason: compactBlockedReason,
  waitingFor: {
    type: "blocker.resolved",
    taskId: publicCarrierTaskId,
  },
  waitingCondition: compactRetryReason,
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction,
  resumeAction:
    "Reset this feature compact record to pending only after reconcile-spec-loop-pending-rp-regional-quota is replaced or unblocked by a changed public frontier.",
  lastCheckedAt: appliedAt,
  evidencePaths: uniqueStrings([
    ...(compactBefore.evidencePaths ?? []),
    appEvidenceRelative,
  ]),
  reviewEvidencePath: appEvidenceRelative,
  summary:
    "Accepted run 172614503 publication-backport repeated the same 40/161 environment blocker, so the compact package stays blocked only behind reconcile-spec-loop-pending-rp-regional-quota.",
});

saveSpecLoopState(specStatePath, specLoopLoaded.state, [specMirrorPath]);
saveFeatureCompactLoopState(compactStatePath, compactLoaded.state);
saveFeatureCompactLoopState(compactMirrorPath, compactLoaded.state);

const specAfter = specLoopLoaded.state.specs[publicSpecId];
const compactAfter = compactLoaded.state.features[featureKey];
const afterSpecSnapshot = snapshotSpec(specAfter);
const afterCompactSnapshot = snapshotCompact(compactAfter);

writeText(
  appEvidencePath,
  `# App apply: reconcile rp-regional-quota publication-surface state repair — 2026-07-17

- Task: \`ops-apply-reconcile-rp-regional-quota-publication-surface-after-run-172614503-20260717-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Live task-tree carrier: \`${publicCarrierTaskId}\`
- Reviewed closed publication task: \`${reviewedPublicationTaskId}\` (live tree state at apply time: \`${reviewedTaskState}\`)

## Scope

Applied the bounded app-owned repair requested by the accepted review:

1. refreshed the live blocked wait on \`${publicCarrierTaskId}\` so it records run \`${runId}\` and no longer names the closed publication-surface task as a current live companion;
2. rewrote the app-owned spec-loop row for \`${publicSpecId}\` onto the live blocked carrier with accepted run \`${runId}\` result pointers; and
3. refreshed the compact projection for \`${featureKey}\` so it points only at the live blocked carrier instead of stale holder metadata.

No runtime events were emitted. No raw runtime JSON was hand-edited.

## Baseline snapshots

### Spec-loop before

\`\`\`json
${formatJson(beforeSpecSnapshot)}
\`\`\`

### Feature-compact before

\`\`\`json
${formatJson(beforeCompactSnapshot)}
\`\`\`

## Applied loop-state writeback

### Spec-loop after

\`\`\`json
${formatJson(afterSpecSnapshot)}
\`\`\`

### Feature-compact after

\`\`\`json
${formatJson(afterCompactSnapshot)}
\`\`\`

## Verification checklist

1. \`${publicSpecId}.taskId\` now equals \`${publicCarrierTaskId}\`.
2. \`${publicSpecId}.lastRunId\` now equals \`${runId}\` and \`lastResultPath\` points to the accepted same-run artifact review.
3. \`${publicSpecId}.review.acceptedByTaskId\` now points to this repair task instead of unrelated private-cluster repair residue.
4. \`${featureKey}.taskId\` and \`frontierTaskIds\` now point only at \`${publicCarrierTaskId}\`.
5. \`${featureKey}.reviewEvidencePath\` now points to \`${appEvidenceRelative}\` and no stale compact-holder task id remains in the live compact row.
6. The live task-tree blocker for \`${publicCarrierTaskId}\` no longer treats \`${reviewedPublicationTaskId}\` as the current live same-spec companion and does contain run \`${runId}\`.

## Reviewer verification commands

Run fresh:

- \`bun run task-tree show ${publicCarrierTaskId}\`
- \`python3 - <<'PY'\nimport json\nfrom pathlib import Path\nstate=json.loads(Path('${specStatePath}').read_text())\nprint(json.dumps(state['specs']['${publicSpecId}'], indent=2))\nPY\`
- \`python3 - <<'PY'\nimport json\nfrom pathlib import Path\nstate=json.loads(Path('${compactStatePath}').read_text())\nprint(json.dumps(state['features']['${featureKey}'], indent=2))\nPY\`
`
);

console.log(
  JSON.stringify(
    {
      appliedAt,
      attemptId,
      specBefore: beforeSpecSnapshot,
      specAfter: afterSpecSnapshot,
      compactBefore: beforeCompactSnapshot,
      compactAfter: afterCompactSnapshot,
      nextCheckAt,
      fallbackAt,
      appEvidenceRelative,
    },
    null,
    2,
  ),
);
