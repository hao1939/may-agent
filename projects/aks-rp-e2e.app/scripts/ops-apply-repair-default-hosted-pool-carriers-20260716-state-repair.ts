import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
import {
  readTaskTree,
  withTreeLock,
} from "../workflows/lib/task-tree-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

type JsonRecord = Record<string, unknown>;

type SpecRepair = {
  specId: string;
  lastRunId: string;
  lastRunUrl: string;
  lastResultPath: string;
  review: JsonRecord;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const attemptId =
  process.env.ATTEMPT_ID ??
  "a_ops-apply-repair-default-hosted-pool-carriers-20260716-state-repair_20260716064818";
const appliedAt = new Date().toISOString();

const repairTaskId =
  "ops-apply-repair-default-hosted-pool-carriers-20260716-state-repair";
const evidencePath =
  "evidence/archive/ops-apply-repair-default-hosted-pool-carriers-20260716-state-repair.md";
const evidenceAbsolute = resolve(appDir, evidencePath);
const specMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");

const staleEgressTaskId =
  "domain/publish-egress-lockdown-windows-baseline-visible-20260716";
const liveEgressWaitTaskId =
  "wait-egress-lockdown-windows-baseline-ado-run-172475799-result";
const liveNetIntegrationHolderTaskId =
  "hold-compact-net-integration-package-partial-frontier";
const liveOutboundPublicationTaskId =
  "domain/publish-net-integration-outbound-lb-custom-ip-origin-dev-20260716";
const archivedFiveSpecReviewTaskId =
  "domain/review-net-integration-five-spec-run-172471988-visible-20260716";
const archivedOutboundReviewTaskId =
  "domain/review-net-integration-outbound-lb-custom-ip-run-172471991-visible-20260716";

const egressSpecId = "spec.egress-lockdown.windows-baseline";
const fiveSpecIds = [
  "spec.net-integration.authorized-ip-ranges",
  "spec.net-integration.authorized-service-tags",
  "spec.net-integration.node-public-ip",
  "spec.net-integration.nsg-control",
  "spec.net-integration.outbound-nat-gateway",
] as const;
const outboundLbSpecId = "spec.net-integration.outbound-lb-custom-ip";

const egressFeatureKey = "egress-lockdown";
const netIntegrationFeatureKey = "net-integration";

const domainPublishFiveSpecMemo =
  "/app/projects/aks-rp-e2e/evidence/archive/publish-net-integration-five-spec-origin-dev-20260716.md";
const domainReviewFiveSpecMemo =
  "/app/projects/aks-rp-e2e/evidence/archive/review-net-integration-five-spec-run-172471988-visible-20260716.md";
const domainReviewOutboundMemo =
  "/app/projects/aks-rp-e2e/evidence/archive/review-net-integration-outbound-lb-custom-ip-run-172471991-visible-20260716.md";
const domainPublishOutboundMemo =
  "/app/projects/aks-rp-e2e/evidence/archive/publish-net-integration-outbound-lb-custom-ip-origin-dev-20260716.md";
const domainRepairEgressMemo =
  "/app/projects/aks-rp-e2e/evidence/archive/repair-egress-lockdown-windows-baseline-udr-prereq-contract-20260716.md";

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const treeBefore = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  return {
    liveEgressWait: tree.tasks[liveEgressWaitTaskId],
    liveNetIntegrationHolder: tree.tasks[liveNetIntegrationHolderTaskId],
    liveOutboundPublication: tree.tasks[liveOutboundPublicationTaskId],
    staleEgressPublish: tree.tasks[staleEgressTaskId],
    archivedFiveSpecReview: tree.tasks[archivedFiveSpecReviewTaskId],
    archivedOutboundReview: tree.tasks[archivedOutboundReviewTaskId],
  };
});

assert(treeBefore.liveEgressWait, `Missing live task ${liveEgressWaitTaskId}`);
assert(
  treeBefore.liveNetIntegrationHolder,
  `Missing live task ${liveNetIntegrationHolderTaskId}`,
);
assert(
  !treeBefore.staleEgressPublish,
  `${staleEgressTaskId} unexpectedly became live again`,
);
assert(
  !treeBefore.archivedFiveSpecReview,
  `${archivedFiveSpecReviewTaskId} unexpectedly became live again`,
);
assert(
  !treeBefore.archivedOutboundReview,
  `${archivedOutboundReviewTaskId} unexpectedly became live again`,
);

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const beforeEgress = specLoaded.state.specs[egressSpecId];
const beforeFiveSpec = Object.fromEntries(
  fiveSpecIds.map((specId) => [specId, specLoaded.state.specs[specId]]),
) as Record<(typeof fiveSpecIds)[number], (typeof specLoaded.state.specs)[string]>;
const beforeOutbound = specLoaded.state.specs[outboundLbSpecId];
const beforeEgressFeature = compactLoaded.state.features[egressFeatureKey];
const beforeNetIntegrationFeature =
  compactLoaded.state.features[netIntegrationFeatureKey];

assert(beforeEgress, `Missing spec-loop row ${egressSpecId}`);
assert(beforeOutbound, `Missing spec-loop row ${outboundLbSpecId}`);
for (const specId of fiveSpecIds) {
  assert(beforeFiveSpec[specId], `Missing spec-loop row ${specId}`);
}
assert(beforeEgressFeature, `Missing compact row ${egressFeatureKey}`);
assert(
  beforeNetIntegrationFeature,
  `Missing compact row ${netIntegrationFeatureKey}`,
);

assert(
  beforeEgress.taskId === staleEgressTaskId || beforeEgress.taskId === liveEgressWaitTaskId,
  `Expected ${egressSpecId}.taskId to be either stale ${staleEgressTaskId} or repaired ${liveEgressWaitTaskId}, got ${String(beforeEgress.taskId ?? "null")}`,
);
assert(
  beforeEgress.lastRunId === "172471986" || beforeEgress.lastRunId === "172475799",
  `Expected ${egressSpecId}.lastRunId to be either 172471986 or 172475799, got ${String(beforeEgress.lastRunId ?? "null")}`,
);
for (const specId of fiveSpecIds) {
  assert(
    beforeFiveSpec[specId]?.lastRunId === "172275388" ||
      beforeFiveSpec[specId]?.lastRunId === "172471988",
    `Expected ${specId} to point at either stale compact run 172275388 or repaired run 172471988, got ${String(beforeFiveSpec[specId]?.lastRunId ?? "null")}`,
  );
}
assert(
  beforeOutbound.lastRunId === "172275388" || beforeOutbound.lastRunId === "172471991",
  `Expected ${outboundLbSpecId} to point at either stale compact run 172275388 or repaired run 172471991, got ${String(beforeOutbound.lastRunId ?? "null")}`,
);

const egressWaitBlocker = asRecord(treeBefore.liveEgressWait?.blocker);
const egressWaitingFor = asRecord(egressWaitBlocker.waiting_for);
const egressWaitState = String(
  treeBefore.liveEgressWait?.state ?? treeBefore.liveEgressWait?.status ?? "review-pending",
);
const outboundPublicationTaskState = String(
  treeBefore.liveOutboundPublication?.state ?? "archived-non-live",
);

updateSpecLoopSpec(specLoaded.state, egressSpecId, {
  status: "pending",
  taskId: liveEgressWaitTaskId,
  lastRunId: "172475799",
  lastRunUrl:
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172475799",
  lastResultPath: null,
  lastPrUrl: null,
  lastWorkflowLoopKey: null,
  lastDispatchMetadataPath: null,
  failureClass: null,
  diagnosis: null,
  inputFingerprint: JSON.stringify({
    branch: "aks-explorer/repair-egress-lockdown-windows-baseline-udr-prereq-contract-20260716",
    pipeline: "ado-pipeline-467665",
    specid: egressSpecId,
    target: "staging",
  }),
  errorFingerprint: null,
  review: {
    source: "app-ops-state-repair",
    classification: "accepted_repair_rerun_wait",
    predecessorRunId: "172471986",
    predecessorTaskId: staleEgressTaskId,
    replacedRunId: "172469069",
    activeWaitTaskId: liveEgressWaitTaskId,
    waitRunId: "172475799",
    waitRunUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172475799",
    waitStatus: egressWaitState,
    sourceTaskId:
      "domain/repair-egress-lockdown-windows-baseline-udr-prereq-contract-20260716",
    sourceAttemptId:
      "a_domain_repair-egress-lockdown-windows-baseline-udr-prereq-contract-20260716062611",
    evidencePath,
    prerequisiteEvidencePath: domainRepairEgressMemo,
    lastAction:
      "Advanced the stale wrong-pool repair pointer off archived publication task domain/publish-egress-lockdown-windows-baseline-visible-20260716 and onto the live review wait for rerun 172475799 created by the accepted Windows UDR prerequisite repair lineage.",
    reviewedAt: appliedAt,
  },
  resumeCondition:
    "Resume when wait-egress-lockdown-windows-baseline-ado-run-172475799-result consumes the terminal run 172475799 artifacts into a pass, repair successor, refreshed exact wait, or exact blocker.",
});

const fiveSpecRepairs: SpecRepair[] = [
  {
    specId: "spec.net-integration.authorized-ip-ranges",
    lastRunId: "172471988",
    lastRunUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172471988",
    lastResultPath:
      "/app/projects/aks-rp-e2e/workspace/review-net-integration-five-spec-run-172471988-visible-20260716/20260716T062057Z/download-slice/runs/test-results/test_20260716055957603_yq5vyr_150506/tests/net-integration-authorized-ip-ranges.json",
    review: {
      source: "spec-result-review",
      classification: "replacement_run_reviewed_pass_published_to_dev",
      acceptedRunId: "172471988",
      acceptedStatus: "pass",
      acceptedByTaskId: "domain/publish-net-integration-five-spec-origin-dev-20260716",
      acceptedAt: "2026-07-16T06:41:21.752Z",
      replacementRunId: "172471988",
      replacedRunId: "172469449",
      branch:
        "refs/heads/aks-explorer/normalize-net-integration-five-spec-batch-20260716",
      sourceVersion: "911dc20effeea006a77f5e2fdb92b90d8f25c229",
      evidencePath: domainReviewFiveSpecMemo,
      publicationEvidencePath: domainPublishFiveSpecMemo,
      publishedDevHead: "019241149cd052faf82163777dc1529939f01690",
      lastAction:
        "Reviewed replacement run 172471988 as pass and recorded the accepted publication of the unchanged five-spec lineage into origin/dev without rerun.",
    },
  },
  {
    specId: "spec.net-integration.authorized-service-tags",
    lastRunId: "172471988",
    lastRunUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172471988",
    lastResultPath:
      "/app/projects/aks-rp-e2e/workspace/review-net-integration-five-spec-run-172471988-visible-20260716/20260716T062057Z/download-slice/runs/test-results/test_20260716055957603_yq5vyr_150506/tests/net-integration-authorized-service-tags.json",
    review: {
      source: "spec-result-review",
      classification: "replacement_run_reviewed_pass_published_to_dev",
      acceptedRunId: "172471988",
      acceptedStatus: "pass",
      acceptedByTaskId: "domain/publish-net-integration-five-spec-origin-dev-20260716",
      acceptedAt: "2026-07-16T06:41:21.752Z",
      replacementRunId: "172471988",
      replacedRunId: "172469449",
      branch:
        "refs/heads/aks-explorer/normalize-net-integration-five-spec-batch-20260716",
      sourceVersion: "911dc20effeea006a77f5e2fdb92b90d8f25c229",
      evidencePath: domainReviewFiveSpecMemo,
      publicationEvidencePath: domainPublishFiveSpecMemo,
      publishedDevHead: "019241149cd052faf82163777dc1529939f01690",
      lastAction:
        "Reviewed replacement run 172471988 as pass and recorded the accepted publication of the unchanged five-spec lineage into origin/dev without rerun.",
    },
  },
  {
    specId: "spec.net-integration.node-public-ip",
    lastRunId: "172471988",
    lastRunUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172471988",
    lastResultPath:
      "/app/projects/aks-rp-e2e/workspace/review-net-integration-five-spec-run-172471988-visible-20260716/20260716T062057Z/download-slice/runs/test-results/test_20260716055957603_yq5vyr_150506/tests/net-integration-node-public-ip.json",
    review: {
      source: "spec-result-review",
      classification: "replacement_run_reviewed_pass_published_to_dev",
      acceptedRunId: "172471988",
      acceptedStatus: "pass",
      acceptedByTaskId: "domain/publish-net-integration-five-spec-origin-dev-20260716",
      acceptedAt: "2026-07-16T06:41:21.752Z",
      replacementRunId: "172471988",
      replacedRunId: "172469449",
      branch:
        "refs/heads/aks-explorer/normalize-net-integration-five-spec-batch-20260716",
      sourceVersion: "911dc20effeea006a77f5e2fdb92b90d8f25c229",
      evidencePath: domainReviewFiveSpecMemo,
      publicationEvidencePath: domainPublishFiveSpecMemo,
      publishedDevHead: "019241149cd052faf82163777dc1529939f01690",
      lastAction:
        "Reviewed replacement run 172471988 as pass and recorded the accepted publication of the unchanged five-spec lineage into origin/dev without rerun.",
    },
  },
  {
    specId: "spec.net-integration.nsg-control",
    lastRunId: "172471988",
    lastRunUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172471988",
    lastResultPath:
      "/app/projects/aks-rp-e2e/workspace/review-net-integration-five-spec-run-172471988-visible-20260716/20260716T062057Z/download-slice/runs/test-results/test_20260716055957603_yq5vyr_150506/tests/net-integration-nsg-control.json",
    review: {
      source: "spec-result-review",
      classification: "replacement_run_reviewed_pass_published_to_dev",
      acceptedRunId: "172471988",
      acceptedStatus: "pass",
      acceptedByTaskId: "domain/publish-net-integration-five-spec-origin-dev-20260716",
      acceptedAt: "2026-07-16T06:41:21.752Z",
      replacementRunId: "172471988",
      replacedRunId: "172469449",
      branch:
        "refs/heads/aks-explorer/normalize-net-integration-five-spec-batch-20260716",
      sourceVersion: "911dc20effeea006a77f5e2fdb92b90d8f25c229",
      evidencePath: domainReviewFiveSpecMemo,
      publicationEvidencePath: domainPublishFiveSpecMemo,
      publishedDevHead: "019241149cd052faf82163777dc1529939f01690",
      lastAction:
        "Reviewed replacement run 172471988 as pass and recorded the accepted publication of the unchanged five-spec lineage into origin/dev without rerun.",
    },
  },
  {
    specId: "spec.net-integration.outbound-nat-gateway",
    lastRunId: "172471988",
    lastRunUrl:
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172471988",
    lastResultPath:
      "/app/projects/aks-rp-e2e/workspace/review-net-integration-five-spec-run-172471988-visible-20260716/20260716T062057Z/download-slice/runs/test-results/test_20260716055957603_yq5vyr_150506/tests/net-integration-outbound-nat-gateway.json",
    review: {
      source: "spec-result-review",
      classification: "replacement_run_reviewed_pass_published_to_dev",
      acceptedRunId: "172471988",
      acceptedStatus: "pass",
      acceptedByTaskId: "domain/publish-net-integration-five-spec-origin-dev-20260716",
      acceptedAt: "2026-07-16T06:41:21.752Z",
      replacementRunId: "172471988",
      replacedRunId: "172469449",
      branch:
        "refs/heads/aks-explorer/normalize-net-integration-five-spec-batch-20260716",
      sourceVersion: "911dc20effeea006a77f5e2fdb92b90d8f25c229",
      evidencePath: domainReviewFiveSpecMemo,
      publicationEvidencePath: domainPublishFiveSpecMemo,
      publishedDevHead: "019241149cd052faf82163777dc1529939f01690",
      lastAction:
        "Reviewed replacement run 172471988 as pass and recorded the accepted publication of the unchanged five-spec lineage into origin/dev without rerun.",
    },
  },
];

for (const repair of fiveSpecRepairs) {
  updateSpecLoopSpec(specLoaded.state, repair.specId, {
    status: "pass",
    taskId: liveNetIntegrationHolderTaskId,
    lastRunId: repair.lastRunId,
    lastRunUrl: repair.lastRunUrl,
    lastResultPath: repair.lastResultPath,
    lastPrUrl: null,
    lastWorkflowLoopKey: null,
    lastDispatchMetadataPath: null,
    failureClass: null,
    diagnosis: null,
    inputFingerprint: null,
    errorFingerprint: null,
    review: repair.review,
  });
}

updateSpecLoopSpec(specLoaded.state, outboundLbSpecId, {
  status: "pass",
  taskId: liveNetIntegrationHolderTaskId,
  lastRunId: "172471991",
  lastRunUrl:
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172471991",
  lastResultPath:
    "/app/projects/aks-rp-e2e/workspace/domain-review-net-integration-outbound-lb-custom-ip-run-172471991-visible-20260716/20260716T063737Z/download/runs/test-results/test_20260716055958365_ygn2on_236453/tests/net-integration-outbound-lb-custom-ip.json",
  lastPrUrl: null,
  lastWorkflowLoopKey: null,
  lastDispatchMetadataPath: null,
  failureClass: null,
  diagnosis: null,
  inputFingerprint: null,
  errorFingerprint: null,
  review: {
    source: "spec-result-review",
    classification: "replacement_run_reviewed_pass_no_rerun",
    acceptedRunId: "172471991",
    acceptedStatus: "pass",
    acceptedByTaskId: archivedOutboundReviewTaskId,
    acceptedAt: "2026-07-16T06:40:38.071Z",
    replacementRunId: "172471991",
    replacedRunId: "172469979",
    branch:
      "refs/heads/aks-explorer/rebuild-net-integration-outbound-lb-custom-ip-clean-carrier-rerun-20260716",
    sourceVersion: "f7d88f285fdbfa6e5b01856507c4038ea9676d5f",
    evidencePath: domainReviewOutboundMemo,
    publicationEvidencePath: domainPublishOutboundMemo,
    publicationTaskId: liveOutboundPublicationTaskId,
    publicationTaskState: outboundPublicationTaskState,
    lastAction:
      "Replaced the stale wrong-pool wait lineage with the exact terminal artifact review for run 172471991; no further rerun is represented by this repair.",
  },
});

saveSpecLoopState(
  specLoaded.path,
  specLoaded.state,
  existsSync(specMirrorPath) ? [specMirrorPath] : [],
);

updateFeatureCompactItem(compactLoaded.state, egressFeatureKey, {
  reviewEvidencePath: evidencePath,
  evidencePaths: unique([
    ...asStringArray(beforeEgressFeature.evidencePaths),
    evidencePath,
    domainRepairEgressMemo,
  ]),
  attemptedFixes: [
    ...(Array.isArray(beforeEgressFeature.attemptedFixes)
      ? beforeEgressFeature.attemptedFixes.filter(
          (item): item is string => typeof item === "string" && Boolean(item.trim()),
        )
      : []),
    `${appliedAt}: app-ops repaired stale wrong-pool-carrier drift for ${egressSpecId} by repointing spec-loop state from archived task ${staleEgressTaskId} / run 172471986 to live review wait ${liveEgressWaitTaskId} for rerun 172475799 created by the accepted Windows UDR prerequisite repair lineage.`,
  ],
  summary:
    "Current compact egress-lockdown frontier still remains FIPS/shared-auth, but the wrong-pool windows-baseline carrier is no longer represented by archived publication task domain/publish-egress-lockdown-windows-baseline-visible-20260716: spec-loop now follows live wait-egress-lockdown-windows-baseline-ado-run-172475799-result after the accepted UDR prerequisite repair queued rerun 172475799.",
  lastCheckedAt: appliedAt,
});

updateFeatureCompactItem(compactLoaded.state, netIntegrationFeatureKey, {
  reviewEvidencePath: evidencePath,
  evidencePaths: unique([
    ...asStringArray(beforeNetIntegrationFeature.evidencePaths),
    evidencePath,
    domainReviewFiveSpecMemo,
    domainPublishFiveSpecMemo,
    domainReviewOutboundMemo,
    domainPublishOutboundMemo,
  ]),
  attemptedFixes: [
    ...(Array.isArray(beforeNetIntegrationFeature.attemptedFixes)
      ? beforeNetIntegrationFeature.attemptedFixes.filter(
          (item): item is string => typeof item === "string" && Boolean(item.trim()),
        )
      : []),
    `${appliedAt}: app-ops repaired stale replacement-carrier metadata so the five-spec clean-batch replacement run 172471988 is recorded as reviewed pass plus accepted origin/dev publication, and spec.net-integration.outbound-lb-custom-ip is recorded from exact terminal review run 172471991 instead of the older compact batch residue.`,
  ],
  summary:
    "Current compact net-integration frontier remains the held MultiNIC/package-partial family only; outside that frontier, the five-spec wrong-pool replacement batch was reviewed pass on run 172471988 and published to origin/dev, and spec.net-integration.outbound-lb-custom-ip is represented by the exact terminal review of replacement run 172471991 rather than the stale canceled-wait lineage.",
  lastCheckedAt: appliedAt,
});

saveFeatureCompactLoopState(compactLoaded.path, compactLoaded.state);

const beforeFiveSpecRunIds = unique(
  fiveSpecIds.map((specId) => String(beforeFiveSpec[specId]?.lastRunId ?? "null")),
);

const afterSpecLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const afterCompactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const afterTree = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  return {
    liveEgressWait: tree.tasks[liveEgressWaitTaskId],
    liveNetIntegrationHolder: tree.tasks[liveNetIntegrationHolderTaskId],
    liveOutboundPublication: tree.tasks[liveOutboundPublicationTaskId],
    staleEgressPublish: tree.tasks[staleEgressTaskId],
  };
});

const afterEgress = afterSpecLoaded.state.specs[egressSpecId];
const afterOutbound = afterSpecLoaded.state.specs[outboundLbSpecId];
const afterEgressFeature = afterCompactLoaded.state.features[egressFeatureKey];
const afterNetIntegrationFeature =
  afterCompactLoaded.state.features[netIntegrationFeatureKey];

assert(afterEgress, `Missing repaired row ${egressSpecId}`);
assert(afterOutbound, `Missing repaired row ${outboundLbSpecId}`);
assert(afterEgressFeature, `Missing repaired compact row ${egressFeatureKey}`);
assert(
  afterNetIntegrationFeature,
  `Missing repaired compact row ${netIntegrationFeatureKey}`,
);
assert(
  afterEgress.taskId === liveEgressWaitTaskId,
  `Expected ${egressSpecId}.taskId=${liveEgressWaitTaskId}, got ${String(afterEgress.taskId ?? "null")}`,
);
assert(
  afterEgress.lastRunId === "172475799",
  `Expected ${egressSpecId}.lastRunId=172475799, got ${String(afterEgress.lastRunId ?? "null")}`,
);
for (const specId of fiveSpecIds) {
  const row = afterSpecLoaded.state.specs[specId];
  assert(row?.lastRunId === "172471988", `Expected ${specId}.lastRunId=172471988`);
  assert(
    row?.taskId === liveNetIntegrationHolderTaskId,
    `Expected ${specId}.taskId=${liveNetIntegrationHolderTaskId}`,
  );
}
assert(
  afterOutbound.lastRunId === "172471991",
  `Expected ${outboundLbSpecId}.lastRunId=172471991, got ${String(afterOutbound.lastRunId ?? "null")}`,
);
assert(
  !afterTree.staleEgressPublish,
  `${staleEgressTaskId} unexpectedly became live after repair`,
);

const memo = `# App apply — canonical-holder parity repair refresh — 2026-07-16

- Task: \`${repairTaskId}\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`

## Why this retry was needed

The original app repair memo captured the first wrong-pool retarget, but the live branch moved again before this retry:

- \`${egressSpecId}\` still pointed at archived task \`${staleEgressTaskId}\` and stale run \`172471986\` even though the accepted Windows UDR-prerequisite repair had already created live review wait \`${liveEgressWaitTaskId}\` for rerun \`172475799\`.
- The five-spec net-integration slice still advertised old compact run \`172275388\` in spec-loop state even though replacement run \`172471988\` was reviewed pass and then published into \`origin/dev\`.
- \`${outboundLbSpecId}\` still advertised old compact run \`172275388\` even though replacement run \`172471991\` already had an exact terminal artifact review and a same-lineage publication task \`${liveOutboundPublicationTaskId}\` had already been created on that branch.

## Supported task-tree reads used for this repair

- \`bun run task-tree show ${liveEgressWaitTaskId}\`
- \`bun run task-tree show ${liveNetIntegrationHolderTaskId}\`
- \`bun run task-tree show ${liveOutboundPublicationTaskId}\` when the publication task is still live, otherwise \`Task not found\` after archive/review completion
- \`bun run task-tree show ${staleEgressTaskId}\` → \`Task not found\` (archived/non-live)
- \`bun run task-tree show ${archivedFiveSpecReviewTaskId}\` → \`Task not found\` (archived/non-live)
- \`bun run task-tree show ${archivedOutboundReviewTaskId}\` → \`Task not found\` (archived/non-live)

## State observed at this invocation

This repair script is idempotent. On a fresh retry it may still catch the stale pre-repair values described above; on a verification rerun it will instead show the already-repaired state while preserving the same canonical-holder evidence.

### Spec-loop rows seen when this script started

- \`${egressSpecId}\`: taskId \`${String(beforeEgress.taskId ?? "null")}\`, lastRunId \`${String(beforeEgress.lastRunId ?? "null")}\`
- five-spec net-integration rows opened this invocation with lastRunId set(s) ${JSON.stringify(beforeFiveSpecRunIds)}
- \`${outboundLbSpecId}\`: taskId \`${String(beforeOutbound.taskId ?? "null")}\`, lastRunId \`${String(beforeOutbound.lastRunId ?? "null")}\`

### Task-tree anchors observed at this invocation

- live egress review wait: \`${liveEgressWaitTaskId}\`
- live net-integration holder: \`${liveNetIntegrationHolderTaskId}\`
- outbound publication lineage task \`${liveOutboundPublicationTaskId}\`: state seen by this invocation = \`${outboundPublicationTaskState}\`

## Applied loop-state repair

### 1) Egress state pointer advanced to the live wait

Updated app-owned \`.state/spec-loop/state.json\` so \`${egressSpecId}\` now follows the live review wait created by the accepted UDR-prerequisite repair lineage:

- taskId: \`${String(beforeEgress.taskId ?? "null")}\` → \`${String(afterEgress.taskId ?? "null")}\`
- lastRunId: \`${String(beforeEgress.lastRunId ?? "null")}\` → \`${String(afterEgress.lastRunId ?? "null")}\`
- lastRunUrl: \`${String(beforeEgress.lastRunUrl ?? "null")}\` → \`${String(afterEgress.lastRunUrl ?? "null")}\`

This preserves the original wrong-pool replacement lineage (\`172469069 → 172471986\`) while keeping the controller-visible spec pointer aligned with the current live next step (review wait for rerun \`172475799\`).

### 2) Five-spec net-integration replacement batch normalized to the reviewed/published lineage

Updated these five rows from stale compact run \`172275388\` to reviewed replacement run \`172471988\` with exact per-spec result paths and accepted publication evidence from \`${domainPublishFiveSpecMemo}\`:

- \`${fiveSpecIds[0]}\`
- \`${fiveSpecIds[1]}\`
- \`${fiveSpecIds[2]}\`
- \`${fiveSpecIds[3]}\`
- \`${fiveSpecIds[4]}\`

Each row now keeps the live net-integration holder \`${liveNetIntegrationHolderTaskId}\` as its taskId while recording:

- replacement run \`172471988\`
- replaced wrong-pool run \`172469449\`
- branch \`aks-explorer/normalize-net-integration-five-spec-batch-20260716@911dc20effeea006a77f5e2fdb92b90d8f25c229\`
- accepted publication to \`origin/dev\` head \`019241149cd052faf82163777dc1529939f01690\`

### 3) Outbound LB custom IP normalized to the exact terminal review lineage

Updated \`${outboundLbSpecId}\` from stale compact run \`172275388\` to exact reviewed replacement run \`172471991\` with per-spec result path from \`${domainReviewOutboundMemo}\`.

The row keeps live net-integration holder \`${liveNetIntegrationHolderTaskId}\` as taskId while recording:

- replacement run \`172471991\`
- replaced wrong-pool run \`172469979\`
- exact terminal review memo \`${domainReviewOutboundMemo}\`
- same-lineage publication task \`${liveOutboundPublicationTaskId}\` (state observed by this invocation: \`${outboundPublicationTaskState}\`)

## Feature-compact state refresh

Updated controller-visible compact summaries/evidence pointers without changing the actual compact blockers:

- \`${egressFeatureKey}\` reviewEvidencePath now points to this current attempt memo and its summary no longer claims archived task \`${staleEgressTaskId}\` is the active holder.
- \`${netIntegrationFeatureKey}\` reviewEvidencePath now points to this current attempt memo and its summary now explicitly names the reviewed/published five-spec lineage and the reviewed outbound-lb lineage as non-frontier history.

## Acceptance check

- App-owned task-tree or loop-state repair applied through supported app mechanisms: satisfied via \`workflows/lib/spec-loop-store.ts\` and \`workflows/lib/feature-compact-loop-store.ts\`.
- The affected branch records the exact restored holder, state pointer, or refreshed wait with evidence: satisfied by live wait \`${liveEgressWaitTaskId}\`, live holder \`${liveNetIntegrationHolderTaskId}\`, recorded outbound publication lineage task \`${liveOutboundPublicationTaskId}\` with state \`${outboundPublicationTaskState}\`, the repaired app-owned loop state files, and this memo.
`;

writeText(evidenceAbsolute, `${memo}\n`);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      evidencePath,
      egress: {
        taskId: afterEgress.taskId,
        lastRunId: afterEgress.lastRunId,
        resumeCondition: afterEgress.resumeCondition,
      },
      fiveSpecLastRunIds: Object.fromEntries(
        fiveSpecIds.map((specId) => [
          specId,
          afterSpecLoaded.state.specs[specId]?.lastRunId ?? null,
        ]),
      ),
      outbound: {
        taskId: afterOutbound.taskId,
        lastRunId: afterOutbound.lastRunId,
        lastResultPath: afterOutbound.lastResultPath,
      },
      compactRows: {
        egress: {
          reviewEvidencePath: afterEgressFeature.reviewEvidencePath,
          summary: afterEgressFeature.summary,
        },
        netIntegration: {
          reviewEvidencePath: afterNetIntegrationFeature.reviewEvidencePath,
          summary: afterNetIntegrationFeature.summary,
        },
      },
    },
    null,
    2,
  ),
);
