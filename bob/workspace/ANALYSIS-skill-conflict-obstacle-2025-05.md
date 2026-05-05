# Analysis: Obstacle-Pivot vs Obstacle-Persistence Skill Conflict

**Date**: 2025-05-06
**Context**: Coder has both skills in context.md. Are they contradictory?

## Finding

**Not contradictory — complementary, but poorly signposted.**

| Skill | Says | Goal |
|-------|------|------|
| obstacle-persistence | Try 2+ alternatives before pivoting away from the *goal* | Don't abandon objectives too easily |
| obstacle-pivot | When an *approach* fails, switch to Plan B quickly | Don't retry broken approaches blindly |

The distinction is **goal vs approach**:
- Persistence says: keep pursuing the same *goal* (try different paths to it)
- Pivot says: when one *technique* fails, switch techniques (but implicitly toward the same goal)

## Risk

Without explicit framing, an agent could interpret them as:
- "Persist = retry" (wrong — persistence means *alternative approaches*, not retries)
- "Pivot = give up on goal" (wrong — pivot means switch *method*, not objective)

In practice they say the same thing: **try alternatives**. The real question is when to escalate/abandon entirely — and both skills agree: after 2-3 genuine attempts.

## Recommendation

**No action needed.** The skills are aligned. If confusion surfaces in evaluations (agent cites one skill to justify violating the other), then merge them into a single "obstacle-response" skill. For now, monitor.

## Experiment Opportunity

EXP-299 (Obstacle Persistence) is designed to test whether the persistence skill reduces OBSTACLE_PIVOT failures. If it runs, we'll have data on whether this skill actually changes behavior. The pivot skill has no equivalent experiment. 

**Proposed measurement**: After EXP-299, check if agents with both skills perform better than agents with only one. This would validate the "complementary" theory above.

## Status: MONITORING (no intervention needed)
