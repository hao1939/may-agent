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

type StateSnapshot = {
  resources?: Record<
    string,
    {
      metadata?: { generation?: number };
      spec?: { mode?: string; parentId?: string };
      status?: { phase?: string; conditionIds?: string[] };
    }
  >;
  conditions?: Record<string, { spec?: { type?: string } }>;
};

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
      ).some((conditionId) => conditions[conditionId]?.spec?.type === "project.state");
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

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) throw new Error("unified-resource-migration requires appDir");
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const actions = projectStateHolderCloseActions(state);
  const summary = `Retired ${actions.length} childless legacy project-state compact holders.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:project-state-holders-v1"],
    actions,
  });
}
