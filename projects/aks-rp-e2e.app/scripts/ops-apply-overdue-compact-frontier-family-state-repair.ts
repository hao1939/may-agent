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
        waiting_for?: Record<string, unknown>;
        resume_condition?: string;
        next_check_at?: string;
        fallback_at?: string;
      };
    }
  >;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const { state, path: statePath } = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});

const memoPath = "evidence/archive/ops-apply-repair-overdue-compact-frontier-family-20260711-state-repair.md";

function holder(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

const netTaskId = "hold-compact-net-integration-package-partial-frontier";
const netHolder = holder(netTaskId);
updateFeatureCompactItem(state, "net-integration", {
  status: "blocked",
  taskId: netTaskId,
  blockedReason: netHolder.condition ?? null,
  waitingFor: (netHolder.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: netHolder.resume_condition ?? null,
  nextCheckAt: netHolder.next_check_at ?? null,
  fallbackAt: netHolder.fallback_at ?? null,
  blockerOwner: "operator",
  reviewEvidencePath: memoPath,
  summary:
    "Repaired stale private-cluster projection drift; net-integration now points at the live mixed compact frontier holder rather than unrelated artifact-visibility lineage.",
});

const cniTaskId = "hold-compact-network-cni-package-partial-frontier-20260709i";
const cniHolder = holder(cniTaskId);
updateFeatureCompactItem(state, "network-cni", {
  status: "blocked",
  taskId: cniTaskId,
  frontierTaskIds: [cniTaskId],
  blockedReason: cniHolder.condition ?? null,
  waitingFor: (cniHolder.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: cniHolder.resume_condition ?? null,
  nextCheckAt: cniHolder.next_check_at ?? null,
  fallbackAt: cniHolder.fallback_at ?? null,
  blockerOwner: "aks-explorer",
  reviewEvidencePath: memoPath,
  evidencePaths: [
    "evidence/archive/reconcile-compact-network-cni-calico-eno-successor-wait-handoff-20260708.md",
    "evidence/archive/repair-compact-network-cni-row191-pod-list-carrier-rerun-20260709.md",
    "runs/test-results/feature-compact-network-cni-staging_429383",
    "features/network-cni/compact/staging.diagnostics.json",
    "features/network-cni/compact/staging.summary.md",
  ],
  summary:
    "Sharpened machine-readable linkage to the exact rows-192-196 compact remainder frontier and refreshed evidence/timestamps.",
});

const ccpTaskId = "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier";
const ccpHolder = holder(ccpTaskId);
updateFeatureCompactItem(state, "ccp-vpa-os-arch-variants", {
  status: "blocked",
  taskId: ccpTaskId,
  blockedReason: ccpHolder.condition ?? null,
  waitingFor: (ccpHolder.waiting_for ?? null) as Record<string, unknown> | null,
  waitingCondition: ccpHolder.resume_condition ?? null,
  nextCheckAt: ccpHolder.next_check_at ?? null,
  fallbackAt: ccpHolder.fallback_at ?? null,
  blockerOwner: "operator",
  reviewEvidencePath: memoPath,
  summary:
    "Refreshed compact-state freshness/evidence metadata while preserving the exact CCP/ARM64 capacity holder.",
});

saveFeatureCompactLoopState(statePath, state);

console.log(
  JSON.stringify(
    {
      repaired: {
        netIntegration: {
          taskId: netTaskId,
          waitingFor: netHolder.waiting_for,
          nextCheckAt: netHolder.next_check_at,
          fallbackAt: netHolder.fallback_at,
        },
        networkCni: {
          taskId: cniTaskId,
          waitingFor: cniHolder.waiting_for,
          nextCheckAt: cniHolder.next_check_at,
          fallbackAt: cniHolder.fallback_at,
          reviewEvidencePath: memoPath,
        },
        ccpVpaOsArchVariants: {
          taskId: ccpTaskId,
          waitingFor: ccpHolder.waiting_for,
          nextCheckAt: ccpHolder.next_check_at,
          fallbackAt: ccpHolder.fallback_at,
          reviewEvidencePath: memoPath,
        },
      },
      statePath,
    },
    null,
    2,
  ),
);
