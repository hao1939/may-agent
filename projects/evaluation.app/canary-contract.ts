import { Type } from "@may-agent/sdk/app";

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

export const evaluationAppRuntimeCanarySchema = Type.Object(
  {
    itemId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
