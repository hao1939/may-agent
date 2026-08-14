import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk/legacy";

export const name = "unified-repo-ref-condition-migration";
export const description =
  "Return the fixed legacy repo-ref waits to their owners so they can install the canonical external Condition.";

const legacyRepoRefTaskIds = new Set([
  "hold-compact-aad-rbac-split-frontier-9a363c168b-20260728",
  "hold-compact-airlock-reviewed-exception-frontier-068b4df5c3-20260801",
  "hold-compact-app-routing-reviewed-split-frontier-77b045b920-20260801",
  "hold-compact-ccp-autoupgrader-pipeline-reviewed-terminal-frontier-0a39eb70a3-20260802",
  "hold-compact-ccp-security-patch-os-variants-reviewed-terminal-frontier-ac11f9ba2e-20260728",
  "hold-compact-egress-lockdown-reviewed-split-frontier-7962161d-20260802",
  "hold-compact-kms-split-frontier-3f63afff01-20260802",
  "hold-compact-localdns-split-frontier-e8d7677892-20260730",
  "hold-compact-remediator-node-not-ready-restart-reviewed-runtime-frontier-de615e1340-20260728",
  "hold-compact-serverless-split-frontier-8f0161ccfd-20260730",
  "hold-compact-traffic-api-proxy-stale-frontier-f3e1b86bbf-20260802",
  "hold-compact-traffic-azure-service-mesh-reviewed-mixed-frontier-16a70e7e3e-20260731",
  "hold-compact-windows-gpu-source-grounded-frontier-c603633b19-20260729",
  "ops/reconcile-reraised-traffic-api-proxy-contract-helper-retained-worktree-7bbb6f45ba-at-ed1c33b9-20260801",
  "wait-compact-cluster-autoscaler-package-partial-origin-dev-advance-b1d6a33e-20260801",
]);

type StateSnapshot = {
  resources?: Record<
    string,
    {
      metadata?: { generation?: number };
      status?: { phase?: string; conditionIds?: string[] };
    }
  >;
  conditions?: Record<
    string,
    {
      spec?: {
        type?: string;
        subject?: string;
        expected?: { baseRef?: string; shaNotEquals?: string };
      };
    }
  >;
};

function hasLegacyRepoRefCondition(
  state: StateSnapshot,
  taskId: string,
): boolean {
  const resource = state.resources?.[taskId];
  return (resource?.status?.conditionIds ?? []).some((conditionId) => {
    const spec = state.conditions?.[conditionId]?.spec;
    return (
      spec?.type === "aks.repo-ref.observed" &&
      spec.subject === "project:aks-rp-e2e" &&
      typeof spec.expected?.baseRef === "string" &&
      typeof spec.expected?.shaNotEquals === "string"
    );
  });
}

export function legacyRepoRefConditionMigrationActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  return [...legacyRepoRefTaskIds]
    .sort()
    .flatMap((taskId): ProjectAppTaskAction[] => {
      const resource = state.resources?.[taskId];
      const generation = resource?.metadata?.generation;
      if (
        resource?.status?.phase !== "waiting" ||
        !Number.isInteger(generation) ||
        !hasLegacyRepoRefCondition(state, taskId)
      ) {
        return [];
      }
      return [
        {
          kind: "unblock-task",
          taskId,
          expectedGeneration: generation as number,
          reason:
            "Legacy repo-ref Condition shape cannot be observed by the shared tracker; return the same task to its owner to install the canonical repoRef condition or close it.",
        },
      ];
    });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-repo-ref-condition-migration requires appDir");
  }
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const actions = legacyRepoRefConditionMigrationActions(state);
  const summary = `Returned ${actions.length} legacy repo-ref waits to current owner judgment.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:legacy-repo-ref-conditions-v1"],
    actions,
  });
}
