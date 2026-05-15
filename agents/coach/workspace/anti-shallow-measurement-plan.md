# Anti-Shallow Intervention Measurement Plan

**Date**: 2026-10-28
**Intervention**: ANTI-SHALLOW RULE added to coach/heartbeat.md (10+ tool calls, produce artifact, no "nothing to do")
**Baseline**: 49% shallow sessions (coach), 76% (bob)

## What We're Measuring

1. **Shallow rate**: % of sessions with ≤2 messages / no artifact produced
2. **Tool call count**: median tool calls per session (baseline ~2-3 for shallow)
3. **Quality score**: evaluator JS quality (baseline 0.70 for coach)

## Success Criteria

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Coach shallow rate | 49% | <15% | 7 days |
| Coach median tool calls | ~3 | ≥10 | 7 days |
| Coach quality score | 0.70 | ≥0.65 (no regression) | 7 days |
| Bob shallow rate | 76% | <30% | 14 days (needs bob heartbeat update) |

## Measurement Method

```sql
-- Shallow sessions: done sessions with ≤3 ops
SELECT 
  agent,
  COUNT(*) as total,
  SUM(CASE WHEN ops <= 3 THEN 1 ELSE 0 END) as shallow,
  ROUND(100.0 * SUM(CASE WHEN ops <= 3 THEN 1 ELSE 0 END) / COUNT(*), 1) as shallow_pct
FROM sessions
WHERE agent IN ('coach', 'bob')
  AND status = 'done'
  AND createdAt > datetime('now', '-7 days')
GROUP BY agent;
```

## Confounders to Control For

1. **Zombie kills**: Sessions killed by zombie cleanup look shallow but aren't (see finding 2026-04-30). Filter by `status = 'done'` only.
2. **Evaluator heartbeats**: These are legitimately short — exclude `task LIKE '%heartbeat%'` if evaluator is in scope.
3. **Infrastructure failures**: Sessions that error out aren't shallow by choice.

## Current Status

- ✅ Coach intervention deployed (ANTI-SHALLOW RULE in heartbeat.md)
- ⬜ Bob intervention pending (notification sent, awaiting implementation)
- ⬜ First measurement point: next heartbeat should verify this session itself is non-shallow
- ⬜ 7-day measurement: re-run query above

## Blocked Projects Note

Three coach projects (coach-quality, documentation-gen, skill-workflow-audit) are "blocked" at iter 50 safety cap but all have met their targets. They should be closed by infrastructure (may) — not a coach action item. Sent notification.

## Next Experiment: Bob Anti-Shallow

If coach shallow rate drops to <15%, replicate the exact same intervention pattern for bob:
1. Add ANTI-SHALLOW RULE to bob's heartbeat.md
2. Add OUTPUT FORMAT requirement (GOAL/PLAN/DONE WHEN)
3. Measure after 7 days
