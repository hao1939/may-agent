import { Type, defineApp, type AppTaskInput } from "@may-agent/sdk";

const details = Type.Record(Type.String(), Type.Unknown());
export const inputSchema = Type.Union([
  Type.Object({
    kind: Type.Literal("goal"),
    data: Type.Object({
      outcome: Type.String({ minLength: 1 }),
      acceptance: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
      constraints: Type.Optional(Type.Array(Type.String())),
      context: Type.Optional(details),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal("message"),
    data: Type.Object({
      message: Type.String({ minLength: 1 }),
      context: Type.Optional(details),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
]);

export function taskForInput(admitted: Readonly<AppTaskInput>) {
  const data = admitted.input.data as Record<string, unknown>;
  return {
    kind: "desired" as const,
    intent: {
      id: `input/${admitted.id}`,
      parentId: "root",
      agent: "alex",
      outcome: String(data.outcome ?? data.message),
      acceptance: Array.isArray(data.acceptance)
        ? data.acceptance as string[]
        : ["Answer the addressed request with evidence and preserve any remaining obligation."],
      ...(Array.isArray(data.constraints) ? { constraints: data.constraints as string[] } : {}),
      input: admitted.input,
      priority: "P1" as const,
    },
  };
}

export default defineApp({
  id: "alex",
  version: 1,
  agent: "alex",
  description: "Own system improvement from diagnosis through verified outcome; coordinate specialist contributions and escalate unresolved blockers to May.",
  workspace: { kind: "git", localPath: ".", branch: "main" },
  inputSchema,
  task: taskForInput,
  tasks: { maxConcurrent: 1 },
});
