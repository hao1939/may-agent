import { Type, defineApp } from "@may-agent/sdk";

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

export default defineApp({
  id: "evaluation-canary-worker",
  version: 1,
  owner: "evaluator",
  description:
    "Manual-only child and batching target for proving the shared App inbox runtime; never receives production evaluation traffic.",
  inputSchema: workerProbeSchema,
  inbox: { batch: "coalesce-compatible" },
});
