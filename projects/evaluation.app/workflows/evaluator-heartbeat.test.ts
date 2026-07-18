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
      done(summary: string) {
        return { type: "done", summary };
      },
      blocked(reason: string, detail?: unknown) {
        return { type: "blocked", reason, context: detail };
      },
    } as any,
  };
}

describe("evaluation owner action boundary", () => {
  it("runs owner judgment read-only and lets the app accept a no-op", async () => {
    const harness = context({
      disposition: "converged",
      summary: "Existing tasks already cover the signal.",
      evidence: ["No changed anomaly"],
      actions: [],
    });

    const result = await execute(harness.ctx);

    expect(result.type).toBe("done");
    expect(harness.runOptions?.tools).toBe("readonly");
    expect(harness.runOptions?.schema).toBeDefined();
    expect(harness.emitted.at(-1)?.type).toBe("evaluation.owner_reviewed");
  });

  it("rejects owner attempts to mutate reconciler-owned runtime tasks", async () => {
    const harness = context({
      disposition: "progressing",
      summary: "Change the controller task.",
      evidence: [],
      actions: [
        {
          kind: "close-task",
          taskId: "runtime/owner-review",
          expectedRevision: 1,
          summary: "closed",
        },
      ],
    });

    const result = await execute(harness.ctx);

    expect(result).toMatchObject({
      type: "blocked",
      reason: "Evaluation owner actions were rejected",
    });
  });
});
