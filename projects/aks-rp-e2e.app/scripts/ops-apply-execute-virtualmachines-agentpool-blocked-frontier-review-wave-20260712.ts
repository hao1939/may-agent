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
      blocker?: Record<string, unknown>;
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const attemptId =
  "a_ops-apply-execute-virtualmachines-agentpool-blocked-frontier-review-wave_20260712151132";
const checkedAt = new Date().toISOString();
const evidencePath =
  "evidence/archive/ops-apply-execute-virtualmachines-agentpool-blocked-frontier-review-wave-20260712.md";
const sourceReviewMemo =
  "evidence/archive/ops-execute-virtualmachines-agentpool-blocked-frontier-review-wave-app-ops-20260712f.md";
const featureKey = "virtualmachines-agentpool";
const holderTaskIds = [
  "hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708",
  "hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708",
  "hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708",
  "hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b",
] as const;
const familyHolderTaskId =
  "hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
    .sort((a, b) => a.localeCompare(b));
}

function blocker(taskId: string): Record<string, unknown> {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return asRecord(task.blocker);
}

const familyBlocker = blocker(familyHolderTaskId);
const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const feature = state.features[featureKey];
if (!feature) throw new Error(`Missing feature state for ${featureKey}`);

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  errorClass: "package-partial",
  retryable: false,
  taskId: familyHolderTaskId,
  frontierTaskIds: [...holderTaskIds],
  retryReason: asString(familyBlocker.resume_condition),
  rootCauseClassification: "repo-local-spec-metadata-split-frontier",
  ownerReason:
    "The 2026-07-12 15:10Z blocked-frontier family review preserved the same exact four-holder virtualmachines-agentpool split frontier, so the compact branch still waits on those exact holders rather than a broader rerun or duplicate family wait.",
  attemptedFixes: unique([
    ...asStringArray(feature.attemptedFixes),
    `${attemptId}: refreshed the four preserved virtualmachines-agentpool holder waits to the 2026-07-12 15:10Z review evidence, moved next_check_at/resume_at to 2026-07-13T15:00:00Z with fallback_at 2026-07-14T15:00:00Z, and synchronized compact-loop state to the unchanged four-holder representation.`,
  ]),
  nextStepClassification:
    "preserve the exact four-holder virtualmachines-agentpool split frontier and re-review at 2026-07-13T15:00:00Z unless one preserved same-surface frontier changes earlier",
  resumeCondition: asString(familyBlocker.resume_condition),
  blockedAt: asString(familyBlocker.blocked_at) ?? feature.blockedAt ?? checkedAt,
  blockedReason: asString(familyBlocker.condition),
  waitingFor: asRecord(familyBlocker.waiting_for),
  waitingCondition: asString(familyBlocker.resume_condition),
  observedBy: asRecord(familyBlocker.observed_by),
  observationMethod: asString(familyBlocker.observation_method),
  nextCheckAt: asString(familyBlocker.next_check_at),
  blockerOwner: asString(familyBlocker.owner),
  fallbackAt: asString(familyBlocker.fallback_at),
  fallbackAction: asString(familyBlocker.fallback_action),
  resumeAction:
    "Keep the compact branch blocked until one preserved holder materially changes or the next blocked-frontier family review replaces this exact representation.",
  blockedScope: {
    kind: "feature",
    ids: [featureKey],
  },
  blockedFingerprint: {
    errorClass: "package-partial",
    target: "staging",
    branch: "dev",
    featureKey,
  },
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...asStringArray(feature.evidencePaths),
    evidencePath,
    sourceReviewMemo,
    feature.lastSummaryPath,
    feature.lastDiagnosticsPath,
  ]),
  reviewEvidencePath: evidencePath,
  verificationBlocker:
    "Do not rerun unchanged. Preserve the exact four-holder virtualmachines-agentpool split frontier until one preserved same-surface frontier changes or the next blocked-frontier family review produces a truthful replacement.",
  summary:
    "2026-07-12 apply step synchronized virtualmachines-agentpool compact state to the unchanged four-holder frontier review, with the maintained family holder still owning the branch and the next verification window moved to 2026-07-13T15:00:00Z.",
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      sourceReviewMemo,
      compactStatePath: path,
      refreshedFeature: {
        featureKey,
        taskId: state.features[featureKey]?.taskId ?? null,
        frontierTaskIds: state.features[featureKey]?.frontierTaskIds ?? null,
        nextCheckAt: state.features[featureKey]?.nextCheckAt ?? null,
        fallbackAt: state.features[featureKey]?.fallbackAt ?? null,
        reviewEvidencePath:
          state.features[featureKey]?.reviewEvidencePath ?? null,
      },
    },
    null,
    2,
  ),
);
