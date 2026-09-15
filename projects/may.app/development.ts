import { Type, type Static } from "@may-agent/sdk";
import { Check } from "typebox/value";

/** Opt-in local development trial. Commands come from the creator's specification. */
export const developmentInputSchema = Type.Object(
  {
    kind: Type.Literal("development"),
    data: Type.Object(
      {
        outcome: Type.String({ minLength: 1 }),
        acceptance: Type.Array(Type.String({ minLength: 1 }), {
          minItems: 1,
          maxItems: 32,
        }),
        constraints: Type.Optional(
          Type.Array(Type.String({ minLength: 1 }), { maxItems: 32 }),
        ),
        verify: Type.Array(Type.String({ minLength: 1 }), {
          minItems: 1,
          maxItems: 32,
        }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export type DevelopmentInput = Static<typeof developmentInputSchema>;

export function readDevelopmentInput(value: unknown): DevelopmentInput {
  if (!Check(developmentInputSchema, value))
    throw new Error("Invalid development input");
  return value;
}
