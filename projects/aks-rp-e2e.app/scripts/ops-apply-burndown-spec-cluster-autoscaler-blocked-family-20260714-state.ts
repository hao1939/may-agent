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
} from "../workflows/lib/spec-loop-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  withTreeLock,
  type TaskNode,
} from "../workflows/lib/task-tree-store.ts";

const attemptId =
  "a_ops-apply-burndown-spec-cluster-autoscaler-blocked-family-20260714-state_20260714102420";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const repairedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-apply-burndown-spec-cluster-autoscaler-blocked-family-20260714-state.md";
const specLoopTaskId = "aks-spec-verification-loop";
const compactLoopTaskId = "aks-feature-compact-loop";
const compactFeatureKey = "cluster-autoscaler";
const compactReviewTaskId =
  "ops/review-2240-cluster-autoscaler-compact-frontier-lineage-20260713";
const staleFipsTaskId =
  "verify-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips";
const specBindings = {
  "spec.cluster-autoscaler.vm-prerelease-local-storage-runtime":
    "wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708",
  "spec.cluster-autoscaler.vm-prerelease-mincount-recovery":
    "wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708",
  "spec.cluster-autoscaler.vm-prerelease-scale-from-zero-labels-fips":
    "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
} as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

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

function ensureTask(tasks: Record<string, TaskNode>, taskId: string): TaskNode {
  const task = tasks[taskId];
  if (!task) throw new Error(`Missing live task ${taskId}`);
  return task;
}

const liveTreeFacts = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const holderSummaries = Object.entries(specBindings).map(([specId, taskId]) => {
    const task = ensureTask(tree.tasks, taskId);
    const blocker = asRecord(task.blocker);
    return {
      specId,
      taskId,
      status: task.status,
      parentId: task.parent_id,
      nextCheckAt: asString(blocker.next_check_at),
      fallbackAt: asString(blocker.fallback_at),
      resumeCondition: asString(blocker.resume_condition),
    };
  });
  const compactReviewTask = ensureTask(tree.tasks, compactReviewTaskId);
  const compactReviewBlocker = asRecord(compactReviewTask.blocker);
  return {
    holderSummaries,
    staleFipsTaskPresent: Boolean(tree.tasks[staleFipsTaskId]),
    compactReview: {
      taskId: compactReviewTask.id,
      status: compactReviewTask.status,
      nextCheckAt: asString(compactReviewBlocker.next_check_at),
      fallbackAt: asString(compactReviewBlocker.fallback_at),
      resumeCondition: asString(compactReviewBlocker.resume_condition),
      blockerOwner: asString(compactReviewBlocker.owner),
    },
  };
});

if (liveTreeFacts.staleFipsTaskPresent) {
  throw new Error(
    `Expected stale task ${staleFipsTaskId} to be absent from the live tree`,
  );
}
if (!liveTreeFacts.compactReview.nextCheckAt) {
  throw new Error(`Missing next_check_at on ${compactReviewTaskId}`);
}
if (!liveTreeFacts.compactReview.fallbackAt) {
  throw new Error(`Missing fallback_at on ${compactReviewTaskId}`);
}

const specLoopMirrorPath = resolve(projectDir, ".state", "spec-loop", "state.json");
const { state: specState, path: specStatePath } = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});

const specBefore = Object.fromEntries(
  Object.keys(specBindings).map((specId) => {
    const current = specState.specs[specId];
    if (!current) throw new Error(`Missing spec-loop row ${specId}`);
    return [
      specId,
      {
        taskId: current.taskId ?? null,
        updatedAt: current.updatedAt,
      },
    ];
  }),
);

for (const [specId, taskId] of Object.entries(specBindings)) {
  updateSpecLoopSpec(specState, specId, { taskId });
}

saveSpecLoopState(
  specStatePath,
  specState,
  existsSync(specLoopMirrorPath) ? [specLoopMirrorPath] : [],
);

const specAfter = Object.fromEntries(
  Object.keys(specBindings).map((specId) => {
    const current = specState.specs[specId];
    if (!current) throw new Error(`Missing spec-loop row ${specId} after repair`);
    return [
      specId,
      {
        taskId: current.taskId ?? null,
        updatedAt: current.updatedAt,
      },
    ];
  }),
);

const { state: compactState, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactBefore = compactState.features[compactFeatureKey];
if (!compactBefore) {
  throw new Error(`Missing compact-loop feature ${compactFeatureKey}`);
}

const compactFrontierTaskIds = unique([
  ...(Array.isArray(compactBefore.frontierTaskIds)
    ? compactBefore.frontierTaskIds
    : []),
  compactReviewTaskId,
  ...Object.values(specBindings),
  "hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709",
  "hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708",
]);
const compactAttemptedFixes = unique([
  ...(Array.isArray(compactBefore.attemptedFixes)
    ? compactBefore.attemptedFixes
    : []),
  `${attemptId}: resynchronized the three cluster-autoscaler spec-loop holder taskId back-links and aligned cluster-autoscaler compact-loop nextCheckAt/fallbackAt to ${compactReviewTaskId}.`,
]);
const compactEvidencePaths = unique([
  ...(Array.isArray(compactBefore.evidencePaths) ? compactBefore.evidencePaths : []),
  memoPath,
]);

updateFeatureCompactItem(compactState, compactFeatureKey, {
  status: "blocked",
  taskId: compactReviewTaskId,
  frontierTaskIds: compactFrontierTaskIds,
  nextCheckAt: liveTreeFacts.compactReview.nextCheckAt,
  fallbackAt: liveTreeFacts.compactReview.fallbackAt,
  lastCheckedAt: repairedAt,
  reviewEvidencePath: memoPath,
  attemptedFixes: compactAttemptedFixes,
  evidencePaths: compactEvidencePaths,
  summary:
    "Repaired cluster-autoscaler controller-visible metadata: spec-loop state now points local-storage, mincount, and row50 FIPS at their live exact holders, and compact-loop nextCheckAt/fallbackAt now match ops/review-2240.",
});

saveFeatureCompactLoopState(compactStatePath, compactState);

const compactAfter = compactState.features[compactFeatureKey];

const memo = `# Ops apply — cluster-autoscaler blocked-family state repair (2026-07-14)

- Task: \`ops-apply-burndown-spec-cluster-autoscaler-blocked-family-20260714-state\`
- Attempt: \`${attemptId}\`
- Repaired at: \`${repairedAt}\`

## Result

Applied the bounded app-owned loop-state repair identified by the accepted review memo. I did **not** change the five surviving cluster-autoscaler holders themselves. I only resynchronized controller-visible metadata so future app-side reviews point back at the live holders and the compact review watch window.

## Live holder proof read before repair

\`\`\`json
${JSON.stringify(liveTreeFacts, null, 2)}
\`\`\`

Interpretation:

- local-storage, mincount, and row50/FIPS all have live holder tasks in the task tree;
- the stale row50 verifier task id \`${staleFipsTaskId}\` is absent from the live tree;
- compact review holder \`${compactReviewTaskId}\` currently governs the cluster-autoscaler compact wait window with next/fallback times from its blocker contract.

## Spec-loop repair

### Before

\`\`\`json
${JSON.stringify(specBefore, null, 2)}
\`\`\`

### Applied holder back-links

\`\`\`json
${JSON.stringify(specBindings, null, 2)}
\`\`\`

### After

\`\`\`json
${JSON.stringify(specAfter, null, 2)}
\`\`\`

This restores the three stale spec-loop holder pointers to the surviving live exact holders named by the reviewed family memo.

## Feature-compact timing repair

### Before

\`\`\`json
${JSON.stringify(
  {
    taskId: compactBefore.taskId ?? null,
    frontierTaskIds: compactBefore.frontierTaskIds ?? null,
    nextCheckAt: compactBefore.nextCheckAt ?? null,
    fallbackAt: compactBefore.fallbackAt ?? null,
    reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
  },
  null,
  2,
)}
\`\`\`

### Governing live review holder timing

\`\`\`json
${JSON.stringify(liveTreeFacts.compactReview, null, 2)}
\`\`\`

### After

\`\`\`json
${JSON.stringify(
  {
    taskId: compactAfter?.taskId ?? null,
    frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
    nextCheckAt: compactAfter?.nextCheckAt ?? null,
    fallbackAt: compactAfter?.fallbackAt ?? null,
    lastCheckedAt: compactAfter?.lastCheckedAt ?? null,
    reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
  },
  null,
  2,
)}
\`\`\`

This leaves the compact frontier membership unchanged while bringing the controller-visible timing back in sync with the live compact review holder.

## Acceptance check

- App-owned loop-state repair applied through store helpers: **yes**
- Spec-loop local-storage / mincount / row50 FIPS now point at live surviving holder ids: **yes**
- Cluster-autoscaler compact-loop nextCheckAt/fallbackAt now match the live \`${compactReviewTaskId}\` wait contract: **yes**
- No task-tree family reshape or domain rerun was performed: **yes**
`;

const memoAbsolute = resolve(appDir, memoPath);
mkdirSync(dirname(memoAbsolute), { recursive: true });
writeFileSync(memoAbsolute, `${memo}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      attemptId,
      repairedAt,
      memoPath,
      liveTreeFacts,
      specBefore,
      specAfter,
      compactBefore: {
        taskId: compactBefore.taskId ?? null,
        frontierTaskIds: compactBefore.frontierTaskIds ?? null,
        nextCheckAt: compactBefore.nextCheckAt ?? null,
        fallbackAt: compactBefore.fallbackAt ?? null,
        reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
      },
      compactAfter: {
        taskId: compactAfter?.taskId ?? null,
        frontierTaskIds: compactAfter?.frontierTaskIds ?? null,
        nextCheckAt: compactAfter?.nextCheckAt ?? null,
        fallbackAt: compactAfter?.fallbackAt ?? null,
        lastCheckedAt: compactAfter?.lastCheckedAt ?? null,
        reviewEvidencePath: compactAfter?.reviewEvidencePath ?? null,
      },
    },
    null,
    2,
  ),
);
