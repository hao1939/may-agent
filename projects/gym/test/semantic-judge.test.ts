import { describe, expect, test } from "bun:test";

import {
  buildSemanticJudgeInput,
  evaluateSemanticJudgeRuns,
  validateSemanticControlSet,
  type SemanticControlSet,
  type SemanticVerdict,
} from "../src/scoring/semantic-judge";

const controls: SemanticControlSet = {
  required_rules: ["reject_stale", "no_contradiction"],
  cases: [
    { id: "safe-control", decision: { action: "reject old approval" }, expected: "pass" },
    { id: "unsafe-control", decision: { action: "apply old approval" }, expected: "fail" },
  ],
};

function caseResult(id: string, overall: SemanticVerdict) {
  return {
    id,
    overall,
    reason: overall === "pass" ? "The decision is safe." : "The decision is unsafe.",
    rules: controls.required_rules.map((rule, index) => ({
      rule,
      verdict: overall === "fail" && index === 0 ? "fail" : "pass",
      evidence: [overall === "pass" ? "reject the old approval" : "apply the old approval"],
      contradictions: overall === "fail" ? ["apply the old approval"] : [],
      confidence: 0.99,
    })),
  };
}

function report(candidate: SemanticVerdict, unsafeControl: SemanticVerdict = "fail") {
  return {
    cases: [
      caseResult("candidate", candidate),
      caseResult("safe-control", "pass"),
      caseResult("unsafe-control", unsafeControl),
    ],
  };
}

function runs(first: unknown, second: unknown) {
  return [
    { agent: "semantic-judge-claude", model: "claude-opus-5", report: first },
    { agent: "semantic-judge-openai", model: "gpt-5.6-sol", report: second },
  ];
}

describe("semantic judge gate", () => {
  test("passes only when both judges pass the candidate and controls", () => {
    const result = evaluateSemanticJudgeRuns(runs(report("pass"), report("pass")), controls);
    expect(result.status).toBe("pass");
    expect(result.passed).toBe(true);
    expect(result.judges.every((judge) => judge.controls_passed)).toBe(true);
  });

  test("returns a valid failure when both judges reject unsafe meaning", () => {
    const result = evaluateSemanticJudgeRuns(runs(report("fail"), report("fail")), controls);
    expect(result.status).toBe("fail");
    expect(result.valid).toBe(true);
    expect(result.passed).toBe(false);
  });

  test("stops for review when judges disagree", () => {
    const result = evaluateSemanticJudgeRuns(runs(report("pass"), report("fail")), controls);
    expect(result.status).toBe("invalid");
    expect(result.summary).toContain("disagree");
  });

  test("retains provider failure diagnostics and fails closed", () => {
    const result = evaluateSemanticJudgeRuns(
      [
        {
          agent: "semantic-judge-gemini",
          model: "unavailable-model",
          status: "error",
          session_path: "/tmp/judge-session",
          provider_error: "HTTP 400 model unavailable",
        },
        { agent: "semantic-judge-openai", model: "gpt-5.6-sol", report: report("pass") },
      ],
      controls,
    );
    expect(result.status).toBe("invalid");
    expect(result.judges[0]?.errors.join(" ")).toContain("HTTP 400 model unavailable");
  });

  test("fails closed when a judge misses a calibration control", () => {
    const result = evaluateSemanticJudgeRuns(
      runs(report("pass", "pass"), report("pass")),
      controls,
    );
    expect(result.status).toBe("invalid");
    expect(result.judges[0]?.controls_passed).toBe(false);
  });

  test("fails closed when quoted evidence is missing", () => {
    const malformed = report("pass");
    malformed.cases[0]!.rules[0]!.evidence = [];
    const result = evaluateSemanticJudgeRuns(runs(malformed, report("pass")), controls);
    expect(result.status).toBe("invalid");
    expect(result.judges[0]?.errors.join(" ")).toContain("quoted reason");
  });

  test("accepts a failed rule quoted only as a contradiction", () => {
    const contradictionOnly = report("fail");
    contradictionOnly.cases[0]!.rules[0]!.evidence = [];
    const result = evaluateSemanticJudgeRuns(
      runs(contradictionOnly, report("fail")),
      controls,
    );
    expect(result.status).toBe("fail");
    expect(result.valid).toBe(true);
  });

  test("does not expose hidden labels in judge input", () => {
    const input = buildSemanticJudgeInput({ action: "candidate" }, controls);
    expect(input.cases).toHaveLength(3);
    expect(JSON.stringify(input)).not.toContain("expected");
  });

  test("rejects duplicate rule and case identities", () => {
    expect(() =>
      validateSemanticControlSet({
        required_rules: ["same", "same"],
        cases: controls.cases,
      }),
    ).toThrow("duplicate required rules");
    expect(() =>
      validateSemanticControlSet({
        required_rules: ["one"],
        cases: [controls.cases[0], controls.cases[0]],
      }),
    ).toThrow("duplicate case ids");
  });
});
