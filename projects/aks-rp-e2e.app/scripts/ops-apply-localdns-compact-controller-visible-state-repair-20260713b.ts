import { readFileSync } from "node:fs";
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
const checkedAt = new Date().toISOString();

const memoPath =
  "evidence/archive/ops-apply-localdns-compact-controller-visible-state-repair-20260713b.md";
const domainEvidencePath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-localdns-compact-split-frontier-visible-members-20260713.md";
const treePath = resolve(appDir, ".state/tasks/tree.json");
const diagnosticsPath = resolve(projectDir, "features/localdns/compact/staging.diagnostics.json");
const summaryPath = resolve(projectDir, "features/localdns/compact/staging.summary.md");

const featureKey = "localdns";
const compactTaskId = "hold-compact-localdns-package-partial-frontier";
const quotaTaskId = "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708";
const residualTaskId = "wait-localdns-create-http400-residual-family-return-20260704";
const windowsTaskId =
  "hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712";

const cniSpecId = "spec.localdns.cni-matrix";
const windowsSpecId = "spec.localdns.windows-nodepool";

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

function requireBlocker(tree: TaskTree, taskId: string) {
  const blocker = tree.tasks[taskId]?.blocker;
  if (!blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return blocker;
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
for (const phrase of [
  "5 active-frontier quarantined",
  "2 consumed pass-history members",
  "spec.localdns.cni-matrix",
  "spec.localdns.windows-nodepool",
]) {
  if (!summary.includes(phrase)) {
    throw new Error(`Compact summary missing phrase: ${phrase}`);
  }
}

const tree = JSON.parse(readFileSync(treePath, "utf8")) as TaskTree;
const compactBlocker = requireBlocker(tree, compactTaskId);
const residualBlocker = requireBlocker(tree, residualTaskId);
const windowsBlocker = requireBlocker(tree, windowsTaskId);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
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

const compactEvidencePaths = Array.from(
  new Set([
    memoPath,
    ...(Array.isArray(compactBefore.evidencePaths)
      ? compactBefore.evidencePaths.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []),
  ]),
);

const compactAttemptedFixes = [
  ...(Array.isArray(compactBefore.attemptedFixes) ? compactBefore.attemptedFixes : []),
  "Removed non-member compact-facing carriers from LocalDNS frontierTaskIds so only quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive remain visible for the regenerated five-member frontier.",
  "Rebound spec.localdns.cni-matrix to the residual HTTP400 family and spec.localdns.windows-nodepool to the exact unsupported/nonlive holder so spec-loop state matches the current LocalDNS compact authority.",
];

const compactSummary =
  "Repaired LocalDNS controller-visible compact state to the regenerated 2026-07-13 authority: the active frontier is cluster-topology + cni-matrix + network-policy-coexistence + os-arch-matrix + windows-nodepool, the two VM-prerelease rows remain consumed pass history only, and the compact-facing carriers are exactly the quota/headroom family, the residual create-time HTTP400 family, and the windows unsupported/nonlive holder.";

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: compactTaskId,
  frontierTaskIds: [quotaTaskId, residualTaskId, windowsTaskId],
  retryReason: compactBlocker.resume_condition ?? null,
  blockedReason: compactBlocker.condition ?? null,
  waitingFor: (compactBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: compactBlocker.resume_condition ?? null,
  resumeCondition: compactBlocker.resume_condition ?? null,
  observedBy: (compactBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: compactBlocker.observation_method ?? null,
  nextCheckAt: compactBlocker.next_check_at ?? null,
  blockerOwner: compactBlocker.owner ?? compactBefore.blockerOwner ?? null,
  fallbackAt: compactBlocker.fallback_at ?? null,
  fallbackAction: compactBlocker.fallback_action ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths: compactEvidencePaths,
  summary: compactSummary,
  lastSummary: compactSummary,
  rootCauseClassification: "repo-local-mixed-terminal-and-promotion-frontier",
  ownerReason:
    "All 12 active LocalDNS specs remain selected into the compact package, but only five remain on the active frontier and two are consumed pass-history members. Controller-visible compact state must therefore preserve only the three exact downstream families that still own the active frontier: quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive.",
  verificationBlocker:
    "Do not rerun unchanged; the regenerated LocalDNS compact package is still partial with exact blocker repo-local-mixed-terminal-and-promotion-frontier, keeping cni-matrix in the active frontier and the two VM-prerelease rows as consumed pass history unless contrary evidence appears.",
  attemptedFixes: compactAttemptedFixes,
  lastCheckedAt: checkedAt,
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-spec-verification-loop",
  windowSize: 5,
});
const cniBefore = specState.specs[cniSpecId];
const windowsBefore = specState.specs[windowsSpecId];
if (!cniBefore || !windowsBefore) {
  throw new Error("Missing LocalDNS spec-loop state for cni-matrix or windows-nodepool");
}

updateSpecLoopSpec(specState, cniSpecId, {
  status: "pending",
  taskId: residualTaskId,
  review: {
    classification: "mixed_result_create_time_http400",
    lastRootCause:
      "2026-07-13 controller-visible repair reclassified the exact unsplit LocalDNS cni-matrix carrier back to the residual HTTP400 family. Reviewed kubenet rerun 28704745840 remains valid bounded subcoverage, but azure-nodesubnet, azure-overlay, and azure-overlay-cilium still stop at managed-cluster create HTTP 400 before fresh product assertions, so the full unsplit spec is not a pass.",
    lastAction:
      "Keep pending under wait-localdns-create-http400-residual-family-return-20260704. Preserve run 28704745840 as kubenet-only pass evidence, do not normalize the unsplit four-variant carrier to pass or consumed history, and do not rerun unchanged until the remaining residual HTTP400 variants materially change or the owner explicitly narrows the matrix.",
    reviewedAt: checkedAt,
  },
  successorDisposition: "mixed-result-create-time-http400-residual-family-wait",
  successorEvidencePath: domainEvidencePath,
  successorStateReason:
    "Represented by wait-localdns-create-http400-residual-family-return-20260704: kubenet pass evidence from run 28704745840 remains preserved as bounded subcoverage, but azure-nodesubnet, azure-overlay, and azure-overlay-cilium still define the exact residual create-time HTTP400 frontier for the unsplit spec.",
  resumeCondition: residualBlocker.resume_condition ?? cniBefore.resumeCondition ?? null,
  catalogStatus: "blocked",
  catalogSpecState: cniBefore.catalogSpecState ?? "ready",
  terminalDisposition: true,
});

updateSpecLoopSpec(specState, windowsSpecId, {
  status: "pending",
  taskId: windowsTaskId,
  review: {
    classification: "reviewed_exception_unsupported_product_boundary",
    lastRootCause:
      "2026-07-13 controller-visible repair preserved the exact Windows LocalDNS unsupported/nonlive boundary. Mounted source still lacks a handwritten Windows LocalDNS scenario, AgentBaker still preserves no LocalDNS label support on Windows, and validator evidence still rejects LocalDNS Required on Windows pools, so this row belongs on the sharper unsupported/nonlive holder rather than the older broader owner-return family.",
    lastAction:
      `Keep pending under ${windowsTaskId}. Do not rerun unchanged or dispatch live; resume only after authoritative mounted-source or product evidence materially changes the Windows LocalDNS support boundary.`,
    reviewedAt: checkedAt,
  },
  successorDisposition: "reviewed-exception-unsupported-nonlive-evidence-ceiling",
  successorEvidencePath: domainEvidencePath,
  successorStateReason:
    `Represented by ${windowsTaskId}: preserve the exact Windows LocalDNS unsupported/nonlive boundary and do not rerun or dispatch live unchanged until authoritative mounted-source or product evidence materially changes that boundary.`,
  resumeCondition: windowsBlocker.resume_condition ?? windowsBefore.resumeCondition ?? null,
  catalogStatus: windowsBefore.catalogStatus ?? "blocked",
  catalogSpecState: windowsBefore.catalogSpecState ?? "reviewed-exception",
  terminalDisposition: true,
});

saveSpecLoopState(specStatePath, specState);

const compactAfter = compactState.features[featureKey];
const cniAfter = specState.specs[cniSpecId];
const windowsAfter = specState.specs[windowsSpecId];

console.log(
  JSON.stringify(
    {
      memoPath,
      checkedAt,
      authorities: {
        diagnosticsPath,
        summaryPath,
        expectedActiveFrontier,
        expectedConsumedPassHistory,
        compactFrontierTaskIds: [quotaTaskId, residualTaskId, windowsTaskId],
      },
      before: {
        compactFrontierTaskIds: compactBefore.frontierTaskIds ?? null,
        cni: {
          status: cniBefore.status,
          taskId: cniBefore.taskId ?? null,
          review: cniBefore.review ?? null,
        },
        windows: {
          status: windowsBefore.status,
          taskId: windowsBefore.taskId ?? null,
          review: windowsBefore.review ?? null,
        },
      },
      after: {
        compactFrontierTaskIds: compactAfter?.frontierTaskIds ?? null,
        cni: {
          status: cniAfter?.status ?? null,
          taskId: cniAfter?.taskId ?? null,
          resumeCondition: cniAfter?.resumeCondition ?? null,
          review: cniAfter?.review ?? null,
        },
        windows: {
          status: windowsAfter?.status ?? null,
          taskId: windowsAfter?.taskId ?? null,
          resumeCondition: windowsAfter?.resumeCondition ?? null,
          review: windowsAfter?.review ?? null,
        },
      },
      paths: {
        compactStatePath,
        specStatePath,
        treePath,
      },
    },
    null,
    2,
  ),
);
