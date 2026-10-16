import { Type } from "typebox";
import { Check } from "typebox/value";

/** The evaluator chooses whether its report needs another agent's attention. */
export const reportFollowUpSchema = Type.Union([
  Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal("request"),
    message: Type.String({ minLength: 1, maxLength: 2000, pattern: "\\S" }),
  }, { additionalProperties: false }),
]);

export type ReportFollowUp =
  | { kind: "none" }
  | { kind: "request"; message: string };

/** Absence is a legacy report, never an inferred no-action decision. */
export function readReportFollowUp(value: unknown): ReportFollowUp | undefined {
  if (value === undefined) return undefined;
  if (Check(reportFollowUpSchema, value)) return value;
  throw new Error("Invalid evaluation followUp decision");
}

export const reportFollowUpGuidance =
  'Choose followUp explicitly: {kind:"none"} retains the report without asking Alex to review it again; {kind:"request",message:"..."} asks Alex for a concrete action or judgment. Use none for a supported healthy wait, recovered incident or concern already covered by active work when no new intervention is useful. Use request for an actionable finding, unresolved blocker, material uncertainty needing a decision, or supported recurring waste. Name what Alex should do, why now, and existing work to reuse when known. Insufficient evidence does not automatically require or forbid a request: judge whether resolving that gap needs attention now. Explain the choice in the judgment. Report retention, requested follow-up and verification of recovery are independent; none does not certify health or finish another Task. Do not choose delivery transports or create a second report.';
