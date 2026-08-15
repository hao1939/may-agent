import { Type, defineApp, type AppEvent, type AppInput } from "@may-agent/sdk";

const detailsSchema = Type.Record(Type.String(), Type.Unknown());

const mayInputSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("message"),
      data: Type.Object(
        {
          message: Type.String({ minLength: 1 }),
          context: Type.Optional(detailsSchema),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("human-decision"),
      data: Type.Object(
        {
          message: Type.String({ minLength: 1 }),
          dedupeKey: Type.String({ minLength: 1 }),
          sourceSessionId: Type.Optional(Type.String({ minLength: 1 })),
          targetAppId: Type.Optional(Type.String({ minLength: 1 })),
          verdict: Type.Optional(Type.String({ minLength: 1 })),
          requestedHumanAction: Type.Optional(Type.String({ minLength: 1 })),
          evidence: Type.Optional(Type.Array(Type.String())),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requiredText(
  data: Record<string, unknown>,
  field: string,
  eventType: string,
): string {
  const value = typeof data[field] === "string" ? data[field].trim() : "";
  if (!value) {
    throw new Error(`${eventType} requires non-empty ${field}`);
  }
  return value;
}

export function evaluationHumanDecisionInput(
  event: AppEvent<Record<string, unknown>>,
): AppInput {
  const data = record(event.data);
  return {
    kind: "human-decision",
    data: {
      ...data,
      message: requiredText(data, "message", event.type),
      dedupeKey: requiredText(data, "dedupeKey", event.type),
    },
  };
}

export default defineApp({
  id: "may",
  version: 1,
  owner: "may",
  description:
    "Conversation App for durable human requests and explicit human-decision obligations.",
  inputSchema: mayInputSchema,
  inbox: { batch: "single" },
  subscriptions: [
    {
      id: "evaluation-human-decision",
      event: {
        type: "evaluation.human_decision.requested",
        project: "may",
      },
      toInput: evaluationHumanDecisionInput,
    },
  ],
});
