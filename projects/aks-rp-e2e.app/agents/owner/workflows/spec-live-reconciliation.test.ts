import { describe, expect, test } from "bun:test";
import {
  agentConditionProblem,
  matchingTaskRuns,
  parseTaskPayload,
  pipelineWaitCondition,
  pullRequestSourceUpdateCondition,
  pullRequestWaitCondition,
  resolveIntegrationTarget,
} from "./spec-live-reconciliation.js";

describe("spec-live-reconciliation workflow", () => {
  test("validates agent waits without replacing agent judgment", () => {
    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for recovery",
        evidence: ["run:42"],
        condition: {
          id: "recovery",
          type: "pipeline.spec.observed",
          subject: "later proof for spec.example",
          expected: { status: "pass" },
        },
      }),
    ).toContain("must be typed");

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for recovery",
        evidence: ["run:42"],
        condition: {
          id: "recovery",
          type: "pipeline.spec.observed",
          subject: "project:aks-rp-e2e",
          expected: { pipelineRunIdGreaterThan: "42" },
        },
      }),
    ).toContain("unsupported comparison fields");

    expect(
      agentConditionProblem({
        decision: "waiting",
        summary: "wait for recovery",
        evidence: ["run:42"],
        condition: {
          id: "recovery",
          type: "pipeline.spec.observed",
          subject: "project:aks-rp-e2e",
          expected: {
            specId: "spec.example",
            status: "pass",
            sourceBranch: "refs/heads/main",
          },
        },
      }),
    ).toBeNull();
  });

  test("parses the finite spec task identity and generation", () => {
    expect(
      parseTaskPayload(
        `prefix\n## Reconciliation Task\n${JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation: 2,
          input: { specId: "spec.example.lifecycle" },
        })}`,
      ),
    ).toMatchObject({
      taskId: "spec/example-a1b2c3",
      generation: 2,
      input: { specId: "spec.example.lifecycle" },
    });
  });

  test("finds only an exact task-generation, spec, target, and source run", () => {
    const exact = {
      id: 42,
      sourceVersion: "abc",
      templateParameters: {
        specs: "spec.example.lifecycle",
        target: "staging",
        metadata: JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation: 2,
        }),
      },
    };
    const wrongGeneration = {
      ...exact,
      id: 43,
      templateParameters: {
        ...exact.templateParameters,
        metadata: JSON.stringify({
          taskId: "spec/example-a1b2c3",
          generation: 1,
        }),
      },
    };

    expect(
      matchingTaskRuns([wrongGeneration, exact], {
        taskId: "spec/example-a1b2c3",
        generation: 2,
        specId: "spec.example.lifecycle",
        sourceCommit: "abc",
      }),
    ).toEqual([exact]);
  });

  test("uses exact pipeline and PR Conditions", () => {
    expect(pipelineWaitCondition("42")).toEqual({
      id: "pipeline-run-42-completed",
      type: "pipeline-run.state",
      subject: "pipeline-run:42",
      expected: { field: "state", anyOf: ["completed"] },
    });
    expect(pullRequestWaitCondition("77")).toEqual({
      id: "pull-request-77-changed",
      type: "pull-request.state",
      subject: "pull-request:77",
      expected: {
        field: "state",
        anyOf: ["completed", "abandoned", "conflicted"],
      },
    });
    expect(pullRequestSourceUpdateCondition("77", "abc")).toEqual({
      id: "pull-request-77-source-not-abc",
      type: "pull-request.state",
      subject: "pull-request:77",
      expected: { field: "sourceCommit", notEquals: "abc" },
    });
  });

  test("uses dev by convention and allows the master-validation workflow to target main", () => {
    expect(resolveIntegrationTarget()).toEqual({
      targetBranch: "dev",
      targetRef: "origin/dev",
    });
    expect(resolveIntegrationTarget("main")).toEqual({
      targetBranch: "main",
      targetRef: "origin/main",
    });
    expect(() => resolveIntegrationTarget("bad branch")).toThrow();
  });
});
