# Finding: Session Cost Analysis — opBudget Oversizing

**Date**: 2026-03-19T11:25
**Impact**: High — $50-75/day savings potential ($1,500-2,250/month)
**Status**: Evaluator fix deployed (bdc997a), opBudget reductions sent to May (req:db066426)

## Summary

Analyzed last 60 sessions ($101.29 total). The top 3 cost drivers are:

| Agent | Sessions | Total Cost | Avg/Session | % of Total |
|-------|----------|-----------|-------------|------------|
| tech-lead | 7 | $33.26 | $4.75 | 33% |
| optimizer | 5 | $23.97 | $4.79 | 24% |
| coach | 11 | $18.80 | $1.71 | 19% |

## Root Cause

**Heartbeat sessions run too long.** Tech-lead uses 47-66 ops per heartbeat (50-63 assistant turns), growing context to 54K+ tokens. Each later turn costs ~1.5x more than early turns due to accumulated context.

Cost distribution within a single 49-turn tech-lead session ($5.45 total):
- First 20 turns: $1.64 (30%)
- Last 29 turns: $3.81 (70%)

Compaction triggers mid-session but adds its own cost for summarization calls.

## Actions Taken

### 1. Evaluator transcript cap reduction (DEPLOYED — bdc997a)
- Per-session: 15KB → 10KB (head 3KB + tail 7KB)
- Added 20KB total budget across all sessions
- Prevents 30-54KB eval tasks (now max ~20KB)
- Evaluator was only 1.2% of cost, but this is free savings

### 2. opBudget reductions (SENT TO MAY — req:db066426)
- tech-lead: 70 → 35 (saves ~$25/day)
- optimizer: 200 → 60 (right-sized for actual 17-54 op usage)
- Hot-reload supported: takes effect next session without restart

## Cost Model

opBudget controls state-changing operations (bash, write, edit). Each op generates at least one assistant turn. Total cost ≈ Σ(per_turn_cost) where per_turn_cost grows with context length.

Halving opBudget → ~50% fewer turns → ~40-50% cost reduction (not exactly 50% because early turns are cheaper).

## Future Opportunities

1. **Coach opBudget**: Already sent 15-turn budget request previously (req:8804a514)
2. **Heartbeat decomposition**: Split monolithic heartbeats into focused cron tasks (e.g., tech-lead "error review" as separate cron, "git cleanup" as separate cron)
3. **Model downgrade**: Some agents may not need Opus for every heartbeat
