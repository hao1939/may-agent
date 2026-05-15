/// <reference path="../workflow-defs.d.ts" />

export const guard: WorkflowGuard = {
  name: "test-blocker",
  handle(event: WorkflowGuardEvent): Demand[] {
    return [{ type: "block", reason: "blocked by test guard" }];
  },
};
