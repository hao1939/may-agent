import { describe, expect, test } from "bun:test";
import {
  failureObservationIsStale,
  parseFailureInput,
  passingRecoveryObservation,
  productRecoveryCondition,
  shouldReconcileTestFix,
  workspace,
} from "./master-validation-failure.js";

describe("master-validation failure workflow", () => {
  test("declares a main-based task worktree", () => {
    expect(workspace).toEqual({ kind: "task", baseBranch: "main" });
  });

  test("waits for a new verdict instead of repairing an old-main failure", () => {
    expect(failureObservationIsStale("old-main", "current-main")).toBe(true);
    expect(failureObservationIsStale("current-main", "current-main")).toBe(
      false,
    );
    expect(failureObservationIsStale("", "current-main")).toBe(false);
  });

  test("reads the correlated progressive failure payload", () => {
    const parsed = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  generation: 2,
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
    artifactPath: "/tmp/result.json",
    sourceCommit: "abc",
    reason: "failed",
    category: "implementation",
    status: "fail",
  },
})}
`);
    expect(parsed).toMatchObject({
      taskId: "domain/master-validation-failure/spec.example/fp",
      generation: 2,
      specId: "spec.example",
      pipelineRunId: "123",
      failureFingerprint: "fp",
      sourceCommit: "abc",
    });
  });

  test("accepts only a later passing observation from main as recovery", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
  },
})}
`)!;
    const raw = `
## Trigger Event
${JSON.stringify({
  type: "pipeline.spec.observed",
  pipelineRunId: "124",
  sourceBranch: "refs/heads/main",
  sourceCommit: "def",
  specId: "spec.example",
  status: "pass",
  artifactPath: "/tmp/result.json",
})}
`;
    expect(passingRecoveryObservation(raw, input)).toMatchObject({
      pipelineRunId: "124",
      specId: "spec.example",
      status: "pass",
    });
    expect(
      passingRecoveryObservation(
        raw.replace('"pipelineRunId":"124"', '"pipelineRunId":"122"'),
        input,
      ),
    ).toBeNull();
  });

  test("waits for an exact same-spec pass through the project observation stream", () => {
    const input = parseFailureInput(`
## Reconciliation Task
${JSON.stringify({
  taskId: "domain/master-validation-failure/spec.example/fp",
  input: {
    specId: "spec.example",
    pipelineRunId: "123",
    failureFingerprint: "fp",
  },
})}
`)!;
    expect(productRecoveryCondition(input)).toEqual({
      id: "master-validation-product-recovery-fp",
      type: "pipeline.spec.observed",
      subject: "project:aks-rp-e2e",
      expected: {
        specId: "spec.example",
        status: "pass",
        sourceBranch: "refs/heads/main",
      },
    });
  });

  test("resumes deterministic live reconciliation for a novel fix or existing PR", () => {
    expect(
      shouldReconcileTestFix({
        hasPullRequest: false,
        sourceIsInTarget: true,
      }),
    ).toBe(false);
    expect(
      shouldReconcileTestFix({
        hasPullRequest: false,
        sourceIsInTarget: false,
      }),
    ).toBe(true);
    expect(
      shouldReconcileTestFix({
        hasPullRequest: true,
        sourceIsInTarget: true,
      }),
    ).toBe(true);
  });
});
