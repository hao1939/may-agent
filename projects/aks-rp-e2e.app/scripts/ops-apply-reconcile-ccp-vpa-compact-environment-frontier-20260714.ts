import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { readTaskTree } from "../workflows/lib/task-tree-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

const attemptId =
  "a_ops-apply-reconcile-ccp-vpa-compact-environment-frontier-20260714-state-_20260714035938";
const memoPath =
  "evidence/archive/ops-apply-reconcile-ccp-vpa-compact-environment-frontier-20260714-state-repair.md";
const loopTaskId = "aks-feature-compact-loop";
const featureKey = "ccp-vpa-os-arch-variants";
const holderTaskId =
  "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier";

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const config = taskTreeConfig({
  appDir,
  projectDir,
  worker: process.env.WORKER ?? "app-ops",
  maxConcurrent: 1,
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const tree = readTaskTree(config);
const holder = tree.tasks[holderTaskId];
assert(holder, `Missing live holder ${holderTaskId}`);
assert(holder.blocker && typeof holder.blocker === "object", `Missing blocker for ${holderTaskId}`);

const blocker = holder.blocker as {
  condition?: string;
  waiting_for?: Record<string, unknown>;
  observed_by?: Record<string, unknown>;
  observation_method?: string;
  resume_condition?: string;
  next_check_at?: string;
  fallback_at?: string;
  fallback_action?: string;
  owner?: string;
};

const { state, path: statePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const before = state.features[featureKey];
assert(before, `Missing compact-loop state for ${featureKey}`);

const attemptedFixes = unique([
  ...(Array.isArray(before.attemptedFixes) ? before.attemptedFixes : []),
  `${attemptId}: rewrote ${holderTaskId} to the final environment-carrier wording and synchronized the compact-loop projection to the live holder.`,
]);
const evidencePaths = unique([
  ...(Array.isArray(before.evidencePaths) ? before.evidencePaths : []),
  memoPath,
]);
const summary =
  `${attemptId}: synchronized compact-loop state for ${featureKey} to the rewritten final environment holder ${holderTaskId}.`;

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  retryReason: blocker.resume_condition ?? before.retryReason ?? null,
  attemptedFixes,
  resumeCondition: blocker.resume_condition ?? before.resumeCondition ?? null,
  blockedReason: blocker.condition ?? before.blockedReason ?? null,
  waitingFor: blocker.waiting_for ?? before.waitingFor ?? null,
  waitingCondition: blocker.resume_condition ?? before.waitingCondition ?? null,
  observedBy: blocker.observed_by ?? before.observedBy ?? null,
  observationMethod: blocker.observation_method ?? before.observationMethod ?? null,
  nextCheckAt: blocker.next_check_at ?? before.nextCheckAt ?? null,
  blockerOwner:
    (typeof blocker.owner === "string" && blocker.owner) || before.blockerOwner || null,
  fallbackAt: blocker.fallback_at ?? before.fallbackAt ?? null,
  fallbackAction: blocker.fallback_action ?? before.fallbackAction ?? null,
  lastCheckedAt: new Date().toISOString(),
  evidencePaths,
  reviewEvidencePath: memoPath,
  summary,
  lastSummary: summary,
});

saveFeatureCompactLoopState(statePath, state);

const after = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
}).state.features[featureKey];
assert(after, `Missing compact-loop state for ${featureKey} after save`);

console.log(
  JSON.stringify(
    {
      featureKey,
      holderTaskId,
      statePath,
      before: {
        taskId: before.taskId ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
        blockedReason: before.blockedReason ?? null,
        resumeCondition: before.resumeCondition ?? null,
        fallbackAction: before.fallbackAction ?? null,
      },
      after: {
        taskId: after.taskId ?? null,
        reviewEvidencePath: after.reviewEvidencePath ?? null,
        blockedReason: after.blockedReason ?? null,
        resumeCondition: after.resumeCondition ?? null,
        fallbackAction: after.fallbackAction ?? null,
        waitingFor: after.waitingFor ?? null,
        blockerOwner: after.blockerOwner ?? null,
      },
    },
    null,
    2,
  ),
);
