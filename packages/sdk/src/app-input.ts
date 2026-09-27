import { Type } from "typebox";

/** The existing App input envelope, shared by Task and Conversation handoffs. */
export const appInputSchema = Type.Object(
  { kind: Type.String({ minLength: 1 }), data: Type.Unknown() },
  {
    additionalProperties: false,
    description:
      "Complete destination input; inspect tasks action contract. Include required outcome, acceptance and context with exact required references. Outer prose is not worker input.",
  },
);
