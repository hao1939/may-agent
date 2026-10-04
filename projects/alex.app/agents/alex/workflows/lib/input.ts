import { Type, type Static } from "@may-agent/sdk";
import { Check } from "typebox/value";

// Private procedure parameters. Outcomes and acceptance remain on the Task.
const optionsSchema = Type.Object(
  {
    verify: Type.Array(Type.String({ minLength: 1 }), {
      minItems: 1,
      maxItems: 32,
    }),
  },
  { additionalProperties: false },
);
export type DevelopmentOptions = Static<typeof optionsSchema>;
export function readDevelopmentOptions(input: unknown): DevelopmentOptions {
  if (!Check(optionsSchema, input))
    throw new Error(
      "develop-change requires input { verify: [executable, ...arguments] }",
    );
  return input;
}
