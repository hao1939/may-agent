import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * cost-limit guard — tracks cumulative agent turns and enforces a budget.
 *
 * Prevents runaway workflows from consuming excessive resources by summing
 * turnsUsed across all completed steps and the current step.
 *
 * - WARN at 40 total turns
 * - BLOCK at 60 total turns
 */

const WARN_TURNS = 40;
const BLOCK_TURNS = 60;

export const guard: WorkflowGuard = {
  name: "cost-limit",
  events: ["step_done"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type !== "step_done") return [];

    // Sum turnsUsed from all completed steps
    const completedTurns = (event.completedSteps ?? []).reduce(
      (sum, s) => sum + (s.result?.turnsUsed ?? 0),
      0,
    );

    // Add current step's turns
    const currentTurns = event.result?.turnsUsed ?? 0;
    const totalTurns = completedTurns + currentTurns;

    if (totalTurns >= BLOCK_TURNS) {
      return [
        {
          type: "block",
          reason:
            `Workflow has used ${totalTurns} total turns (limit: ${BLOCK_TURNS}). ` +
            `Blocking to prevent runaway resource consumption.`,
        },
      ];
    }

    if (totalTurns >= WARN_TURNS) {
      return [
        {
          type: "warn",
          reason:
            `Workflow has used ${totalTurns} total turns so far (warn threshold: ${WARN_TURNS}, ` +
            `block threshold: ${BLOCK_TURNS}). Consider wrapping up.`,
        },
      ];
    }

    return [];
  },
};
