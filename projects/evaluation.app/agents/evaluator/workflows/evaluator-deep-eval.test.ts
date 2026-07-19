import { describe, expect, test } from "bun:test";
import { reconciliationInput } from "./evaluator-deep-eval.js";

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
});
