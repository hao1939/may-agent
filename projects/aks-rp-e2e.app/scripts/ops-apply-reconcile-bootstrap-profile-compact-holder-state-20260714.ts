import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  readTaskTree,
  withTreeLock,
} from "../workflows/lib/task-tree-store.ts";
import { taskTreeConfig } from "../workflows/lib/task-tree-tools.ts";

type HolderSnapshot = {
  id: string;
  state: string;
  status: string;
  goal: string | null;
  blocker: {
    condition: string | null;
    owner: string | null;
    waiting_for: Record<string, unknown> | null;
    observed_by: Record<string, unknown> | null;
    observation_method: string | null;
    resume_condition: string | null;
    next_check_at: string | null;
    fallback_at: string | null;
    fallback_action: string | null;
    blocked_at: string | null;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? ({ ...(value as Record<string, unknown>) } satisfies Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  ];
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const worker = process.env.WORKER ?? "app-ops";
const checkedAt = new Date().toISOString();

const featureKey = "bootstrap-profile";
const loopTaskId = "aks-feature-compact-loop";
const holderTaskId =
  "hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b";
const memoPath =
  "evidence/archive/ops-apply-reconcile-bootstrap-profile-compact-holder-state-20260714.md";
const repairNote =
  "Restored bootstrap-profile compact controller state from stale done/holder-free drift back to the live blocked holder hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b.";
const restoredSummary =
  "Bootstrap-profile remains blocked on the exact create-cache-acr0 runtime frontier from Azure DevOps run 171800822; controller-visible compact state now points at hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b instead of reporting the feature as done/holder-free.";

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const holder = withTreeLock(config, () => {
  const tree = readTaskTree(config);
  const loopTask = tree.tasks[loopTaskId];
  if (!loopTask) {
    throw new Error(`Task not found: ${loopTaskId}`);
  }
  const task = tree.tasks[holderTaskId];
  if (!task) {
    throw new Error(`Task not found: ${holderTaskId}`);
  }
  const blocker = asRecord(task.blocker);
  const snapshot: HolderSnapshot = {
    id: task.id,
    state: String(task.state ?? ""),
    status: String(task.status ?? task.state ?? ""),
    goal: asString(task.goal),
    blocker: {
      condition: asString(blocker?.condition),
      owner: asString(blocker?.owner) ?? asString(task.owner),
      waiting_for: asRecord(blocker?.waiting_for),
      observed_by: asRecord(blocker?.observed_by),
      observation_method: asString(blocker?.observation_method),
      resume_condition: asString(blocker?.resume_condition),
      next_check_at: asString(blocker?.next_check_at),
      fallback_at: asString(blocker?.fallback_at),
      fallback_action: asString(blocker?.fallback_action),
      blocked_at: asString(blocker?.blocked_at),
    },
  };

  if (snapshot.state !== "blocked" || snapshot.status !== "blocked") {
    throw new Error(
      `Expected ${holderTaskId} to remain blocked, got state=${snapshot.state} status=${snapshot.status}`,
    );
  }
  if (!snapshot.goal?.includes("bootstrap-profile")) {
    throw new Error(`Unexpected holder goal for ${holderTaskId}: ${snapshot.goal ?? "null"}`);
  }
  if (!snapshot.blocker.condition || !snapshot.blocker.resume_condition) {
    throw new Error(`Holder ${holderTaskId} is missing the blocked wait contract text`);
  }
  return snapshot;
});

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId,
  windowSize: 1,
  refreshFromProject: false,
});
const before = state.features[featureKey];
if (!before) {
  throw new Error(`Missing feature-compact state for ${featureKey}`);
}

const priorEvidencePaths = Array.isArray(before.evidencePaths)
  ? before.evidencePaths.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    )
  : [];
const priorAttemptedFixes = Array.isArray(before.attemptedFixes)
  ? before.attemptedFixes.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    )
  : [];
const attemptedFixes = priorAttemptedFixes.includes(repairNote)
  ? priorAttemptedFixes
  : [...priorAttemptedFixes, repairNote];
const evidencePaths = uniqueStrings([memoPath, before.reviewEvidencePath ?? null, ...priorEvidencePaths]);

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  retryReason: holder.blocker.resume_condition,
  taskId: holderTaskId,
  frontierTaskIds: [holderTaskId],
  blockedAt: holder.blocker.blocked_at,
  blockedReason: holder.blocker.condition,
  waitingFor: holder.blocker.waiting_for,
  waitingCondition: holder.blocker.resume_condition,
  observedBy: holder.blocker.observed_by,
  observationMethod: holder.blocker.observation_method,
  resumeCondition: holder.blocker.resume_condition,
  nextCheckAt: holder.blocker.next_check_at,
  blockerOwner: holder.blocker.owner,
  fallbackAt: holder.blocker.fallback_at,
  fallbackAction: holder.blocker.fallback_action,
  resumeAction:
    "Resume this feature only after materially new same-lineage create-cache-acr0 evidence, a bounded same-path repair, or a newer same-spec artifact bundle changes the exact runtime frontier.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    featureKey,
    target: "staging",
    holderTaskId,
    rootCauseClassification:
      before.rootCauseClassification ?? "agent-pool-bring-up-evidence-ceiling",
  },
  lastCheckedAt: checkedAt,
  reviewEvidencePath: memoPath,
  evidencePaths,
  attemptedFixes,
  summary: restoredSummary,
  lastSummary: restoredSummary,
});

saveFeatureCompactLoopState(path, state);

const after = state.features[featureKey];

console.log(
  JSON.stringify(
    {
      checkedAt,
      memoPath,
      compactStatePath: path,
      holder,
      before: {
        status: before.status,
        taskId: before.taskId ?? null,
        frontierTaskIds: before.frontierTaskIds ?? null,
        waitingFor: before.waitingFor ?? null,
        nextCheckAt: before.nextCheckAt ?? null,
        fallbackAt: before.fallbackAt ?? null,
        blockerOwner: before.blockerOwner ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
      },
      after: after
        ? {
            status: after.status,
            taskId: after.taskId ?? null,
            frontierTaskIds: after.frontierTaskIds ?? null,
            waitingFor: after.waitingFor ?? null,
            nextCheckAt: after.nextCheckAt ?? null,
            fallbackAt: after.fallbackAt ?? null,
            blockerOwner: after.blockerOwner ?? null,
            blockedReason: after.blockedReason ?? null,
            resumeCondition: after.resumeCondition ?? null,
            reviewEvidencePath: after.reviewEvidencePath ?? null,
            summary: after.summary ?? null,
          }
        : null,
    },
    null,
    2,
  ),
);
