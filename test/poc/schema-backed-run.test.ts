import { describe, expect, it } from "bun:test";
import {
  ReviewSchema,
  comparisonCases,
  createPocWorkflowFinishTool,
  evaluateStructuredFinish,
  runComparison,
  type Review,
} from "../../scripts/poc/schema-backed-run.js";

const validReview: Review = {
  verdict: "fail",
  findings: [{ summary: "Missing test", evidence: ["No matching test file"] }],
};

describe("schema-backed sequential run POC", () => {
  it("extends the existing finish tool into the single terminating workflow tool", () => {
    const tool = createPocWorkflowFinishTool(ReviewSchema);

    expect(tool.name).toBe("finish");
    expect(JSON.stringify(tool.parameters)).toContain('"result"');
  });

  it("accepts valid data on the first submission", async () => {
    const outcome = await evaluateStructuredFinish(ReviewSchema, [
      {
        kind: "finish",
        arguments: {
          status: "success",
          summary: "Review complete",
          verification_evidence: ["test evidence"],
          result: validReview,
        },
      },
    ]);

    expect(outcome.status).toBe("done");
    expect(outcome.result).toEqual(validReview);
    expect(outcome.attemptsUsed).toBe(1);
  });

  it("rejects invalid data instead of returning successful null", async () => {
    const invalidFinish = {
      status: "success",
      summary: "Review complete",
      verification_evidence: ["test evidence"],
      result: { verdict: "pass" },
    };
    const outcome = await evaluateStructuredFinish(ReviewSchema, [
      { kind: "finish", arguments: invalidFinish },
      { kind: "finish", arguments: invalidFinish },
    ]);

    expect(outcome.status).toBe("error");
    expect(outcome.result).toBeUndefined();
    expect(outcome.error).toContain("findings");
  });

  it("uses no more than the initial attempt and one corrective retry", async () => {
    const outcome = await evaluateStructuredFinish(ReviewSchema, [
      { kind: "text", text: "done" },
      { kind: "text", text: "still done" },
      {
        kind: "finish",
        arguments: {
          status: "success",
          summary: "Review complete",
          verification_evidence: ["test evidence"],
          result: validReview,
        },
      },
    ]);

    expect(outcome.status).toBe("error");
    expect(outcome.attemptsUsed).toBe(2);
  });

  it("recovers when the corrective submission is valid", async () => {
    const finish = (result: unknown) => ({
      status: "success",
      summary: "Review complete",
      verification_evidence: ["test evidence"],
      result,
    });
    const outcome = await evaluateStructuredFinish(ReviewSchema, [
      { kind: "finish", arguments: finish({ verdict: "fail" }) },
      { kind: "finish", arguments: finish(validReview) },
    ]);

    expect(outcome.status).toBe("done");
    expect(outcome.result).toEqual(validReview);
    expect(outcome.attemptsUsed).toBe(2);
  });

  it("makes the contract-reliability improvement measurable", async () => {
    const report = await runComparison(comparisonCases);

    expect(report.freeText).toEqual({
      cases: 9,
      validAccepted: 5,
      invalidRejected: 0,
      falseAccepted: 4,
      deterministicUsable: 1,
      recoveredOnRetry: 0,
    });
    expect(report.structuredFinish).toEqual({
      cases: 9,
      validAccepted: 5,
      invalidRejected: 4,
      falseAccepted: 0,
      deterministicUsable: 5,
      recoveredOnRetry: 2,
    });
  });
});
