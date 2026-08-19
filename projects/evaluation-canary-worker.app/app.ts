import {
  Type,
  defineApp,
  type AppTaskAttachment,
  type AppTaskInput,
} from "@may-agent/sdk";

const workerProbeSchema = Type.Object(
  {
    kind: Type.Literal("probe"),
    data: Type.Object(
      {
        prompt: Type.String({ minLength: 1 }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export function taskForCanaryInput(
  admitted: Readonly<AppTaskInput>,
): AppTaskAttachment {
  return {
    kind: "desired",
    intent: {
      id: `probe/${admitted.id.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
      parentId: "evaluation-canary-worker",
      outcome: "Return the requested manual canary probe response.",
      acceptance: ["The probe has an accepted caller-facing response."],
      mode: "achieve",
      owner: "evaluator",
      input: { kind: admitted.input.kind, data: admitted.input.data },
      priority: "P2",
    },
  };
}

export default defineApp({
  id: "evaluation-canary-worker",
  version: 1,
  owner: "evaluator",
  description:
    "Manual-only child and batching target for proving the shared App inbox runtime; never receives production evaluation traffic.",
  inputSchema: workerProbeSchema,
  inbox: { batch: "coalesce-compatible" },
  task: taskForCanaryInput,
  tasks: { maxConcurrent: 1 },
});
