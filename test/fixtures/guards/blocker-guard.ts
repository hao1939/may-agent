import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk/workflow-guard";

export const guard: WorkflowGuard = {
  name: "test-blocker",
  handle(_event: WorkflowGuardEvent): Demand[] {
    return [{ type: "block", reason: "blocked by test guard" }];
  },
};
