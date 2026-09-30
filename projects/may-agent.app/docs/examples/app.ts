import type { TaskReconcileResult } from "@may-agent/sdk";

// The runnable App is canonical; these exports demonstrate additional results.
export { default } from "../../../sample.app/app.js";

// An attempt that needs an external fact can return this exact wait. The
// pipeline observer must publish the declared fact when run 123 changes.
export const waitingResult = {
  state: "waiting",
  summary: "Waiting for pipeline run 123 to complete",
  facts: ["pipeline-run:123"],
  conditions: [{
    id: "report-run-finished",
    type: "pipeline-run.state",
    subject: "pipeline-run:123",
    expected: { field: "state", equals: "completed" },
    owner: "app:pipeline",
    reviewAfterMs: 300_000,
  }],
} satisfies TaskReconcileResult;

// Use this result only with an installed App accepting this input contract.
// A workflow returns ctx.done(dependencyResult.summary, dependencyResult).
export const dependencyResult = {
  state: "waiting",
  summary: "Waiting for release governance",
  facts: ["verification/report.json"],
  dependencies: [{
    id: "release-governance-v4",
    appId: "release-governance",
    input: {
      kind: "approval-request",
      data: {
        requestedAction: "Approve, adjust, or reject the rollout.",
        reason: "Production policy requires an independent decision.",
        evidence: ["verification/report.json"],
        severity: "P1",
        correlationKey: "sample:production-rollout:v4",
      },
    },
  }],
} satisfies TaskReconcileResult;
