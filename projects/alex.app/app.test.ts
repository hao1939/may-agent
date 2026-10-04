import { expect, test } from "bun:test";
import app, { taskForInput, taskInputForEvent } from "./app.ts";
import { assertValidAppDefinition } from "/app/projects/may-agent/src/app/core/apps/definition-validation.ts";

test("Alex bootstrap uses ordinary durable Task admission", () => {
  expect(() => assertValidAppDefinition(app)).not.toThrow();
  const admitted = {
    id: "migration-admission",
    input: { kind: "goal", data: {
      outcome: "Carry unfinished improvement work into Alex",
      acceptance: ["Preserve unfinished requirements and caller relationships"],
      constraints: ["Keep existing history"],
    } },
  };
  const first = taskForInput(admitted as never);
  expect(taskForInput(admitted as never)).toEqual(first);
  expect(first.intent.agent).toBe("alex");
  expect(first.intent.input).toEqual(admitted.input);
  expect(first.intent.acceptance).toEqual(admitted.input.data.acceptance);
});

test("An operational message reaches executable Alex work", () => {
  const input = { kind: "message", data: { message: "Investigate the broken intake" } };
  expect(taskForInput({ id: "report-1", input } as never).intent).toMatchObject({
    agent: "alex", outcome: "Investigate the broken intake", input,
  });
});

test("specialist goals remain Alex-owned executable work", () => {
  const input = { kind: "goal", data: {
    outcome: "Implement the narrow repair",
    acceptance: ["Focused checks pass"],
    assignment: { agent: "may-tech-lead" },
  } };
  expect(taskForInput({ id: "implementation-1", input } as never).intent).toMatchObject({
    agent: "may-tech-lead", outcome: "Implement the narrow repair", input,
  });
});

test("independent review may assess Alex work without App-wide exclusion", () => {
  const input = { kind: "review-task-outcome", data: {
    appId: "alex", taskId: "input/change-1", subjectGeneration: 2,
    reviewer: "evaluator-deepseek",
  } };
  const intent = taskForInput({ id: "review-1", input } as never).intent;
  expect(intent).toMatchObject({
    agent: "alex-evaluator-deepseek", workflow: "task-outcome-review",
    input: { appId: "alex", taskId: "input/change-1", subjectGeneration: 2 },
  });
});

test("selected review events return to executable Alex review work", () => {
  const input = taskInputForEvent({
    type: "evaluation.task.review.requested",
    data: {
      appId: "may",
      taskId: "input/change-1",
      populationEnd: 42,
      reviewer: "evaluator-deepseek",
    },
  } as never);
  expect(input).toEqual({
    kind: "review-task-outcome",
    data: {
      appId: "may",
      taskId: "input/change-1",
      populationEnd: 42,
      assessmentPurpose: "outcome",
      reviewer: "evaluator-deepseek",
      automatic: true,
    },
  });
  expect(taskForInput({ id: "selected-review-1", input } as never).intent).toMatchObject({
    parentId: "root",
    agent: "alex-evaluator-deepseek",
    workflow: "task-outcome-review",
    input: { appId: "may", taskId: "input/change-1", populationEnd: 42, automatic: true },
  });
});

test("qualified Scout research reaches executable Alex adoption work", () => {
  const input = taskInputForEvent({
    type: "scout.research.qualified",
    data: { artifact: "shared/knowledge/example.md", artifactHash: "a".repeat(64) },
  } as never)!;
  expect(input.kind).toBe("message");
  expect(taskForInput({ id: "research-1", input } as never).intent).toMatchObject({
    parentId: "root",
    agent: "alex",
    input,
  });
});

test("automatic review failures stay executable under Alex", () => {
  const input = taskInputForEvent({
    type: "evaluation.review_failed",
    data: { appId: "may", taskId: "goal/one", reason: "acquisition-failed" },
  } as never)!;
  expect(taskForInput({ id: "review-failure-1", input } as never).intent).toMatchObject({
    parentId: "root",
    agent: "alex",
    input: { kind: "message", data: { context: { reviewFailure: { appId: "may", taskId: "goal/one" } } } },
  });
});

test("metric review events attach to the migrated evaluator", () => {
  const input = taskInputForEvent({
    type: "evaluation.metric.review.requested",
    data: { metricId: "tasks.failed", end: 42, reviewer: "evaluator-deepseek" },
  } as never)!;
  expect(taskForInput({ id: "metric-1", input } as never).intent).toMatchObject({
    parentId: "root",
    agent: "alex-evaluator-deepseek",
    workflow: "metric-review",
    input: { metricId: "tasks.failed", end: 42, automatic: true },
  });
});

test("comparison inputs attach to the migrated Gym specialist", () => {
  const data = {
    requestId: "candidate-1", agent: "may", baselineRunId: "base-1",
    baselinePath: "/tmp/base", baselineFingerprint: "base-hash",
    candidate: "candidate-1", candidatePath: "/tmp/candidate",
    candidateFingerprint: "candidate-hash", benchmark: "focused",
    scorerRevision: "scorer-1", frameworkRevision: "framework-1", model: "test",
    scenarios: ["incident", "paraphrase", "opposite", "transfer"], trials: 1,
    timeoutMs: 60000, totalAllowanceMs: 60000,
  };
  expect(taskForInput({ id: "comparison-1", input: { kind: "compare-candidate", data } } as never).intent).toMatchObject({
    agent: "alex-gym", workflow: "compare-candidate", input: data,
  });
});
