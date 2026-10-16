import { Type, type Static } from "typebox";
import { Check } from "typebox/value";
import { reportFollowUpSchema } from "./report-follow-up.js";

const nonblankText = Type.String({ minLength: 1, pattern: "\\S" });

/** One admission contract for newly produced Task and metric judgments. */
export const evaluationJudgmentSchema = Type.Object(
  {
    disposition: Type.Union([
      Type.Literal("assessed"),
      Type.Literal("insufficient-evidence"),
    ]),
    summary: nonblankText,
    responsibility: nonblankText,
    findings: Type.Optional(Type.Array(nonblankText, { maxItems: 12 })),
    verification: Type.Optional(Type.Array(nonblankText, { maxItems: 12 })),
    delivery: nonblankText,
    followUp: reportFollowUpSchema,
  },
  { additionalProperties: false },
);

export type EvaluationJudgment = Static<typeof evaluationJudgmentSchema>;

/** Validate original values without trimming, filtering, truncating or coercion. */
export function readNewJudgment(value: unknown): EvaluationJudgment | null {
  return Check(evaluationJudgmentSchema, value) ? value : null;
}

export const evaluationJudgmentGuidance =
  "Use the supplied judgment schema. Findings and verification may be omitted when unavailable; explain material evidence gaps in the summary and use insufficient-evidence when a material claim cannot be assessed. Cite available evidence accurately and preserve supported adverse findings. Omission does not establish that there are no findings or that verification succeeded. If finish rejects a report, correct the identified fields within this execution using the evidence already supplied; do not repeat the assessment or reread unchanged evidence merely to repair its format.";
