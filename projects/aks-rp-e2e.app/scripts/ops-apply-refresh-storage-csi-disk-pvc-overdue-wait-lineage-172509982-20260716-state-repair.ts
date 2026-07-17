import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
  type FeatureCompactItemState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { defaultSpecLoopStatePath } from "../workflows/lib/spec-loop-store.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

const attemptId =
  "a_ops-apply-refresh-storage-csi-disk-pvc-overdue-wait-lineage-172509982-20260716-state-repair_20260716140517";
const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const appliedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-apply-refresh-storage-csi-disk-pvc-overdue-wait-lineage-172509982-20260716-state-repair.md";
const featureKey = "storage-csi";
const compactLoopTaskId = "aks-feature-compact-loop";
const compactHolderTaskId = "hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707";
const retiredWaitTaskId = "wait-storage-csi-disk-pvc-compact-ado-run-172509982-result";
const successorTaskId =
  "align-storage-csi-direct-vitest-live-request-contract-disk-replacement-live-proof";
const mcrWaitTaskId =
  "wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function summarizeTask(task: Record<string, unknown> | undefined) {
  return task
    ? {
        id: task.id ?? null,
        state: task.state ?? task.status ?? null,
        resolution: task.resolution ?? null,
        result: task.result ?? null,
      }
    : null;
}

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

const tree = readTaskTree(config);
const retiredWait = tree.tasks[retiredWaitTaskId] as Record<string, unknown> | undefined;
const successor = tree.tasks[successorTaskId] as Record<string, unknown> | undefined;
const compactHolder = tree.tasks[compactHolderTaskId] as Record<string, unknown> | undefined;
const mcrWait = tree.tasks[mcrWaitTaskId] as Record<string, unknown> | undefined;
assert(retiredWait, `Missing task ${retiredWaitTaskId}`);
assert(successor, `Missing task ${successorTaskId}`);
assert(compactHolder, `Missing task ${compactHolderTaskId}`);
assert(mcrWait, `Missing task ${mcrWaitTaskId}`);
assert(
  asString(retiredWait.state) === "done" && asString(retiredWait.resolution) === "replaced",
  `${retiredWaitTaskId} must already be done/replaced before compact-state repair`,
);
assert(asString(successor.state) === "active", `${successorTaskId} is no longer active`);
assert(
  asString(compactHolder.state) === "blocked",
  `${compactHolderTaskId} is no longer the blocked compact holder`,
);
assert(asString(mcrWait.state) === "blocked", `${mcrWaitTaskId} is no longer blocked`);

const compactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: compactLoopTaskId,
  windowSize: 1,
  statePath: compactStatePath,
  refreshFromProject: false,
});
const featureBefore = compactLoaded.state.features[featureKey];
assert(featureBefore, `Missing compact feature state for ${featureKey}`);
assert(
  featureBefore.taskId === compactHolderTaskId,
  `${featureKey} compact taskId drifted: expected ${compactHolderTaskId}, got ${String(featureBefore.taskId ?? null)}`,
);

const desiredFrontierTaskIds = [mcrWaitTaskId];
const beforeFrontierTaskIds = asStringArray(featureBefore.frontierTaskIds);
const attemptedFix =
  `${attemptId}: retired stale run-172509982 passive wait in favor of ${successorTaskId} and restored ${featureKey} compact frontierTaskIds to the accepted exact MCR wait ${mcrWaitTaskId}.`;
const summary =
  `${attemptId}: marked ${retiredWaitTaskId} replaced by ${successorTaskId} and removed the stale Disk wait from ${featureKey} compact frontierTaskIds so the compact row again points only at ${mcrWaitTaskId}.`;

updateFeatureCompactItem(compactLoaded.state, featureKey, {
  status: featureBefore.status,
  taskId: compactHolderTaskId,
  frontierTaskIds: desiredFrontierTaskIds,
  reviewEvidencePath: memoPath,
  evidencePaths: unique([...(featureBefore.evidencePaths ?? []), memoPath]),
  attemptedFixes: unique([...(featureBefore.attemptedFixes ?? []), attemptedFix]),
  summary,
  lastSummary: summary,
  lastCheckedAt: appliedAt,
});
saveFeatureCompactLoopState(compactStatePath, compactLoaded.state);

const compactAfter = JSON.parse(readFileSync(compactStatePath, "utf-8")) as {
  features?: Record<string, FeatureCompactItemState>;
};
const featureAfter = compactAfter.features?.[featureKey];
assert(featureAfter, `Missing compact feature state for ${featureKey} after save`);
assert(
  JSON.stringify(asStringArray(featureAfter.frontierTaskIds)) === JSON.stringify(desiredFrontierTaskIds),
  `${featureKey}.frontierTaskIds=${JSON.stringify(featureAfter.frontierTaskIds ?? null)} (expected ${JSON.stringify(desiredFrontierTaskIds)})`,
);
assert(
  asString(featureAfter.reviewEvidencePath) === memoPath,
  `${featureKey}.reviewEvidencePath=${String(featureAfter.reviewEvidencePath ?? null)} (expected ${memoPath})`,
);
assert(
  !asStringArray(featureAfter.frontierTaskIds).includes(retiredWaitTaskId),
  `${retiredWaitTaskId} still appears in ${featureKey}.frontierTaskIds after repair`,
);

const specLoopText = readFileSync(defaultSpecLoopStatePath(appDir), "utf-8");
const specLoopHasRetiredWait = specLoopText.includes(retiredWaitTaskId);

const memo = `# App apply — Storage CSI overdue wait lineage replacement repair — 2026-07-16

- Attempt: \`${attemptId}\`
- Applied at: \`${appliedAt}\`
- Worker: \`${process.env.WORKER ?? "app-ops"}\`
- Replaced wait: \`${retiredWaitTaskId}\`
- Active successor holder: \`${successorTaskId}\`
- Compact holder: \`${compactHolderTaskId}\`
- Restored compact frontier wait: \`${mcrWaitTaskId}\`

## Baseline

- \`${retiredWaitTaskId}\` before this apply step had already been observed as a stale blocked wait whose own review window expired at \`2026-07-16T13:30:00Z\`.
- Live task-tree baseline for this session confirmed \`${successorTaskId}\` was already \`active\` as the single Disk replacement-proof holder.
- \`.state/feature-compact-loop/state.json\` still pointed \`${featureKey}.frontierTaskIds\` at the stale Disk wait: \`${JSON.stringify(beforeFrontierTaskIds)}\`.
- \`.state/spec-loop/state.json\` contained no \`${retiredWaitTaskId}\` reference before or after this repair: \`${String(specLoopHasRetiredWait)}\`.

## Applied repair

1. Used the supported task-tree CLI to retire \`${retiredWaitTaskId}\` as \`resolution=replaced\` in favor of \`${successorTaskId}\`.
2. Used the app loop-state helper \`updateFeatureCompactItem\` to restore \`${featureKey}\` compact frontier state to the accepted exact wait \`${mcrWaitTaskId}\`.
3. Recorded this memo on the compact feature row via \`reviewEvidencePath\` and \`evidencePaths\` so the branch has a durable audit trail for the repair.

## Post-repair state

- Replaced wait task: \`${JSON.stringify(summarizeTask(retiredWait))}\`
- Successor holder: \`${JSON.stringify(summarizeTask(successor))}\`
- Compact feature frontier before: \`${JSON.stringify(beforeFrontierTaskIds)}\`
- Compact feature frontier after: \`${JSON.stringify(featureAfter.frontierTaskIds ?? null)}\`
- Compact feature reviewEvidencePath after: \`${String(featureAfter.reviewEvidencePath ?? null)}\`

## Outcome

The stale passive wait on run \`172509982\` is retired, the active Disk replacement-proof holder remains \`${successorTaskId}\`, and controller-visible compact state no longer misrepresents Storage CSI with the obsolete Disk wait.
`;

const memoAbsPath = resolve(appDir, memoPath);
mkdirSync(dirname(memoAbsPath), { recursive: true });
writeFileSync(memoAbsPath, memo, "utf-8");

console.log(
  JSON.stringify(
    {
      attemptId,
      appliedAt,
      memoPath,
      retiredWait: summarizeTask(retiredWait),
      successor: summarizeTask(successor),
      compactFeature: {
        beforeFrontierTaskIds,
        afterFrontierTaskIds: featureAfter.frontierTaskIds ?? null,
        reviewEvidencePath: featureAfter.reviewEvidencePath ?? null,
      },
      specLoopHasRetiredWait,
    },
    null,
    2,
  ),
);
