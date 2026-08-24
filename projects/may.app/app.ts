import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type Condition,
} from "@may-agent/sdk";

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

function taskIdPart(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-") || "input";
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

export function taskForMayInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const data = record(admitted.input.data);
  const decisionKey =
    admitted.input.kind === "human-decision" ? taskIdPart(data.dedupeKey) : "";
  const taskId = decisionKey
    ? `decision/${decisionKey}`
    : `conversation/${taskIdPart(admitted.id)}`;
  return {
    kind: "desired",
    intent: {
      id: taskId,
      parentId: "may",
      outcome:
        admitted.input.kind === "human-decision"
          ? "Handle the explicit human-decision obligation and return the useful outcome."
          : "Understand and fulfill the human request, then answer naturally.",
      acceptance: [
        "The request is handled as far as current capabilities allow.",
        "The accepted result contains a direct caller-facing response or an exact evidenced wait.",
      ],
      mode: "achieve",
      agent: "may",
      input: {
        kind: admitted.input.kind,
        data,
        source: admitted.source,
      },
      priority: "P0",
      category: "conversation",
    },
  };
}

const mayObservableConditionTypes = new Set([
  "project.approval.submitted",
  "project.approval.resolved",
]);

export function validateMayCondition(condition: Condition): string | null {
  return mayObservableConditionTypes.has(condition.type)
    ? null
    : `type ${condition.type} is not an observable May approval event; clarify now or use a typed installed-App dependency`;
}

export default defineApp({
  id: "may",
  version: 1,
  agent: "may",
  description:
    "Conversation App for durable human requests and explicit human-decision obligations.",
  inputSchema: mayInputSchema,
  task: taskForMayInput,
  tasks: {
    maxConcurrent: 8,
    validateCondition: validateMayCondition,
  },
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
