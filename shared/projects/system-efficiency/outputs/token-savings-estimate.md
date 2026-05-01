# Token Savings Estimate: Shared Rules Deduplication

## Summary
Deduplicating common rules from 7 agent SOUL.md files into a single `shared-rules.md` saves ~1,700 tokens per session-set, or ~17,000 tokens/day at 10 sessions/day.

## Current State: Duplicated Rules

### Rules Duplicated Across SOUL.md Files
| Rule | Avg Tokens/Agent | Agents With It | Total Duplicated |
|------|-----------------|----------------|-----------------|
| edit() over write() | ~45 tokens | 7 | 315 tokens |
| finish() format & deliverables | ~120 tokens | 7 | 840 tokens |
| checkpoint usage guidance | ~80 tokens | 7 | 560 tokens |
| File verification before claiming done | ~60 tokens | 5 | 300 tokens |
| **Total duplicated per load** | **~305/agent** | **7** | **~2,015 tokens** |

## Proposed State: Shared Rules Reference

- Single `shared-rules.md`: ~305 tokens (all 3 common rules)
- Each SOUL.md adds 1 reference line: ~15 tokens
- Per-agent overhead after dedup: ~15 tokens

### Savings Calculation
```
Before: 7 agents × 305 tokens = 2,135 tokens/session-set
After:  1 × 305 tokens (shared) + 7 × 15 tokens (refs) = 410 tokens/session-set
Savings per session-set: 1,725 tokens
```

## Daily Impact

| Metric | Value |
|--------|-------|
| Avg sessions/day (all agents) | ~10 |
| Tokens saved per session-set | 1,725 |
| **Daily token savings** | **~17,250 tokens** |
| Monthly token savings | ~517,500 tokens |
| % reduction in SOUL.md prompt overhead | ~14% per agent |

## Context Window Impact
- Each agent reclaims ~290 tokens at session start
- Small % of 200K context window (0.15%) but reduces first-response latency
- Real win is maintenance: update rules in 1 place instead of 7

## ROI Assessment
- **Implementation effort**: ~30 minutes (edit 7 files + create shared-rules.md)
- **Ongoing benefit**: 17K+ tokens/day, cleaner SOUL.md, single source of truth
- **Risk**: Low
- **Verdict**: ✅ High ROI — implement immediately
