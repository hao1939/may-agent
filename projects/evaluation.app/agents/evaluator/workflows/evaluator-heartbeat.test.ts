import { describe, expect, it } from "bun:test";
import { execute } from "./evaluator-heartbeat";

function context(result: Record<string, unknown>) {
  const emitted: Array<Record<string, unknown>> = [];
  let runOptions: Record<string, unknown> | undefined;
  const unavailable = () => {
    throw new Error("not available in unit test");
  };
  return {
    emitted,
    get runOptions() {
      return runOptions;
    },
    ctx: {
      task: "evaluation owner review",
      query: {
        metrics: unavailable,
        workflowRuns: unavailable,
        events: unavailable,
      },
      emit(event: Record<string, unknown>) {
        emitted.push(event);
      },
      async runAgent(
        _agent: string,
        _prompt: string,
        options: Record<string, unknown>,
      ) {
        runOptions = options;
        return {
          sessionId: "s_owner",
          status: "done",
          lastAssistantText: "reviewed",
          messages: [],
          structuredResult: result,
        };
      },
      done(summary: string, output?: unknown) {
        return { type: "done", summary, output };
      },
      blocked(reason: string, detail?: unknown) {
        return { type: "blocked", reason, context: detail };
      },
    } as any,
  };
}

describe("evaluation owner action boundary", () => {
  it("runs owner judgment read-only and returns a typed no-op to the reconciler", async () => {
    const harness = context({
      state: "converged",
      summary: "Existing tasks already cover the signal.",
      evidence: ["No changed anomaly"],
      actions: [],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.runOptions?.tools).toBe("readonly");
    expect(harness.runOptions?.schema).toBeDefined();
    expect(harness.emitted.at(-1)?.type).toBe("evaluation.owner_reviewed");
    if (result.type === "done") {
      expect((result.output as Record<string, unknown>).actions).toEqual([]);
    }
  });

  it("coerces a waiting no-op without exact conditions to converged", async () => {
    const harness = context({
      state: "waiting",
      summary: "No task-tree edit; wait for the next owner wake.",
      evidence: [
        "Regression shape: Waiting result for runtime/owner-review requires at least one exact Condition",
      ],
      actions: [],
      conditions: [],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.emitted.at(-1)).toMatchObject({
      type: "evaluation.owner_reviewed",
      data: { state: "converged", proposedActions: [] },
    });
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        state: "converged",
        actions: [],
        conditions: [],
      });
      expect(
        String((result.output as Record<string, unknown>).summary),
      ).toContain("waiting without exact conditions");
    }
  });

  it("preserves waiting when exact conditions are present", async () => {
    const harness = context({
      state: "waiting",
      summary: "Wait for runtime patch evidence.",
      evidence: ["Owner identified a real external wait."],
      actions: [],
      conditions: [
        {
          id: "runtime-owner-review-contract-patch-observed",
          type: "event-observed",
          subject: "runtime/owner-review contract enforcement",
          expected:
            "a passing owner-review reconciliation with exact conditions",
          owner: "may-agent.app",
        },
      ],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        state: "waiting",
        conditions: [
          {
            id: "runtime-owner-review-contract-patch-observed",
            type: "event-observed",
          },
        ],
      });
    }
  });

  it("returns proposed actions without applying them inside the workflow", async () => {
    const harness = context({
      state: "converged",
      summary: "Change the controller task.",
      evidence: [],
      actions: [
        {
          kind: "close-task",
          taskId: "runtime/owner-review",
          expectedGeneration: 1,
          summary: "closed",
        },
      ],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    if (result.type === "done") {
      expect(result.output).toMatchObject({
        actions: [{ kind: "close-task", taskId: "runtime/owner-review" }],
      });
    }
  });
});
