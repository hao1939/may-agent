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

  test("keeps an external project hint neutral without authoritative Task identity", async () => {
    let calls = 0;
    const ctx = createTestAppWorkflowContext({
      input: {
        targetProject: "gym.app",
        focus: "Check executor isolation.",
        readOnly: true,
      },
      callAgent: async () => {
        calls += 1;
        throw new Error("must not call");
      },
    });
    const result = await execute(ctx);
    expect(result).toMatchObject({
      status: "done",
      output: {
        state: "converged",
        summary: expect.stringContaining("insufficient-evidence"),
        facts: [
          "review-disposition:insufficient-evidence",
          "subject-hint:gym.app",
        ],
        actions: [],
      },
    });
    expect(calls).toBe(0);
  });

  test("excludes Evaluation before calling the model", async () => {
    let calls = 0;
    const ctx = createTestAppWorkflowContext({
      input: {
        targetProject: "evaluation.app",
        focus: "self review",
        readOnly: true,
      },
      callAgent: async () => {
        calls += 1;
        throw new Error("must not call");
      },
    });
    await expect(execute(ctx)).resolves.toMatchObject({
      status: "done",
      output: {
        facts: ["review-disposition:excluded", "subject-hint:evaluation.app"],
      },
    });
    expect(calls).toBe(0);
  });
});
