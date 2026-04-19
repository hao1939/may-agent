/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { buildAgentHeartbeat } from "../../shared/workflows/agent-heartbeat.ts";

export const name = "scout-heartbeat";
export const description = "Scout's heartbeat — research discovery and knowledge curation. Dispatcher mode.";

export const execute = buildAgentHeartbeat({
  agent: "scout",
  role: "the Scout — discover what's new, what's working, what the field knows.",
  observeInstructions: `Check "Injected: pending tasks" for P0/P1 items from other agents.
Quick scan: cd agents && git log --oneline -5 -- shared/knowledge/
Read agents/scout/workspace/todo.md for ongoing priorities and pending handoffs.
Check your metrics from "Injected: metrics" above.
Note the day of week — weekdays = fresh arXiv; weekends = synthesis/enrichment.`,
  dispatchGuidance: `⛔ CRITICAL: NO INLINE RESEARCH — EVER.
Do NOT call scrape_webpage, fetch arXiv, search GitHub/HN in this heartbeat.
LOOKING (read todo, check git, read pending tasks) = OK inline.
DOING (any scrape_webpage, fetch, external research) = MUST be forked.
If you're about to call scrape_webpage, STOP and fork a work session instead.`,
});
