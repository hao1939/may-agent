/// <reference path="../workflow-defs.d.ts" />

/**
 * Test guard: injects a run_step demand when step "step-one" completes.
 * Used by integration tests to verify guard step injection.
 */
export const guard: WorkflowGuard = {
  name: "test-inject-step",
  events: ["step_done"],
  handle(event: WorkflowGuardEvent): Demand[] {
    if (event.type === "step_done" && event.step === "step-one") {
      return [{
        type: "run_step",
        reason: "step-one needs verification",
        step: {
          agent: "verifier",
          task: "Verify the output of step-one",
          label: "guard:verify-step-one",
        },
      }];
    }
    return [];
  },
};
