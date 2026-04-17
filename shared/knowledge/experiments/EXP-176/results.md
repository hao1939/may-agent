# EXP-176: Scout Analysis Quality on scout-coder-calc

## Status: CEILING EFFECT — scenario too easy

## Setup
- **Scenario**: scout-coder-calc (two-phase scout→coder)
- **Bugs**: Tax on wrong subtotal + shipping off-by-one
- **Agent**: coder (baseline, no scout intervention)
- **Date**: 2026-04-16

## Baseline Results (5 trials)

| Trial | all-tests-pass | tax-on-discounted | shipping-threshold-fixed | Overall |
|-------|---------------|-------------------|-------------------------|---------|
| 1     | ✅            | ✅                | ✅                      | PASS    |
| 2     | ✅            | ✅                | ✅                      | PASS    |
| 3     | ✅            | ✅                | ✅                      | PASS    |
| 4     | ✅            | ✅                | ✅                      | PASS    |
| 5     | ✅            | ✅                | ✅                      | PASS    |

**Baseline: 5/5 (100%)**

All behavioral checks also passed in every trial.

## Conclusion

The scenario has a **ceiling effect** — the coder solves both bugs 100% of the time without any scout intervention. This makes it impossible to measure whether improved scout analysis helps.

This mirrors the invoice scenario finding from earlier (5/5 baseline). The bugs (tax on wrong subtotal, shipping >= vs >) are straightforward enough that the coder identifies and fixes them without needing scout guidance.

---

## Scenario 2: scout-coder-event-flow

### Status: CEILING EFFECT — scenario too easy (3/3 pass)

- **Bug**: enricher.js uses `event.userId` instead of `event.user_id`
- **Symptoms**: Look like routing/channel bugs (all users get default tier)
- **Date**: 2026-04-17

| Trial | Product (5/5) | Behavior (3/3) | Overall |
|-------|--------------|----------------|---------|
| 1     | 5/5          | 3/3            | PASS    |
| 2     | 5/5          | 3/3            | PASS    |
| 3     | 5/5          | 3/3            | PASS    |

**Baseline: 3/3 (100%)** — Another ceiling. Misdirection doesn't confuse the agent.

See: `baseline-event-flow.md` for details.

## Scenario 3: scout-coder-stale-cache

### Status: CEILING EFFECT — scenario too easy (3/3 pass)

- **Bugs**: Multiple interacting bugs — stale cache, sort comparator, window counting, event dedup, anomaly threshold
- **Symptoms**: 10 test failures across multiple modules
- **Date**: 2026-04-17

| Trial | Product (5/5) | Behavior (3/3) | Overall |
|-------|--------------|----------------|---------|
| 1     | 5/5          | 3/3            | PASS    |
| 2     | 5/5          | 3/3            | PASS    |
| 3     | 5/5          | 3/3            | PASS    |

**Baseline: 3/3 (100%)** — Yet another ceiling. Even with 5 bugs across multiple files and 10 test failures, the coder fixes everything.

## Next Steps

To test scout analysis quality, we need a scenario where:
- Baseline coder succeeds 20-40% of the time
- The bottleneck is *recognition* (identifying what's wrong), not *implementation*
- A good scout analysis would meaningfully help the coder

The cascading-fix-trap-v2 scenario has the opposite problem (floor effect, 0% on the hard check). We need something in between.

## Note on batch runner

The batch runner (`gym-batch.sh`) showed 0/5 ERROR for all trials, but individual `gym-run.sh` runs succeeded. There may be a batch runner bug with this scenario's two-phase workflow.
