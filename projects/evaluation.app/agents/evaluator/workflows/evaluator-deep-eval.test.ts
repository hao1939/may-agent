import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./evaluator-deep-eval.js";

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
  test("passes typed workflow input to the bounded evaluator execution", async () => {
    const calls: Array<[string, string]> = [];
    const ctx = createTestAppWorkflowContext({
      input: { sessionId: "s_source" },
      callAgent: async (agent, task) => {
        calls.push([agent, task]);
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
        evidence: ["execution:s_inner"],
        actions: [],
      },
    });
    expect(events).toEqual([
      {
        type: "evaluation.deep_dispatched",
        data: { source: "evaluator-deep-eval", sessionId: "s_source" },
        target: { appId: "evaluation", sessionId: "s_source" },
      },
      {
        type: "evaluation.deep_failed",
        data: {
          source: "evaluator-deep-eval",
          executionId: "s_inner",
          status: "blocked",
          summary: "transcript unavailable",
          sessionId: "s_source",
        },
        target: {
          appId: "evaluation",
          executionId: "s_inner",
          sessionId: "s_source",
        },
      },
    ]);
  });

  test("converges visibly when structured output is missing or invalid", async () => {
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
        status: "done",
        summary: "Deep evaluator returned no valid result for s_source.",
        output: { state: "converged", actions: [] },
      });
      expect(events.map((event: any) => event.type)).toEqual([
        "evaluation.deep_dispatched",
      ]);
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
        evidence: ["execution:s_inner", "evaluated-session:s_source"],
        actions: [],
      },
    });
    expect(events[1]).toMatchObject({
      type: "evaluation.deep_recorded",
      data: {
        source: "evaluator-deep-eval",
        evaluation: {
          sessionId: "s_source",
          verdict: "good",
          overall: { deepEval: true, deepEvalVersion: 1 },
        },
      },
      target: { appId: "evaluation", sessionId: "s_source" },
    });
  });
});
