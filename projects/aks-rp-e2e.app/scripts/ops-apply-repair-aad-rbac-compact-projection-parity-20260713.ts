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

type SpecLoopState = {
  specs?: Record<
    string,
    {
      catalogSpecState?: string | null;
      review?: { classification?: string | null } | null;
      successorEvidencePath?: string | null;
      resumeCondition?: string | null;
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const specLoopPath = resolve(appDir, ".state/spec-loop/state.json");

const memoPath =
  "evidence/archive/ops-repair-aad-rbac-compact-projection-parity-20260713.md";
const featureKey = "aad-rbac";
const compactTaskId = "hold-compact-aad-rbac-package-partial-frontier";
const secopsTaskId =
  "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702";
const row37TaskId = "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705";
const runCommandSpecId = "spec.aad-rbac.run-command-access";

const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;
const specLoop = JSON.parse(readFileSync(specLoopPath, "utf-8")) as SpecLoopState;
const compactTask = tree.tasks[compactTaskId];
const runCommandSpec = specLoop.specs?.[runCommandSpecId];

if (!compactTask?.blocker) {
  throw new Error(`Missing blocker for ${compactTaskId}`);
}

if (runCommandSpec?.catalogSpecState !== "reviewed-exception") {
  throw new Error(
    `${runCommandSpecId} must remain reviewed-exception before compact parity repair; got ${String(
      runCommandSpec?.catalogSpecState ?? null,
    )}`,
  );
}

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const existingEvidencePaths = compactState.features[featureKey]?.evidencePaths ?? [];
const evidencePaths = Array.from(
  new Set([
    memoPath,
    "evidence/archive/ops-review-aad-rbac-compact-environment-overblock-warning-20260713.md",
    "evidence/archive/ops-reconcile-aad-rbac-visible-holder-text-parity-20260713.md",
    "evidence/archive/ops-apply-reconcile-aad-rbac-compact-stale-run-command-holder-lineage-20260713.md",
    "/app/projects/aks-rp-e2e/evidence/archive/bound-spec-aad-rbac-run-command-access-user-vs-serviceprincipal-branch-20260703.md",
    "/app/projects/aks-rp-e2e/evidence/archive/domain-aad-rbac-run-command-access-mounted-source-branch-options-20260712.md",
    ...existingEvidencePaths.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    ),
  ]),
);

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: compactTaskId,
  frontierTaskIds: [secopsTaskId, row37TaskId],
  retryable: false,
  retryReason: compactTask.blocker.resume_condition ?? null,
  blockedReason: compactTask.blocker.condition ?? null,
  waitingFor: (compactTask.blocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: compactTask.blocker.resume_condition ?? null,
  observedBy: (compactTask.blocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: compactTask.blocker.observation_method ?? null,
  nextCheckAt: compactTask.blocker.next_check_at ?? null,
  blockerOwner: "operator",
  fallbackAt: compactTask.blocker.fallback_at ?? null,
  fallbackAction: compactTask.blocker.fallback_action ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary:
    "Projection parity repair aligned the app-owned aad-rbac compact state with the already-truthful residual-trio holder: exact live frontier tasks are the shared secops capacity-family wait plus the row-37 managed-v2 owner wait, while spec.aad-rbac.run-command-access remains represented only by reviewed-exception/domain evidence.",
  lastCheckedAt: new Date().toISOString(),
});

saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      memoPath,
      compact: {
        featureKey,
        taskId: compactTaskId,
        frontierTaskIds: [secopsTaskId, row37TaskId],
        blockedReason: compactTask.blocker.condition ?? null,
        waitingCondition: compactTask.blocker.resume_condition ?? null,
        nextCheckAt: compactTask.blocker.next_check_at ?? null,
        fallbackAt: compactTask.blocker.fallback_at ?? null,
      },
      runCommand: {
        specId: runCommandSpecId,
        catalogSpecState: runCommandSpec.catalogSpecState ?? null,
        reviewClassification: runCommandSpec.review?.classification ?? null,
        successorEvidencePath: runCommandSpec.successorEvidencePath ?? null,
        resumeCondition: runCommandSpec.resumeCondition ?? null,
      },
      paths: {
        compactStatePath,
        treePath,
        specLoopPath,
      },
    },
    null,
    2,
  ),
);
