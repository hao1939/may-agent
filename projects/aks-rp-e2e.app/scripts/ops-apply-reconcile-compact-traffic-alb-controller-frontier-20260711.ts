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
        resume_condition?: string;
        observed_by?: Record<string, unknown>;
        observation_method?: string;
        next_check_at?: string;
        fallback_at?: string;
        fallback_action?: string;
      };
      context?: {
        workflowProgress?: Record<string, unknown>;
      };
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const featureKey = "traffic-alb-controller";
const holderTaskId = "hold-compact-traffic-alb-controller-package-partial-frontier";
const memoPath =
  "evidence/archive/ops-apply-reconcile-compact-traffic-alb-controller-frontier-20260711-state-repair.md";
const attemptId =
  "a_ops-apply-reconcile-compact-traffic-alb-controller-frontier-20260711-sta_20260711142143";
const checkedAt = new Date().toISOString();

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const before = state.features[featureKey];
if (!before) {
  throw new Error(`Missing compact feature state for ${featureKey}`);
}

const holder = tree.tasks[holderTaskId];
if (!holder?.blocker) {
  throw new Error(`Missing live blocker for ${holderTaskId}`);
}

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  blockedReason: holder.blocker.condition ?? before.blockedReason ?? null,
  waitingFor:
    (holder.blocker.waiting_for ?? before.waitingFor ?? null) as
      | Record<string, unknown>
      | null,
  waitingCondition:
    holder.blocker.resume_condition ?? before.waitingCondition ?? null,
  observedBy:
    (holder.blocker.observed_by ?? before.observedBy ?? null) as
      | Record<string, unknown>
      | null,
  observationMethod:
    holder.blocker.observation_method ?? before.observationMethod ?? null,
  nextCheckAt: holder.blocker.next_check_at ?? before.nextCheckAt ?? null,
  fallbackAt: holder.blocker.fallback_at ?? before.fallbackAt ?? null,
  fallbackAction:
    holder.blocker.fallback_action ?? before.fallbackAction ?? null,
  blockerOwner: holder.blocker.owner ?? before.blockerOwner ?? null,
  reviewEvidencePath: memoPath,
  summary:
    "Restored traffic-alb-controller compact-loop projection to the exact compact holder hold-compact-traffic-alb-controller-package-partial-frontier and aligned frontierTaskIds/blocker metadata with the live blocked wait; workflowProgress already shows the feature represented and no longer unrepresented.",
  lastCheckedAt: checkedAt,
});

saveFeatureCompactLoopState(path, state);

const after = state.features[featureKey];
const workflowProgress =
  tree.tasks["aks-feature-compact-loop"]?.context?.workflowProgress ?? null;

console.log(
  JSON.stringify(
    {
      attemptId,
      featureKey,
      statePath: path,
      holderTaskId,
      before: {
        taskId: before.taskId ?? null,
        frontierTaskIds: before.frontierTaskIds ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
        summary: before.summary ?? null,
        updatedAt: before.updatedAt ?? null,
        lastCheckedAt: before.lastCheckedAt ?? null,
      },
      after: {
        taskId: after.taskId ?? null,
        frontierTaskIds: after.frontierTaskIds ?? null,
        reviewEvidencePath: after.reviewEvidencePath ?? null,
        summary: after.summary ?? null,
        updatedAt: after.updatedAt ?? null,
        lastCheckedAt: after.lastCheckedAt ?? null,
        waitingFor: after.waitingFor ?? null,
        nextCheckAt: after.nextCheckAt ?? null,
        fallbackAt: after.fallbackAt ?? null,
      },
      workflowProgress: workflowProgress
        ? {
            representedFeatureKeys: Array.isArray(
              workflowProgress.representedFeatureKeys,
            )
              ? workflowProgress.representedFeatureKeys
              : null,
            unrepresentedBlockedFeatureKeys: Array.isArray(
              workflowProgress.unrepresentedBlockedFeatureKeys,
            )
              ? workflowProgress.unrepresentedBlockedFeatureKeys
              : null,
            unrepresentedNonTerminalFeatureKeys: Array.isArray(
              workflowProgress.unrepresentedNonTerminalFeatureKeys,
            )
              ? workflowProgress.unrepresentedNonTerminalFeatureKeys
              : null,
            updatedAt:
              typeof workflowProgress.updatedAt === "string"
                ? workflowProgress.updatedAt
                : null,
          }
        : null,
    },
    null,
    2,
  ),
);
