import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * rbe-primer — Step-start reminder to read before edit.
 *
 * EXP-256: Tests whether a structural prompt at step_start achieves
 * higher RBE compliance than post-hoc recovery (EXP-254: 50%).
 * This is a Tier 2 intervention — fires at the decision point.
 */

export const guard: WorkflowGuard = {
  name: "rbe-primer",
  events: ["step_start"],

  handle(event: WorkflowGuardEvent): Demand[] {
    // Only fire for agent steps, not function/utility steps
    if (event.source === "function") return [];

    return [
      {
        type: "warn",
        reason:
          "C1.1 Reminder: Always read() a file before edit(). Read first, then edit.",
      },
    ];
  },
};
