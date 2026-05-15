/// <reference path="../workflow-defs.d.ts" />

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
