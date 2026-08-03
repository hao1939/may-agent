import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-project-state-residue-migration";
export const description =
  "Retire the two exact project-state residues that require topology-aware cleanup.";

const localDnsHolder =
  "hold-compact-localdns-mixed-frontier-a564608562-20260728";
const localDnsChildren = [
  "wait-localdns-compact-mixed-frontier-origin-dev-advance-110b4497-20260728",
  "wait-localdns-compact-mixed-frontier-origin-dev-advance-68084bdc-20260728",
] as const;
const runtimeContainerCarrier =
  "compact/repair-compact-feature-runtime-container-representation-c4c7695238-ceb5e59f32";

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string; conditionIds?: string[] };
};

type StateSnapshot = {
  resources?: Record<string, Resource>;
  conditions?: Record<string, { spec?: { type?: string } }>;
};

function hasProjectStateCondition(
  state: StateSnapshot,
  taskId: string,
): boolean {
  return (state.resources?.[taskId]?.status?.conditionIds ?? []).some(
    (conditionId) =>
      state.conditions?.[conditionId]?.spec?.type === "project.state",
  );
}

function childIds(state: StateSnapshot, parentId: string): string[] {
  return Object.entries(state.resources ?? {})
    .filter(([, resource]) => resource.spec?.parentId === parentId)
    .map(([taskId]) => taskId)
    .sort();
}

export function projectStateResidueCloseActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const actions: ProjectAppTaskAction[] = [];
  const resources = state.resources ?? {};

  const holder = resources[localDnsHolder];
  const expectedChildren = [...localDnsChildren].sort();
  const childrenMatch =
    JSON.stringify(childIds(state, localDnsHolder)) ===
      JSON.stringify(expectedChildren) &&
    localDnsChildren.every((taskId) => {
      const child = resources[taskId];
      return (
        child?.spec?.mode === "maintain" &&
        child.status?.phase === "converged" &&
        Number.isInteger(child.metadata?.generation) &&
        childIds(state, taskId).length === 0
      );
    });
  if (
    holder?.spec?.mode === "maintain" &&
    holder.status?.phase === "waiting" &&
    Number.isInteger(holder.metadata?.generation) &&
    hasProjectStateCondition(state, localDnsHolder) &&
    childrenMatch
  ) {
    for (const taskId of expectedChildren) {
      actions.push({
        kind: "close-task",
        taskId,
        expectedGeneration: resources[taskId]!.metadata!.generation as number,
        summary:
          "Compacted completed legacy LocalDNS repo-ref carrier into a receipt.",
      });
    }
    actions.push({
      kind: "close-task",
      taskId: localDnsHolder,
      expectedGeneration: holder.metadata!.generation as number,
      summary:
        "Retired legacy LocalDNS project-state holder; the stable feature loop owns future observation.",
    });
  }

  const runtimeContainer = resources[runtimeContainerCarrier];
  if (
    runtimeContainer?.spec?.mode === "achieve" &&
    runtimeContainer.status?.phase === "waiting" &&
    Number.isInteger(runtimeContainer.metadata?.generation) &&
    hasProjectStateCondition(state, runtimeContainerCarrier) &&
    childIds(state, runtimeContainerCarrier).length === 0
  ) {
    actions.push({
      kind: "close-task",
      taskId: runtimeContainerCarrier,
      expectedGeneration: runtimeContainer.metadata!.generation as number,
      summary:
        "Closed completed representation repair; the stable feature loop owns future runtime-container observation.",
    });
  }

  return actions;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-project-state-residue-migration requires appDir");
  }
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const actions = projectStateResidueCloseActions(state);
  const summary = `Retired ${actions.length} topology-aware project-state residues.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:project-state-residue-v2"],
    actions,
  });
}
