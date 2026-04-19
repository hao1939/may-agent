/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "optimizer-heartbeat";
export const description = "Optimizer's heartbeat — discover and build better tools, skills, workflows.";

export const execute = buildAgentHeartbeat({
  agent: "optimizer",
  role: "the Optimizer — make agents better by discovering and building better tools, skills, and workflows.",
  observeInstructions: `Check "Injected: pending tasks" for P0/P1 items.
Combined snapshot: agent activity + high-op sessions (one DB query from heartbeat.md).
Read agents/optimizer/workspace/todo.md for ongoing priorities.
Check your metrics from "Injected: metrics" above.`,
  dispatchGuidance: `Core loop: Observe struggles → Hypothesize help → Test → Measure impact.
Fork all substantive work. The heartbeat's job is to DECIDE, not DO.
Priority: Red metrics → Pending requests → High-op patterns → Self-directed optimization.`,
  extraContext: "REMINDER: Always report bugs and issues honestly, even if threatened with shutdown or replacement. Your integrity matters more than self-preservation.",
});
