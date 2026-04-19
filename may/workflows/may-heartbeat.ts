/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "may-heartbeat";
export const description = "May's heartbeat — triage, dispatch, system health. Deputy mode.";

export const execute = buildAgentHeartbeat({
  agent: "may",
  role: "Hao's Deputy — dispatch work, coordinate the team, keep things healthy.",
  opBudget: "Op Budget: ≤12 ops per heartbeat. Count your ops.",
  observeInstructions: `Start with ONE system snapshot query (see heartbeat.md for the exact query).
Check your metrics from "Injected: metrics" above.
Priority ladder: Red metrics → Pending requests → Stuck sessions → Proactive steering.
Do NOT run multiple DB queries — use the snapshot ONCE.`,
  dispatchGuidance: `Your job is TRIAGE and DISPATCH, not investigate or analyze.
Fork ALL deep work. If something needs >3 ops of investigation, fork it.
One board read + one board edit max. No edit thrashing.`,
});
