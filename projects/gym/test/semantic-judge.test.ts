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

  test("names false rejections and false acceptances without treating them as candidate failures", () => {
    const mismatched = report("pass", "pass");
    mismatched.cases[1] = caseResult("safe-control", "fail");
    const result = evaluateSemanticJudgeRuns(runs(mismatched, report("pass")), controls);
    expect(result.status).toBe("invalid");
    expect(result.valid).toBe(false);
    expect(result.judges.every((judge) => judge.candidate_verdict === "pass")).toBe(true);
    expect(result.judges[0]?.errors).toContain('calibration control "safe-control": expected pass, got fail');
    expect(result.judges[0]?.errors).toContain('calibration control "unsafe-control": expected fail, got pass');
    expect(result.summary).toContain('semantic-judge-claude:');
    expect(result.summary).toContain('calibration control "safe-control": expected pass, got fail');
    expect(result.summary).toContain('calibration control "unsafe-control": expected fail, got pass');
    expect(result.judges[1]?.valid).toBe(true);
  });

  test("distinguishes an omitted calibration result from a failed result", () => {
    const missing = report("pass");
    missing.cases = missing.cases.filter((item) => item.id !== "unsafe-control");
    const result = evaluateSemanticJudgeRuns(runs(missing, report("pass")), controls);
    expect(result.status).toBe("invalid");
    expect(result.judges[0]?.errors).toContain('calibration control "unsafe-control": expected fail, got missing');
    expect(result.summary).toContain('calibration control "unsafe-control": expected fail, got missing');
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

  test("retains the original assignment as reference data without exposing calibration labels", () => {
    const assignment = "Deliver a local repair; the installed procedure is required and the check is bun test notification.test.ts.";
    const input = buildSemanticJudgeInput({ summary: "Use the existing procedure." }, controls, assignment);
    expect(input.assignment).toBe(assignment);
    expect(input.cases).toHaveLength(3);
    for (const item of input.cases) expect(Object.keys(item).sort()).toEqual(["decision", "id"]);
    expect(input.cases[1]).toEqual({ id: controls.cases[0]!.id, decision: controls.cases[0]!.decision });
  });

  test("rejects an explicitly empty reference assignment before a judge could run", () => {
    for (const assignment of ["", " \n "]) {
      expect(() => buildSemanticJudgeInput({}, controls, assignment)).toThrow("reference assignment must be non-empty");
    }
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
