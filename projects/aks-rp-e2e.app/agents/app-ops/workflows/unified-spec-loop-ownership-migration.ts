import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk/legacy";

export const name = "unified-spec-loop-ownership-migration";
export const description =
  "Move the exact safe legacy spec-loop siblings under their executable parent and compact completed holders.";

const specLoopTaskId = "aks-spec-verification-loop";
const legacyGroupId = "group/spec-verification";
const childBackedWait =
  "wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708";
const completedHolders = [
  "hold-spec-trusted-access-dataplane-token-gateway-reviewed-exception-20260720",
  "hold-spec-network-swift-v1-vnetscale-dual-stack-basic-datapath-reviewed-timeout-frontier-20260728",
] as const;

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string; conditionIds?: string[] };
};

type StateSnapshot = {
  resources?: Record<string, Resource>;
};

function childIds(state: StateSnapshot, parentId: string): string[] {
  return Object.entries(state.resources ?? {})
    .filter(([, resource]) => resource.spec?.parentId === parentId)
    .map(([taskId]) => taskId)
    .sort();
}

export function specLoopOwnershipMigrationActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const resources = state.resources ?? {};
  const actions: ProjectAppTaskAction[] = [];

  const wait = resources[childBackedWait];
  if (
    wait?.spec?.parentId === legacyGroupId &&
    wait.spec.mode === "achieve" &&
    wait.status?.phase === "waiting" &&
    (wait.status.conditionIds ?? []).length === 0 &&
    childIds(state, childBackedWait).length > 0 &&
    Number.isInteger(wait.metadata?.generation)
  ) {
    actions.push({
      kind: "update-task",
      taskId: childBackedWait,
      expectedGeneration: wait.metadata!.generation as number,
      parentId: specLoopTaskId,
    });
  }

  for (const taskId of completedHolders) {
    const holder = resources[taskId];
    if (
      holder?.spec?.parentId !== legacyGroupId ||
      holder.spec.mode !== "maintain" ||
      holder.status?.phase !== "converged" ||
      (holder.status.conditionIds ?? []).length > 0 ||
      childIds(state, taskId).length > 0 ||
      !Number.isInteger(holder.metadata?.generation)
    ) {
      continue;
    }
    actions.push({
      kind: "close-task",
      taskId,
      expectedGeneration: holder.metadata!.generation as number,
      summary:
        "Compacted completed legacy spec holder; the standing spec loop owns future reconciliation.",
    });
  }

  return actions;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-spec-loop-ownership-migration requires appDir");
  }
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const actions = specLoopOwnershipMigrationActions(state);
  const summary = `Migrated ${actions.length} safe legacy spec-loop siblings to executable-parent ownership.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:spec-loop-siblings-v1"],
    actions,
  });
}
