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
  const message = requiredText(data, "message", event.type);
  requiredText(data, "dedupeKey", event.type);
  return {
    kind: "message",
    data: {
      message,
      // Preserve the original fact and its correlation data. An escalation
      // requests judgment; it is not a human decision or new authority.
      context: { event: structuredClone(event) },
    },
  };
}

export default defineApp({
  id: "may",
  version: 1,
  agent: "may",
  workspace: { kind: "git", localPath: ".", branch: "main" },
  description:
    "Hao's deputy: handles conversation and authorized direct work, owns ongoing Tasks, and involves other Apps when useful or required. Use development (outcome, acceptance, executable verify argv, optional constraints) for a locally committed code or documentation candidate with Bob design/review and direct tech-lead implementation; code retains reports and verification receipts. Use goal for other ongoing work.",
  inputSchema: mayInputSchema,
  conversation: {
    mode: "agent",
    inputKinds: ["message"],
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
