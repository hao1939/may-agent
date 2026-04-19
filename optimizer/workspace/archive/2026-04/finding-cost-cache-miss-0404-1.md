# Finding: $1,409/Week Cost — Cache Miss Driving 80% of Spend

**Date**: 2026-04-04
**Severity**: P0 (largest single cost driver)
**Category**: Performance & efficiency

## Summary

Weekly LLM cost: **$1,409** ($201/day). Top 3 agents account for 80%:
- Bob: $470 (33%) — 148M input tokens, 0% cache
- Optimizer: $336 (24%) — 104M input tokens, 0% cache  
- Coach: $323 (23%) — 101M input tokens, 0% cache

**Root cause**: 353M input tokens with **0% prompt cache hit rate** for the top 3 agents.

Meanwhile, QA and amy-kimi achieve high cache rates (619% and 1100% respectively), paying much less per token.

## Why Cache Doesn't Work for Top 3

Anthropic prompt caching requires identical prefix content across consecutive requests. The top 3 agents fail this because:

1. **Every session starts fresh** — no parent-child relationship, each heartbeat is independent
2. **Injected context varies** — pending tasks, last session state, and injections change the prompt prefix every time
3. **Session compaction** — mid-session compaction rewrites the entire conversation, breaking any cache
4. **Long sessions accumulate unique context** — Bob at 22 avg ops, Optimizer at 20, Coach at 21

QA and amy-kimi succeed because they have shorter sessions (3 and 9 avg ops) with more stable prompt structures.

## Cost Per Interrupt

Interrupted sessions for the top 3 agents:
| Agent | Avg cost (interrupted) | Avg cost (done) | Wasted on interrupts |
|---|---|---|---|
| Optimizer | $11.46 (5 sessions) | $6.51 (8 sessions) | ~$57 |
| Bob | ~$5.50 (est.) | ~$2.50 (est.) | ~$30 |
| Coach | ~$4.00 (est.) | ~$1.50 (est.) | ~$20 |

**Interrupt waste alone: ~$100+/week for top 3 agents.**

## Bob's Specific Problem

Bob runs 164 heartbeat sessions/week, each reading INDEX.md (6-8 times per session due to compaction) and exploring knowledge entries. His top sessions cost $16.70, $12.17, $11.02 — these are pure exploration/synthesis heartbeats.

**Recommendation for Bob**: Reduce heartbeat frequency or scope. Bob's synthesis work doesn't need to run every 30 minutes. Consider:
- Increase Bob's heartbeat interval to 60 or 90 minutes
- Pre-populate Bob's context with INDEX.md summary (JS injection) to avoid re-reads
- Set maxTurns lower (30) to cap cost per session

## Optimizer's Self-Problem

I (Optimizer) am the #2 cost center. My average session is 20 ops at $2.43. My interrupted sessions average $11.46 — nearly 5x a done session.

**Fix**: Work faster, finish in fewer ops. Target: ≤15 ops per session, ≤$1.50 avg cost.

## Actionable Recommendations

### Quick (no code changes):
1. **Increase Bob heartbeat interval** to 60min (saves ~50% = $235/wk)
2. **Reduce Optimizer heartbeat interval** to 60min (saves ~$168/wk)
3. **Lower maxTurns for Bob/Optimizer** to 30 (prevents $15+ runaway sessions)

### Medium (code changes):
4. **JS-inject INDEX.md summary for Bob** — avoid 6-8 duplicate reads per session
5. **Stable prompt prefix** — restructure system prompt to keep a cacheable prefix before dynamic injections

### Strategic:
6. **Fix gracefulRestart()** — prevent interrupt waste ($100+/wk for top 3)
7. **Session continuity** — allow sessions to resume from checkpoint instead of starting fresh

## Data Source

All data from `.state/may.db` evaluations + sessions tables, 7-day window.
