import { describe, expect, it } from "bun:test";

import { workflowRunWithoutSessionLooksHealthy } from "./project-metrics.ts";

describe("workflowRunWithoutSessionLooksHealthy", () => {
  it("treats a direct workflow-backed active task as owned even before a child session row exists", () => {
    expect(
      workflowRunWithoutSessionLooksHealthy({
        workflowTask: `Reconcile task through workflow master-validation-cycle\n\
app: /app/projects/aks-rp-e2e.app\n\
project: /app/projects/aks-rp-e2e\n\
\n\
## Reconciliation Task\n\
\
\
{\"taskId\":\"master-validation-staging-cycle\"}`,
        activeTaskState: "active",
        activeTaskRestartReason: null,
      }),
    ).toBeTrue();
  });

  it("does not hide a sessionless workflow run when the referenced task is inactive or already stale", () => {
    expect(
      workflowRunWithoutSessionLooksHealthy({
        workflowTask: `Reconcile task through workflow master-validation-cycle\n\
app: /app/projects/aks-rp-e2e.app\n\
project: /app/projects/aks-rp-e2e\n\
\n\
## Reconciliation Task\n\
\
\
{\"taskId\":\"master-validation-staging-cycle\"}`,
        activeTaskState: "waiting",
        activeTaskRestartReason: null,
      }),
    ).toBeFalse();
    expect(
      workflowRunWithoutSessionLooksHealthy({
        workflowTask: `{"taskId":"master-validation-staging-cycle"}`,
        activeTaskState: "active",
        activeTaskRestartReason: "missing-session",
      }),
    ).toBeFalse();
  });
});
