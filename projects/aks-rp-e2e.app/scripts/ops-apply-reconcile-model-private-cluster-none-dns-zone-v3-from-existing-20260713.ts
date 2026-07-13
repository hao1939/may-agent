import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type TaskTree = {
  tasks?: Record<
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

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const specLoopPath = resolve(defaultSpecLoopStatePath(appDir));
const memoPath =
  "evidence/archive/ops-apply-reconcile-model-private-cluster-none-dns-zone-v3-from-existing-20260713.md";
const domainMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/domain-reconcile-model-private-cluster-none-dns-zone-v3-from-existing-frontier-20260713.md";
const specId = "spec.private-cluster.none-private-dns-zone-v3";
const staleHolderTaskId =
  "hold-spec-private-cluster-none-dns-zone-v3-authorization-explicit-tuple-return-20260712";
const compactFeatureKey = "private-cluster";
const compactHolderTaskId =
  "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix";
const compactFrontierTaskIds = [
  "hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707",
  "wait-private-cluster-jumpbox-key-execution-surface-return-20260704",
  "hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707",
  "hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h",
];
const exactPassRunId = "28750369397";
const exactPassRunUrl =
  "https://github.com/azure-management-and-platforms/aks-rp-e2e/actions/runs/28750369397";
const exactPassResultPath =
  "/app/projects/aks-rp-e2e.app/.state/spec-loop/artifacts/28750369397/aks-rp-e2e-28750369397-spec-test-results/test-results/single-private-cluster-none-private-dns-zone-v3_929719/artifacts/private-cluster-none-private-dns-zone-v3/spec-runner/result.json";

const now = new Date().toISOString();
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
const compactBlocker = tree.tasks?.[compactHolderTaskId]?.blocker;
if (!compactBlocker) {
  throw new Error(`Missing blocker for ${compactHolderTaskId}`);
}

const specLoop = JSON.parse(readFileSync(specLoopPath, "utf-8")) as SpecLoopState;
const beforeSpec = specLoop.specs[specId];
if (!beforeSpec) {
  throw new Error(`Spec loop record not found: ${specId}`);
}
if ((beforeSpec.lastRunId ?? null) !== exactPassRunId) {
  throw new Error(
    `${specId} lastRunId drifted before repair: expected ${exactPassRunId}, got ${String(beforeSpec.lastRunId ?? null)}`,
  );
}

updateSpecLoopSpec(specLoop, specId, {
  status: "pass",
  taskId: null,
  lastRunId: exactPassRunId,
  lastRunUrl: exactPassRunUrl,
  lastResultPath: exactPassResultPath,
  successorDisposition: "exact-same-spec-live-pass-already-ingested",
  successorEvidencePath: memoPath,
  successorStateReason:
    "The stale authorization/explicit-tuple blocked holder is superseded by the already-ingested exact same-spec live pass run 28750369397 for path.private-cluster-none-dns-zone-v3. Keep the canonical branch at pass with no unchanged rerun implied.",
  resumeCondition:
    "No unchanged rerun is implied. Resume only if an owner requests fresher same-path live verification on a materially changed build, target, API surface, or mounted-source contract beyond verified pass run 28750369397.",
  review: {
    classification: "exact_spec_pass_recovered_same_path",
    lastRootCause:
      "Checked-in exact same-spec live pass run 28750369397 already verifies the mounted one-cluster system->none lifecycle end to end, so the later restored authorization/explicit-tuple blocked holder became stale residue rather than the truthful frontier.",
    lastAction:
      "Retire the stale blocked holder from the spec-loop branch and normalize this row to pass from existing exact same-spec evidence without launching a rerun.",
    reviewedAt: now,
  },
});
saveSpecLoopState(specLoopPath, specLoop);
const afterSpec = specLoop.specs[specId];

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const beforeFeature = compactState.features[compactFeatureKey];
if (!beforeFeature) {
  throw new Error(`Feature-compact record not found: ${compactFeatureKey}`);
}

updateFeatureCompactItem(compactState, compactFeatureKey, {
  status: "blocked",
  taskId: compactHolderTaskId,
  frontierTaskIds: compactFrontierTaskIds,
  retryable: false,
  retryReason: compactBlocker.resume_condition ?? null,
  blockedReason: compactBlocker.condition ?? null,
  waitingFor: (compactBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: compactBlocker.resume_condition ?? null,
  observedBy: (compactBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: compactBlocker.observation_method ?? null,
  nextCheckAt: compactBlocker.next_check_at ?? null,
  blockerOwner: compactBlocker.owner ?? null,
  fallbackAt: compactBlocker.fallback_at ?? null,
  fallbackAction: compactBlocker.fallback_action ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths: unique([
    memoPath,
    domainMemoPath,
    ...(beforeFeature.evidencePaths ?? []),
  ]),
  ownerReason:
    "Private-cluster compact still remains a represented mixed residual frontier, but the exact same-spec live pass run 28750369397 means spec.private-cluster.none-private-dns-zone-v3 is no longer one of the frontier blockers. The compact-facing residual set is now the BYO UDR prerequisite wait, the private-cluster jumpbox-key execution-surface wait for k8s-validation, the intentional nonlive update-private-second-hop lineage, and the update-public-second-hop artifact frontier, while superseded dns-zone-none and dns-zone-system rows remain historical residue only.",
  summary:
    "Retired the stale none-dns-zone-v3 holder from the private-cluster compact projection. Controller-visible compact frontier task ids now track only the remaining BYO UDR prerequisite, jumpbox-key execution-surface, update-private-second-hop nonlive, and update-public-second-hop artifact waits while the exact same-spec live pass run 28750369397 keeps spec.private-cluster.none-private-dns-zone-v3 out of the blocked residual set.",
  lastSummary:
    "Private-cluster compact remains partial, but spec.private-cluster.none-private-dns-zone-v3 is now represented by exact pass run 28750369397 rather than a stale blocked holder. The remaining controller-visible downstream waits are BYO UDR prerequisite, jumpbox-key execution surface, update-private-second-hop nonlive lineage, and update-public-second-hop artifact visibility.",
  attemptedFixes: unique([
    ...(beforeFeature.attemptedFixes ?? []),
    `Retired stale compact/spec-loop none-dns-zone-v3 blocked-holder residue in favor of exact same-spec live pass run ${exactPassRunId} and rewired the compact projection to the remaining truthful downstream waits during ${now}.`,
  ]),
  lastCheckedAt: now,
});
saveFeatureCompactLoopState(compactStatePath, compactState);
const afterFeature = compactState.features[compactFeatureKey];

console.log(
  JSON.stringify(
    {
      memoPath,
      paths: {
        treePath,
        specLoopPath,
        compactStatePath,
      },
      specLoop: {
        specId,
        before: {
          status: beforeSpec.status,
          taskId: beforeSpec.taskId ?? null,
          lastRunId: beforeSpec.lastRunId ?? null,
          review: beforeSpec.review ?? null,
          successorEvidencePath: beforeSpec.successorEvidencePath ?? null,
          resumeCondition: beforeSpec.resumeCondition ?? null,
        },
        after: {
          status: afterSpec.status,
          taskId: afterSpec.taskId ?? null,
          lastRunId: afterSpec.lastRunId ?? null,
          review: afterSpec.review ?? null,
          successorDisposition: (afterSpec as Record<string, unknown>).successorDisposition ?? null,
          successorEvidencePath: afterSpec.successorEvidencePath ?? null,
          successorStateReason: (afterSpec as Record<string, unknown>).successorStateReason ?? null,
          resumeCondition: afterSpec.resumeCondition ?? null,
        },
      },
      featureCompact: {
        featureKey: compactFeatureKey,
        before: {
          frontierTaskIds: beforeFeature.frontierTaskIds ?? null,
          reviewEvidencePath: beforeFeature.reviewEvidencePath ?? null,
          ownerReason: beforeFeature.ownerReason ?? null,
          summary: beforeFeature.summary ?? null,
        },
        after: {
          frontierTaskIds: afterFeature?.frontierTaskIds ?? null,
          reviewEvidencePath: afterFeature?.reviewEvidencePath ?? null,
          ownerReason: afterFeature?.ownerReason ?? null,
          summary: afterFeature?.summary ?? null,
          waitingCondition: afterFeature?.waitingCondition ?? null,
          nextCheckAt: afterFeature?.nextCheckAt ?? null,
          fallbackAt: afterFeature?.fallbackAt ?? null,
        },
      },
    },
    null,
    2,
  ),
);
