import { describe, expect, test } from "bun:test";
import {
  planReportIntake,
  type IntakeEvidence,
} from "./evaluation-report-intake";

const valid: IntakeEvidence = {
  appId: "may",
  taskId: "goal/1",
  evidenceHash: "e1",
  jsonHash: "j1",
  markdownHash: "m1",
  read: { status: "valid", jsonHash: "j1", markdownHash: "m1" },
  currentEvidenceHash: "e1",
  recovered: false,
};

describe("published report intake mechanics", () => {
  test("distinguishes publication race from invalid integrity", () => {
    expect(
      planReportIntake({ ...valid, read: { status: "publication-pending" } })
        .disposition,
    ).toBe("retry-publication");
    expect(
      planReportIntake({
        ...valid,
        read: { status: "valid", jsonHash: "tampered", markdownHash: "m1" },
      }).disposition,
    ).toBe("invalid");
  });
  test("makes duplicate/no-op and recovered paths cheap", () => {
    expect(planReportIntake({ ...valid, recovered: true }).disposition).toBe(
      "recovered",
    );
    expect(
      planReportIntake({
        ...valid,
        prior: {
          evidenceHash: "e1",
          disposition: "investigate",
          linkedTaskId: "repair/1",
        },
      }),
    ).toEqual({ disposition: "reuse", linkedTaskId: "repair/1" });
  });
  test("keeps handoff stable and rejects stale/self evidence", () => {
    expect(planReportIntake(valid).handoffKey).toBe(
      planReportIntake(valid).handoffKey,
    );
    expect(
      planReportIntake({ ...valid, currentEvidenceHash: "e2" }).disposition,
    ).toBe("stale");
    expect(
      planReportIntake({ ...valid, appId: "evaluation" }).disposition,
    ).toBe("invalid");
  });
});
