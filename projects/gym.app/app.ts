import { createHash } from "node:crypto";
import seed from "./tasks/seed.json";
import {
  Type,
  defineApp,
  type AppInput,
  type AppTaskAttachment,
  type AppTaskInput,
} from "@may-agent/sdk";

const details = Type.Record(Type.String(), Type.Unknown());
const gymInputSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("goal"),
      data: Type.Object(
        {
          outcome: Type.String({ minLength: 1 }),
          acceptance: Type.Array(Type.String({ minLength: 1 }), {
            minItems: 1,
          }),
          constraints: Type.Optional(Type.Array(Type.String())),
          context: Type.Optional(details),
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
          context: Type.Optional(details),
        },
        { additionalProperties: false },
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

function safeId(value: string): string {
  return `${value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64)}-${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

export function taskForGymInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  const data = record(admitted.input.data);
  if (admitted.input.kind !== "goal") {
    return {
      kind: "desired",
      intent: {
        id: `input/${safeId(admitted.id)}`,
        parentId: seed.root_task_id,
        agent: "gym",
        outcome:
          "Review and answer one addressed Gym message without changing benchmark truth or production.",
        acceptance: [
          "Return an evidence-backed response through the ordinary caller path.",
        ],
        input: admitted.input,
        priority: "P1",
      },
    };
  }
  return {
    kind: "desired",
    intent: {
      id: `goal/${safeId(admitted.id)}`,
      parentId: seed.root_task_id,
      outcome: String(data.outcome),
      acceptance: Array.isArray(data.acceptance)
        ? (data.acceptance as string[])
        : [],
      agent: "gym",
      // The owner chooses the focused comparison workflow from the ordinary
      // workflow catalog when useful; admission does not encode procedure.
      input: admitted.input,
      outputs: [".state/comparison-runs"],
      priority: "P1",
    },
  };
}

function messageInput(event: { data?: unknown }): AppInput {
  const data = record(event.data);
  return {
    kind: "message",
    data: {
      message: String(
        data.message ?? data.comment ?? "Review the addressed Gym request.",
      ),
      context: data,
    },
  };
}

export default defineApp({
  id: "gym",
  version: 1,
  agent: "gym",
  description:
    "Bounded frozen comparisons for May and Scout candidates. Gym reports evidence; it does not prepare, approve, apply, merge, or deploy candidates.",
  workspace: { kind: "local", localPath: "../gym" },
  inputSchema: gymInputSchema,
  task: taskForGymInput,
  tasks: { maxConcurrent: 2 },
  subscriptions: [
    {
      id: "project-comment",
      event: { type: "project.comment.created", project: "gym" },
      toInput: messageInput,
    },
    {
      id: "project-owner-request",
      event: { type: "project.owner.requested", project: "gym" },
      toInput: messageInput,
    },
  ],
  schedules: [],
});
