import { describe, expect, test } from "bun:test";
import {
  buildDeepEvaluationTask,
  parseDeepEvaluationOutcome,
} from "./deep-evaluation.js";

const evaluation = {
  sessionId: "s1",
  agent: "dev",
  quality: 0.8,
  efficiency: 0.7,
  productiveCalls: 3,
  wastedCalls: 1,
  verdict: "good",
  issues: ["useful implementation"],
  overall: { resultDelivered: true },
  usage: null,
  failureChains: [],
};

describe("deep evaluation outcome", () => {
  test("accepts a complete evaluation bound to the expected session", () => {
    expect(parseDeepEvaluationOutcome({ evaluation }, "s1")).toMatchObject({
      kind: "evaluation",
      evaluation: {
        sessionId: "s1",
        agent: "dev",
        verdict: "good",
        overall: { deepEval: true, deepEvalVersion: 1 },
      },
    });
  });

  test("rejects a mismatched session and incomplete structured output", () => {
    expect(parseDeepEvaluationOutcome({ evaluation }, "s2")).toBeNull();
    expect(
      parseDeepEvaluationOutcome({
        evaluation: { sessionId: "s1", agent: "dev", verdict: "good" },
      }),
    ).toBeNull();
  });

  test("accepts no-candidate only with an explicit non-empty reason", () => {
    expect(
      parseDeepEvaluationOutcome({
        noCandidate: true,
        reason: "No terminal session is eligible.",
      }),
    ).toEqual({ kind: "none", reason: "No terminal session is eligible." });
    expect(parseDeepEvaluationOutcome({ noCandidate: true })).toBeNull();
    expect(
      parseDeepEvaluationOutcome({ noCandidate: true, reason: "   " }),
    ).toBeNull();
  });

  test("builds one bounded review task without runtime paths or artifacts", () => {
    const task = buildDeepEvaluationTask("s1");
    expect(task).toContain("Evaluate exactly session s1");
    expect(task).toContain("Return the result only through finish().result");
    expect(task).not.toContain("session.jsonl");
    expect(task).not.toContain("Artifact Path");
  });
});
