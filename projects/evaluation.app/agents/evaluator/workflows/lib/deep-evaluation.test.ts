import { describe, expect, test } from "bun:test";
import {
  buildDeepEvaluationTask,
  normalizeDeepEvaluationCandidate,
  parseDeepEvaluationArtifact,
} from "./deep-evaluation.js";

describe("deep evaluation artifacts", () => {
  test("accepts only an artifact bound to the expected session and agent", () => {
    const artifact = JSON.stringify({
      sessionId: "s1",
      agent: "dev",
      quality: 0.8,
      efficiency: 0.7,
      productiveCalls: 3,
      wastedCalls: 1,
      verdict: "good",
      issues: ["useful implementation"],
      overall: { resultDelivered: true },
      failureChains: [],
    });
    expect(parseDeepEvaluationArtifact(artifact, "s1", "dev")).toMatchObject({
      sessionId: "s1",
      agent: "dev",
      verdict: "good",
      overall: { deepEval: true, deepEvalVersion: 1 },
    });
    expect(parseDeepEvaluationArtifact(artifact, "s2", "dev")).toBeNull();
  });

  test("builds one bounded review task from the normalized candidate", () => {
    const candidate = normalizeDeepEvaluationCandidate({
      sessionId: "s1",
      agent: "dev",
      status: "done",
      task: "fix a bug",
      startedAt: 1,
    });
    expect(candidate).not.toBeNull();
    const task = buildDeepEvaluationTask(candidate!, "/state", "/app");
    expect(task).toContain("Evaluate session s1");
    expect(task).toContain("/state/sessions/history/s1/session.jsonl");
    expect(task).toContain(
      "/app/projects/evaluation.app/agents/evaluator/workspace/deep-evals/s1.json",
    );
  });
});
