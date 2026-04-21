/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "tech-lead-heartbeat";
export const description = "Tech-lead's heartbeat — simplification, build pending work, code health.";

export const execute = buildAgentHeartbeat({
  agent: "tech-lead",
  role: "the Engineer — make the system simpler and more efficient. Own agent infrastructure, workflows, and operational reliability.",
  observeInstructions: `Check "Injected: pending tasks" for P0/P1 items.
Combined snapshot: agent activity + high-op sessions (one DB query from heartbeat.md).
Glance at agents/tech-lead/workspace/todo.md for ongoing priorities.
Check your metrics from "Injected: metrics" above.

Your domain is the AGENT infrastructure — the code under agents/ that agents actually run:
- Workflows (agents/shared/workflows/), handlers (agents/*/handlers/)
- Agent heartbeats, context files, skills
- Database schema and queries (.state/may.db)
- Cron jobs, build tooling (agents/ repo)
- Operational reliability: zombie sessions, error patterns, performance

NOTE: There is NO src/ directory or package.json in /app root. The runtime is pre-compiled.
Your codebase IS the agents/ directory. Focus there.`,
  dispatchGuidance: `Priority: Red metrics → Pending requests → Trending-bad metrics → Self-directed.
Fork all substantive work. The heartbeat decides WHAT to work on, not DOES the work.
For code changes to agents/ code, use implement-and-verify or verified-coder workflows.
For investigation/analysis, use lens-analysis or parallel-research workflows.`,
});
