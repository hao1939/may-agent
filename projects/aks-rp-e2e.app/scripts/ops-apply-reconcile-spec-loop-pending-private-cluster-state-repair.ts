import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
import { readTask, taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

type JsonRecord = Record<string, unknown>;

type SpecSnapshot = {
  status: string | null;
  taskId: string | null;
  lastRunId: string | null;
  lastRunUrl: string | null;
  lastResultPath: string | null;
  successorDisposition: string | null;
  successorEvidencePath: string | null;
  successorStateReason: string | null;
  resumeCondition: string | null;
  retryResetAt: string | null;
  retryResetByTaskId: string | null;
  retryResetReason: string | null;
  review: JsonRecord | null;
};

type CompactSnapshot = {
  status: string | null;
  taskId: string | null;
  frontierTaskIds: string[] | null;
  nextStepClassification: string | null;
  resumeCondition: string | null;
  waitingForTaskId: string | null;
  waitingCondition: string | null;
  verificationBlocker: string | null;
  summary: string | null;
  reviewEvidencePath: string | null;
};

const attemptId =
  "a_ops-apply-reconcile-spec-loop-pending-private-cluster-state-repair_20260717025639";
const appliedAt = new Date().toISOString();
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const loopTaskId = "aks-spec-verification-loop";
const featureCompactLoopTaskId = "aks-feature-compact-loop";
const evidencePath = resolve(
  appDir,
  "evidence/archive/ops-apply-reconcile-spec-loop-pending-private-cluster-state-repair-20260717.md",
);
const mirrorSpecLoopPath = resolve(projectDir, ".state/spec-loop/state.json");
const successorTaskId =
  "domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716";
const successorEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-refresh-private-cluster-update-private-result-contract-frontier-20260716.md";
const reconciliationEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/reconcile-spec-loop-pending-private-cluster-20260717.md";

const preservedWaitTaskIds = {
  egress:
    "hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707",
  jumpbox: "wait-private-cluster-jumpbox-key-execution-surface-return-20260704",
  sharedAuth: "hold-spec-shared-authenticated-artifact-result-recovery-family-20260714",
  nonlive:
    "hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707",
} as const;

const specIds = {
  egress: "spec.private-cluster.egress-outboundtype",
  privateEndpoint:
    "spec.private-cluster.private-endpoint-connections-lifecycle",
  privateLink: "spec.private-cluster.privatelink-create.k8s-validation",
  sharedApiserver:
    "spec.private-cluster.vnet-integration-shared-apiserver-subnet",
  updatePrivate: "spec.private-cluster.vnet-integration-update-private",
  updatePrivateSecondHop:
    "spec.private-cluster.vnet-integration-update-private-second-hop",
  updatePublicSecondHop:
    "spec.private-cluster.vnet-integration-update-public-second-hop",
} as const;

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
  const items = value
    .map((entry) => (typeof entry === "string" && entry.trim() ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
  return items.length > 0 ? items : [];
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
    successorDisposition: asString(spec?.successorDisposition),
    successorEvidencePath: asString(spec?.successorEvidencePath),
    successorStateReason: asString(spec?.successorStateReason),
    resumeCondition: asString(spec?.resumeCondition),
    retryResetAt: asString(spec?.retryResetAt),
    retryResetByTaskId: asString(spec?.retryResetByTaskId),
    retryResetReason: asString(spec?.retryResetReason),
    review: Object.keys(review).length > 0 ? review : null,
  };
}

function snapshotCompact(item: FeatureCompactItemState | undefined): CompactSnapshot {
  return {
    status: asString(item?.status),
    taskId: asString(item?.taskId),
    frontierTaskIds: asStringArray(item?.frontierTaskIds),
    nextStepClassification: asString(item?.nextStepClassification),
    resumeCondition: asString(item?.resumeCondition),
    waitingForTaskId: asString(asRecord(item?.waitingFor).taskId),
    waitingCondition: asString(item?.waitingCondition),
    verificationBlocker: asString(item?.verificationBlocker),
    summary: asString(item?.summary),
    reviewEvidencePath: asString(item?.reviewEvidencePath),
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
for (const taskId of Object.values(preservedWaitTaskIds)) {
  assert(tree.tasks[taskId], `Required live holder missing: ${taskId}`);
}
assert(
  !tree.tasks[
    "hold-spec-private-cluster-update-private-empty-aggregate-result-contract-frontier-20260711"
  ],
  "Retired update-private holder unexpectedly exists live again",
);
const successorTask = readTask(config, successorTaskId);
assert(successorTask, `Expected successor task ${successorTaskId} to exist before state writeback`);

const specLoopLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 5,
});
const featureCompactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: featureCompactLoopTaskId,
  windowSize: 5,
  refreshFromProject: false,
});

const privateEndpointBefore = specLoopLoaded.state.specs[specIds.privateEndpoint];
const updatePrivateBefore = specLoopLoaded.state.specs[specIds.updatePrivate];
const compactBefore = featureCompactLoaded.state.features["private-cluster"];

assert(privateEndpointBefore, `Missing spec-loop row ${specIds.privateEndpoint}`);
assert(updatePrivateBefore, `Missing spec-loop row ${specIds.updatePrivate}`);
assert(compactBefore, "Missing feature-compact row private-cluster");
assert(
  (privateEndpointBefore.status === "pending" &&
    privateEndpointBefore.lastRunId === "172513872") ||
    (privateEndpointBefore.status === "pass" &&
      privateEndpointBefore.lastRunId === "172544012"),
  `Expected ${specIds.privateEndpoint} to be either the pre-repair pending row or the repaired pass row`,
);
assert(
  updatePrivateBefore.taskId ===
    "hold-spec-private-cluster-update-private-empty-aggregate-result-contract-frontier-20260711" ||
    updatePrivateBefore.taskId === successorTaskId,
  `Expected ${specIds.updatePrivate}.taskId to reference either the retired holder or the exact successor`,
);

const specSnapshotsBefore = Object.fromEntries(
  Object.values(specIds).map((specId) => [
    specId,
    snapshotSpec(specLoopLoaded.state.specs[specId]),
  ]),
);
const compactSnapshotBefore = snapshotCompact(compactBefore);

updateSpecLoopSpec(specLoopLoaded.state, specIds.privateEndpoint, {
  status: "pass",
  taskId: null,
  lastRunId: "172544012",
  lastRunUrl:
    "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172544012",
  lastResultPath:
    "workspace/reconcile-normalization-overdue-ado-results-20260717/20260717T022647Z/172544012-download/runs/test-results/test_20260716171937597_kwrak7_152086/tests/private-cluster-private-endpoint-connections-lifecycle.json",
  successorDisposition: "exact_ado_pass_recovered_same_path",
  successorEvidencePath: reconciliationEvidencePath,
  successorStateReason:
    "Exact same-spec ADO rerun 172544012 on the repaired private-endpoint-connections request shape passed end to end, so the prior pending fix-forward lineage from failing run 172513872 is now resolved to pass rather than an open rerun wait.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if a materially changed private-endpoint-connections lifecycle carrier later needs fresh live verification beyond exact ADO pass run 172544012.",
  review: {
    classification: "exact_ado_pass_recovered_same_path",
    lastRootCause:
      "The prior pending frontier was a test-code request-shape bug: run 172513872 failed when the approve/reject step sent a cloned privateEndpointConnection body and the repaired ADO rerun 172544012 passed after narrowing the request body to properties.privateLinkServiceConnectionState.",
    lastAction:
      "Normalize spec.private-cluster.private-endpoint-connections-lifecycle from pending to pass on exact ADO run 172544012 and clear the stale fix-forward task pointer from failing run 172513872.",
    reviewedAt: appliedAt,
    acceptedRunId: "172544012",
    acceptedResultPath:
      "workspace/reconcile-normalization-overdue-ado-results-20260717/20260717T022647Z/172544012-download/runs/test-results/test_20260716171937597_kwrak7_152086/tests/private-cluster-private-endpoint-connections-lifecycle.json",
    acceptedStatus: "pass",
    acceptedByTaskId:
      "ops-apply-reconcile-spec-loop-pending-private-cluster-state-repair",
    acceptedAt: appliedAt,
  },
});

updateSpecLoopSpec(specLoopLoaded.state, specIds.updatePrivate, {
  status: "pending",
  taskId: successorTaskId,
  lastRunId: "28409398347",
  lastRunUrl:
    "https://github.com/azure-management-and-platforms/aks-rp-e2e/actions/runs/28409398347",
  lastResultPath:
    "/app/projects/aks-rp-e2e.app/.state/spec-loop/artifacts/28409398347/aks-rp-e2e-28409398347-spec-test-results/test-results/single-private-cluster-vnet-integration-update-private_647036/result.json",
  successorDisposition: "exact_timeout_review_successor",
  successorEvidencePath: successorEvidencePath,
  successorStateReason:
    "The retired 28391585887 empty-aggregate holder is only historical lineage now that same-spec run 28409398347 has a top-level result contract plus exact child timeout evidence. The truthful current frontier is one narrower review successor for that exact 75-minute timeout bundle.",
  resumeCondition:
    "Resume only through domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716 or a reviewed same-lineage replacement that is sharper than run 28409398347. Do not reopen an unchanged rerun from historical 28391585887 empty-aggregate residue alone.",
  review: {
    ...asRecord(updatePrivateBefore.review),
    classification: "exact_timeout_review_successor",
    lastRootCause:
      "Run 28391585887 remains truthful only as historical shared aggregation/publication/result-contract debt. A newer exact same-spec bundle for run 28409398347 now exists locally with top-level specResults[0] plus child evidence showing a 75-minute enableVnetIntegration timeout, so the old empty-aggregate holder is no longer the controlling frontier.",
    lastAction:
      "Rebind spec.private-cluster.vnet-integration-update-private from the retired 20260711 empty-aggregate holder to exact review successor domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716 and preserve run 28391585887 only as historical lineage.",
    reviewedAt: appliedAt,
    pendingReviewReason:
      "sharper exact timeout-review successor replaces the retired empty-aggregate holder",
    pendingReviewTaskId: successorTaskId,
    pendingReviewRunId: "28409398347",
    pendingReviewObservedAt: appliedAt,
  },
});

saveSpecLoopState(
  specLoopLoaded.path,
  specLoopLoaded.state,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const compactEvidencePaths = uniqueStrings([
  ...(compactBefore.evidencePaths ?? []),
  evidencePath,
]);
updateFeatureCompactItem(featureCompactLoaded.state, "private-cluster", {
  status: compactBefore.status,
  taskId: compactBefore.taskId,
  frontierTaskIds: [
    preservedWaitTaskIds.egress,
    preservedWaitTaskIds.jumpbox,
    preservedWaitTaskIds.sharedAuth,
    successorTaskId,
    preservedWaitTaskIds.nonlive,
  ],
  nextStepClassification:
    "preserve the represented mixed frontier, keep the BYO UDR, jumpbox-key, shared-auth artifact/result, and intentional nonlive branches on their exact waits, and route spec.private-cluster.vnet-integration-update-private through the sharper exact run-28409398347 timeout review successor instead of the retired empty-aggregate holder.",
  resumeCondition:
    "Resume only when accepted evidence or owner action changes one of the actual remaining residual surfaces: the exact BYO UDR prerequisite wait resolves for spec.private-cluster.egress-outboundtype; the jumpbox-key execution surface returns or is equivalently replaced for spec.private-cluster.privatelink-create.k8s-validation; hold-spec-shared-authenticated-artifact-result-recovery-family-20260714 resolves or splits back out the private-cluster same-run pair; domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716 reaches a reviewed exact classification or a sharper same-lineage successor; an owner-approved bounded reopen changes the nonlive contract for spec.private-cluster.vnet-integration-update-private-second-hop; or superseded rows spec.private-cluster.dns-zone-none or spec.private-cluster.dns-zone-system are intentionally removed or rehomed. Do not resume based on historical runs 28700532873 or 28391585887 alone.",
  waitingCondition:
    "Resume only when one exact represented downstream carrier materially changes: the BYO UDR prerequisite carrier resolves or is reclassified for spec.private-cluster.egress-outboundtype; the jumpbox-key execution surface returns, is equivalently replaced, or receives a reviewed decline/reroute for spec.private-cluster.privatelink-create.k8s-validation; hold-spec-shared-authenticated-artifact-result-recovery-family-20260714 resolves, narrows to a private-cluster-only replacement, or yields a reviewed same-lineage split-back-out for the shared-auth same-run pair; domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716 reaches a reviewed exact classification or a sharper same-lineage replacement; an owner-approved bounded reopen changes the nonlive contract for spec.private-cluster.vnet-integration-update-private-second-hop; or superseded dns-zone-none/dns-zone-system residue is intentionally removed or rehomed. Do not resume based on historical runs 28700532873 or 28391585887 alone.",
  verificationBlocker:
    "Do not rerun unchanged. hold-spec-shared-authenticated-artifact-result-recovery-family-20260714 still carries the shared-auth same-run visibility pair for runs 28840446579 and 28671841561, hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707 and wait-private-cluster-jumpbox-key-execution-surface-return-20260704 remain unresolved, hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707 remains the intentional nonlive boundary, and spec.private-cluster.vnet-integration-update-private now routes through exact review successor domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716 rather than the retired 20260711 empty-aggregate holder.",
  summary:
    "Applied the private-cluster pending-family writeback: normalized private-endpoint-connections lifecycle to exact ADO pass run 172544012, preserved the five exact wait/nonlive/artifact-gap frontiers without retry reset, and replaced the stale update-private empty-aggregate residue with exact review successor domain/review-private-cluster-update-private-run-28409398347-timeout-frontier-20260716.",
  reviewEvidencePath: evidencePath,
  evidencePaths: compactEvidencePaths,
  lastCheckedAt: appliedAt,
});
saveFeatureCompactLoopState(featureCompactLoaded.path, featureCompactLoaded.state);

const specSnapshotsAfter = Object.fromEntries(
  Object.values(specIds).map((specId) => [
    specId,
    snapshotSpec(specLoopLoaded.state.specs[specId]),
  ]),
);
const compactSnapshotAfter = snapshotCompact(
  featureCompactLoaded.state.features["private-cluster"],
);

const memo = `# App apply: reconcile spec-loop pending private-cluster state repair — 2026-07-17

- Task: \`ops-apply-reconcile-spec-loop-pending-private-cluster-state-repair\`
- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`

## Decisions applied

1. Created or confirmed the exact successor task \`${successorTaskId}\` for run \`28409398347\` so \`${specIds.updatePrivate}\` no longer points at retired holder \`hold-spec-private-cluster-update-private-empty-aggregate-result-contract-frontier-20260711\`.
2. Normalized \`${specIds.privateEndpoint}\` from pending/fix-forward wait to pass on exact ADO run \`172544012\` using the controller-visible result path from the accepted reconciliation memo.
3. Preserved the remaining five exact private-cluster waits/nonlive/artifact-gap frontiers without any retry reset:
   - \`${specIds.egress}\` -> \`${preservedWaitTaskIds.egress}\`
   - \`${specIds.privateLink}\` -> \`${preservedWaitTaskIds.jumpbox}\`
   - \`${specIds.sharedApiserver}\` -> \`${preservedWaitTaskIds.sharedAuth}\`
   - \`${specIds.updatePrivateSecondHop}\` -> \`${preservedWaitTaskIds.nonlive}\`
   - \`${specIds.updatePublicSecondHop}\` -> \`${preservedWaitTaskIds.sharedAuth}\`
4. Rewrote the app-owned private-cluster compact projection so its frontier pointers now include the jumpbox-key wait and the new exact update-private review successor, keeping the mixed frontier truthful after the spec-loop/task-tree repair.

## Successor task proof

\`\`\`json
${formatJson({
  id: successorTask?.id ?? null,
  state: successorTask?.state ?? null,
  parent_id: successorTask?.parent_id ?? null,
  owner: successorTask?.owner ?? null,
  goal: successorTask?.goal ?? null,
})}
\`\`\`

## Spec-loop snapshots

### Before
\`\`\`json
${formatJson(specSnapshotsBefore)}
\`\`\`

### After
\`\`\`json
${formatJson(specSnapshotsAfter)}
\`\`\`

## Feature-compact private-cluster projection

### Before
\`\`\`json
${formatJson(compactSnapshotBefore)}
\`\`\`

### After
\`\`\`json
${formatJson(compactSnapshotAfter)}
\`\`\`

## Verification notes

- \`${specIds.privateEndpoint}\` is now \`pass\` with \`lastRunId=172544012\`, \`taskId=null\`, and the exact ADO result path from the accepted reconciliation evidence.
- \`${specIds.updatePrivate}\` is now rebound to \`${successorTaskId}\` with \`lastRunId=28409398347\` and the exact top-level result-contract path for that run.
- The preserved five non-pass rows still keep \`retryResetAt=null\`, \`retryResetByTaskId=null\`, and \`retryResetReason=null\`.
- \`private-cluster.frontierTaskIds\` now names all five surviving exact downstream carriers for the mixed feature frontier: BYO UDR wait, jumpbox-key wait, shared-auth family carrier, exact update-private review successor, and intentional nonlive second-hop holder.
`;

writeText(evidencePath, memo);

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      successorTaskId,
      evidencePath,
      specSnapshotsBefore,
      specSnapshotsAfter,
      compactSnapshotBefore,
      compactSnapshotAfter,
    },
    null,
    2,
  ),
);
