import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";

type TaskNode = {
  blocker?: Record<string, unknown>;
};

type TaskTree = {
  tasks: Record<string, TaskNode>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const evidencePath =
  "evidence/archive/ops-apply-execute-noon-compact-represented-frontier-refresh-wave-app-ops-20260712.md";
const attemptId =
  "a_ops-apply-execute-noon-compact-represented-frontier-refresh-wave-app-ops_20260712121115";
const checkedAt = "2026-07-12T12:12:57Z";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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

const { state, path } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const extensionTaskId = "hold-compact-extension-addon-reviewed-exception-frontier";
const extensionBlocker = blocker(extensionTaskId);
const extensionFeature = state.features["extension-addon"];
if (!extensionFeature) throw new Error("Missing feature state for extension-addon");
updateFeatureCompactItem(state, "extension-addon", {
  status: "blocked",
  taskId: extensionTaskId,
  retryable: false,
  retryReason: stringValue(extensionBlocker.resume_condition),
  blockedAt:
    stringValue(extensionBlocker.blocked_at) ?? extensionFeature.blockedAt ?? checkedAt,
  blockedReason: stringValue(extensionBlocker.condition),
  waitingFor: asRecord(extensionBlocker.waiting_for),
  waitingCondition: stringValue(extensionBlocker.resume_condition),
  observedBy: asRecord(extensionBlocker.observed_by),
  observationMethod: stringValue(extensionBlocker.observation_method),
  nextCheckAt: stringValue(extensionBlocker.next_check_at),
  blockerOwner: stringValue(extensionBlocker.owner),
  fallbackAt: stringValue(extensionBlocker.fallback_at),
  fallbackAction: stringValue(extensionBlocker.fallback_action),
  reviewEvidencePath: evidencePath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(extensionFeature.evidencePaths ?? []),
    evidencePath,
    "evidence/archive/ops-execute-noon-compact-represented-frontier-refresh-wave-app-ops-20260712c.md",
  ]),
  summary:
    "2026-07-12 noon refresh preserved extension-addon only as the compact-facing represented holder for wait-spec-extension-addon-execution-identity-permission-response-20260702 and aligned the watch window to the exact downstream wait.",
  attemptedFixes: unique([
    ...(extensionFeature.attemptedFixes ?? []),
    `${attemptId}: refreshed the compact-facing extension-addon holder to current evidence and aligned next_check_at/fallback_at with the exact downstream permission-response wait.`,
  ]),
});

const netTaskId = "hold-compact-net-integration-package-partial-frontier";
const netBlocker = blocker(netTaskId);
const netFeature = state.features["net-integration"];
if (!netFeature) throw new Error("Missing feature state for net-integration");
updateFeatureCompactItem(state, "net-integration", {
  status: "blocked",
  taskId: netTaskId,
  frontierTaskIds: [],
  retryable: false,
  retryReason: stringValue(netBlocker.resume_condition),
  blockedAt: stringValue(netBlocker.blocked_at) ?? netFeature.blockedAt ?? checkedAt,
  blockedReason: stringValue(netBlocker.condition),
  waitingFor: asRecord(netBlocker.waiting_for),
  waitingCondition: stringValue(netBlocker.resume_condition),
  observedBy: asRecord(netBlocker.observed_by),
  observationMethod: stringValue(netBlocker.observation_method),
  nextCheckAt: stringValue(netBlocker.next_check_at),
  blockerOwner: stringValue(netBlocker.owner),
  fallbackAt: stringValue(netBlocker.fallback_at),
  fallbackAction: stringValue(netBlocker.fallback_action),
  reviewEvidencePath: evidencePath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(netFeature.evidencePaths ?? []),
    evidencePath,
    "evidence/archive/ops-execute-noon-compact-represented-frontier-refresh-wave-app-ops-20260712c.md",
    "evidence/archive/ops-apply-net-integration-promotion-candidate-reclassification-20260711.md",
  ]),
  nextStepClassification:
    "preserve the live accepted net-integration mixed frontier without depending on missing successor lane ids; rematerialize sharper exact lanes later only if planner/app-ops or new same-surface evidence makes them truthful again",
  resumeCondition: stringValue(netBlocker.resume_condition),
  verificationBlocker:
    "Do not broad-rerun unchanged; the compact-facing holder is now intentionally narrowed to currently live accepted representation only, without citing missing runtime successor lane ids.",
  summary:
    "2026-07-12 noon refresh narrowed net-integration to currently live accepted representation only: preserve the mixed environment/terminal residue plus accepted source-grounded/nonlive reclassifications, and do not depend on absent 2026-07-11 successor lane ids.",
  attemptedFixes: unique([
    ...(netFeature.attemptedFixes ?? []),
    `${attemptId}: narrowed the compact-facing net-integration holder/state so it preserves only currently live accepted representation and no longer depends on missing runtime successor lane ids from the 2026-07-11 decomposition.`,
  ]),
});

const nodeTaskId = "hold-compact-node-http-proxy-package-partial-frontier";
const nodeBlocker = blocker(nodeTaskId);
const nodeFeature = state.features["node-http-proxy"];
if (!nodeFeature) throw new Error("Missing feature state for node-http-proxy");
updateFeatureCompactItem(state, "node-http-proxy", {
  status: "blocked",
  taskId: nodeTaskId,
  retryable: false,
  retryReason: stringValue(nodeBlocker.resume_condition),
  blockedAt: stringValue(nodeBlocker.blocked_at) ?? nodeFeature.blockedAt ?? checkedAt,
  blockedReason: stringValue(nodeBlocker.condition),
  waitingFor: asRecord(nodeBlocker.waiting_for),
  waitingCondition: stringValue(nodeBlocker.resume_condition),
  observedBy: asRecord(nodeBlocker.observed_by),
  observationMethod: stringValue(nodeBlocker.observation_method),
  nextCheckAt: stringValue(nodeBlocker.next_check_at),
  blockerOwner: stringValue(nodeBlocker.owner),
  fallbackAt: stringValue(nodeBlocker.fallback_at),
  fallbackAction: stringValue(nodeBlocker.fallback_action),
  reviewEvidencePath: evidencePath,
  lastCheckedAt: checkedAt,
  evidencePaths: unique([
    ...(nodeFeature.evidencePaths ?? []),
    evidencePath,
    "../aks-rp-e2e/evidence/archive/ops-escalate-node-http-proxy-trusted-ca-owner-decision-return-20260712.md",
  ]),
  summary:
    "2026-07-12 noon refresh preserved node-http-proxy only as the compact-facing holder for wait-compact-node-http-proxy-trusted-ca-owner-decision-return-20260708 and moved the watch window past noon while keeping the same-lineage fallback at 16:00Z.",
  attemptedFixes: unique([
    ...(nodeFeature.attemptedFixes ?? []),
    `${attemptId}: refreshed the compact-facing node-http-proxy holder to current evidence and pushed the stale noon watch window forward while preserving the exact same-lineage owner-decision fallback.`,
  ]),
});

saveFeatureCompactLoopState(path, state);

console.log(
  JSON.stringify(
    {
      attemptId,
      evidencePath,
      compactStatePath: path,
      refreshedFeatures: {
        "extension-addon": {
          taskId: state.features["extension-addon"]?.taskId ?? null,
          nextCheckAt: state.features["extension-addon"]?.nextCheckAt ?? null,
          fallbackAt: state.features["extension-addon"]?.fallbackAt ?? null,
          reviewEvidencePath:
            state.features["extension-addon"]?.reviewEvidencePath ?? null,
        },
        "net-integration": {
          taskId: state.features["net-integration"]?.taskId ?? null,
          nextCheckAt: state.features["net-integration"]?.nextCheckAt ?? null,
          fallbackAt: state.features["net-integration"]?.fallbackAt ?? null,
          reviewEvidencePath:
            state.features["net-integration"]?.reviewEvidencePath ?? null,
        },
        "node-http-proxy": {
          taskId: state.features["node-http-proxy"]?.taskId ?? null,
          nextCheckAt: state.features["node-http-proxy"]?.nextCheckAt ?? null,
          fallbackAt: state.features["node-http-proxy"]?.fallbackAt ?? null,
          reviewEvidencePath:
            state.features["node-http-proxy"]?.reviewEvidencePath ?? null,
        },
      },
    },
    null,
    2,
  ),
);
