/// <reference path="../workflow-defs.d.ts" />

/**
 * Test guard: emits a warn demand on every step_done event.
 * Used by integration tests to verify warning delivery to next step.
 */
export const guard: WorkflowGuard = {
  name: "test-warn-on-step-done",
  events: ["step_done"],
  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type === "step_done") {
      return [{ type: "warn", reason: `Step "${event.step}" completed — review recommended` }];
    }
    return [];
  },
};
