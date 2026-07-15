import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  loadSpecLoopState,
  type SpecLoopSpecState,
} from "../workflows/lib/spec-loop-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";

const attemptId =
  "a_ops_repair-serverless-mounted-vmss-task-linkage-20260715_20260715005125";
const worker = process.env.WORKER ?? "app-ops";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const checkedAt = new Date().toISOString();

const currentTaskId = "ops/repair-serverless-mounted-vmss-task-linkage-20260715";
const featureKey = "serverless";
const loopTaskId = "aks-feature-compact-loop";
const specLoopTaskId = "aks-spec-verification-loop";
const specId =
  "spec.serverless-virtual-nodes.addonv2-aci-connector-mounted-vmss-lifecycle";
const archivedTaskId =
  "wait-spec-serverless-virtual-nodes-mounted-vmss-rerun-171356203-return-20260708";
const successorTaskId =
  "wait-spec-serverless-mounted-vmss-runtime-witness-nonconvergence-171356203-20260715";
const compactRepairLeaf =
  "domain/repair-serverless-compact-readiness-vs-model-20260715";
const memoRelativePath =
  "evidence/archive/ops-repair-serverless-mounted-vmss-task-linkage-20260715.md";
const memoPath = resolve(appDir, memoRelativePath);
const serverlessHolderMemo =
  "evidence/archive/ops-apply-reconcile-serverless-virtual-nodes-holder-vs-model-20260715-st.md";
const domainReviewMemoPath =
  "/app/projects/aks-rp-e2e/evidence/archive/review-serverless-mounted-vmss-runtime-witness-frontier-20260710.md";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function specSnapshot(spec: SpecLoopSpecState | undefined): Record<string, unknown> | null {
  if (!spec) return null;
  return {
    status: spec.status,
    taskId: spec.taskId ?? null,
    lastRunId: spec.lastRunId,
    successorDisposition: spec.successorDisposition ?? null,
    successorStateReason: spec.successorStateReason ?? null,
    resumeCondition: spec.resumeCondition ?? null,
    review: spec.review ?? null,
    diagnosis: spec.diagnosis ?? null,
    updatedAt: spec.updatedAt,
  };
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const featureBefore = compactState.features[featureKey];
assert(featureBefore, `Missing feature-compact row for ${featureKey}`);
assert(featureBefore.taskId === compactRepairLeaf, `Expected ${featureKey} taskId ${compactRepairLeaf}, found ${featureBefore.taskId ?? "(null)"}`);
const hadStaleFallbackReference =
  typeof featureBefore.fallbackAction === "string" &&
  featureBefore.fallbackAction.includes(archivedTaskId);

const specLoaded = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
});
const specBefore = specLoaded.state.specs[specId];
assert(specBefore, `Missing spec-loop row for ${specId}`);
assert(specBefore.taskId === successorTaskId, `Expected spec-loop taskId ${successorTaskId}, found ${specBefore.taskId ?? "(null)"}`);

const tree = readTaskTree(config);
const successorTask = tree.tasks[successorTaskId];
const archivedTask = tree.tasks[archivedTaskId];
assert(successorTask, `Missing live successor task ${successorTaskId}`);
assert(!archivedTask, `Archived task ${archivedTaskId} unexpectedly exists in live tree`);

const repairedFallbackAction =
  `If ${compactRepairLeaf} remains incomplete at fallback, re-review whether the compact readout repair leaf is still the sharpest active representation or whether a sharper same-lineage holder/task now exists. The mounted-VMSS linkage drift for ${specId} is already normalized to live carrier ${successorTaskId}; keep any follow-up on that live carrier lineage only.`;
const summary =
  `${attemptId}: removed the stale archived mounted-VMSS fallback reference from the app-owned ${featureKey} feature-compact row while preserving the already-correct live mounted-VMSS carrier ${successorTaskId} in spec-loop/task-tree state.`;
const attemptedFixes = unique([
  ...(Array.isArray(featureBefore.attemptedFixes) ? featureBefore.attemptedFixes : []).filter(
    (entry) => !entry.includes(archivedTaskId),
  ),
  `${attemptId}: removed the stale archived mounted-VMSS fallback reference after verifying spec-loop already pointed at live carrier ${successorTaskId} and the archived task was absent from the live task tree.`,
]);
const evidencePaths = unique([
  ...(Array.isArray(featureBefore.evidencePaths) ? featureBefore.evidencePaths : []),
  memoRelativePath,
  serverlessHolderMemo,
  domainReviewMemoPath,
]);

updateFeatureCompactItem(compactState, featureKey, {
  status: featureBefore.status,
  taskId: featureBefore.taskId,
  frontierTaskIds: featureBefore.frontierTaskIds ?? [],
  retryable: featureBefore.retryable ?? false,
  retryReason: featureBefore.retryReason ?? null,
  ownerReason: featureBefore.ownerReason ?? null,
  attemptedFixes,
  summary,
  lastSummary: summary,
  lastCheckedAt: checkedAt,
  evidencePaths,
  fallbackAction: repairedFallbackAction,
});

saveFeatureCompactLoopState(compactLoaded.path, compactState);

const featureAfter = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
assert(featureAfter, `Missing feature-compact row for ${featureKey} after save`);
assert(featureAfter.taskId === compactRepairLeaf, `Expected unchanged taskId ${compactRepairLeaf}`);
assert(
  typeof featureAfter.fallbackAction === "string" && !featureAfter.fallbackAction.includes(archivedTaskId),
  `FallbackAction still references archived task ${archivedTaskId}`,
);

const specAfter = loadSpecLoopState({
  appDir,
  projectDir,
  loopTaskId: specLoopTaskId,
  windowSize: 5,
}).state.specs[specId];
assert(specAfter, `Missing spec-loop row for ${specId} after save`);
assert(specAfter.taskId === successorTaskId, `Spec-loop taskId drifted away from ${successorTaskId}`);

const memo = `# App retry apply: repair serverless mounted-VMSS task linkage — 2026-07-15

- Task: \`${currentTaskId}\`
- Attempt: \`${attemptId}\`
- Checked at: \`${checkedAt}\`
- App state repaired: \`.state/feature-compact-loop/state.json\`
- Verified unchanged live carrier: \`${successorTaskId}\`
- Verified absent archived id: \`${archivedTaskId}\`

## What was already true before this retry

This retry did **not** create a new carrier and did **not** rebind the spec-loop row again.
Those parts were already true before this attempt:

- live task-tree entry \`${successorTaskId}\` existed
- live task-tree entry \`${archivedTaskId}\` did **not** exist
- app-owned spec-loop row for \`${specId}\` already pointed at \`${successorTaskId}\`

The remaining defect was narrower: the app-owned feature-compact row for \`${featureKey}\` still carried the archived id in \`fallbackAction\`, leaving one actionable loop-state pointer to a task that no longer exists.

## Current live task-tree verification

- \`${successorTaskId}\` exists in the live tree: **yes**
- current live task-tree state for \`${successorTaskId}\`: **${String(successorTask.state ?? successorTask.status ?? "unknown")}**
- \`${archivedTaskId}\` exists in the live tree: **no**

Note: prior review expected the successor carrier to appear as blocked. By the time of this retry, the exact same carrier id still exists but currently shows state \`${String(successorTask.state ?? "unknown")}\` because downstream review advanced that task after the linkage repair. The linkage acceptance for this task is carrier existence + correct app-owned references, not forcing the carrier back to an earlier state.

## Before repair: exact remaining mismatch

### Feature-compact row before retry

\`\`\`json
${JSON.stringify(
  {
    taskId: featureBefore.taskId ?? null,
    status: featureBefore.status,
    fallbackAction: featureBefore.fallbackAction ?? null,
    reviewEvidencePath: featureBefore.reviewEvidencePath ?? null,
    updatedAt: featureBefore.updatedAt,
  },
  null,
  2,
)}
\`\`\`

### Spec-loop row before retry (already correct)

\`\`\`json
${JSON.stringify(specSnapshot(specBefore), null, 2)}
\`\`\`

## Applied retry repair

1. Kept the existing feature-level holder \`${compactRepairLeaf}\` unchanged.
2. Rewrote only the \`${featureKey}\` feature-compact \`fallbackAction\` so it no longer tells the controller to inspect missing task id \`${archivedTaskId}\` as unresolved drift.
3. Recorded this retry attempt in controller-visible compact metadata and refreshed this memo.
4. Left the spec-loop row and live task-tree carrier unchanged because they were already linked to \`${successorTaskId}\` before this retry.

## After repair

### Feature-compact row after retry

\`\`\`json
${JSON.stringify(
  {
    taskId: featureAfter.taskId ?? null,
    status: featureAfter.status,
    fallbackAction: featureAfter.fallbackAction ?? null,
    reviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
    updatedAt: featureAfter.updatedAt,
  },
  null,
  2,
)}
\`\`\`

### Spec-loop row after retry (still correct)

\`\`\`json
${JSON.stringify(specSnapshot(specAfter), null, 2)}
\`\`\`

## Reclassification note

The accepted mounted-VMSS frontier remains the evidence-backed runtime-witness nonconvergence described in domain review memo \`${domainReviewMemoPath}\`:
- run 171356203 reached \`setup.vnet-created\` HTTP 200
- cluster create succeeded
- addon identity role assignment succeeded
- kubeconfig retrieval succeeded
- runtime witnesses failed with \`attempt=60; helm=false; pod=false; virtualNode=false; requireVirtualNode=false\`

So the truthful exact carrier remains \`${successorTaskId}\`, not the old HTTP 429 VNet-create wait.

## Outcome

After this retry, no app-owned active loop-state pointer for the mounted-VMSS surface names absent task id \`${archivedTaskId}\` as an actionable next step. The archived id now remains only as historical/superseded context in the spec-loop reclassification text, task-tree replacement metadata, this repair task history, and this audit memo.`;

mkdirSync(dirname(memoPath), { recursive: true });
writeFileSync(memoPath, memo, "utf-8");

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      currentTaskId,
      tree: {
        successorTaskId,
        successorState: successorTask.state ?? successorTask.status ?? null,
        archivedTaskPresent: false,
      },
      featureCompact: {
        before: {
          taskId: featureBefore.taskId ?? null,
          fallbackAction: featureBefore.fallbackAction ?? null,
        },
        after: {
          taskId: featureAfter.taskId ?? null,
          fallbackAction: featureAfter.fallbackAction ?? null,
        },
      },
      specLoop: {
        before: specSnapshot(specBefore),
        after: specSnapshot(specAfter),
      },
      memoPath,
    },
    null,
    2,
  ),
);
