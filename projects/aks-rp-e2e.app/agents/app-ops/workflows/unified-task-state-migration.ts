import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-task-state-migration";
export const description =
  "Replace a fixed family of legacy task-state Conditions with task-resource relationships.";

const dependencyByTask = new Map([
  [
    "compact/reconcile-traffic-alb-controller-ingress-routing-rerun-ready-origin-dev-86645c57-20260726",
    "compact/reconcile-traffic-alb-controller-upgrade-survival-rerun-ready-origin-dev-86645c57-20260726",
  ],
  [
    "domain/wait-net-integration-outbound-udr-virtualappliance-prerequisite-origin-dev-894696be-20260726",
    "ops/verify-shared-byo-udr-prerequisite-owner-return-and-bind-wait-20260727",
  ],
  [
    "domain/master-validation-failure/spec.traffic-api-proxy.service-reachability/030606162f889d54fd53",
    "domain/repair-master-validation-api-proxy-cpu-overload-manager-storage-toggle-auth-20260802",
  ],
  [
    "hold-compact-node-pool-config-environment-frontier-df5a8af6f1-20260730",
    "ops/send-node-pool-config-kubereserved-staging-custom-node-config-preview-registration-owner-handoff-20260726",
  ],
  [
    "compact/compact-feature-virtualmachines-agentpool-372b7afd23",
    "domain/master-validation-failure/spec.virtualmachines.mixed-sku-upgrade/1f5d75c79e520c91b41c",
  ],
  [
    "domain/reconcile-direct-scenario-quality-airlock-tests-airlock-compliance-check-6703619e",
    "domain/repair-airlock-compliance-check-live-claim-closure-origin-dev-5a71669d-20260801",
  ],
  [
    "domain/reconcile-direct-scenario-quality-aad-rbac-tests-aad-rbac-azure-rbac-automatic-sku-335d7489",
    "hold-compact-aad-rbac-split-frontier-9a363c168b-20260728",
  ],
]);

const missingSubjectWait =
  "domain/reconcile-direct-scenario-quality-aad-rbac-tests-aad-rbac-managed-v2-lifecycle-378e6e08";
const missingSubject =
  "compact/live-proof-egress-lockdown-ready-four-package-c346a6cb-20260802";
const taskStateTypes = new Set(["task-field", "task-phase", "task.phase"]);

type StateSnapshot = {
  resources?: Record<
    string,
    {
      metadata?: { generation?: number };
      spec?: { dependsOn?: string[] };
      status?: { phase?: string; conditionIds?: string[] };
    }
  >;
  conditions?: Record<
    string,
    { spec?: { type?: string; subject?: string } }
  >;
};

function matchingTaskStateCondition(
  state: StateSnapshot,
  taskId: string,
  subjectTaskId: string,
): boolean {
  const resource = state.resources?.[taskId];
  return (resource?.status?.conditionIds ?? []).some((conditionId) => {
    const spec = state.conditions?.[conditionId]?.spec;
    return (
      taskStateTypes.has(spec?.type ?? "") &&
      spec?.subject === `task:${subjectTaskId}`
    );
  });
}

export function taskStateWaitMigrationActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const actions: ProjectAppTaskAction[] = [];
  for (const [taskId, dependencyId] of [...dependencyByTask].sort()) {
    const resource = state.resources?.[taskId];
    const generation = resource?.metadata?.generation;
    if (
      resource?.status?.phase !== "waiting" ||
      !Number.isInteger(generation) ||
      !state.resources?.[dependencyId] ||
      !matchingTaskStateCondition(state, taskId, dependencyId)
    ) {
      continue;
    }
    actions.push({
      kind: "update-task",
      taskId,
      expectedGeneration: generation as number,
      dependsOn: [...new Set([...(resource.spec?.dependsOn ?? []), dependencyId])],
    });
  }

  const missing = state.resources?.[missingSubjectWait];
  if (
    missing?.status?.phase === "waiting" &&
    Number.isInteger(missing.metadata?.generation) &&
    !state.resources?.[missingSubject] &&
    matchingTaskStateCondition(state, missingSubjectWait, missingSubject)
  ) {
    actions.push({
      kind: "unblock-task",
      taskId: missingSubjectWait,
      expectedGeneration: missing.metadata!.generation as number,
      reason:
        "Legacy task-state subject has left the live graph; return the same task to current owner judgment.",
    });
  }
  return actions;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) throw new Error("unified-task-state-migration requires appDir");
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const actions = taskStateWaitMigrationActions(state);
  const summary = `Migrated ${actions.length} legacy task-state waits to task-resource reconciliation.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:task-state-waits-v1"],
    actions,
  });
}
