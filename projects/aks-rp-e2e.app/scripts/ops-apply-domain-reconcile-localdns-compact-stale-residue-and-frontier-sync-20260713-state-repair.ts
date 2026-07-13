import { readFileSync } from "node:fs";
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

type LocaldnsDiagnostics = {
  compactLiveReadiness?: {
    activeFrontierSpecIds?: string[];
    consumedPassHistorySpecIds?: string[];
  };
  selectionBlocker?: {
    kind?: string;
  };
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const diagnosticsPath = resolve(projectDir, "features/localdns/compact/staging.diagnostics.json");
const summaryPath = resolve(projectDir, "features/localdns/compact/staging.summary.md");

const memoPath =
  "evidence/archive/ops-apply-domain-reconcile-localdns-compact-stale-residue-and-frontier-sync-20260713.md";
const featureKey = "localdns";
const compactTaskId = "hold-compact-localdns-package-partial-frontier";
const quotaTaskId = "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708";
const residualTaskId = "wait-localdns-create-http400-residual-family-return-20260704";
const windowsTaskId =
  "hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712";

const expectedActiveFrontier = [
  "spec.localdns.cluster-topology",
  "spec.localdns.cni-matrix",
  "spec.localdns.network-policy-coexistence",
  "spec.localdns.os-arch-matrix",
  "spec.localdns.windows-nodepool",
];

const expectedConsumedPassHistory = [
  "spec.localdns.vm-prerelease.azurelinux",
  "spec.localdns.vm-prerelease.enable-disable",
];

function assertSameMembers(actual: string[] | undefined, expected: string[], label: string) {
  const left = [...(actual ?? [])].sort();
  const right = [...expected].sort();
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    throw new Error(`${label} mismatch. actual=${JSON.stringify(left)} expected=${JSON.stringify(right)}`);
  }
}

const taskTree = JSON.parse(readFileSync(treePath, "utf8")) as TaskTree;
const blocker = taskTree.tasks[compactTaskId]?.blocker;
if (!blocker) {
  throw new Error(`Missing blocker for ${compactTaskId}`);
}

const diagnostics = JSON.parse(readFileSync(diagnosticsPath, "utf8")) as LocaldnsDiagnostics;
assertSameMembers(
  diagnostics.compactLiveReadiness?.activeFrontierSpecIds,
  expectedActiveFrontier,
  "activeFrontierSpecIds",
);
assertSameMembers(
  diagnostics.compactLiveReadiness?.consumedPassHistorySpecIds,
  expectedConsumedPassHistory,
  "consumedPassHistorySpecIds",
);
if (diagnostics.selectionBlocker?.kind !== "repo-local-mixed-terminal-and-promotion-frontier") {
  throw new Error(
    `Unexpected selectionBlocker.kind=${diagnostics.selectionBlocker?.kind ?? "null"}`,
  );
}

const summary = readFileSync(summaryPath, "utf8");
for (const specId of expectedActiveFrontier) {
  if (!summary.includes(specId)) {
    throw new Error(`Compact summary missing active frontier spec ${specId}`);
  }
}
for (const specId of expectedConsumedPassHistory) {
  if (!summary.includes(specId)) {
    throw new Error(`Compact summary missing consumed pass-history spec ${specId}`);
  }
}
if (!summary.includes("5 active-frontier quarantined") || !summary.includes("2 consumed pass-history members")) {
  throw new Error("Compact summary no longer preserves the 5 active-frontier / 2 consumed pass-history shape");
}

const { state, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const before = state.features[featureKey];
if (!before) {
  throw new Error(`Missing feature-compact state for ${featureKey}`);
}

const evidencePaths = Array.from(
  new Set([
    memoPath,
    ...(Array.isArray(before.evidencePaths)
      ? before.evidencePaths.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []),
  ]),
);

const attemptedFixes = [
  ...(Array.isArray(before.attemptedFixes) ? before.attemptedFixes : []),
  "Synchronized LocalDNS controller-visible compact branch metadata to the regenerated 2026-07-13 domain authority: five active-frontier specs remain represented by the quota/headroom + residual HTTP400 + windows unsupported downstream families, while spec.localdns.vm-prerelease.azurelinux and spec.localdns.vm-prerelease.enable-disable stay consumed pass history only.",
];

const summaryText =
  "Synchronized LocalDNS controller-visible compact state to the regenerated 2026-07-13 domain authority: the active frontier is the five-spec cluster-topology + cni-matrix + network-policy-coexistence + os-arch-matrix + windows-nodepool set, represented compact-facing only by the quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive downstream families; spec.localdns.vm-prerelease.azurelinux and spec.localdns.vm-prerelease.enable-disable remain consumed pass history rather than active blockers.";

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: compactTaskId,
  frontierTaskIds: [quotaTaskId, residualTaskId, windowsTaskId],
  retryReason: blocker.resume_condition ?? null,
  blockedReason: blocker.condition ?? null,
  waitingFor: (blocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: blocker.resume_condition ?? null,
  resumeCondition: blocker.resume_condition ?? null,
  observedBy: (blocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: blocker.observation_method ?? null,
  nextCheckAt: blocker.next_check_at ?? null,
  blockerOwner: blocker.owner ?? before.blockerOwner ?? null,
  fallbackAt: blocker.fallback_at ?? null,
  fallbackAction: blocker.fallback_action ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary: summaryText,
  lastSummary: summaryText,
  rootCauseClassification: "repo-local-mixed-terminal-and-promotion-frontier",
  ownerReason:
    "All 12 active LocalDNS specs remain selected into the compact package. The regenerated authority now preserves a five-spec active frontier (cluster-topology, cni-matrix, network-policy-coexistence, os-arch-matrix, windows-nodepool) and two consumed pass-history members (vm-prerelease.azurelinux, vm-prerelease.enable-disable). Compact-facing state should therefore project only the three exact downstream families that still own the active frontier: quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive.",
  verificationBlocker:
    "Do not rerun unchanged; the regenerated LocalDNS compact package is still partial with exact blocker repo-local-mixed-terminal-and-promotion-frontier, preserving a five-spec active frontier and two consumed pass-history members. Keep cni-matrix in the active frontier unless an owner explicitly narrows the unsplit matrix carrier.",
  attemptedFixes,
  lastCheckedAt: new Date().toISOString(),
});

saveFeatureCompactLoopState(compactStatePath, state);

const after = state.features[featureKey];
console.log(
  JSON.stringify(
    {
      memoPath,
      compactStatePath,
      diagnosticsPath,
      summaryPath,
      authorities: {
        compactTaskId,
        frontierTaskIds: [quotaTaskId, residualTaskId, windowsTaskId],
        expectedActiveFrontier,
        expectedConsumedPassHistory,
      },
      before: {
        frontierTaskIds: before.frontierTaskIds ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
        summary: before.summary ?? null,
        ownerReason: before.ownerReason ?? null,
        verificationBlocker: before.verificationBlocker ?? null,
      },
      after: after
        ? {
            frontierTaskIds: after.frontierTaskIds ?? null,
            reviewEvidencePath: after.reviewEvidencePath ?? null,
            summary: after.summary ?? null,
            ownerReason: after.ownerReason ?? null,
            verificationBlocker: after.verificationBlocker ?? null,
            nextCheckAt: after.nextCheckAt ?? null,
            fallbackAt: after.fallbackAt ?? null,
          }
        : null,
    },
    null,
    2,
  ),
);
