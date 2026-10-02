import { describe, expect, it } from "bun:test";
import { admitCodexGoalTaskResult } from "./codex-goal-result.js";

const options = {
  allowNeedsAgent: false,
};

describe("admitCodexGoalTaskResult", () => {
  it("uses the production SDK admission boundary after exact JSON parsing", () => {
    const admitted = admitCodexGoalTaskResult(
      JSON.stringify({
        state: "converged",
        summary: "The bounded proof passed",
        response: "The task is complete.",
        facts: ["bun test: passed"],
      }),
      options,
    );

    expect(admitted).toEqual({
      kind: "accepted",
      result: {
        state: "converged",
        summary: "The bounded proof passed",
        response: "The task is complete.",
        facts: ["bun test: passed"],
        actions: [],
      },
    });
  });

  it("rejects valid JSON with a non-May terminal state", () => {
    const rejected = admitCodexGoalTaskResult(
      JSON.stringify({ state: "complete", summary: "Done", facts: ["proof.txt contains once"] }),
      options,
    );

    expect(rejected.kind).toBe("retry");
    if (rejected.kind !== "retry") throw new Error("expected rejected result");
    expect(rejected.reason).toContain("state must be converged, waiting, incomplete, or needs-agent");
    expect(rejected.nextAttemptContext).toContain("The May Task remains pending");
    expect(rejected.nextAttemptContext).not.toContain("proof.txt contains once");
  });

  it("rejects prose, fenced JSON, missing output, and schema-invalid objects", () => {
    for (const candidate of [
      null,
      "Done.",
      '```json\n{"state":"converged","summary":"Done","facts":[]}\n```',
      JSON.stringify({ state: "converged", summary: "Done", facts: "not-an-array" }),
    ]) {
      expect(admitCodexGoalTaskResult(candidate, options).kind).toBe("retry");
    }
  });

  it("admits only the corrected result", () => {
    const first = admitCodexGoalTaskResult(
      JSON.stringify({ state: "complete", summary: "Wrong state", facts: [] }),
      options,
    );
    expect(first.kind).toBe("retry");

    const second = admitCodexGoalTaskResult(
      JSON.stringify({ state: "converged", summary: "Corrected state", facts: ["verified on retry"] }),
      options,
    );
    expect(second).toMatchObject({
      kind: "accepted",
      result: { state: "converged", summary: "Corrected state" },
    });
  });
});
