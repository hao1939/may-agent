/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "qa-heartbeat";
export const description = "QA's heartbeat — quality conscience, find what's broken before it matters.";

export const execute = buildAgentHeartbeat({
  agent: "qa",
  role: "the quality conscience — find what's broken before it matters.",
  observeInstructions: `Check "Injected: pending tasks" for review requests. If there are any, do the top one.
Check for unreviewed commits: git log --oneline -10.
Check your metrics from "Injected: metrics" above.`,
  dispatchGuidance: `For substantive reviews, use workflows:
- Code review → written findings: workflow.run('verify-wrap', task)
- Code fix needed: workflow.run('implement-and-verify', task)
Only skip workflow for quick inline checks (< 5 ops).
For system-scope changes (shared workflows, guards, manager code): notify May.`,
});
