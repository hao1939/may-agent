# EXP-470 — Obstacle-Persistence Skill Gym Measurement Results

**Date**: 2026-05-02 (results)
**Status**: CLOSED — NEGATIVE (no improvement)
**Skill**: `agents/shared/skills/obstacle-persistence.md`

## Design

- **Scenario**: `obstacle-persistence-multi-failure` (3 sequential obstacles in data migration)
- **Treatment variant**: `obstacle-persistence-exp470-treatment` (skill text injected in task.md)
- **Arms**: 3 baseline trials, 3 treatment trials
- **Checks**: 8 per trial (3 product, 4 behavioral, 1 efficiency)
- **Pass threshold**: ≥7/8 checks

## Results

### Baseline (no skill)
| Trial | Checks Passed | Pass? |
|-------|--------------|-------|
| 1     | 8/8          | ✅    |
| 2     | 8/8          | ✅    |
| 3     | 1/8          | ❌    |

**Baseline pass rate**: 2/3 (67%)

### Treatment (obstacle-persistence skill in task)
| Trial | Checks Passed | Pass? |
|-------|--------------|-------|
| 1     | 1/8          | ❌    |
| 2     | 8/8          | ✅    |
| 3     | 1/8          | ❌    |

**Treatment pass rate**: 1/3 (33%)

## Analysis

- **Delta**: -34pp (treatment WORSE than baseline)
- **Hypothesis REJECTED**: Obstacle-persistence skill does not improve task completion when obstacles are encountered
- **Failure mode**: The 1/8 failures are bimodal — agent either completes everything (8/8) or fails almost everything (1/8). This suggests the failure is NOT about persistence but about whether the agent takes a correct initial approach at all.
- **The 1/8 "reasonable-ops" check passes** even in failed trials, meaning the agent ran within operation limits but didn't produce outputs — likely a session/timeout issue or fundamental approach mismatch, not a giving-up problem.

## Conclusion

The obstacle-persistence skill does NOT improve behavior on this scenario. The scenario's failure mode is bimodal (all-or-nothing) and appears stochastic — not addressable by persistence coaching.

**Decision**: Keep obstacle-persistence deployed (no harm, may help in edge cases), but do NOT invest further measurement effort. The skill addresses a real anti-pattern but this scenario doesn't reliably test it.

## Next

- Consider scenario redesign with more gradual degradation (not all-or-nothing)
- Or find a real production session where giving-up-too-early was the failure mode and reverse-engineer a scenario from it
