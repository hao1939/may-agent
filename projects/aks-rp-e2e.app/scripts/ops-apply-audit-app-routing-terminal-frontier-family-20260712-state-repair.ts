import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  saveSpecLoopState,
  updateSpecLoopSpec,
  type SpecLoopState,
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

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const attemptId =
  "a_ops-apply-audit-app-routing-terminal-frontier-family-20260712-state-repa_20260712225554";
const memoPath =
  "evidence/archive/ops-apply-audit-app-routing-terminal-frontier-family-20260712-state-repair.md";
const appliedAt = new Date().toISOString();
const quartetTaskId =
  "wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709";
const retiredSpecIds = [
  "spec.app-routing.default-domain-tls-secret",
  "spec.app-routing.default-domain-istio-hello-world",
  "spec.app-routing.rollback-istio-to-nginx",
] as const;

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) throw new Error(`Missing blocker for ${taskId}`);
  return task.blocker;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

const liveQuartetBlocker = blocker(quartetTaskId);

const compactLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactLoaded.state;
const compactBefore = compactState.features["app-routing"];
if (!compactBefore) {
  throw new Error("Missing compact-loop state for app-routing");
}

updateFeatureCompactItem(compactState, "app-routing", {
  status: "blocked",
  taskId: quartetTaskId,
  frontierTaskIds: [quartetTaskId],
  retryable: false,
  retryReason:
    liveQuartetBlocker.resume_condition ??
    compactBefore.retryReason ??
    null,
  blockedReason:
    liveQuartetBlocker.condition ?? compactBefore.blockedReason ?? null,
  waitingFor:
    (liveQuartetBlocker.waiting_for as Record<string, unknown> | undefined) ??
    compactBefore.waitingFor ??
    null,
  waitingCondition:
    liveQuartetBlocker.resume_condition ??
    compactBefore.waitingCondition ??
    null,
  observedBy:
    (liveQuartetBlocker.observed_by as Record<string, unknown> | undefined) ??
    compactBefore.observedBy ??
    null,
  observationMethod:
    liveQuartetBlocker.observation_method ??
    compactBefore.observationMethod ??
    null,
  nextCheckAt: liveQuartetBlocker.next_check_at ?? compactBefore.nextCheckAt ?? null,
  blockerOwner: liveQuartetBlocker.owner ?? compactBefore.blockerOwner ?? null,
  fallbackAt: liveQuartetBlocker.fallback_at ?? compactBefore.fallbackAt ?? null,
  fallbackAction:
    liveQuartetBlocker.fallback_action ?? compactBefore.fallbackAction ?? null,
  reviewEvidencePath: memoPath,
  lastCheckedAt: appliedAt,
  evidencePaths: unique([...(compactBefore.evidencePaths ?? []), memoPath]),
  summary:
    `${attemptId}: reprojected app-routing compact state to the sole live quartet wait ${quartetTaskId} after retiring the terminal non-environment holders.`,
  attemptedFixes: unique([
    ...(compactBefore.attemptedFixes ?? []),
    `${attemptId}: synchronized app-routing compact taskId/frontierTaskIds and blocked-watch fields to the sole live quartet wait ${quartetTaskId}.`,
  ]),
});
saveFeatureCompactLoopState(compactLoaded.path, compactState);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;
const specResults = retiredSpecIds.map((specId) => {
  const current = specState.specs[specId];
  if (!current) throw new Error(`Missing spec-loop state for ${specId}`);
  const before = {
    taskId: current.taskId ?? null,
    updatedAt: current.updatedAt ?? null,
  };
  updateSpecLoopSpec(specState, specId, { taskId: null });
  const after = specState.specs[specId];
  return {
    specId,
    before,
    after: {
      taskId: after?.taskId ?? null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});
saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      attemptId,
      memoPath,
      quartetTaskId,
      compact: {
        before: {
          taskId: compactBefore.taskId ?? null,
          frontierTaskIds: compactBefore.frontierTaskIds ?? null,
          nextCheckAt: compactBefore.nextCheckAt ?? null,
          fallbackAt: compactBefore.fallbackAt ?? null,
          reviewEvidencePath: compactBefore.reviewEvidencePath ?? null,
        },
        after: {
          taskId: compactState.features["app-routing"]?.taskId ?? null,
          frontierTaskIds:
            compactState.features["app-routing"]?.frontierTaskIds ?? null,
          nextCheckAt: compactState.features["app-routing"]?.nextCheckAt ?? null,
          fallbackAt: compactState.features["app-routing"]?.fallbackAt ?? null,
          reviewEvidencePath:
            compactState.features["app-routing"]?.reviewEvidencePath ?? null,
        },
      },
      specs: specResults,
      paths: {
        compactStatePath: compactLoaded.path,
        specStatePath,
        treePath,
      },
    },
    null,
    2,
  ),
);
