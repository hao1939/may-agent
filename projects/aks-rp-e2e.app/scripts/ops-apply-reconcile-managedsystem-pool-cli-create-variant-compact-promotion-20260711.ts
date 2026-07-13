import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const memoPath =
  "evidence/archive/ops-apply-reconcile-managedsystem-pool-cli-create-variant-compact-promotion-20260711.md";
const attemptId =
  "a_ops-apply-reconcile-managedsystem-pool-cli-create-variant-compact-promot_20260711183431";
const repairedAt = "2026-07-11T18:00:00Z";
const nextCheckAt = "2026-07-12T18:00:00Z";
const fallbackAt = "2026-07-13T18:00:00Z";

const featureKey = "managedsystem-pool";
const specId = "spec.managedsystem.cli-create-variant";
const activeTaskId =
  "ops-apply-reconcile-managedsystem-pool-cli-create-variant-compact-promot";
const productGapWaitTaskId =
  "domain/wait-managedsystem-pool-compact-product-gap-family-return-20260711";
const artifactWaitTaskId =
  "domain/wait-managedsystem-pool-rest-add-existing-artifact-recovery-return-20260711";

const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;

updateSpecLoopSpec(specState, specId, {
  taskId: null,
  resumeCondition:
    "No direct single-spec rerun is implied by this repair. Revisit the adjacent CLI create carrier only if a fixed aks-preview build, owner-confirmed contract-safe CLI invocation shape, or an explicit rehome/retirement decision materially changes the non-canonical surface.",
  review: {
    classification: "adjacent_cli_surface_not_compact_promotion_authority",
    lastRootCause:
      "Exact live pass run 28513937237 exists for the bounded cli-create-variant probe, but the maintained managedsystem packet/spec truth still classifies this surface as adjacent and non-canonical rather than the canonical ManagedSystem create-time product contract.",
    lastAction:
      "Clear the stale archived verifier task pointer and keep the spec-loop row as pass history only; do not treat this pass alone as compact-promotion authority for managedsystem-pool.",
    reviewedAt: repairedAt,
  },
});
saveSpecLoopState(specStatePath, specState);

const { state: compactState } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: activeTaskId,
  frontierTaskIds: [activeTaskId, productGapWaitTaskId, artifactWaitTaskId],
  errorClass: "adjacent-cli-client-surface-external-fix-wait",
  retryable: false,
  retryReason:
    "Resume only when a fixed aks-preview build strips the disallowed defaults from ManagedSystem create payloads, an owner confirms a contract-safe alternate CLI invocation shape, or an explicit owner decision rehomes/retires spec.managedsystem.cli-create-variant from the compact frontier.",
  lastSummary:
    "ManagedSystem compact should no longer treat spec.managedsystem.cli-create-variant as an execute-ready promotion candidate. The exact remaining non-product blocker is now the adjacent CLI/client-surface external-fix wait, alongside the separate product-gap and artifact-recovery residues already represented by exact waits.",
  rootCauseClassification:
    "non-canonical-adjacent-cli-client-surface-plus-exact-residue-waits",
  ownerReason:
    "spec.managedsystem.cli-create-variant is an adjacent non-canonical CLI/client surface already diagnosed as cli-tooling-default-payload rather than a canonical ManagedSystem create-time product contract, so compact must hold on an external CLI/client-shape wait instead of a promotion candidate. The remaining create-time-initial-pool product-gap and rest-add-existing artifact-recovery residues stay on their own exact waits.",
  attemptedFixes: [
    "Reviewed current managedsystem compact summary plus the 2026-07-11 domain memo and replaced the stale execute-ready promotion interpretation for spec.managedsystem.cli-create-variant with an exact adjacent CLI/client-surface external-fix wait.",
    "Repointed controller-visible managedsystem compact state from the archived broad reviewed-exception holder to the current exact active handoff plus the two surviving exact residue waits.",
    `Cleared the stale spec-loop task pointer for ${specId} during ${attemptId} so the spec row no longer points at archived verify-spec-managedsystem-cli-create-variant history.`,
  ],
  nextStepClassification:
    "preserve exact adjacent-cli external-fix wait plus separate managedsystem product-gap and artifact-recovery waits; do not reopen any unchanged broad compact rerun",
  resumeCondition:
    "Resume only when a fixed aks-preview build strips the disallowed defaults from ManagedSystem create payloads, an owner confirms a contract-safe alternate CLI invocation shape, or an explicit owner decision rehomes/retires spec.managedsystem.cli-create-variant from the compact frontier. Do not reopen the unchanged broad managedsystem-pool compact rerun.",
  blockedAt: repairedAt,
  blockedReason:
    "Blocked on exact adjacent CLI/client-surface wait for spec.managedsystem.cli-create-variant after the 2026-07-11 compact-promotion review: maintained packet/spec evidence classifies this carrier as non-canonical and already diagnosed as cli-tooling-default-payload, so the truthful next surface is cli-tooling-default-payload-external-fix-wait rather than execute-ready promotion. Keep the separate product-gap wait for spec.managedsystem.create-time-initial-pool/spec.managedsystem.disable-migration and the separate artifact-recovery wait for spec.managedsystem.rest-add-existing.minimal-rest; do not reopen an unchanged broad managedsystem-pool compact rerun.",
  waitingFor: {
    type: "cli-tooling-default-payload-external-fix-wait",
    featureKey,
    specId,
    externalTool: "aks-preview",
    holderTaskId: activeTaskId,
  },
  waitingCondition:
    "Wait for one of exactly three changes: fixed aks-preview payload shape, owner-confirmed contract-safe alternate CLI invocation shape, or explicit owner rehome/retirement of spec.managedsystem.cli-create-variant.",
  observedBy: {
    workflow: "feature-compact-loop-controller",
    trigger: "project.task.tick",
  },
  observationMethod:
    "On each compact-loop tick, preserve this exact adjacent CLI wait unless one of the three named resume triggers is evidenced; keep the product-gap and artifact-recovery residues separate.",
  nextCheckAt,
  blockerOwner: "aks-explorer",
  fallbackAt,
  fallbackAction:
    "If unchanged at fallback, refresh the same exact adjacent CLI/client-surface wait with current evidence and keep the managedsystem product-gap and artifact-recovery residues on their separate waits instead of reopening a broad compact rerun.",
  resumeAction:
    "Reset this feature compact record to pending or replace the holder only after one of the named resume triggers is evidenced.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "adjacent-cli-client-surface-external-fix-wait",
    target: "staging",
    branch: "dev",
    featureKey,
    specId,
  },
  lastCheckedAt: repairedAt,
  evidencePaths: [
    memoPath,
    "evidence/archive/domain-reconcile-managedsystem-pool-cli-create-variant-compact-promotion-20260711.md",
    "features/managedsystem-pool/compact/staging.summary.md",
    "features/managedsystem-pool/compact/staging.diagnostics.json",
  ],
  reviewEvidencePath: memoPath,
  verificationBlocker:
    "Do not rerun unchanged. The truthful frontier is the adjacent CLI/client-surface external-fix wait for spec.managedsystem.cli-create-variant plus the separate exact product-gap and artifact-recovery residues.",
  summary:
    "managedsystem-pool now records spec.managedsystem.cli-create-variant as an exact adjacent CLI/client-surface external-fix wait, not an execute-ready promotion candidate; product-gap and artifact-recovery residues remain split onto their own exact waits.",
  updatedAt: repairedAt,
});

saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      repairedAt,
      compactStatePath,
      specStatePath,
      feature: compactState.features[featureKey],
      spec: specState.specs[specId],
    },
    null,
    2,
  ),
);
