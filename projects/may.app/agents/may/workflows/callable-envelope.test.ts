import { expect, test } from "bun:test";
import { Check } from "typebox/value";
import { inputSchema as metricResponseSchema } from "./metric-response.js";
import { inputSchema as evaluationReportIntakeSchema } from "./evaluation-report-intake.js";
import { inputSchema as prepareImprovementApprovalSchema } from "./prepare-improvement-approval.js";
import { inputSchema as improvementActivationFollowUpSchema } from "./improvement-activation-follow-up.js";

const schemas = [
  metricResponseSchema,
  evaluationReportIntakeSchema,
  prepareImprovementApprovalSchema,
  improvementActivationFollowUpSchema,
];

test("active May workflow schemas require the canonical callable envelope", () => {
  for (const schema of schemas) {
    expect(Check(schema, { prompt: "Run the requested procedure", data: { fixture: true } })).toBe(true);
    expect(Check(schema, { data: { fixture: true } })).toBe(false);
    expect(Check(schema, { prompt: "Run the requested procedure", fixture: true })).toBe(false);
    expect(Check(schema, { fixture: true })).toBe(false);
  }
});
