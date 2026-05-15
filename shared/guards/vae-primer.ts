import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * vae-primer — Step-start reminder to verify after edit.
 *
 * EXP-258: Replicates EXP-256 success (RBE primer: 50%→84.2%).
 * Injects a 1-line reminder at step_start to read() files after edit()/write().
 * This is a Tier 2 intervention — fires at the decision point.
 */

export const guard: WorkflowGuard = {
  name: "vae-primer",
  events: ["step_start"],

  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.source === "function") return [];

    return [
      {
        type: "warn",
        reason:
          "C1.3 Reminder: After every edit() or write(), read() the file to verify your change landed correctly.",
      },
    ];
  },
};
