import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import { execute } from "./evaluator-deep-eval.ts";

describe("retired deep session review", () => {
  test("never calls a model for session-only input, including a false external hint", async () => {
    for (const input of [
      { sessionId: "s_unknown" },
      { sessionId: "s_evaluation_owned", subjectAppId: "scout-knowledge-lib" },
    ]) {
      let calls = 0;
      const result = await execute(
        createTestAppWorkflowContext({
          input,
          callAgent: async () => {
            calls += 1;
            throw new Error("must not call");
          },
        }),
      );
      expect(result.status).toBe("done");
      expect(result.summary).toContain("session-only deep review is retired");
      expect(calls).toBe(0);
    }
  });

  test("excludes an explicit Evaluation hint before side effects", async () => {
    let calls = 0;
    const result = await execute(
      createTestAppWorkflowContext({
        input: { sessionId: "s_self", subjectAppId: "evaluation" },
        callAgent: async () => {
          calls += 1;
          throw new Error("must not call");
        },
      }),
    );
    expect(result.summary).toContain("Excluded Evaluation-owned session");
    expect(calls).toBe(0);
  });
});
