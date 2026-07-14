import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  loadSpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";

type TaskTree = {
  tasks: Record<
    string,
    {
      blocker?: {
        condition?: string;
        category?: string;
        owner?: string;
        blocked_at?: string;
        waiting_for?: Record<string, unknown>;
        observed_by?: Record<string, unknown>;
        observation_method?: string;
        resume_condition?: string;
        next_check_at?: string;
        fallback_at?: string;
        fallback_action?: string;
      };
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();
const attemptId =
  "a_ops-apply-repair-1845-ccp-security-patch-holder-represented-metadata-syn_20260713181221";

const memoPath =
  "evidence/archive/ops-apply-repair-1845-ccp-security-patch-holder-represented-metadata-sync-20260713.md";
const priorMemoPath =
  "evidence/archive/ops-repair-1845-ccp-security-patch-holder-represented-metadata-sync-20260713.md";
const acceptedDomainEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/reclassify-ccp-security-patch-mariner-v2-mounted-source-retire-or-alias-20260712.md";

const featureKey = "ccp-security-patch-os-variants";
const holderTaskId =
  "hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier-20260713";
const representedWaitTaskId =
  "wait-ccp-security-patch-reviewed-exception-owner-response-20260708";
const staleRepresentedTaskId =
  "reclassify-ccp-security-patch-mariner-v2-mounted-source-retire-or-alias-20260712";
const staleRepresentedSpecId = "spec.ccp-security-patch.mariner-v2-prod-mtc";
const expectedRepresentedSpecIds = [
  "spec.ccp-security-patch.windows2022-prod-mtc",
  "spec.ccp-security-patch.windows2025-prod-mtc",
];

const treePath = resolve(appDir, ".state/tasks/tree.json");
const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const specStatePath = defaultSpecLoopStatePath(appDir);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

const tree = JSON.parse(readFileSync(treePath, "utf8")) as TaskTree;
const blocker = tree.tasks[holderTaskId]?.blocker;
if (!blocker) {
  throw new Error(`Missing blocker for ${holderTaskId}`);
}

const waitingFor = asRecord(blocker.waiting_for);
const representedTaskIds = asStringArray(waitingFor.representedTaskIds);
const representedSpecIds = asStringArray(waitingFor.representedSpecIds);

if (representedTaskIds.length !== 1 || representedTaskIds[0] !== representedWaitTaskId) {
  throw new Error(
    `Unexpected representedTaskIds=${JSON.stringify(representedTaskIds)} for ${holderTaskId}`,
  );
}
if (
  representedSpecIds.length !== expectedRepresentedSpecIds.length ||
  expectedRepresentedSpecIds.some((specId) => !representedSpecIds.includes(specId))
) {
  throw new Error(
    `Unexpected representedSpecIds=${JSON.stringify(representedSpecIds)} for ${holderTaskId}`,
  );
}
if (representedTaskIds.includes(staleRepresentedTaskId)) {
  throw new Error(`Stale represented task still present: ${staleRepresentedTaskId}`);
}
if (representedSpecIds.includes(staleRepresentedSpecId)) {
  throw new Error(`Stale represented spec still present: ${staleRepresentedSpecId}`);
}

const { state: compactState } = loadFeatureCompactLoopState({
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

const attemptedFixes = unique([
  ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
  "Applied the documented holder metadata-only repair so controller-visible compact state now represents only the exact Windows source-authority wait and no longer carries retired MarinerV2 lineage in waitingFor.",
]);
const evidencePaths = unique([
  ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
  priorMemoPath,
  memoPath,
  acceptedDomainEvidencePath,
]);
const summary =
  "Refreshed the compact CCP security-patch frontier to one represented Windows wait: the holder still blocks ccp-security-patch-os-variants, but controller-visible waitingFor/frontier metadata now exposes only wait-ccp-security-patch-reviewed-exception-owner-response-20260708 for spec.ccp-security-patch.windows2022-prod-mtc and spec.ccp-security-patch.windows2025-prod-mtc.";

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  errorClass: compactBefore.errorClass ?? "reviewed-exception",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [representedWaitTaskId],
  retryReason: blocker.resume_condition ?? compactBefore.retryReason ?? null,
  rootCauseClassification:
    compactBefore.rootCauseClassification ??
    "reviewed-exception-windows-source-authority-frontier",
  ownerReason:
    "Accepted MarinerV2 retirement/alias evidence already removed the legacy Linux branch from the compact frontier. The remaining compact blocker is only the Windows CCP source-authority/source-change wait on wait-ccp-security-patch-reviewed-exception-owner-response-20260708 for Windows2022/Windows2025.",
  attemptedFixes,
  nextStepClassification:
    "preserve one exact represented Windows source-authority wait until the named Windows frontier materially changes; do not restore retired MarinerV2 lineage or rerun unchanged reviewed-exception coverage",
  resumeCondition: blocker.resume_condition ?? compactBefore.resumeCondition ?? null,
  blockedAt: blocker.blocked_at ?? compactBefore.blockedAt ?? null,
  blockedReason: blocker.condition ?? compactBefore.blockedReason ?? null,
  waitingFor,
  waitingCondition: blocker.resume_condition ?? compactBefore.waitingCondition ?? null,
  observedBy: (blocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod:
    blocker.observation_method ?? compactBefore.observationMethod ?? null,
  nextCheckAt: blocker.next_check_at ?? compactBefore.nextCheckAt ?? null,
  blockerOwner: blocker.owner ?? compactBefore.blockerOwner ?? null,
  fallbackAt: blocker.fallback_at ?? compactBefore.fallbackAt ?? null,
  fallbackAction: blocker.fallback_action ?? compactBefore.fallbackAction ?? null,
  resumeAction:
    "Reset this compact record to pending only after wait-ccp-security-patch-reviewed-exception-owner-response-20260708 materially changes or accepted evidence retires/rehomes one of the remaining Windows carriers.",
  blockedScope: compactBefore.blockedScope ?? {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: compactBefore.blockedFingerprint ?? {
    errorClass: compactBefore.errorClass ?? "reviewed-exception",
    featureKey,
    target: "staging",
    branch: "dev",
  },
  lastCheckedAt: checkedAt,
  evidencePaths,
  reviewEvidencePath: memoPath,
  verificationBlocker:
    "Do not rerun unchanged. The truthful remaining frontier is only the Windows source-authority/source-change wait, and controller-visible compact metadata must keep MarinerV2 retired unless accepted evidence reopens that lineage.",
  summary,
  lastSummary: summary,
});

saveFeatureCompactLoopState(compactStatePath, compactState);
const compactAfter = compactState.features[featureKey];

const { state: specState } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const marinerSpec = specState.specs[staleRepresentedSpecId];
const windows2022Spec = specState.specs[expectedRepresentedSpecIds[0]];
const windows2025Spec = specState.specs[expectedRepresentedSpecIds[1]];
if (!marinerSpec || !windows2022Spec || !windows2025Spec) {
  throw new Error("Missing one or more CCP security-patch spec-loop records");
}

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      paths: {
        treePath,
        compactStatePath,
        specStatePath,
      },
      before: {
        compactFrontierTaskIds: compactBefore.frontierTaskIds ?? null,
        compactRetryReason: compactBefore.retryReason ?? null,
        compactWaitingFor: compactBefore.waitingFor ?? null,
      },
      after: {
        compactFrontierTaskIds: compactAfter?.frontierTaskIds ?? null,
        compactRetryReason: compactAfter?.retryReason ?? null,
        compactWaitingFor: compactAfter?.waitingFor ?? null,
        compactReviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
      },
      specLoopVerification: {
        mariner: {
          taskId: asString(marinerSpec.taskId),
          successorDisposition: asString(marinerSpec.successorDisposition),
          catalogStatus: asString(marinerSpec.catalogStatus),
        },
        windows2022: {
          taskId: asString(windows2022Spec.taskId),
          successorDisposition: asString(windows2022Spec.successorDisposition),
          catalogStatus: asString(windows2022Spec.catalogStatus),
        },
        windows2025: {
          taskId: asString(windows2025Spec.taskId),
          successorDisposition: asString(windows2025Spec.successorDisposition),
          catalogStatus: asString(windows2025Spec.catalogStatus),
        },
      },
    },
    null,
    2,
  ),
);
