import { describe, expect, test } from "bun:test";
import { resolveAksTask } from "../../../app.js";
import {
  activeMasterValidationRun,
  buildMasterValidationQueueArgs,
  completedCycleDecision,
  completedCycleState,
  nextScheduledCycleCondition,
} from "./master-validation-cycle.js";

const parameters = {
  feature_set: "master-validation",
  target: "staging",
  metadata: JSON.stringify({ purpose: "scheduled-master-validation" }),
};

describe("master-validation cycle", () => {
  test("queues the exact main commit with the fixed validation shape", () => {
    const args = buildMasterValidationQueueArgs({
      taskId: "master-validation-staging-cycle",
      generation: 3,
      sourceCommit: "abc123",
      queuedAt: "2026-07-22T10:00:00.000Z",
    });
    expect(args).toContain("--branch");
    expect(args[args.indexOf("--branch") + 1]).toBe("main");
    expect(args[args.indexOf("--commit-id") + 1]).toBe("abc123");
    expect(args).toContain("feature_set=master-validation");
    expect(args).toContain("target=staging");
    expect(args).toContain("slices=12");
    expect(args).toContain("slice_max_parallel=6");
  });

  test("finds an active matching cycle and ignores completed or unrelated runs", () => {
    expect(
      activeMasterValidationRun([
        {
          id: 12,
          status: "completed",
          sourceBranch: "refs/heads/main",
          templateParameters: parameters,
        },
        {
          id: 13,
          status: "inProgress",
          sourceBranch: "refs/heads/dev",
          templateParameters: parameters,
        },
        {
          id: 14,
          status: "inProgress",
          sourceBranch: "refs/heads/main",
          sourceVersion: "abc123",
          templateParameters: parameters,
        },
      ]),
    ).toMatchObject({ id: 14, sourceVersion: "abc123" });
  });

  test("converges only after a passing full validation result", () => {
    expect(completedCycleState("succeeded")).toBe("converged");
    expect(completedCycleState("failed")).toBe("waiting");
    expect(completedCycleState("canceled")).toBe("waiting");
    expect(completedCycleState("unknown")).toBe("waiting");
  });

  test("rejects every aggregate result when main advanced during the run", () => {
    expect(
      completedCycleDecision({
        result: "failed",
        testedCommit: "old-main",
        currentMainCommit: "new-main",
      }),
    ).toBe("stale");
    expect(
      completedCycleDecision({
        result: "succeeded",
        testedCommit: "old-main",
        currentMainCommit: "new-main",
      }),
    ).toBe("stale");
    expect(
      completedCycleDecision({
        result: "succeeded",
        testedCommit: "current-main",
        currentMainCommit: "current-main",
      }),
    ).toBe("converged");
    expect(
      completedCycleDecision({
        result: "failed",
        testedCommit: "current-main",
        currentMainCommit: "current-main",
      }),
    ).toBe("waiting");
  });

  test("waits for the next scheduled cycle after a nonpassing result", () => {
    expect(nextScheduledCycleCondition()).toEqual({
      id: "master-validation-next-scheduled-cycle",
      type: "project.task.tick",
      subject: "task:master-validation-staging-cycle",
      expected: {
        field: "reason",
        anyOf: [
          "scheduled-six-hour-master-validation",
          "master-validation-main-advanced",
        ],
      },
    });
  });

  test("uses one stable sibling identity for the same spec failure", () => {
    const event = {
      type: "pipeline.failure.observed",
      target: { project: "aks-rp-e2e" },
      data: {
        project: "aks-rp-e2e",
        pipelineRunId: "123",
        specId: "spec.example",
        status: "fail",
        category: "implementation",
        reason: "assertion failed",
        failureFingerprint: "same-fingerprint",
        artifactPath: "/tmp/result.json",
        sourceBranch: "main",
        sourceCommit: "abc123",
      },
    };
    const first = resolveAksTask(event);
    const second = resolveAksTask({
      ...event,
      data: { ...event.data, pipelineRunId: "456" },
    });
    expect(first?.id).toBe(second?.id);
    expect(first).toMatchObject({
      parentId: "group/domain-work",
      owner: "aks-explorer",
      workflow: "master-validation-failure",
      input: {
        validationTaskId: "master-validation-staging-cycle",
        sourceBranch: "main",
      },
    });
  });
});
