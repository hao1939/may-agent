import { expect, test } from "bun:test";
import app, { evaluationReportInput, taskForInput, taskInputForEvent } from "./app.ts";
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
    assignment: { agent: "tech-lead" },
  } };
  expect(taskForInput({ id: "implementation-1", input } as never).intent).toMatchObject({
    agent: "tech-lead", outcome: "Implement the narrow repair", input,
  });
});

test("independent review may assess Alex work without App-wide exclusion", () => {
  const input = { kind: "review-task-outcome", data: {
    appId: "alex", taskId: "input/change-1", subjectGeneration: 2,
    reviewer: "evaluator-deepseek",
  } };
  const intent = taskForInput({ id: "review-1", input } as never).intent;
  expect(intent).toMatchObject({
    agent: "evaluator-deepseek", workflow: "task-outcome-review",
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
    agent: "evaluator-deepseek",
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

test("declared metric and review-failure subscriptions dispatch executable inputs", () => {
  const metric = app.subscriptions?.find(({ id }) => id === "selected-metric-review");
  const failure = app.subscriptions?.find(({ id }) => id === "review-failure-recovery");
  expect(metric?.event).toEqual({ type: "evaluation.metric.review.requested", project: "alex" });
  expect(failure?.event).toEqual({ type: "evaluation.review_failed", project: "alex" });
  const input = metric!.toInput!({
    type: "evaluation.metric.review.requested",
    data: { metricId: "tasks.failed", end: 42, reviewer: "evaluator-deepseek" },
  } as never)!;
  expect(taskForInput({ id: "metric-1", input } as never).intent).toMatchObject({
    parentId: "root",
    agent: "evaluator-deepseek",
    workflow: "metric-review",
    input: { metricId: "tasks.failed", end: 42, automatic: true },
  });
  const failed = failure!.toInput!({
    type: "evaluation.review_failed",
    data: { appId: "may", taskId: "goal/one", reason: "acquisition-failed" },
  } as never)!;
  expect(taskForInput({ id: "failed-1", input: failed } as never).intent.agent).toBe("alex");
});

test("ordinary Evaluation reports are consumed only by Alex with immutable identity", () => {
  const hash = (char: string) => char.repeat(64);
  const taskEvent = {
    type: "evaluation.task_report_published",
    source: "workflow:task-outcome-review",
    owner: "app:alex",
    localKey: "task-report-1",
    target: { appId: "alex", project: "alex" },
    data: {
      appId: "may", taskId: "goal/subject", evidenceHash: hash("a"),
      executionId: "s_eval_1", report: "report.md", facts: "facts.json",
      jsonHash: hash("b"), markdownHash: hash("c"), reviewer: "evaluator-deepseek",
    },
  } as never;
  const metricEvent = {
    ...taskEvent,
    type: "evaluation.metric_report_published",
    localKey: "metric-report-1",
    data: { ...taskEvent.data, appId: "alex", metricId: "tasks.failed", alertId: 42 },
  } as never;
  for (const event of [taskEvent, metricEvent]) {
    const input = evaluationReportInput(event)!;
    expect(input.kind).toBe("message");
    expect((input.data as any).context.publication.evidenceHash).toBe(hash("a"));
    expect(taskForInput({ id: String(event.localKey), input } as never).intent).toMatchObject({ agent: "alex", input });
  }
  expect(app.subscriptions?.filter(({ id }) => id === "evaluation-task-report" || id === "evaluation-metric-report")).toHaveLength(2);
  expect(() => evaluationReportInput({ ...taskEvent, data: { ...taskEvent.data, jsonHash: "bad" } } as never)).toThrow("SHA-256 jsonHash");
});

test("weekly research preserves one standing Alex Bob Task across deliveries", () => {
  const schedule = app.schedules?.find(({ id }) => id === "research-adoption-archive-review");
  expect(schedule).toMatchObject({
    intervalMs: 604800000,
    catchUp: "latest",
    input: { kind: "goal", data: { assignment: { agent: "bob" }, context: { research: { adoption: "research-adoption", mode: "standing" } } } },
  });
  const first = taskForInput({ id: "week-1", input: (schedule as any).input } as never);
  const second = taskForInput({ id: "week-2", input: (schedule as any).input } as never);
  expect(first.intent).toMatchObject({ id: "research-adoption", agent: "bob", parentId: "root" });
  expect(second.intent).toEqual(first.intent);

  const changed = structuredClone((schedule as any).input);
  changed.data.acceptance = ["Silently replace the standing requirement"];
  expect(() => taskForInput({ id: "week-3", input: changed } as never)).toThrow("exact fixed outcome");

  const targeted = structuredClone((schedule as any).input);
  delete targeted.data.context.research.mode;
  expect(taskForInput({ id: "targeted", input: targeted } as never).intent.id).toBe("input/targeted");
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
    agent: "gym", workflow: "compare-candidate", input: data,
  });
});


test("Alex translates its blocked standalone workflow facts into ordinary owned work", () => {
  const fact = { type: "workflow.owner.requested", source: "workflow-tool", data: {
    projectId: "alex", reason: "workflow-blocked", workflowRunId: "wr_blocked", blockerReason: "Missing authority",
  } };
  const input = taskInputForEvent(fact);
  expect(input?.kind).toBe("message");
  expect(taskForInput({ id: "workflow-report", input } as never).intent).toMatchObject({ agent: "alex", input });
  expect(taskInputForEvent({ ...fact, data: { ...fact.data, projectId: "another" } })).toBeNull();
  expect(taskInputForEvent({ ...fact, data: { ...fact.data, workflowRunId: "" } })).toBeNull();
});
