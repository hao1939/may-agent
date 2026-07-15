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
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";

const attemptId =
  "a_ops-apply-ops-apply-ops-apply-ops-apply-ops-apply-ops-apply-ops-apply-repair-net-integration-multinic-same-run-carrier-r_20260715014642";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();

const consumerTaskId =
  "domain/consume-net-integration-multinic-live-run-172268432-return-20260715";
const holderTaskId = "hold-compact-net-integration-package-partial-frontier";
const featureKey = "net-integration";
const specIds = [
  "spec.net-integration.multinic-dualstack",
  "spec.net-integration.multinic-mixed",
] as const;
const runId = "172268432";
const queueId = "12818";
const appMemoPath =
  "evidence/archive/ops-apply-net-integration-multinic-terminal-reconciliation-20260715.md";
const domainMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-consume-net-integration-multinic-live-run-172268432-return-20260715.md";
const domainWorkerMemoPath =
  "/app/projects/aks-rp-e2e.app/evidence/archive/ops-apply-repair-net-integration-multinic-same-run-carrier-routing-20260715-terminal-artifacts-worker.md";
const appMemoAbsolute = resolve(appDir, appMemoPath);

type MutableRecord = Record<string, unknown>;

type SpecFact = {
  specId: (typeof specIds)[number];
  resultPath: string;
  diagnosisPath: string;
  testPath: string;
  reason: string;
  diagnosis: string;
  resourceGroup: string;
  clusterName: string;
  apiVersion: string;
  kubernetesVersion: string;
  nodeVmSize: string;
};

const specFacts: SpecFact[] = [
  {
    specId: "spec.net-integration.multinic-dualstack",
    resultPath:
      "/app/projects/aks-rp-e2e/workspace/app-ops-consume-net-integration-multinic-run-172268432/20260715T013917Z/slice-01-test-results/runs/test-results/test_20260715011609360_wkrn1j_347832/artifacts/net-integration-multinic-dualstack/spec-runner/result.json",
    diagnosisPath:
      "/app/projects/aks-rp-e2e/workspace/app-ops-consume-net-integration-multinic-run-172268432/20260715T013917Z/slice-01-test-results/runs/test-results/test_20260715011609360_wkrn1j_347832/artifacts/net-integration-multinic-dualstack/spec-runner/diagnosis.json",
    testPath:
      "/app/projects/aks-rp-e2e/workspace/app-ops-consume-net-integration-multinic-run-172268432/20260715T013917Z/slice-01-test-results/runs/test-results/test_20260715011609360_wkrn1j_347832/tests/net-integration-multinic-dualstack.json",
    reason: "Cluster creation failed: HTTP 400; provisioningState=(missing).",
    diagnosis: "inconclusive",
    resourceGroup: "rg-plan-001-9360-wkrn1j-347832",
    clusterName: "aks-plan-001-9360-wkrn1j-347832",
    apiVersion: "2026-03-02-preview",
    kubernetesVersion: "1.34",
    nodeVmSize: "Standard_D2s_v3",
  },
  {
    specId: "spec.net-integration.multinic-mixed",
    resultPath:
      "/app/projects/aks-rp-e2e/workspace/app-ops-consume-net-integration-multinic-run-172268432/20260715T013917Z/slice-01-test-results/runs/test-results/test_20260715011609360_wkrn1j_347832/artifacts/net-integration-multinic-mixed/spec-runner/result.json",
    diagnosisPath:
      "/app/projects/aks-rp-e2e/workspace/app-ops-consume-net-integration-multinic-run-172268432/20260715T013917Z/slice-01-test-results/runs/test-results/test_20260715011609360_wkrn1j_347832/artifacts/net-integration-multinic-mixed/spec-runner/diagnosis.json",
    testPath:
      "/app/projects/aks-rp-e2e/workspace/app-ops-consume-net-integration-multinic-run-172268432/20260715T013917Z/slice-01-test-results/runs/test-results/test_20260715011609360_wkrn1j_347832/tests/net-integration-multinic-mixed.json",
    reason: "Cluster creation failed: HTTP 400; provisioningState=(missing).",
    diagnosis: "inconclusive",
    resourceGroup: "rg-plan-002-9360-wkrn1j-347832",
    clusterName: "aks-plan-002-9360-wkrn1j-347832",
    apiVersion: "2026-03-02-preview",
    kubernetesVersion: "1.34",
    nodeVmSize: "Standard_D2s_v3",
  },
];

function asRecord(value: unknown): MutableRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as MutableRecord) }
    : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeText(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const specState = specLoaded.state;
const specBefore = Object.fromEntries(
  specIds.map((specId) => [specId, clone(specState.specs[specId])]),
) as Record<(typeof specIds)[number], SpecLoopSpecState>;

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const featureBefore = clone(compactState.features[featureKey]);

ensure(featureBefore, `Missing feature row ${featureKey}`);
for (const specId of specIds) {
  ensure(specBefore[specId], `Missing spec row ${specId}`);
}

const featureEvidencePaths = unique([
  ...(featureBefore.evidencePaths ?? []),
  appMemoPath,
  domainMemoPath,
  domainWorkerMemoPath,
]);

for (const fact of specFacts) {
  const before = specBefore[fact.specId];
  const existingReview = asRecord(before.review);
  updateSpecLoopSpec(specState, fact.specId, {
    status: "error",
    taskId: consumerTaskId,
    lastRunId: runId,
    lastResultPath: fact.resultPath,
    review: {
      ...existingReview,
      classification:
        "same_run_terminal_error_consumed_carrier_drift_investigation_required",
      lastRootCause:
        `${fact.specId} consumed Azure DevOps run ${runId} terminal artifacts: status completed, result failed, artifacts plan-inputs + slice-01-test-results, and exact per-spec result ${fact.resultPath} records terminal error \"${fact.reason}\" after resource-group and multinic VNet setup. The returned artifact also shows realized runtime defaults apiVersion=${fact.apiVersion}, kubernetesVersion=${fact.kubernetesVersion}, nodeVmSize=${fact.nodeVmSize} instead of the preserved multinic carrier defaults, so the next truthful successor is bounded carrier/runner drift investigation rather than a same-run wait.`,
      lastAction:
        `Keep ${fact.specId} pointed at ${consumerTaskId} only as the consumed terminal-artifact lineage for run ${runId}; do not wait on ado.pipeline_run.completed and do not queue another unchanged rerun first. Next exact step: one bounded domain investigation of the shared-default runtime drift and the HTTP 400 cluster-create boundary for the multinic pair.`,
      reviewedAt: appliedAt,
      runId,
      queueId,
      adoStatus: "completed",
      adoResult: "failed",
      artifactCount: 2,
      artifactNames: ["plan-inputs", "slice-01-test-results"],
      startTime: "2026-07-15T01:15:36.637675+00:00",
      finishTime: "2026-07-15T01:35:14.424361+00:00",
      lastChangedDate: "2026-07-15T01:35:15.657000+00:00",
      owner: "aks-explorer",
      observer: "app-ops",
      acceptedRunId: runId,
      acceptedResultPath: fact.resultPath,
      acceptedStatus: "error",
      acceptedByTaskId: consumerTaskId,
      acceptedAt: appliedAt,
      resultPath: fact.resultPath,
      diagnosisPath: fact.diagnosisPath,
      testPath: fact.testPath,
      terminalStatus: "error",
      terminalReason: fact.reason,
      diagnosis: fact.diagnosis,
      resourceGroup: fact.resourceGroup,
      clusterName: fact.clusterName,
      apiVersion: fact.apiVersion,
      kubernetesVersion: fact.kubernetesVersion,
      nodeVmSize: fact.nodeVmSize,
      driftInvestigationProposal:
        "Investigate why the bounded multinic run used shared defaults (Standard_D2s_v3, 2026-03-02-preview, 1.34) instead of the preserved carrier defaults, and determine whether that drift caused the HTTP 400 cluster-create failure.",
    },
    successorDisposition:
      "same-run-terminal-error-consumed-carrier-drift-investigation-required",
    successorEvidencePath: appMemoPath,
    successorStateReason:
      `App-owner reconciliation consumed run ${runId} terminal artifacts for ${fact.specId}: completed/failed with exact terminal error \"${fact.reason}\" and realized runtime defaults ${fact.nodeVmSize} / ${fact.apiVersion} / ${fact.kubernetesVersion}, so the stale same-run wait is superseded by one bounded carrier/runner drift investigation successor.`,
    resumeCondition:
      `Resume only when one bounded domain investigation explains, repairs, or truthfully reframes the shared-default runtime drift and HTTP 400 cluster-create boundary for the multinic pair, or when materially new same-surface evidence supersedes run ${runId}. Do not wait on this same ADO run or queue another unchanged rerun first.`,
  });
}

const blockedReason =
  "Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact blocked frontier is the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table-user-assigned-msi node-readiness blocker, and the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none. Exclude spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed from the live ADO wait set because run 172268432 terminal artifacts were consumed into exact terminal error facts under domain/consume-net-integration-multinic-live-run-172268432-return-20260715; the next exact successor for that pair is one bounded domain investigation of shared-default runtime drift plus the HTTP 400 cluster-create boundary, not another same-run wait or duplicate rerun.";

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: featureBefore.errorClass ?? "package-partial",
  taskId: holderTaskId,
  retryable: false,
  retryReason:
    "Resume only when one exact represented frontier materially changes or when the bounded multinic carrier/runner drift investigation returns a truthful successor; do not reopen Azure DevOps run 172268432 as an active same-run wait.",
  ownerReason:
    "All feature-owned specs are already selected into the compact package. The remaining compact blocked frontier stays on hold-compact-net-integration-package-partial-frontier for the BasicLB, cross-subscription VNet, outboundType=none, BYO UDR, custom-route-table-user-assigned-msi, and remaining source-grounded/nonlive multinic-standard plus natgw-v2-migration-v2-to-none surfaces. The multinic dualstack + mixed pair is no longer a live ADO wait: run 172268432 terminal artifacts were consumed into exact terminal error facts, and the next exact successor is one bounded domain investigation of the shared-default runtime drift and HTTP 400 cluster-create failures.",
  attemptedFixes: unique([
    ...(featureBefore.attemptedFixes ?? []),
    `${attemptId}: reconciled the multinic pair away from stale ado.pipeline_run.completed wait wording to consumed terminal error facts from Azure DevOps run 172268432 and recorded the bounded carrier/runner drift investigation successor.`,
  ]),
  nextStepClassification:
    "preserve the reduced exact net-integration blocked frontier while the multinic pair stays represented by consumed terminal error evidence from run 172268432 and one bounded domain carrier/runner drift investigation successor, not an active same-run ADO wait",
  resumeCondition:
    "Resume only when one exact represented blocked surface materially changes (the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis, or accepted live-capable reclassification of multinic-standard plus natgw-v2-migration-v2-to-none), or when the bounded multinic carrier/runner drift investigation returns a truthful successor for the dualstack/mixed pair.",
  blockedAt: featureBefore.blockedAt ?? appliedAt,
  blockedReason,
  waitingFor: {
    type: "domain.investigation.required",
    taskId: consumerTaskId,
    runId,
    specIds: [...specIds],
    reason:
      "terminal artifacts consumed; investigate shared-default runtime drift plus HTTP 400 cluster-create boundary",
  },
  waitingCondition:
    "Azure DevOps run 172268432 is no longer an active wait. The exact multinic pair successor is one bounded domain investigation into why the run realized shared defaults (Standard_D2s_v3, 2026-03-02-preview, 1.34) and whether that drift caused the terminal HTTP 400 cluster-create failures.",
  observedBy: {
    workflow: "project-planner",
    trigger: "project.task.reviewed",
    schedule: "blocked-frontier-app-ops-review",
  },
  observationMethod:
    "Planner/app-ops keeps the net-integration family holder exact while aks-explorer/domain review investigates the consumed multinic terminal error artifacts and either returns a sharper successor or preserves the remaining family wait unchanged.",
  nextCheckAt: null,
  blockerOwner: "aks-explorer",
  fallbackAt: null,
  fallbackAction: null,
  resumeAction:
    "Keep the feature blocked until a represented frontier materially changes or the bounded multinic carrier/runner drift investigation returns a truthful successor.",
  blockedScope: featureBefore.blockedScope ?? {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: featureBefore.blockedFingerprint ?? {
    errorClass: "package-partial",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  lastCheckedAt: appliedAt,
  evidencePaths: featureEvidencePaths,
  reviewEvidencePath: appMemoPath,
  verificationBlocker:
    "Do not restore stale ado.pipeline_run.completed same-run wait wording for spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed. Run 172268432 terminal artifacts were already consumed; the next exact successor is bounded carrier/runner drift investigation, not another wait or duplicate rerun.",
  summary:
    "Refreshed the net-integration compact projection so the multinic dualstack + mixed pair no longer appears as an in-progress same-run ADO wait. Run 172268432 is consumed into exact terminal error facts for both specs, and the next exact successor is one bounded domain investigation of the shared-default runtime drift plus HTTP 400 cluster-create failures.",
  lastSummary:
    "Run 172268432 terminal artifacts were consumed for the multinic pair; the pair is no longer waiting on ado.pipeline_run.completed and now points at one bounded carrier/runner drift investigation successor.",
});

const specMirrorPath = resolve(projectDir, ".state/spec-loop/state.json");
saveSpecLoopState(
  specLoaded.path,
  specState,
  existsSync(specMirrorPath) ? [specMirrorPath] : [],
);
saveFeatureCompactLoopState(compactLoaded.path, compactState);

const specAfter = Object.fromEntries(
  specIds.map((specId) => [specId, clone(specState.specs[specId])]),
) as Record<(typeof specIds)[number], SpecLoopSpecState>;
const featureAfter = clone(compactState.features[featureKey]);

const memo = `# App apply — net-integration multinic terminal reconciliation — 2026-07-15

- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Consumer task: \`${consumerTaskId}\`
- Holder task: \`${holderTaskId}\`
- App spec state: \`.state/spec-loop/state.json\`
- App compact state: \`.state/feature-compact-loop/state.json\`

## Applied evidence sources

- Domain terminal review: \`${domainMemoPath}\`
- Worker mutation packet: \`${domainWorkerMemoPath}\`

## Baseline before apply

### Spec rows
${specIds
  .map((specId) => {
    const before = specBefore[specId];
    const review = asRecord(before.review);
    return `- \`${specId}\`: classification=\`${String(review.classification ?? "(missing)")}\`, adoStatus=\`${String(review.adoStatus ?? "(missing)")}\`, adoResult=\`${String(review.adoResult ?? "(missing)")}\`, successorDisposition=\`${String(before.successorDisposition ?? "(missing)")}\``;
  })
  .join("\n")}

### Feature row
- \`waitingFor.type\` = \`${String(asRecord(featureBefore.waitingFor).type ?? "(missing)")}\`
- \`waitingCondition\` = ${JSON.stringify(featureBefore.waitingCondition ?? null)}
- \`reviewEvidencePath\` = ${JSON.stringify(featureBefore.reviewEvidencePath ?? null)}

## Applied repair

1. Rewrote both multinic spec rows away from \`shared_ado_returned_signal_wait\` / \`adoStatus=inProgress\` to consumed terminal facts for Azure DevOps run \`${runId}\`.
2. Preserved the exact per-spec terminal result paths plus runtime drift facts:
${specFacts
  .map(
    (fact) =>
      `   - \`${fact.specId}\`: result=\`error\`, reason=${JSON.stringify(
        fact.reason,
      )}, apiVersion=\`${fact.apiVersion}\`, kubernetesVersion=\`${fact.kubernetesVersion}\`, nodeVmSize=\`${fact.nodeVmSize}\``,
  )
  .join("\n")}
3. Replaced the feature-compact projection's \`ado.pipeline_run.completed\` wait with a terminal successor pointer to one bounded domain carrier/runner drift investigation.
4. Recorded this app-owner apply memo as the current review evidence path.

## After apply

### Spec rows
${specIds
  .map((specId) => {
    const after = specAfter[specId];
    const review = asRecord(after.review);
    return `- \`${specId}\`: classification=\`${String(review.classification ?? "(missing)")}\`, adoStatus=\`${String(review.adoStatus ?? "(missing)")}\`, adoResult=\`${String(review.adoResult ?? "(missing)")}\`, artifactNames=${JSON.stringify(review.artifactNames ?? null)}, successorDisposition=\`${String(after.successorDisposition ?? "(missing)")}\``;
  })
  .join("\n")}

### Feature row
- \`waitingFor.type\` = \`${String(asRecord(featureAfter.waitingFor).type ?? "(missing)")}\`
- \`waitingCondition\` = ${JSON.stringify(featureAfter.waitingCondition ?? null)}
- \`reviewEvidencePath\` = ${JSON.stringify(featureAfter.reviewEvidencePath ?? null)}

## Exact next successor recorded

> Investigate why the bounded multinic run for \`spec.net-integration.multinic-dualstack\` and \`spec.net-integration.multinic-mixed\` executed with shared plan defaults (\`nodeVmSize=Standard_D2s_v3\`, \`apiVersion=2026-03-02-preview\`, \`kubernetesVersion=1.34\`) instead of the preserved carrier defaults, and determine whether that drift caused the terminal \`HTTP 400; provisioningState=(missing)\` cluster-create errors.
`;

writeText(appMemoAbsolute, memo);
console.log(
  JSON.stringify(
    {
      appliedAt,
      attemptId,
      memoPath: appMemoPath,
      specRows: Object.fromEntries(
        specIds.map((specId) => [
          specId,
          {
            classification: asRecord(specAfter[specId].review).classification,
            adoStatus: asRecord(specAfter[specId].review).adoStatus,
            adoResult: asRecord(specAfter[specId].review).adoResult,
            successorDisposition: specAfter[specId].successorDisposition,
          },
        ]),
      ),
      featureRow: {
        waitingForType: asRecord(featureAfter.waitingFor).type ?? null,
        reviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
        summary: featureAfter.summary ?? null,
      },
    },
    null,
    2,
  ),
);
