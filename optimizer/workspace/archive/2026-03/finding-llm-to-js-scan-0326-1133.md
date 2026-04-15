# LLM-to-JS Scan Finding — 2026-03-26T11:33

## Scan Window
Last 2.5h of sessions (since 09:06 UTC). ~6 sessions checked via checkpoints.

## Current State
- 22 JS handlers in agents/may/handlers/
- Last LLM-to-JS implementation: tool-quality-trend history (09:06, blocked on restart)
- Heartbeat-context handler already pre-computes session counts + sizes per agent
- Tool-quality-scan already generates reports + baselines

## Candidate Found: Cost Scan Redundancy with Heartbeat-Context

### Problem
Optimizer's "cost outlier scan" periodic task costs 3-5 ops per run:
1. Try to query may.db (often fails — no sqlite3 binary) (1 op, wasted)
2. Fall back to checkpoint scanning (1-2 ops)
3. Count sessions, calculate rates (1 op)
4. Compare with previous scan (1 op)
5. Update periodic-tasks.md (1 op)

Meanwhile, `heartbeat-context.ts` **already computes** per-agent session counts and total KB,
and injects it into `workspace/heartbeat-context.md`. The output already shows:
```
System: 61 sessions/6h, 4.9% error rate
Top spenders: coach 12s/2461KB, bob 7s/1130KB, optimizer 6s/986KB...
```

### What the LLM Adds (Unique Value)
- Sessions/hour rate calculation (trivial arithmetic)
- Ops estimate (not currently available without DB)
- Comparison with last report ("waste rate trending up/down")
- Outlier detection (">$2.00 session")

### Proposal: Extend heartbeat-context.ts with Cost Summary
Add to the heartbeat-context handler:
1. **Session rate**: sessions_count / window_hours → "X sessions/hr"
2. **Change detection**: compare current session count + KB against `.state/cost-history.json`
   - If rate is within ±20% of last scan → "STABLE"
   - If rate jumped >20% → "ALERT: session rate spiked"
3. **Outlier flag**: any single session > 500KB → flag it
4. **Write cost-monitor section** in heartbeat-context.md

This reduces cost scan from 3-5 ops to 1 op (read heartbeat-context.md, see "STABLE").

### Expected Savings
- 2-4 ops saved per cost scan × ~2 scans/day = 4-8 ops/day
- Plus avoids the sqlite3 failure + retry pattern (saves 1-2 wasted ops per scan)

### Priority: LOW-MEDIUM
The tool-quality-trend implementation (from last scan) saves more (9-20 ops/day) and is 
already coded, just blocked on restart. This candidate saves less but eliminates a recurring 
"sqlite3 not found" error pattern.

### Other Candidates Evaluated (Not Viable)
- **Analysis review automation**: analysis.md rarely changes. But when it does, the LLM needs
  to understand the strategic implications — can't be JS-automated. Change detection could
  save 1 op (skip the read when unchanged) but the file is small and the read is useful context.
- **Handler health check automation**: already low-cost (2 ops). The 22-handler listing is 
  static. No improvement possible.
- **Coach growth-cycle**: requires genuine LLM judgment for experiment design.
- **Bob strategy work**: requires genuine LLM judgment.
- **Periodic task rotation**: already 1-op overhead (just reading the file). Not worth automating.

## Action
No implementation this session — the previous implementation (tool-quality-trend) is still 
blocked on process restart and covers a higher-savings candidate. Will revisit cost-monitor 
enhancement after restart validates the trend implementation.

## Status: FINDING_DOCUMENTED
