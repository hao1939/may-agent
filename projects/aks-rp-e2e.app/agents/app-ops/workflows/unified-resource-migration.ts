import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-resource-migration";
export const description =
  "Retire one fixed family of legacy AKS resources after checking their live contract.";

const projectStateHolderIds = new Set([
  "hold-compact-app-monitoring-reviewed-blocked-frontier-140dcd4cc6-20260728",
  "hold-compact-bootstrap-profile-byo-acr-cache-switch-frontier-c8dce044a7-20260728",
  "hold-compact-fleet-split-frontier-8b3a1bcdfe-20260728",
  "hold-compact-gpu-reviewed-terminal-and-shared-owner-return-frontier-20260728",
  "hold-compact-network-cni-reviewed-terminal-and-nonlive-source-grounded-frontier-75be0f2c63-20260731",
  "hold-compact-planned-maintenance-split-residual-frontier-234e60d5e2-20260728",
  "hold-compact-secure-tls-bootstrap-current-ready-subset-frontier-ac65437296-20260728",
  "hold-compact-storage-csi-mixed-frontier-13555d99f7-20260728",
  "hold-compact-trusted-access-reviewed-exception-frontier-e02c40c8b0-20260728",
  "hold-compact-windows-reviewed-terminal-and-promotion-frontier-06ec85b5a8-20260728",
  "hold-compact-workload-identity-reviewed-terminal-frontier-d5a078d6d2-20260728",
]);

const producerlessWaitIds = new Set([
  "compact/repair-compact-feature-app-monitoring-representation-140dcd4cc6",
  "compact/repair-compact-feature-ccp-metricsserver-representation-1173beaf09",
  "compact/repair-compact-feature-network-cni-representation-75be0f2c63",
  "compact/repair-compact-feature-planned-maintenance-representation-234e60d5e2",
  "compact/repair-compact-feature-trusted-access-representation-e02c40c8b0",
]);

type StateSnapshot = {
  resources?: Record<
    string,
    {
      metadata?: { generation?: number };
      spec?: {
        mode?: string;
        parentId?: string;
        owner?: string;
        category?: string;
        outcome?: string;
        acceptance?: string[];
      };
      status?: { phase?: string; conditionIds?: string[]; summary?: string };
    }
  >;
  conditions?: Record<string, { spec?: { type?: string } }>;
  receipts?: Record<string, unknown>;
};

const ownerReviewTaskId = "runtime/owner-review";

export function ownerReviewChildReleaseActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  return Object.entries(state.resources ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([taskId, resource]): ProjectAppTaskAction[] => {
      const generation = resource.metadata?.generation;
      if (
        resource.spec?.parentId !== ownerReviewTaskId ||
        !["achieve", "maintain"].includes(resource.spec.mode ?? "") ||
        !["pending", "waiting", "attention"].includes(
          resource.status?.phase ?? "",
        ) ||
        !Number.isInteger(generation)
      ) {
        return [];
      }
      const appOwned =
        resource.spec.owner === "app-ops" ||
        resource.spec.category === "ops" ||
        resource.spec.category === "app-operations";
      return [
        {
          kind: "update-task",
          taskId,
          expectedGeneration: generation as number,
          parentId: appOwned ? "group/app-operations" : "group/domain-work",
        },
      ];
    })
    .slice(0, 16);
}

export function projectStateHolderCloseActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const resources = state.resources ?? {};
  const conditions = state.conditions ?? {};
  const parentIdsWithLiveChildren = new Set(
    Object.values(resources)
      .map((resource) => resource.spec?.parentId)
      .filter((value): value is string => Boolean(value)),
  );

  return [...projectStateHolderIds]
    .sort()
    .flatMap((taskId): ProjectAppTaskAction[] => {
      const resource = resources[taskId];
      const generation = resource?.metadata?.generation;
      const hasProjectStateCondition = (
        resource?.status?.conditionIds ?? []
      ).some(
        (conditionId) =>
          conditions[conditionId]?.spec?.type === "project.state",
      );
      if (
        resource?.spec?.mode !== "maintain" ||
        resource?.status?.phase !== "waiting" ||
        !Number.isInteger(generation) ||
        !hasProjectStateCondition ||
        parentIdsWithLiveChildren.has(taskId)
      ) {
        return [];
      }
      return [
        {
          kind: "close-task",
          taskId,
          expectedGeneration: generation as number,
          summary:
            "Retired legacy compact holder; the standing feature loop owns future reconciliation and project state is no longer a scheduling Condition.",
        },
      ];
    });
}

export function producerlessWaitCloseActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const resources = state.resources ?? {};
  const parentIdsWithLiveChildren = new Set(
    Object.values(resources)
      .map((resource) => resource.spec?.parentId)
      .filter((value): value is string => Boolean(value)),
  );
  return [...producerlessWaitIds]
    .sort()
    .flatMap((taskId): ProjectAppTaskAction[] => {
      const resource = resources[taskId];
      const generation = resource?.metadata?.generation;
      if (
        resource?.spec?.mode !== "achieve" ||
        resource?.status?.phase !== "waiting" ||
        (resource.status.conditionIds?.length ?? 0) > 0 ||
        parentIdsWithLiveChildren.has(taskId) ||
        !Number.isInteger(generation)
      ) {
        return [];
      }
      return [
        {
          kind: "close-task",
          taskId,
          expectedGeneration: generation as number,
          summary:
            "Removed a producerless representation repair that had no Condition and no child capable of waking it.",
        },
      ];
    });
}

export function completedIdentityRepairActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const resources = state.resources ?? {};
  const receipts = state.receipts ?? {};
  return Object.entries(resources).flatMap(
    ([taskId, resource]): ProjectAppTaskAction[] => {
      const generation = resource.metadata?.generation;
      const summary = resource.status?.summary ?? "";
      const completedId = summary.match(
        /Handler action task already exists or completed: (\S+)/,
      )?.[1];
      if (
        resource.status?.phase !== "attention" ||
        !resource.spec?.outcome?.includes(
          "Repair the feature-compact representation",
        ) ||
        !completedId ||
        !receipts[completedId] ||
        !Number.isInteger(generation)
      ) {
        return [];
      }
      const acceptance = resource.spec.acceptance ?? [];
      const completedIdentityRule = `Completed task ID ${completedId} is immutable. Check receipts before creating a holder; if the frontier is still live, create one new deterministic holder ID and repoint the ledger to it.`;
      return [
        {
          kind: "update-task",
          taskId,
          expectedGeneration: generation as number,
          acceptance: acceptance.includes(completedIdentityRule)
            ? acceptance
            : [...acceptance, completedIdentityRule],
        },
      ];
    },
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir)
    throw new Error("unified-resource-migration requires appDir");
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const projectStateActions = projectStateHolderCloseActions(state);
  const producerlessActions = producerlessWaitCloseActions(state);
  const completedIdentityActions = completedIdentityRepairActions(state);
  const ownerReviewChildActions = ownerReviewChildReleaseActions(state);
  const actions = [
    ...projectStateActions,
    ...producerlessActions,
    ...completedIdentityActions,
    ...ownerReviewChildActions,
  ];
  const summary = `Reconciled legacy resources: ${projectStateActions.length} project-state holder(s), ${producerlessActions.length} producerless wait(s), ${completedIdentityActions.length} completed-identity repair(s), and ${ownerReviewChildActions.length} owner-review child release(s).`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:resource-liveness-v3"],
    actions,
  });
}
