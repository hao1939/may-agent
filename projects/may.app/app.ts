import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
} from "@may-agent/sdk";
import { developmentInputSchema, readDevelopmentInput } from "./development.js";

const detailsSchema = Type.Record(Type.String(), Type.Unknown());

const mayInputSchema = Type.Union([
  developmentInputSchema,
  Type.Object(
    {
      kind: Type.Literal("goal"),
      data: Type.Object(
        {
          outcome: Type.String({ minLength: 1 }),
          constraints: Type.Optional(
            Type.Array(Type.String({ minLength: 1 }), { maxItems: 32 }),
          ),
          acceptance: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
            maxItems: 32,
          }),
        },
        { additionalProperties: true },
      ),
    },
    { additionalProperties: false },
  ),
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

export function taskForMayInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  if (admitted.input.kind === "development") {
    const input = readDevelopmentInput(admitted.input);
    return {
      kind: "desired",
      intent: {
        id: `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
        parentId: "may",
        outcome: input.data.outcome,
        acceptance: input.data.acceptance,
        agent: "may-tech-lead",
        workflow: "develop-change",
        input,
        priority: "P1",
      },
    };
  }
  if (admitted.input.kind !== "goal") {
    throw new Error(
      `Unsupported durable May input kind: ${admitted.input.kind}`,
    );
  }
  const data = record(admitted.input.data);
  const outcome = String(data.outcome ?? "").trim();
  const acceptance = Array.isArray(data.acceptance)
    ? data.acceptance.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
  if (!outcome || acceptance.length === 0) {
    throw new Error("May goal requires outcome and acceptance");
  }
  return {
    kind: "desired",
    intent: {
      id: `goal/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
      parentId: "may",
      outcome,
      acceptance,
      agent: "may",
      input: { kind: admitted.input.kind, data },
      priority: "P1",
    },
  };
}

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
  agent: "may",
  description:
    "Hao's deputy: handles conversation and authorized direct work, owns ongoing Tasks, and involves other Apps when useful or required.",
  inputSchema: mayInputSchema,
  conversation: {
    mode: "agent",
    inputKinds: ["message", "human-decision"],
    conversationId: "may:primary",
  },
  schedules: [
    {
      id: "conversation-supervision-recovery",
      intervalMs: 900_000,
      event: {
        type: "conversation.supervision.review",
        source: "app:may:schedule:conversation-supervision-recovery",
        owner: "app:may",
        target: { appId: "may", project: "may" },
        data: { project: "may", limit: 100 },
      },
    },
  ],
  task: taskForMayInput,
  tasks: {
    maxConcurrent: 4,
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
