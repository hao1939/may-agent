import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  loadFeatureCompactLoopState,
  saveFeatureCompactLoopState,
  updateFeatureCompactItem,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
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
const summaryPath = resolve(projectDir, "features/localdns/compact/staging.summary.md");
const specStatePath = defaultSpecLoopStatePath(appDir);

const memoPath =
  "evidence/archive/ops-apply-recover-overdue-compact-frontier-wave-localdns-20260712-state-repair.md";
const featureKey = "localdns";
const compactTaskId = "hold-compact-localdns-package-partial-frontier";
const quotaTaskId = "hold-spec-localdns-managed-cluster-quota-family-frontier-20260708";
const residualTaskId = "wait-localdns-create-http400-residual-family-return-20260704";
const windowsTaskId =
  "hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712";
const staleReviewedTaskId =
  "hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c";
const hostsPluginTaskId =
  "wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703";

function loadBlocker(taskTree: TaskTree, taskId: string) {
  const blocker = taskTree.tasks[taskId]?.blocker;
  if (!blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return blocker;
}

const taskTree = JSON.parse(readFileSync(treePath, "utf8")) as TaskTree;
const compactBlocker = loadBlocker(taskTree, compactTaskId);
const summary = readFileSync(summaryPath, "utf8");
const specState = JSON.parse(readFileSync(specStatePath, "utf8")) as SpecLoopState;

const hostsPluginSpec = specState.specs["spec.localdns.hosts-plugin"];
const networkPolicySpec = specState.specs["spec.localdns.network-policy-coexistence"];
const windowsSpec = specState.specs["spec.localdns.windows-nodepool"];
if (!hostsPluginSpec || !networkPolicySpec || !windowsSpec) {
  throw new Error("Missing required LocalDNS spec-loop state entries");
}
if (hostsPluginSpec.taskId !== hostsPluginTaskId) {
  throw new Error(
    `Expected hosts-plugin taskId=${hostsPluginTaskId}; found ${hostsPluginSpec.taskId ?? "null"}`,
  );
}
if (networkPolicySpec.taskId !== residualTaskId) {
  throw new Error(
    `Expected network-policy taskId=${residualTaskId}; found ${networkPolicySpec.taskId ?? "null"}`,
  );
}
if (windowsSpec.taskId !== staleReviewedTaskId) {
  throw new Error(
    `Expected windows-nodepool spec-loop taskId=${staleReviewedTaskId}; found ${windowsSpec.taskId ?? "null"}`,
  );
}

const remainingUncoveredLine =
  summary
    .split(/\r?\n/)
    .find((line) => line.startsWith("- Remaining uncovered specs:")) ?? "";
if (!remainingUncoveredLine.includes("spec.localdns.windows-nodepool")) {
  throw new Error("Compact summary no longer lists spec.localdns.windows-nodepool in remaining uncovered specs");
}
if (remainingUncoveredLine.includes("spec.localdns.hosts-plugin")) {
  throw new Error("Compact summary unexpectedly lists spec.localdns.hosts-plugin as a remaining uncovered spec");
}
if (
  !summary.includes("spec.localdns.multipool-consistency") ||
  !summary.includes("status=superseded, specState=superseded") ||
  !summary.includes("supersededBy=spec.localdns.cluster-topology")
) {
  throw new Error("Compact summary no longer preserves the multipool-consistency superseded-lineage note");
}

const { state, path: compactStatePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const before = state.features[featureKey];
if (!before) {
  throw new Error(`Missing feature-compact state for ${featureKey}`);
}

const evidencePaths = Array.from(
  new Set([
    memoPath,
    ...(Array.isArray(before.evidencePaths)
      ? before.evidencePaths.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : []),
  ]),
);

updateFeatureCompactItem(state, featureKey, {
  status: "blocked",
  retryable: false,
  taskId: compactTaskId,
  frontierTaskIds: [quotaTaskId, residualTaskId, windowsTaskId],
  retryReason: compactBlocker.resume_condition ?? null,
  blockedReason: compactBlocker.condition ?? null,
  waitingFor: (compactBlocker.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: compactBlocker.resume_condition ?? null,
  resumeCondition: compactBlocker.resume_condition ?? null,
  observedBy: (compactBlocker.observed_by ?? null) as Record<string, unknown> | null,
  observationMethod: compactBlocker.observation_method ?? null,
  nextCheckAt: compactBlocker.next_check_at ?? null,
  fallbackAt: compactBlocker.fallback_at ?? null,
  fallbackAction: compactBlocker.fallback_action ?? null,
  blockerOwner: compactBlocker.owner ?? before.blockerOwner ?? null,
  reviewEvidencePath: memoPath,
  evidencePaths,
  summary:
    "Refreshed LocalDNS controller-visible compact projection from the live compact holder plus current compact summary: quota/headroom, residual create-time HTTP400, and windows unsupported/nonlive boundary. Removed stale reviewed-exception family prose/member drift and kept hosts-plugin spec-loop-only without reopening reruns.",
  lastCheckedAt: new Date().toISOString(),
});

saveFeatureCompactLoopState(compactStatePath, state);

const after = state.features[featureKey];
console.log(
  JSON.stringify(
    {
      memoPath,
      compactStatePath,
      specStatePath,
      summaryPath,
      before: {
        taskId: before.taskId ?? null,
        frontierTaskIds: before.frontierTaskIds ?? null,
        blockedReason: before.blockedReason ?? null,
        waitingCondition: before.waitingCondition ?? null,
        resumeCondition: before.resumeCondition ?? null,
        reviewEvidencePath: before.reviewEvidencePath ?? null,
        summary: before.summary ?? null,
      },
      after: after
        ? {
            taskId: after.taskId ?? null,
            frontierTaskIds: after.frontierTaskIds ?? null,
            blockedReason: after.blockedReason ?? null,
            waitingCondition: after.waitingCondition ?? null,
            resumeCondition: after.resumeCondition ?? null,
            reviewEvidencePath: after.reviewEvidencePath ?? null,
            summary: after.summary ?? null,
            nextCheckAt: after.nextCheckAt ?? null,
            fallbackAt: after.fallbackAt ?? null,
          }
        : null,
      authorities: {
        compactHolderTaskId: compactTaskId,
        quotaTaskId,
        residualTaskId,
        windowsTaskId,
        staleReviewedTaskId,
        hostsPluginTaskId,
      },
      specLoopChecks: {
        hostsPluginTaskId: hostsPluginSpec.taskId ?? null,
        networkPolicyTaskId: networkPolicySpec.taskId ?? null,
        windowsTaskId: windowsSpec.taskId ?? null,
      },
      compactSummaryChecks: {
        remainingUncoveredLine,
        multipoolSupersededNotePresent: true,
      },
    },
    null,
    2,
  ),
);
