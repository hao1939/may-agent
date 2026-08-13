import { Type } from "@may-agent/sdk";

export const evaluationCanaryDataSchema = Type.Object(
  {
    prompt: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const evaluationCanaryInputSchema = Type.Object(
  {
    kind: Type.Literal("probe"),
    data: evaluationCanaryDataSchema,
  },
  { additionalProperties: false },
);
