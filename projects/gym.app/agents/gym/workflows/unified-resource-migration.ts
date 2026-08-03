import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-resource-migration";
export const description =
  "Close the fixed set of pre-contract Gym resources into completion receipts.";

const legacyResources: Array<{ taskId: string; generation: number }> = [
  {
    taskId: "benchmark-cases/incident-s_1785517213446_45/hao-approval",
    generation: 1,
  },
  { taskId: "benchmark-cases/incident-s_1785517213446_45", generation: 1 },
  { taskId: "agent-evaluation/may", generation: 1 },
  {
    taskId: "human-review/may-alignment-20260719T142412Z-0f11808c",
    generation: 1,
  },
  { taskId: "learning/codex-failure-evidence-preservation", generation: 1 },
  {
    taskId: "verification/may-g52-exact-cli-candidate-retry-20260801",
    generation: 1,
  },
];

export function legacyGymTaskCloseActions(): ProjectAppTaskAction[] {
  return legacyResources.map(({ taskId, generation }) => ({
    kind: "close-task",
    taskId,
    expectedGeneration: generation,
    summary:
      "Retired during Gym unified-resource migration; durable event and run evidence remains authoritative.",
  }));
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const actions = legacyGymTaskCloseActions();
  const summary = `Retired ${actions.length} pre-contract Gym task resources.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:unified-resource-v1"],
    actions,
  });
}
