import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk/workflow-guard";

export const guard: WorkflowGuard = {
  name: "test-valid",
  events: ["step_done"],
  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type === "step_done") {
      return [{ type: "warn", reason: "test warning from valid guard" }];
    }
    return [];
  },
};
