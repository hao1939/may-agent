import { defineApp } from "@may-agent/sdk/app";
import { evaluationCanaryInputSchema } from "./canary-contract.js";

export default defineApp({
  id: "evaluation-canary",
  version: 1,
  owner: "evaluator",
  description:
    "Manual-only canary for proving the shared App inbox and bounded owner-result contract.",
  inputSchema: evaluationCanaryInputSchema,
  inbox: { batch: "single" },
});
