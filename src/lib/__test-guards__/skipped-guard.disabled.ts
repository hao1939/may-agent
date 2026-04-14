/// <reference path="../workflow-defs.d.ts" />
// This guard file has .disabled.ts extension and should be skipped by loadGuards
export const guard: WorkflowGuard = {
  name: "disabled-guard",
  handle: () => [{ type: "warn", reason: "should never fire" }],
};
