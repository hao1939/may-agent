import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import { defaultSpecLoopStatePath, type SpecLoopState } from "../workflows/lib/spec-loop-store.ts";

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

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const memoPath =
  "evidence/archive/ops-apply-review-localdns-three-family-frontier-now-app-ops-20260712.md";
const featureKey = "localdns";
const compactTaskId = "hold-compact-localdns-package-partial-frontier";
const quotaTaskId = "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708";
const residualTaskId = "wait-localdns-create-http400-residual-family-return-20260704";
const reviewedTaskId =
  "hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c";
const specId = "spec.localdns.network-policy-coexistence";
const refreshedAt = "2026-07-12T12:53:18Z";

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

const compactBlocker = blocker(compactTaskId);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;
const specStateEntry = specState.specs[specId];
if (!specStateEntry) {
  throw new Error(`Missing spec-loop state for ${specId}`);
}
if (specStateEntry.taskId !== residualTaskId) {
  throw new Error(
    `Expected ${specId} taskId=${residualTaskId}; found ${specStateEntry.taskId ?? "null"}`,
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
  new Set([memoPath, ...existingEvidencePaths.filter((value): value is string => typeof value === "string" && value.trim().length > 0)]),
);

updateFeatureCompactItem(compactState, featureKey, {
  status: "blocked",
  taskId: compactTaskId,
  frontierTaskIds: [quotaTaskId, residualTaskId, reviewedTaskId],
  retryable: false,
  retryReason: compactBlocker.resume_condition ?? null,
  blockedReason: compactBlocker.condition ?? null,
  waitingFor: (compactBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: compactBlocker.resume_condition ?? null,
  observedBy: (compactBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: compactBlocker.observation_method ?? null,
  nextCheckAt: compactBlocker.next_check_at ?? null,
  blockerOwner: "operator",
  fallbackAt: compactBlocker.fallback_at ?? null,
  fallbackAction: compactBlocker.fallback_action ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary:
    "App-state repair restored the LocalDNS residual HTTP400 carrier and re-synchronized compact-facing frontierTaskIds to the quota/headroom + network-policy HTTP400 residual + reviewed-exception multipool/windows trio, leaving hosts-plugin spec-loop-only.",
  updatedAt: refreshedAt,
  lastCheckedAt: refreshedAt,
});
saveFeatureCompactLoopState(compactStatePath, compactState);

console.log(
  JSON.stringify(
    {
      memoPath,
      compact: {
        featureKey,
        taskId: compactTaskId,
        frontierTaskIds: [quotaTaskId, residualTaskId, reviewedTaskId],
        reviewEvidencePath: memoPath,
        nextCheckAt: compactBlocker.next_check_at ?? null,
        fallbackAt: compactBlocker.fallback_at ?? null,
      },
      spec: {
        specId,
        taskId: specStateEntry.taskId,
        lastRunId: specStateEntry.lastRunId,
      },
      paths: {
        compactStatePath,
        specStatePath,
      },
    },
    null,
    2,
  ),
);
