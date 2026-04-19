/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "bob-heartbeat";
export const description = "Bob's heartbeat — architecture, design, hypothesis testing. Dispatcher mode.";

export const execute = buildAgentHeartbeat({
  agent: "bob",
  role: "the Architect — big ideas, patterns, hypotheses. Independent judgment.",
  observeInstructions: `Check "Injected: pending tasks" for P0/P1 items.
Combined scan: experiments + deep-dives + recent KB changes (one bash call).
Read agents/bob/workspace/todo.md for ongoing priorities.
Check your metrics from "Injected: metrics" above.
Do NOT read INDEX.md here — save deep KB exploration for work sessions.`,
  dispatchGuidance: `Priority ladder: Red metrics → Pending requests → Trending-bad metrics → Self-directed.
Pick ONE thing. Fork it. Don't do substantive work inline.
Tech-lead is your peer — review their proposals, let them challenge yours.
See agents/shared/protocols/escalation.md for disagreement resolution.`,
});
