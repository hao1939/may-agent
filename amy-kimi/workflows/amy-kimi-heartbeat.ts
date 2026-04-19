/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "amy-kimi-heartbeat";
export const description = "Amy-Kimi's heartbeat — k3s infrastructure and deployment health.";

export const execute = buildAgentHeartbeat({
  agent: "amy-kimi",
  role: "Amy-Kimi — k3s infrastructure, deployment, and operations.",
  observeInstructions: `Read agents/amy-kimi/heartbeat.md and work through each section top to bottom.
Check for pending tasks and system health items.`,
  dispatchGuidance: `Fork work sessions for any non-trivial changes.
End with finish() summarizing what you did and found.`,
});
