# Finding: Shallow Sessions Drive 50-76% of Quality Score Degradation

**Date**: 2026-06-29  
**Severity**: High  
**Source**: Coach quality investigation (coach-quality project, M1 diagnosis)

## Summary

49% of coach evaluations (235/480) and 76% of bob evaluations are "shallow sessions" — sessions with only 2 messages that perform no meaningful work. These are infrastructure/dispatch failures (crash on startup, empty tasks, immediate errors), not behavioral issues.

## Impact

- Coach's real quality score excluding shallow sessions: **0.486** (near 0.50 target)
- Coach's reported score with shallow sessions: **0.24** (misleading)
- Bob is even worse at 76% shallow rate
- These inflate failure metrics and waste compute on sessions that never had a chance to succeed

## Root Cause Hypothesis

Sessions are being created and immediately failing due to:
1. Dispatch errors (empty/malformed tasks)
2. Startup crashes (missing dependencies, bad config)
3. Infrastructure timeouts before first tool call

## Recommendation

1. **Filter shallow sessions from quality metrics** — 2-message sessions should be categorized as "infra failures" not "quality failures"
2. **Add dispatch validation** — reject empty/malformed tasks before creating a session
3. **Add startup health check** — verify agent can make at least one tool call within 30s
4. **Track shallow session rate as its own metric** per agent

## Action Items

- [ ] Escalate to May: shallow sessions need infra-level fix
- [ ] Propose metric filtering for evaluations
- [ ] Investigate bob's 76% shallow rate specifically — worse than coach, may have different root cause
