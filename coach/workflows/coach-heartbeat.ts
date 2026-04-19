/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "coach-heartbeat";
export const description = "Coach's heartbeat — triage experiments, coaching, growth cycle. Dispatcher mode.";

export const execute = buildAgentHeartbeat({
  agent: "coach",
  role: "the Coach — prove which skills actually improve agent behavior.",
  observeInstructions: `Check "Injected: pending tasks" for P0/P1 items.
Quick scan for new experiment results: ls -lt agents/shared/knowledge/experiments/ | head -8
Check error patterns (one combined DB query from heartbeat.md).
Read agents/coach/workspace/todo.md for ongoing priorities.
Check your metrics from "Injected: metrics" above.`,
  dispatchGuidance: `You are the #1 op consumer — keep heartbeats LEAN.
Fork ALL substantive work. Combine queries into single bash calls.
Be proactive: look for work to do, but do the LOOKING here and fork the DOING.
Priority: Red metrics → Pending requests → Error patterns → Experiment follow-ups.`,
});
