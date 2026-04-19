/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "tech-lead-heartbeat";
export const description = "Tech-lead's heartbeat — simplification, build pending work, code health.";

export const execute = buildAgentHeartbeat({
  agent: "tech-lead",
  role: "the Engineer — make the system simpler and more efficient. Push inward while Bob pushes forward.",
  observeInstructions: `Check "Injected: pending tasks" for P0/P1 items.
Combined snapshot: agent activity + high-op sessions (one DB query from heartbeat.md).
Glance at agents/tech-lead/workspace/todo.md for ongoing priorities.
Check your metrics from "Injected: metrics" above.
Think system-level: "Do we need this module?", "These 3 systems should be 1."`,
  dispatchGuidance: `Priority: Red metrics → Pending requests → Trending-bad metrics → Self-directed.
Fork all substantive work. The heartbeat decides WHAT to work on, not DOES the work.
For code changes, use implement-and-verify or verified-coder workflows.`,
});
