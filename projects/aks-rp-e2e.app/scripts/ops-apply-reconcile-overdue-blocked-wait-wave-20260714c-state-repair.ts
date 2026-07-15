import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  defaultFeatureCompactLoopStatePath,
  type FeatureCompactLoopState,
} from "../workflows/lib/feature-compact-loop-store.ts";
import {
  defaultSpecLoopStatePath,
  type SpecLoopState,
} from "../workflows/lib/spec-loop-store.ts";
import {
  refreshBlockedWait,
  taskTreeConfig,
  updateTaskText,
} from "../workflows/lib/task-tree-tools.ts";
import { readTaskTree, type TaskNode } from "../workflows/lib/task-tree-store.ts";

type BlockerRecord = {
  condition?: string;
  resume_condition?: string;
  next_check_at?: string;
  fallback_at?: string;
  fallback_action?: string;
  resume_at?: string;
};

function blockerOf(task: TaskNode, taskId: string): BlockerRecord {
  if (!task.blocker || typeof task.blocker !== "object") {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker as BlockerRecord;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(
  process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`,
);
const worker = process.env.WORKER ?? "app-ops";
const attemptId =
  "a_ops-apply-reconcile-overdue-blocked-wait-wave-20260714c-state-repair_20260714204958";
const reviewMemoPath =
  "evidence/archive/ops-reconcile-overdue-blocked-wait-wave-20260714c.md";
const targetAt = "2026-07-15T20:40:00Z";

const holders = [
  {
    taskId:
      "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this exact row-50 reviewed frontier: maintained run 28721673014 still preserves the same four failed assertions on the FIPS scale-from-zero contract, and no stronger same-path evidence or accepted rerun replaces it.`,
    summary:
      `${attemptId}: refreshed the row-50 FIPS reviewed frontier from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} while preserving the exact same-path holder.`,
  },
  {
    taskId:
      "hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this exact node-subnet HTTP 409 post-rerun frontier: accepted rerun 171341607 still stops at setup.vnet before KMS assertions, and no reviewed same-surface recovery replaces it.`,
    summary:
      `${attemptId}: refreshed the KMS node-subnet HTTP 409 holder from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} without reopening an unchanged rerun.`,
  },
  {
    taskId:
      "hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this exact row-60 nonlive/source-grounded Scenario_Addon boundary: the mounted-source carrier remains truthful and no new same-path live artifact or posture change replaces it.`,
    summary:
      `${attemptId}: refreshed the row-60 nonlive/source-grounded holder from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} while preserving its nonlive posture.`,
  },
  {
    taskId:
      "hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this exact four-spec Hubble UI runtime frontier: the same missing deployments.apps \"hubble-ui\" surface remains the truthful blocker and no accepted narrowing or same-surface recovery replaces it.`,
    summary:
      `${attemptId}: refreshed the Hubble UI runtime frontier from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} without reopening an unchanged rerun.`,
  },
  {
    taskId:
      "hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this exact user-iptables runtime assertion frontier: rerun 28849780940 still preserves the narrowed missing kubernetes.azure.com/user-iptables-rules surface on two CiliumNode objects, and no reviewed material change replaces it.`,
    summary:
      `${attemptId}: refreshed the performance-cilium user-iptables runtime frontier from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} while preserving the narrowed runtime assertion surface.`,
  },
  {
    taskId:
      "hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this adjacent-lineage/nonlive frontier: no authoritative confidential-node Kata SNP source appeared, so the mounted-source-backed bridge remains the truthful holder.`,
    summary:
      `${attemptId}: refreshed the Kata SNP adjacent-hypothesis holder from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} while preserving its reviewed nonlive posture.`,
  },
  {
    taskId:
      "hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713",
    condition:
      `2026-07-14 overdue-wave repair (${reviewMemoPath}) revalidated this compact-facing projection: it still truthfully points only to governing holder hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706, with no accepted compact-side replacement.`,
    summary:
      `${attemptId}: refreshed the compact-facing row-60 projection from ${reviewMemoPath} and moved resume_at/next_check_at/fallback_at to ${targetAt} while preserving the governing spec-level holder.`,
  },
] as const;

const config = taskTreeConfig({
  appDir,
  projectDir,
  worker,
  maxConcurrent: 1,
});

const beforeTree = readTaskTree(config);
const before = holders.map((holder) => {
  const task = beforeTree.tasks[holder.taskId];
  if (!task) throw new Error(`Task not found: ${holder.taskId}`);
  const blocker = blockerOf(task, holder.taskId);
  return {
    taskId: holder.taskId,
    condition: blocker.condition ?? null,
    resumeAt: blocker.resume_at ?? null,
    nextCheckAt: blocker.next_check_at ?? null,
    fallbackAt: blocker.fallback_at ?? null,
  };
});

const refreshed = holders.map((holder) => {
  const liveBefore = beforeTree.tasks[holder.taskId];
  const blocker = blockerOf(liveBefore, holder.taskId);
  const resumeCondition = blocker.resume_condition?.trim();
  if (!resumeCondition) {
    throw new Error(`Missing resume_condition for ${holder.taskId}`);
  }

  refreshBlockedWait(config, {
    taskId: holder.taskId,
    condition: holder.condition,
    resumeCondition,
    summary: holder.summary,
    nextCheckAt: targetAt,
    fallbackAt: targetAt,
  });

  const updated = updateTaskText(config, {
    taskId: holder.taskId,
    resumeAt: targetAt,
    nextCheckAt: targetAt,
    fallbackAt: targetAt,
  });

  const updatedBlocker = blockerOf(updated as TaskNode, holder.taskId);
  return {
    taskId: holder.taskId,
    condition: updatedBlocker.condition ?? null,
    resumeCondition: updatedBlocker.resume_condition ?? null,
    resumeAt: updatedBlocker.resume_at ?? null,
    nextCheckAt: updatedBlocker.next_check_at ?? null,
    fallbackAt: updatedBlocker.fallback_at ?? null,
    result: (updated as TaskNode & { result?: string }).result ?? null,
    trace: asRecord((updated as TaskNode).trace) ?? null,
  };
});

const featureCompactStatePath = defaultFeatureCompactLoopStatePath(appDir);
const featureCompactState = JSON.parse(
  readFileSync(featureCompactStatePath, "utf-8"),
) as FeatureCompactLoopState;
const compactFeature = featureCompactState.features[
  "virtualmachine-prerelease-row60-legacy-addon-disable-scaling"
];

const specLoopStatePath = defaultSpecLoopStatePath(appDir);
const specLoopState = JSON.parse(
  readFileSync(specLoopStatePath, "utf-8"),
) as SpecLoopState;
const specLoopReferences = Object.entries(specLoopState.specs ?? {})
  .filter(([, spec]) =>
    typeof spec?.taskId === "string" &&
    holders.some((holder) => holder.taskId === spec.taskId),
  )
  .map(([specId, spec]) => ({
    specId,
    taskId: spec?.taskId ?? null,
    resumeCondition: spec?.resumeCondition ?? null,
    updatedAt: spec?.updatedAt ?? null,
  }))
  .sort((a, b) => a.specId.localeCompare(b.specId));

console.log(
  JSON.stringify(
    {
      attemptId,
      reviewMemoPath,
      targetAt,
      before,
      refreshed,
      compactFeatureAfter: compactFeature
        ? {
            featureKey: compactFeature.featureKey,
            taskId: compactFeature.taskId ?? null,
            status: compactFeature.status,
            nextCheckAt: compactFeature.nextCheckAt ?? null,
            fallbackAt: compactFeature.fallbackAt ?? null,
            resumeCondition: compactFeature.resumeCondition ?? null,
            blockedReason: compactFeature.blockedReason ?? null,
            updatedAt: compactFeature.updatedAt ?? null,
          }
        : null,
      specLoopReferences,
    },
    null,
    2,
  ),
);
