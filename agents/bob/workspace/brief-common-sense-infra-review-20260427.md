# Common Sense Infra Review — 2026-04-27

## Summary

Evaluator pipeline still broken (last eval: Apr 16, 11 days stale). Coach has two infra-dependent blockers. One has a concrete, immediately fixable root cause: the gym runner path is wrong in the gym_runs infrastructure.

## Infra-Owned Items Status

| Item | Priority | Status | Notes |
|------|----------|--------|-------|
| IT-87 Evaluator pipeline | P0 | Broken since Apr 16 | 0 evals in 11 days; 32,716 total historical |
| C12.1 Convention checker false positives | P0 | Unfixed | Still generating noise |
| C1.3 Write-readback nudge | P1 | Unbuilt | Coach tracks 36 violations/week |

**Highest priority unbuilt mechanism: IT-87 evaluator pipeline** — no evals since Apr 16. This blocks all quality measurement and coach's training loop.

## Coach Infra Dependencies (not framed as escalations, but clearly blocked)

1. **IT-113 — Restore skill-effectiveness metric via gym runs** (Coach P0)
   - gym_runs table: 1 row, and it FAILED due to wrong path (`test/gym/run-gym.sh: not found`)
   - Coach already identified correct path: `scripts/gym-run.sh`
   - Coach also notes growth-cycle workflow is needed to populate real data
   - **This is a concrete bug**: something is invoking `test/gym/run-gym.sh` instead of `scripts/gym-run.sh`

2. **Evaluator restart** (Coach P1)
   - Coach can't measure skill effectiveness without evals
   - Manual session sampling is the workaround

## Actionable Finding: Gym Runner Path Bug

The single gym_run in the DB failed because the runner was invoked at `test/gym/run-gym.sh` (doesn't exist) instead of `scripts/gym-run.sh`. This is likely hardcoded somewhere in the gym infrastructure. Fixing this path reference would unblock gym data collection.

**Recommend**: Find and fix the `test/gym/run-gym.sh` reference, then re-run `scripts/gym-run.sh partial-verification-trap --agent coder` to verify.

## Ownership Updates

None. No items were recently built.

## Recommendation

1. **Quick win**: Fix gym runner path bug (minutes of work, unblocks coach IT-113)
2. **Critical**: Investigate why evaluator pipeline stopped Apr 16 and restart it
3. C1.3 write-readback nudge remains P1 — deprioritized vs the above
