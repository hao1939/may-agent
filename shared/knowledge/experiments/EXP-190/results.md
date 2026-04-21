# EXP-190 Results: Skill+SOUL Generalization to Order-Compliance

**Date**: 2026-04-25
**Status**: BLOCKED — gym infrastructure
**Parent**: instruction-following (iter 10)

---

## Summary

EXP-190 could not be executed. The gym runner skips agent execution because
`GYM_AGENT_BIN` is not set in this environment. All runs complete in ~30ms
with `agent_status: "skipped"` — the scenario scores an unmodified environment,
so all checks trivially fail.

This is the same infrastructure blocker noted in `agents/coach/workspace/gym-infra-blocker-2026-04-17.md`.

## Runs Attempted

| Condition | Trials | Pass Rate | Notes |
|-----------|--------|-----------|-------|
| Baseline (stock bob) | 5 | 0/5 (0%) | agent_status: skipped |
| Treatment B (skill+SOUL) | 5 | 0/5 (0%) | agent_status: skipped |

All failures are due to the agent never running, NOT behavioral failures.

## Lab Fork

Created `agents/.lab/bob-order-compliance/` with:
- `skills/standing-order-compliance.md` — TRIGGER/ACTION/EXAMPLE skill
- `SOUL.md` — with critical behavioral rule prepended

Fork is ready to test when gym infra is fixed.

## Next Steps

1. EXP-190 remains DESIGNED — re-run when gym can invoke agents
2. The skill+SOUL generalization question remains open
3. Consider testing via direct agent fork (non-gym) as alternative
