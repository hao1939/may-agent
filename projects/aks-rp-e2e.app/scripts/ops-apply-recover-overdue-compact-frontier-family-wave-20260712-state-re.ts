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

type TaskNode = {
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
};

type TaskTree = {
  tasks: Record<string, TaskNode>;
};

const appDir = resolve(process.env.APP_DIR ?? process.cwd());
const projectDir = resolve(process.env.PROJECT_DIR ?? `${appDir}/../aks-rp-e2e`);
const treePath = resolve(appDir, ".state/tasks/tree.json");
const tree = JSON.parse(readFileSync(treePath, "utf-8")) as TaskTree;

const attemptId =
  "a_ops-apply-recover-overdue-compact-frontier-family-wave-20260712-state-re_20260712185937";
const checkedAt = new Date().toISOString();
const memoPath =
  "evidence/archive/ops-apply-recover-overdue-compact-frontier-family-wave-20260712-state-re.md";

function blocker(taskId: string) {
  const task = tree.tasks[taskId];
  if (!task?.blocker) {
    throw new Error(`Missing blocker for ${taskId}`);
  }
  return task.blocker;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))].sort(
    (a, b) => a.localeCompare(b),
  );
}

const holderTaskIds = {
  networkCni: "hold-compact-network-cni-package-partial-frontier-20260709i",
  ccpVpa: "hold-compact-ccp-vpa-os-arch-variants-reviewed-exception-frontier",
  privateCluster:
    "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix",
  secureTlsSpec:
    "hold-spec-secure-tls-bootstrap-network-isolated-image-pull-after-disable-frontier-20260708",
  secureTlsCompact: "hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707",
  sgxSpec:
    "wait-spec-sgx-addon-vm-prerelease-matrix-owner-live-carrier-decision-20260703",
  sgxCompact:
    "hold-compact-sgx-addon-vm-prerelease-matrix-reviewed-exception-frontier",
  sharedReviewedException:
    "wait-compact-reviewed-exception-live-ready-policy-family-20260702",
  defenderProfile: "hold-compact-defender-profile-reviewed-exception-frontier",
  machinesAgentpool:
    "hold-compact-machines-agentpool-package-partial-frontier-202607090638",
  row60Spec:
    "hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706",
  row60Compact:
    "hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier",
};

const compactStateLoaded = loadFeatureCompactLoopState({
  appDir,
  projectDir,
  loopTaskId: "aks-feature-compact-loop",
  windowSize: 1,
  refreshFromProject: false,
});
const compactState = compactStateLoaded.state;

const compactRepairs = [
  {
    featureKey: "network-cni",
    taskId: holderTaskIds.networkCni,
    frontierTaskIds: undefined,
  },
  {
    featureKey: "ccp-vpa-os-arch-variants",
    taskId: holderTaskIds.ccpVpa,
    frontierTaskIds: undefined,
  },
  {
    featureKey: "private-cluster",
    taskId: holderTaskIds.privateCluster,
    frontierTaskIds:
      compactState.features["private-cluster"]?.frontierTaskIds ?? undefined,
  },
  {
    featureKey: "secure-tls-bootstrap",
    taskId: holderTaskIds.secureTlsCompact,
    frontierTaskIds: [
      holderTaskIds.secureTlsSpec,
      "wait-secure-tls-bootstrap-vnet-integration-surge-node-capacity-return-20260703",
    ],
  },
  {
    featureKey: "sgx-addon-vm-prerelease-matrix",
    taskId: holderTaskIds.sgxCompact,
    frontierTaskIds: [holderTaskIds.sgxSpec],
  },
  {
    featureKey: "defender-profile",
    taskId: holderTaskIds.defenderProfile,
    frontierTaskIds:
      compactState.features["defender-profile"]?.frontierTaskIds ?? undefined,
  },
  {
    featureKey: "machines-agentpool",
    taskId: holderTaskIds.machinesAgentpool,
    frontierTaskIds:
      compactState.features["machines-agentpool"]?.frontierTaskIds ?? undefined,
  },
  {
    featureKey: "virtualmachine-prerelease-row60-legacy-addon-disable-scaling",
    taskId: holderTaskIds.row60Compact,
    frontierTaskIds: [holderTaskIds.row60Spec],
  },
] as const;

const compactResults = compactRepairs.map((repair) => {
  const item = compactState.features[repair.featureKey];
  if (!item) {
    throw new Error(`Missing compact feature state for ${repair.featureKey}`);
  }

  const liveBlocker = blocker(repair.taskId);
  const before = {
    taskId: item.taskId ?? null,
    frontierTaskIds: item.frontierTaskIds ?? null,
    nextCheckAt: item.nextCheckAt ?? null,
    fallbackAt: item.fallbackAt ?? null,
    reviewEvidencePath: item.reviewEvidencePath ?? null,
  };

  updateFeatureCompactItem(compactState, repair.featureKey, {
    status: "blocked",
    taskId: repair.taskId,
    frontierTaskIds: repair.frontierTaskIds,
    retryable: false,
    retryReason: liveBlocker.resume_condition ?? item.retryReason ?? null,
    blockedReason: liveBlocker.condition ?? item.blockedReason ?? null,
    waitingFor:
      (liveBlocker.waiting_for as Record<string, unknown> | undefined) ??
      item.waitingFor ??
      null,
    waitingCondition:
      liveBlocker.resume_condition ?? item.waitingCondition ?? null,
    observedBy:
      (liveBlocker.observed_by as Record<string, unknown> | undefined) ??
      item.observedBy ??
      null,
    observationMethod:
      liveBlocker.observation_method ?? item.observationMethod ?? null,
    nextCheckAt: liveBlocker.next_check_at ?? item.nextCheckAt ?? null,
    blockerOwner: liveBlocker.owner ?? item.blockerOwner ?? null,
    fallbackAt: liveBlocker.fallback_at ?? item.fallbackAt ?? null,
    fallbackAction:
      liveBlocker.fallback_action ?? item.fallbackAction ?? null,
    reviewEvidencePath: memoPath,
    lastCheckedAt: checkedAt,
    evidencePaths: unique([...(item.evidencePaths ?? []), memoPath]),
    summary:
      `${attemptId}: refreshed compact holder projection for ${repair.featureKey} from live task ${repair.taskId}.`,
    attemptedFixes: unique([
      ...(item.attemptedFixes ?? []),
      `${attemptId}: aligned compact-loop next/fallback watch fields and state pointer to live blocked holder ${repair.taskId}.`,
    ]),
  });

  const after = compactState.features[repair.featureKey];
  return {
    featureKey: repair.featureKey,
    taskId: repair.taskId,
    before,
    after: {
      taskId: after?.taskId ?? null,
      frontierTaskIds: after?.frontierTaskIds ?? null,
      nextCheckAt: after?.nextCheckAt ?? null,
      fallbackAt: after?.fallbackAt ?? null,
      reviewEvidencePath: after?.reviewEvidencePath ?? null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});

saveFeatureCompactLoopState(compactStateLoaded.path, compactState);

const specStatePath = defaultSpecLoopStatePath(appDir);
const specState = JSON.parse(readFileSync(specStatePath, "utf-8")) as SpecLoopState;

const specRepairs = [
  {
    specId: "spec.secure-tls-bootstrap.network-isolated",
    taskId: holderTaskIds.secureTlsSpec,
  },
  {
    specId: "spec.sgx-addon.vm-prerelease-matrix",
    taskId: holderTaskIds.sgxSpec,
  },
] as const;

const specResults = specRepairs.map((repair) => {
  const current = specState.specs[repair.specId];
  if (!current) {
    throw new Error(`Missing spec state for ${repair.specId}`);
  }
  const liveBlocker = blocker(repair.taskId);
  const review = asRecord(current.review) ?? {};
  const before = {
    taskId: current.taskId ?? null,
    resumeCondition: current.resumeCondition ?? null,
    pendingReviewTaskId:
      typeof review.pendingReviewTaskId === "string"
        ? review.pendingReviewTaskId
        : null,
  };

  updateSpecLoopSpec(specState, repair.specId, {
    taskId: repair.taskId,
    resumeCondition: liveBlocker.resume_condition ?? current.resumeCondition ?? undefined,
    review: {
      ...review,
      pendingReviewTaskId: repair.taskId,
      reviewedAt: checkedAt,
    },
  });

  const after = specState.specs[repair.specId];
  const afterReview = asRecord(after?.review) ?? {};
  return {
    specId: repair.specId,
    taskId: repair.taskId,
    before,
    after: {
      taskId: after?.taskId ?? null,
      resumeCondition: after?.resumeCondition ?? null,
      pendingReviewTaskId:
        typeof afterReview.pendingReviewTaskId === "string"
          ? afterReview.pendingReviewTaskId
          : null,
      updatedAt: after?.updatedAt ?? null,
    },
  };
});

saveSpecLoopState(specStatePath, specState);

console.log(
  JSON.stringify(
    {
      attemptId,
      checkedAt,
      memoPath,
      compactStatePath: compactStateLoaded.path,
      specStatePath,
      liveTaskRefreshes: {
        sharedReviewedException: {
          taskId: holderTaskIds.sharedReviewedException,
          nextCheckAt: blocker(holderTaskIds.sharedReviewedException).next_check_at ?? null,
          fallbackAt: blocker(holderTaskIds.sharedReviewedException).fallback_at ?? null,
        },
      },
      compactResults,
      specResults,
    },
    null,
    2,
  ),
);
