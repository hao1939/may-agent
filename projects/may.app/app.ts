import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
  type TaskIntent,
} from "@may-agent/sdk";

const detailsSchema = Type.Record(Type.String(), Type.Unknown());

const mayInputSchema = Type.Union([
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

export const MAY_FOLLOW_UP_TASK_ID = "conversation/follow-up";

export function mayFollowUpTask(
  event: AppEvent<Record<string, unknown>>,
): TaskIntent | null {
  if (event.type !== "app.follow-up.requested") return null;
  return {
    id: MAY_FOLLOW_UP_TASK_ID,
    parentId: "may",
    outcome:
      "Keep every accepted May conversation follow-up moving through its exact responsible Task and return useful results to the shared Conversation.",
    acceptance: [
      "Every newly observed follow-up is either linked to one fitting unfinished Task, requested from the accountable App, or represented by one direct May-owned child goal.",
      "Existing work is continued by exact identity; a new sibling is never created merely because work is waiting, stale, or slow.",
      "Useful progress, a concrete human decision, or a terminal result is returned in result.conversation with conversationId, topicId, followUpId, text, and exact taskRefs; transport state is never mentioned.",
    ],
    mode: "maintain",
    agent: "may",
    input: {
      role: "conversation-follow-up",
      conversationId: "may:primary",
      resultContract: {
        conversation: {
          conversationId: "string",
          topicId: "string",
          followUpId: "string",
          text: "plain language",
          taskRefs: [{ appId: "string", taskId: "string" }],
        },
      },
    },
    priority: "P0",
    category: "internal",
  };
}

export function taskForMayInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
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
      mode: "achieve",
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
    "Hao's conversational deputy: understands turns, links Topics, routes App Tasks, and returns results.",
  inputSchema: mayInputSchema,
  requests: {
    mode: "agent",
    inputKinds: ["message", "human-decision"],
    conversationId: "may:primary",
  },
  task: taskForMayInput,
  tasks: {
    subscriptions: [{ type: "app.follow-up.requested", project: "may" }],
    resolve: mayFollowUpTask,
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
