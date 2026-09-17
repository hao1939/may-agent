import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { Check } from "typebox/value";
import { execute } from "./evaluator-deep-eval.js";
import { deepEvaluationOutcomeSchema } from "./lib/deep-evaluation.js";

const evaluation = {
  sessionId: "s_source",
  agent: "coder",
  quality: 0.8,
  efficiency: 0.7,
  productiveCalls: 3,
  wastedCalls: 1,
  verdict: "good",
  issues: ["useful implementation"],
  overall: { resultDelivered: true },
  usage: { inputTokens: 100 },
  failureChains: [],
};

describe("evaluator deep workflow", () => {
  test("excludes an explicitly Evaluation-owned session before side effects", async () => {
    let calls = 0;
    const events: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_self", subjectAppId: "evaluation" },
      callAgent: async () => {
        calls += 1;
        throw new Error("must not call");
      },
      emit: async (event) => {
        events.push(event);
      },
    });
    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        facts: ["excluded-owner:evaluation", "excluded-session:s_self"],
      },
    });
    expect(calls).toBe(0);
    expect(events).toEqual([]);
  });

  test("passes typed workflow input and a strict result schema to the evaluator", async () => {
    const calls: Array<[string, string]> = [];
    let suppliedSchema: unknown;
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_source" },
      callAgent: async (agent, task, options) => {
        calls.push([agent, task]);
        suppliedSchema = options?.schema;
        return {
          id: "s_inner",
          kind: "agent",
          status: "done",
          summary: "no candidate",
          output: { noCandidate: true, reason: "Session is unavailable." },
        };
      },
    });

    await execute(ctx);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe("evaluator");
    expect(calls[0]?.[1]).toContain(
      "Evaluate exactly session s_source. Do not substitute another session.",
    );
    expect(suppliedSchema).toBe(deepEvaluationOutcomeSchema);
    expect(Check(deepEvaluationOutcomeSchema, evaluation)).toBe(true);
    expect(
      Check(deepEvaluationOutcomeSchema, {
        noCandidate: true,
        reason: "Session is unavailable.",
      }),
    ).toBe(true);
    expect(Check(deepEvaluationOutcomeSchema, { noCandidate: true })).toBe(
      false,
    );
  });

  test("publishes a visible failure and converges without task mutations", async () => {
    const events: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_source" },
      callAgent: async () => ({
        id: "s_inner",
        kind: "agent",
        status: "blocked",
        summary: "transcript unavailable",
      }),
      emit: async (event) => {
        events.push(event);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      kind: "workflow",
      status: "done",
      output: {
        state: "converged",
        facts: ["execution:s_inner"],
        actions: [],
      },
    });
    expect(events).toEqual([
      {
        type: "evaluation.deep_dispatched",
        localKey: "deep-dispatched",
        data: { source: "evaluator-deep-eval", sessionId: "s_source" },
        target: { appId: "evaluation", sessionId: "s_source" },
      },
      {
        type: "evaluation.deep_failed",
        localKey: "deep-failed-execution",
        data: {
          source: "evaluator-deep-eval",
          failure: "execution-not-done",
          sessionId: "s_source",
        },
        target: {
          appId: "evaluation",
          sessionId: "s_source",
        },
      },
    ]);
  });

  test("fails visibly when selected-session output is missing or invalid", async () => {
    for (const output of [undefined, { sessionId: "s_source" }]) {
      const events: unknown[] = [];
      const ctx = createTestAppWorkflowContext({
        input: { sessionId: "s_source" },
        callAgent: async () => ({
          id: "s_inner",
          kind: "agent",
          status: "done",
          summary: "finished",
          ...(output === undefined ? {} : { output }),
        }),
        emit: async (event) => {
          events.push(event);
        },
      });

      await expect(execute(ctx)).resolves.toMatchObject({
        status: "blocked",
        summary:
          "Deep evaluator output for selected session s_source failed validation.",
      });
      expect(events.map((event: any) => event.type)).toEqual([
        "evaluation.deep_dispatched",
        "evaluation.deep_failed",
      ]);
      expect(events[1]).toMatchObject({
        localKey: "deep-failed-invalid-output",
        data: {
          failure: "invalid-output",
          sessionId: "s_source",
        },
        target: { sessionId: "s_source" },
      });
    }
  });

  test("accepts an explicit no-candidate outcome without recording", async () => {
    const events: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: {},
      callAgent: async () => ({
        id: "s_inner",
        kind: "agent",
        status: "done",
        summary: "nothing eligible",
        output: { noCandidate: true, reason: "Nothing eligible." },
      }),
      emit: async (event) => {
        events.push(event);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      summary: "Nothing eligible.",
      output: { state: "converged", actions: [] },
    });
    expect(events.map((event: any) => event.type)).toEqual([
      "evaluation.deep_dispatched",
    ]);
  });

  test("publishes one durable fact for valid structured output", async () => {
    const events: unknown[] = [];
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_source" },
      callAgent: async () => ({
        id: "s_inner",
        kind: "agent",
        status: "done",
        summary: "evaluated",
        output: { evaluation },
      }),
      emit: async (event) => {
        events.push(event);
      },
    });

    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      summary: "Recorded deep evaluation for s_source with verdict good.",
      output: {
        state: "converged",
        facts: ["execution:s_inner", "recorded-evaluation:s_source"],
        actions: [],
      },
    });
    expect(events[1]).toMatchObject({
      type: "evaluation.recorded",
      localKey: "deep-recorded",
      data: {
        source: "evaluator-deep-eval",
        evaluationMethod: "llm",
        evaluatedByHeuristic: false,
        evaluation: {
          sessionId: "s_source",
          verdict: "good",
          createdAt: expect.any(Number),
          overall: { deepEval: true, deepEvalVersion: 1 },
        },
      },
      target: {
        appId: "evaluation",
        project: "evaluation",
        sessionId: "s_source",
      },
    });
  });
});
