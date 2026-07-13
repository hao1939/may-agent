import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  saveTaskTreeWithKanbanSnapshot,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

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

type CompactTaskBlocker = {
  condition?: string;
  waiting_for?: Record<string, unknown>;
  observed_by?: Record<string, unknown>;
  observation_method?: string;
  resume_condition?: string;
  next_check_at?: string;
  fallback_at?: string;
  fallback_action?: string;
};

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim())),
    ),
  ];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const specLoopPath = resolve(appDir, ".state/spec-loop/state.json");
const memoPath =
  "evidence/archive/ops-apply-reconcile-aad-rbac-compact-projection-trio-and-frontier-sync-2-20260713.md";
const featureKey = "aad-rbac";
const compactTaskId = "hold-compact-aad-rbac-package-partial-frontier";
const row37TaskId =
  "hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705";
const secopsTaskId =
  "wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702";
const runCommandSpecId = "spec.aad-rbac.run-command-access";
const expectedFrontierTaskIds = [row37TaskId, secopsTaskId];
const refreshedOwnerReason =
  "All feature-owned specs are already selected into the compact package, so the remaining controller-visible compact frontier is the reviewed residual trio: one shared capacity-family wait carrier, one row-37 owner-response wait carrier, and one run-command reviewed-exception/domain-evidence carrier rather than missing package membership or a truthful broad rerun candidate.";
const refreshedLastSummary =
  "Current aad-rbac compact partial is only the reviewed residual trio: wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702 and hold-spec-row37-managed-aad-lifecycle-contradiction-owner-20260705 remain the live blocked carriers, while spec.aad-rbac.run-command-access stays evidence-only under reviewed-exception/spec-loop/domain authority. No broad compact rerun is truthful. See evidence/archive/ops-apply-reconcile-aad-rbac-compact-projection-trio-and-frontier-sync-2-20260713.md.";
const refreshedSummary =
  "App-owned aad-rbac compact state now matches the reviewed residual trio projection: frontierTaskIds carry the live secops capacity-family wait plus the row-37 managed-v2 owner wait, while spec.aad-rbac.run-command-access remains represented only by reviewed-exception/spec-loop/domain evidence.";

const specLoop = JSON.parse(
  readFileSync(specLoopPath, "utf-8"),
) as SpecLoopState;
const runCommand = specLoop.specs?.[runCommandSpecId];

if (runCommand?.catalogSpecState !== "reviewed-exception") {
  throw new Error(
    `${runCommandSpecId} must remain reviewed-exception; got ${String(
      runCommand?.catalogSpecState ?? null,
    )}`,
  );
}

const taskConfig = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const treeRepair = withTreeLock(taskConfig, () => {
  const tree = readTaskTree(taskConfig);
  const compactTask = tree.tasks[compactTaskId] as TaskNode | undefined;
  if (!compactTask?.blocker || typeof compactTask.blocker !== "object") {
    throw new Error(`Missing blocker for ${compactTaskId}`);
  }
  const blocker = compactTask.blocker as CompactTaskBlocker;

  const beforeContext =
    compactTask.context && typeof compactTask.context === "object"
      ? { ...(compactTask.context as Record<string, unknown>) }
      : {};
  compactTask.context = {
    ...beforeContext,
    compactFrontierTaskIds: expectedFrontierTaskIds,
  };
  saveTaskTreeWithKanbanSnapshot(taskConfig, tree);
  return {
    blocker,
    beforeContext,
    afterContext: compactTask.context,
  };
});

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const existing = state.features[featureKey];
if (!existing) {
  throw new Error(`Compact feature not found: ${featureKey}`);
}

const before = {
  frontierTaskIds: existing.frontierTaskIds ?? null,
  ownerReason: existing.ownerReason ?? null,
  lastSummary: existing.lastSummary ?? null,
  reviewEvidencePath: existing.reviewEvidencePath ?? null,
};

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  taskId: compactTaskId,
  frontierTaskIds: expectedFrontierTaskIds,
  retryable: false,
  retryReason: treeRepair.blocker.resume_condition ?? null,
  blockedReason: treeRepair.blocker.condition ?? null,
  waitingFor: (treeRepair.blocker.waiting_for ?? null) as Record<
    string,
    unknown
  > | null,
  waitingCondition: treeRepair.blocker.resume_condition ?? null,
  observedBy: (treeRepair.blocker.observed_by ?? null) as Record<
    string,
    unknown
  > | null,
  observationMethod: treeRepair.blocker.observation_method ?? null,
  nextCheckAt: treeRepair.blocker.next_check_at ?? null,
  blockerOwner: "operator",
  fallbackAt: treeRepair.blocker.fallback_at ?? null,
  fallbackAction: treeRepair.blocker.fallback_action ?? null,
  ownerReason: refreshedOwnerReason,
  lastSummary: refreshedLastSummary,
  summary: refreshedSummary,
  reviewEvidencePath: memoPath,
  evidencePaths: unique([
    memoPath,
    "evidence/archive/domain-reconcile-aad-rbac-compact-projection-trio-and-frontier-sync-20260713.md",
    "evidence/archive/ops-sync-aad-rbac-controller-visible-frontier-trio-projection-20260713.md",
    "evidence/archive/ops-repair-aad-rbac-compact-projection-parity-20260713.md",
    "/app/projects/aks-rp-e2e/evidence/archive/bound-spec-aad-rbac-run-command-access-user-vs-serviceprincipal-branch-20260703.md",
    "/app/projects/aks-rp-e2e/evidence/archive/repair-aad-rbac-run-command-access-serviceprincipal-wording-drift-20260711.md",
    "/app/projects/aks-rp-e2e/evidence/archive/domain-aad-rbac-run-command-access-mounted-source-branch-options-20260712.md",
    ...(existing.evidencePaths ?? []),
  ]),
  attemptedFixes: unique([
    ...(existing.attemptedFixes ?? []),
    "Applied bounded app-owned frontier sync so aad-rbac compact state now carries both live blocked task ids for the reviewed residual trio and leaves spec.aad-rbac.run-command-access evidence-only.",
  ]),
  lastCheckedAt: new Date().toISOString(),
});

saveFeatureCompactLoopState(path, state);

const after = state.features[featureKey];

console.log(
  JSON.stringify(
    {
      memoPath,
      paths: {
        compactStatePath: path,
        treePath,
        specLoopPath,
      },
      holderContext: {
        before: treeRepair.beforeContext,
        after: treeRepair.afterContext,
      },
      before,
      after: {
        frontierTaskIds: after?.frontierTaskIds ?? null,
        ownerReason: after?.ownerReason ?? null,
        lastSummary: after?.lastSummary ?? null,
        reviewEvidencePath: after?.reviewEvidencePath ?? null,
        summary: after?.summary ?? null,
        waitingCondition: after?.waitingCondition ?? null,
        nextCheckAt: after?.nextCheckAt ?? null,
        fallbackAt: after?.fallbackAt ?? null,
      },
      runCommand: {
        specId: runCommandSpecId,
        catalogSpecState: runCommand?.catalogSpecState ?? null,
        reviewClassification: runCommand?.review?.classification ?? null,
        successorEvidencePath: runCommand?.successorEvidencePath ?? null,
        resumeCondition: runCommand?.resumeCondition ?? null,
      },
    },
    null,
    2,
  ),
);
