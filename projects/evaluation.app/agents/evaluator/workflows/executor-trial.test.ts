import { describe, expect, test } from "bun:test";
import { createTestAppWorkflowContext } from "@may-agent/sdk/testing";
import {
  execute,
  executorTrialPrompt,
  parseExecutorTrialResult,
} from "./executor-trial.ts";

describe("executor trial workflow", () => {
  test("uses one explicit read-only prompt", () => {
    const prompt = executorTrialPrompt({
      targetProject: "evaluation.app",
      focus: "Check executor isolation.",
    });
    expect(prompt).toContain("bounded, read-only executor comparison");
    expect(prompt).toContain("Do not edit files");
    expect(prompt).toContain("Check executor isolation.");
  });

  test("accepts only a cited assessment", () => {
    expect(
      parseExecutorTrialResult({
        assessment: "The paths are isolated.",
        evidence: ["app.ts:353"],
      }),
    ).toEqual({
      assessment: "The paths are isolated.",
      evidence: ["app.ts:353"],
    });
    expect(parseExecutorTrialResult({ assessment: "No evidence." })).toBeNull();
  });

  test("returns the assessment through the canonical Task result", async () => {
    const ctx = createTestAppWorkflowContext({
      input: {
        targetProject: "evaluation.app",
        focus: "Check executor isolation.",
        readOnly: true,
      },
      callAgent: async () =>
        ({
          id: "s_trial",
          kind: "agent",
          status: "done",
          summary: "done",
          output: {
            assessment: "The paths are isolated.",
            evidence: ["app.ts:353"],
          },
        }) as const,
    });
    const result = await execute(ctx);
    expect(result).toMatchObject({ status: "done" });
    expect(result.output).toMatchObject({
      state: "converged",
      response: "The paths are isolated.",
      evidence: ["execution:s_trial", "app.ts:353"],
      actions: [],
    });
  });
});
