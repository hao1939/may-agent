import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-resource-migration";
export const description =
  "Close fixed superseded Gym resources into completion receipts.";

const supersededResources: Array<{ taskId: string; generation: number }> = [
  { taskId: "runtime/design-alignment-review", generation: 3 },
  { taskId: "runtime/owner-review", generation: 2 },
];

export function supersededGymTaskCloseActions(): ProjectAppTaskAction[] {
  return supersededResources.map(({ taskId, generation }) => ({
    kind: "close-task",
    taskId,
    expectedGeneration: generation,
    summary:
      "Retired as superseded Gym recovery state; durable event and run evidence remains authoritative.",
  }));
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const actions = supersededGymTaskCloseActions();
  const summary = `Retired ${actions.length} superseded Gym task resources.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:unified-resource-v3"],
    actions,
  });
}
