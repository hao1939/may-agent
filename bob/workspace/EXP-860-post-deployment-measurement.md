# EXP-860: Post-Deployment Measurement — Zombie Task Circuit Breaker

## Date: 2025-05-04 (48h+ post-deployment)
## Status: INCONCLUSIVE — measurement window coincides with system dormancy

## Summary

EXP-860 deployed a "retry-aware-dispatch" skill to bob's context.md on 2025-05-04. The skill instructs agents to track retry attempts, checkpoint progress, and stop after 5 failures.

## Evidence: Pre-Deployment Zombie Patterns (Historical)

From system_status active session list, the following zombie patterns are clearly visible in the ~Apr 21–28 timeframe (before deployment):

| Pattern | Agent | Count | Timeframe |
|---------|-------|-------|-----------|
| "Ship EXP-188 finish-guard" | bob | ~15 | Apr 22–28 |
| "Resume context-learning project" | bob | ~12 | Apr 22–28 |
| "Process scout deep-dives" | bob | ~10 | Apr 21–24 |
| "EXP-188 Run all arms" | coach | ~15 | Apr 21–24 |
| "Triage Hao requests" | may | ~6 | Apr 22–28 |
| "Fix tsc --noEmit" | tech-lead | ~5 | Apr 23–28 |

**Total pre-deployment zombie sessions: ~63 in ~7 days = ~9/day**

## Evidence: Post-Deployment (May 4 onward)

- Recent 6h shows 4 bob sessions, all appear to be unique heartbeat/evaluation tasks
- No repeated task descriptions visible in recent session data
- However: the system appears to have been in reduced activity mode since ~May 1

## Conclusion

**Cannot attribute improvement to EXP-860** because:
1. The system transitioned to reduced dispatch activity around the same time
2. No controlled comparison is possible
3. The skill was only deployed to bob's context — coach, may, tech-lead still lack it

## Actual Observations

The zombie sessions from Apr 21-28 share a common trait: **all were interrupted (not errored or completed)**. This suggests the root cause is:
- Sessions being killed by timeout/resource limits before completing
- Tasks that are simply too large for a single session
- Infrastructure interruption (not agent decision-making)

The retry-aware-dispatch skill addresses agent decision-making (don't re-dispatch after N failures), but if the interruptions are infrastructure-driven (may.db handler dispatches regardless of skill), the skill has no effect.

## Revised Hypothesis

> H-ZOMBIE-002: Zombie tasks are caused by **infrastructure-level repeated dispatch** (handler cron re-fires the same task), NOT by agents choosing to re-dispatch. The skill (Layer 2) is necessary but insufficient without Layer 3 (infrastructure dedup guard).

## Next Steps

1. **Deploy skill to coach, may, tech-lead** — the other zombie-pattern agents
2. **Investigate handler dispatch logic** — does the heartbeat handler re-fire identical tasks regardless of prior failures?
3. **Design Layer 3**: Add a "last_dispatched" check in the handler before creating sessions with duplicate task descriptions
4. **Wait for next active period** to measure properly

## Decision

- Keep skill deployed (zero cost, may help at margins)
- Prioritize Layer 3 investigation (infrastructure dedup) as next experiment
- Mark EXP-860 as **PARTIALLY VALIDATED** — skill is sound but insufficient alone
