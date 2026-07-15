import { existsSync } from "node:fs";
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

const compactTaskId = "hold-compact-net-integration-package-partial-frontier";
const followupTaskId =
  "domain/queue-net-integration-multinic-live-rerun-slice-20260715";
const memoRelative =
  "evidence/archive/ops-apply-reconcile-net-integration-multinic-holder-vs-model-20260715-st.md";
const memoAbsolute = `${appDir}/${memoRelative}`;
const domainMemoAbsolute =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-net-integration-multinic-holder-vs-model-20260715.md";

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});

const specPatches = [
  {
    specId: "spec.net-integration.multinic-dualstack",
    review: {
      classification:
        "implemented_mutation_gated_live_carrier_pending_bounded_rerun",
      lastRootCause:
        "Current repo-local spec/test carrier, private-source policy, live-admission policy, and local --check validation now prove spec.net-integration.multinic-dualstack is an implemented mutation-gated live carrier. The stale spec-loop nonlive/source-grounded wording still reflects the older run-single-spec lane, not the current bounded compact rerun truth.",
      lastAction:
        `Represent this spec under ${followupTaskId} as pending exact bounded live rerun evidence. Do not route it back through the old run-single-spec nonlive lane or mark it consumed before an exact gated execute run or exact capacity blocker is recorded.`,
      reviewedAt: checkedAt,
    },
    successorDisposition: "implemented-mutation-gated-live-rerun-pending",
    successorStateReason:
      `Accepted 2026-07-15 multinic reconciliation now shows the exact dual-stack carrier exists, passes private-source/live-admission policy, and passes local --check validation. The truthful controller-visible next step is the bounded live rerun leaf ${followupTaskId}, not the stale nonlive/source-grounded self-hold. Domain memo: ${domainMemoAbsolute}.`,
    resumeCondition:
      `Resume through ${followupTaskId} after re-running exact private-source and live-admission policies immediately before dispatch, then executing with AKS_RP_E2E_ALLOW_CLOUD_MUTATION=net-integration-multinic-dualstack plus an explicit capacity-confirmed AKS_RP_E2E_LOCATION. If dispatch cannot proceed, record the exact blocker instead of rerunning the old nonlive lane unchanged.`,
  },
  {
    specId: "spec.net-integration.multinic-mixed",
    review: {
      classification:
        "implemented_mutation_gated_live_carrier_pending_bounded_rerun",
      lastRootCause:
        "Current repo-local spec/test carrier, private-source policy, live-admission policy, and local --check validation now prove spec.net-integration.multinic-mixed is an implemented mutation-gated live carrier. The stale spec-loop source-grounded/nonlive wording still reflects the older same-pool Dynamic+Standard lane, not the current bounded compact rerun truth.",
      lastAction:
        `Represent this spec under ${followupTaskId} as pending exact bounded live rerun evidence. Do not route it back through the old nonlive lane or mark it consumed before an exact gated execute run or exact capacity blocker is recorded.`,
      reviewedAt: checkedAt,
    },
    successorDisposition: "implemented-mutation-gated-live-rerun-pending",
    successorStateReason:
      `Accepted 2026-07-15 multinic reconciliation now shows the exact mixed carrier exists, passes private-source/live-admission policy, and passes local --check validation. The truthful controller-visible next step is the bounded live rerun leaf ${followupTaskId} with a non-eastus2 capacity-confirmed region, not the stale nonlive/source-grounded self-hold. Domain memo: ${domainMemoAbsolute}.`,
    resumeCondition:
      `Resume through ${followupTaskId} after re-running exact private-source and live-admission policies immediately before dispatch, then executing with AKS_RP_E2E_ALLOW_CLOUD_MUTATION=net-integration-multinic-mixed plus one explicit non-eastus2 capacity-confirmed AKS_RP_E2E_LOCATION. If dispatch cannot proceed, record the exact blocker instead of rerunning the old nonlive lane unchanged.`,
  },
] as const;

const specBeforeAfter = specPatches.map((item) => {
  const before = specState.specs[item.specId];
  if (!before) throw new Error(`Missing spec-loop row for ${item.specId}`);
  updateSpecLoopSpec(specState, item.specId, {
    status: "pending",
    taskId: followupTaskId,
    review: item.review,
    successorDisposition: item.successorDisposition,
    successorEvidencePath: memoAbsolute,
    successorStateReason: item.successorStateReason,
    resumeCondition: item.resumeCondition,
    terminalDisposition: false,
    catalogStatus: before.catalogStatus ?? "ready",
    catalogSpecState: before.catalogSpecState ?? "source-grounded",
  });
  const after = specState.specs[item.specId];
  return {
    specId: item.specId,
    before: {
      taskId: before.taskId ?? null,
      reviewClassification:
        typeof before.review?.classification === "string"
          ? before.review.classification
          : null,
      successorDisposition: before.successorDisposition ?? null,
      successorEvidencePath: before.successorEvidencePath ?? null,
      resumeCondition: before.resumeCondition ?? null,
    },
    after: {
      taskId: after?.taskId ?? null,
      reviewClassification:
        typeof after?.review?.classification === "string"
          ? after.review.classification
          : null,
      successorDisposition: after?.successorDisposition ?? null,
      successorEvidencePath: after?.successorEvidencePath ?? null,
      resumeCondition: after?.resumeCondition ?? null,
    },
  };
});

const mirrorSpecLoopPath = resolve(projectDir, ".state", "spec-loop", "state.json");
saveSpecLoopState(
  specStatePath,
  specState,
  existsSync(mirrorSpecLoopPath) ? [mirrorSpecLoopPath] : [],
);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactBefore = compactState.features["net-integration"];
if (!compactBefore) throw new Error("Missing feature-compact row for net-integration");

const blockedReason =
  `Current compact/spec-loop/spec evidence shows the exact remaining net-integration compact blocked frontier is the BasicLB deprecation pair on wait-spec-net-integration-basiclb-create-deprecation-boundary-20260702, cross-subscription VNet on wait-spec-net-integration-cross-subscription-vnet-response-20260702, the outboundType=none topology-constraint pair on wait-spec-net-integration-outbound-none-topology-constraint-20260702, spec.net-integration.outbound-udr on wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702, the run-171350866 custom-route-table-user-assigned-msi node-readiness blocker, and the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none. Represent spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed separately by ${followupTaskId} as implemented-mutation-gated live carriers pending exact bounded rerun evidence, not as consumed/commit-backed status or stale check-only residue. Exclude consumed pass-history members spec.net-integration.outbound-migration-natgw-to-none and spec.net-integration.outbound-migration-none-to-lb from active blocked scope.`;
const resumeCondition =
  "Resume only when one exact represented blocked surface materially changes: the BasicLB pair, cross-subscription pairing/access proof, outboundType=none topology constraints, the BYO UDR prerequisite contract, run 171350866 node-readiness diagnosis for custom-route-table-user-assigned-msi, or an accepted live-capable reclassification for the remaining source-grounded/nonlive pair spec.net-integration.multinic-standard plus spec.net-integration.natgw-v2-migration-v2-to-none.";
const nextStepClassification =
  `preserve the reduced exact net-integration blocked frontier while routing spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed through ${followupTaskId} as implemented-mutation-gated live carriers pending bounded rerun evidence`;
const ownerReason =
  `All feature-owned specs are already selected into the compact package. The remaining compact blocked frontier is the preserved family wait ${compactTaskId} over the BasicLB, cross-subscription VNet, outboundType=none, BYO UDR, custom-route-table-user-assigned-msi, and remaining source-grounded/nonlive multinic-standard plus natgw-v2-migration-v2-to-none surfaces, while spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed now self-represent through ${followupTaskId} as implemented-mutation-gated live carriers pending bounded rerun evidence rather than consumed history or stale authoring-gap residue.`;
const retryReason =
  `Keep ${compactTaskId} blocked for the preserved family frontier and handle the multinic pair through ${followupTaskId}; do not reopen a broad compact rerun or restore stale consumed/commit-backed wording.`;
const verificationBlocker =
  `Do not restore stale consumed/commit-backed or check-only-live-authoring-gap wording for spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed; keep them represented by ${followupTaskId} until exact bounded rerun evidence or an exact blocker is recorded.`;
const summary =
  `Repaired net-integration controller-visible wording so ${compactTaskId} keeps only the still-blocked family frontier while ${followupTaskId} represents spec.net-integration.multinic-dualstack and spec.net-integration.multinic-mixed as implemented-mutation-gated live carriers pending bounded rerun evidence.`;

const evidencePaths = Array.from(
  new Set(
    [
      ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
      memoRelative,
      domainMemoAbsolute,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ),
).sort((a, b) => a.localeCompare(b));

const attemptedFixes = Array.from(
  new Set(
    [
      ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
      `${checkedAt}: created ${followupTaskId}, rewrote ${compactTaskId}, and synchronized compact/spec-loop controller state so the multinic pair is represented as implemented-mutation-gated live carriers pending bounded rerun evidence instead of consumed/commit-backed residue.`,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ),
);

updateFeatureCompactItem(compactState, "net-integration", {
  status: "blocked",
  taskId: compactTaskId,
  frontierTaskIds: [compactTaskId],
  retryable: false,
  retryReason,
  blockedReason,
  resumeCondition,
  waitingCondition: resumeCondition,
  nextStepClassification,
  ownerReason,
  reviewEvidencePath: memoRelative,
  evidencePaths,
  summary,
  attemptedFixes,
  verificationBlocker,
  lastCheckedAt: checkedAt,
});

saveFeatureCompactLoopState(compactStatePath, compactState);
const compactAfter = compactState.features["net-integration"];

console.log(
  JSON.stringify(
    {
      checkedAt,
      compactTaskId,
      followupTaskId,
      memoRelative,
      specStatePath,
      compactStatePath,
      specBeforeAfter,
      compact: {
        before: {
          taskId: compactBefore.taskId ?? null,
          frontierTaskIds: compactBefore.frontierTaskIds ?? null,
          retryReason: compactBefore.retryReason ?? null,
          nextStepClassification: compactBefore.nextStepClassification ?? null,
          blockedReason: compactBefore.blockedReason ?? null,
          reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
        },
        after: {
          taskId: compactAfter?.taskId ?? null,
          frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
          retryReason: compactAfter?.retryReason ?? null,
          nextStepClassification: compactAfter?.nextStepClassification ?? null,
          blockedReason: compactAfter?.blockedReason ?? null,
          reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
        },
      },
    },
    null,
    2,
  ),
);
