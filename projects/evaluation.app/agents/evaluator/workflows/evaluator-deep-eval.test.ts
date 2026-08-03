import { describe, expect, test } from "bun:test";
import { execute, reconciliationInput } from "./evaluator-deep-eval.js";

describe("evaluator deep workflow", () => {
  test("reads the stable task input from the reconciliation packet", () => {
    expect(
      reconciliationInput(
        [
          "Reconcile deep evaluation",
          "",
          "## Reconciliation Task",
          "```json",
          '{"taskId":"runtime/deep-eval/s1","input":{"sessionId":"s1"}}',
          "```",
        ].join("\n"),
      ),
    ).toEqual({ sessionId: "s1" });
  });

  test("does not infer input from unrelated prose", () => {
    expect(reconciliationInput("Please review sessionId s1")).toEqual({});
  });

  test("converges without task mutations when the inner deep evaluator session fails", async () => {
    const emitted: unknown[] = [];
    const result = await execute({
      task: [
        "## Reconciliation Task",
        "```json",
        JSON.stringify({ input: { sessionId: "s_source" } }),
        "```",
      ].join("\n"),
      projectRoot: "/tmp/evaluation-deep-eval-test",
      persistDir: "/tmp/evaluation-deep-eval-test/.state",
      getDb() {
        return {};
      },
      query: {
        evaluatorAftermathContext() {
          return {
            session: {
              sessionId: "s_source",
              agent: "coder",
              status: "done",
              task: "do useful work",
              source: "manual",
              startedAt: 1,
              endedAt: 2,
              opCount: 3,
            },
          };
        },
      },
      emit(event: unknown) {
        emitted.push(event);
      },
      async runAgent() {
        return {
          status: "error",
          sessionId: "s_inner",
          error: "provider stream ended",
        };
      },
      done(summary: string, output?: unknown) {
        return { status: "done", summary, result: output };
      },
    } as any);

    expect(result.result).toMatchObject({
      state: "converged",
      evidence: ["session:s_inner"],
      actions: [],
    });
    expect(result.result).not.toHaveProperty("conditions");
    expect(emitted).toHaveLength(2);
  });

  test("converges without task mutations when the deep evaluator artifact is missing", async () => {
    const result = await execute({
      task: [
        "## Reconciliation Task",
        "```json",
        JSON.stringify({ input: { sessionId: "s_missing_artifact" } }),
        "```",
      ].join("\n"),
      projectRoot: "/tmp/evaluation-deep-eval-test",
      persistDir: "/tmp/evaluation-deep-eval-test/.state",
      getDb() {
        return {};
      },
      query: {
        evaluatorAftermathContext() {
          return {
            session: {
              sessionId: "s_missing_artifact",
              agent: "coder",
              status: "done",
              task: "do useful work",
              source: "manual",
              startedAt: 1,
              endedAt: 2,
              opCount: 3,
            },
          };
        },
      },
      emit() {},
      async runAgent() {
        return { status: "done", sessionId: "s_inner_done" };
      },
      done(summary: string, output?: unknown) {
        return { status: "done", summary, result: output };
      },
    } as any);

    expect(result.result).toMatchObject({
      state: "converged",
      evidence: ["session:s_inner_done"],
      actions: [],
    });
    expect(result.result).not.toHaveProperty("conditions");
  });
});
