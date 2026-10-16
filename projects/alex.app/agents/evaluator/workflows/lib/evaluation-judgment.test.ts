import { describe, expect, test } from "bun:test";
import { Check } from "typebox/value";
import { evaluationJudgmentSchema, readNewJudgment, type EvaluationJudgment } from "./evaluation-judgment.js";
import { readReportFollowUp } from "./report-follow-up.js";

const report: EvaluationJudgment = {
  disposition: "insufficient-evidence",
  summary: "The supplied evidence does not establish recovery.",
  responsibility: "The subject owner owns recovery.",
  delivery: "Evidence was retained; recovery remains unverified.",
  followUp: { kind: "none" },
};

describe("new evaluation judgment admission", () => {
  const valid: EvaluationJudgment[] = [
    report,
    { ...report, followUp: { kind: "none", message: "" } },
    { ...report, followUp: { kind: "none", message: "The existing owner is handling this concern." } },
    { ...report, disposition: "assessed", findings: [], verification: [] },
    { ...report, findings: ["A supported adverse finding"], verification: ["event:42"] },
    { ...report, summary: "  Preserve the supplied text.\n", followUp: { kind: "request", message: " Inspect the retained failure. " } },
    { ...report, followUp: { kind: "request", message: "🔎".repeat(1500) } },
  ];
  test.each(valid)("admits available evidence without manufacturing optional information: %j", (value) => {
    expect(Check(evaluationJudgmentSchema, value)).toBe(true);
    expect(Check(JSON.parse(JSON.stringify(evaluationJudgmentSchema)), value)).toBe(true);
    expect(readNewJudgment(value)).toBe(value);
    expect(readNewJudgment(structuredClone(value))).toEqual(value);
    expect(readReportFollowUp(value.followUp)).toEqual(value.followUp);
  });

  const invalid: Array<[string, unknown]> = [
    ["string report", JSON.stringify(report)],
    ["null report", null],
    ["extra property", { ...report, invented: "field" }],
    ["unknown disposition", { ...report, disposition: "healthy" }],
    ["missing decision", { ...report, followUp: undefined }],
    ["none with wrong-type message", { ...report, followUp: { kind: "none", message: 42 } }],
    ["none with null message", { ...report, followUp: { kind: "none", message: null } }],
    ["none with oversized message", { ...report, followUp: { kind: "none", message: "x".repeat(2001) } }],
    ["blank request", { ...report, followUp: { kind: "request", message: " \n\t" } }],
    ["oversized request", { ...report, followUp: { kind: "request", message: "x".repeat(2001) } }],
  ];
  for (const field of ["summary", "responsibility", "delivery"]) {
    for (const value of [undefined, null, 42, true, {}, [], "", " \n\t", "\u00a0"]) {
      invalid.push([`${field}: ${JSON.stringify(value)}`, { ...report, [field]: value }]);
    }
  }
  for (const field of ["findings", "verification"]) {
    for (const value of [null, "event:42", {}, [42], [false], [null], ["valid", " "], Array(13).fill("valid")]) {
      invalid.push([`${field}: ${JSON.stringify(value)}`, { ...report, [field]: value }]);
    }
  }
  test.each(invalid)("rejects %s without repairing or dropping original values", (_name, value) => {
    const original = structuredClone(value);
    expect(Check(evaluationJudgmentSchema, value)).toBe(false);
    expect(Check(JSON.parse(JSON.stringify(evaluationJudgmentSchema)), value)).toBe(false);
    expect(readNewJudgment(value)).toBeNull();
    expect(value).toEqual(original);
  });
});
