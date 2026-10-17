import { Type } from "@may-agent/sdk";
import { metricReuseScopeSchema } from "./metric-decision-reuse.js";

const text = Type.String({ minLength: 1, pattern: "\\S" });
export const metricDecisionSchema = Type.Object(
  {
    metricId: text,
    alertId: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    disposition: Type.Union([
      Type.Literal("observe", {
        description:
          "Legacy disposition; use no-change for passive collection.",
      }),
      Type.Literal("investigate"),
      Type.Literal("no-change"),
      Type.Literal("recovered"),
    ]),
    reason: text,
    evidence: Type.Array(text, { minItems: 1, maxItems: 16 }),
    nextAction: Type.Optional(text),
    reuseScope: Type.Optional(metricReuseScopeSchema),
  },
  { additionalProperties: false },
);
