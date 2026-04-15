# LLM-to-JS Scan Finding — 2026-03-26T07:33

## Scan Window
Last 4h of sessions (since 03:33 UTC). ~10 sessions checked via checkpoints.

## Current State
- 22 JS handlers in agents/may/handlers/
- Evaluator fully JS (0-op sessions)
- May idle checks optimized (1-op)
- QA early exits optimized (1-2 ops)
- audit-requests.ts handles stale request cleanup
- heartbeat-context.ts pre-computes session data

## Candidate Found: Tool Quality Review De-duplication

### Problem
Optimizer's "tool quality review" periodic task costs 5-10 ops per run to:
1. Read `tool-quality-report.md` (1 op)
2. Parse regressions and trends (1-2 ops)
3. Compare with notes from last scan in periodic-tasks.md (1 op)
4. Write finding file (1 op)
5. Update periodic-tasks.md (1-2 ops)

Meanwhile, `tool-quality-scan.ts` (JS handler) **already does** the core analysis:
- Scans sessions every 4h
- Classifies failures by category × agent
- Compares against `tool-quality-baseline.json` for regressions (>20%)
- Writes `tool-quality-report.md`
- Injects regression tasks into optimizer's todo.md when thresholds exceeded

### What the LLM Adds
The only unique value from the LLM scan is:
- **Trend narrative**: "waste rate 4.7%, trending up from 4.1→4.4→4.7"
- **Cross-session context**: "all fixes blocked on restart"
- **Action recommendation**: "no new interventions possible"

### Proposal: Extend JS Handler with Trend History
Extend `tool-quality-scan.ts` to maintain a rolling trend file:
1. Save last 5 baselines in `.state/tool-quality-history.json`
2. Auto-generate trend direction (↑↓→) for each metric
3. Write `agents/optimizer/workspace/tool-quality-trend.md` with pre-analyzed trends

This would reduce the LLM's "tool quality review" from 5-10 ops to 1-2 ops (just read trend summary, decide if action needed).

**Estimated savings**: 3-5 ops per scan × 3-4 scans/day = 9-20 ops/day.

### Other Candidates Evaluated (No Action Needed)
- **Coach growth-cycle**: Requires genuine LLM judgment for intervention design
- **Bob delegation briefs**: Creative writing, not deterministic
- **Optimizer periodic task selection**: Could be JS but overhead is only 1-2 ops — not worth the handler complexity
- **Scout paper analysis**: Pure LLM work

## Status
PROPOSAL — needs routing to tech-lead for implementation if approved.
