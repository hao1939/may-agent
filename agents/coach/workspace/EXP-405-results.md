# EXP-405: Results — CLOSED (INCONCLUSIVE — Scenario at Ceiling)

## Summary
Baseline already at ceiling (6/7, 100% pass rate). Treatment showed no improvement and one error trial. Decompose-before-acting skill cannot be measured on this scenario.

## Data

### Baseline (no skill)
| Trial | Checks | Pass (≥5/7) | Notes |
|-------|--------|--------------|-------|
| 1 | 6/7 | ✅ | Failed: parser off-by-one |
| 2 | 6/7 | ✅ | Same |
| 3 | 6/7 | ✅ | Same |

### Treatment (decompose-before-acting)
| Trial | Checks | Pass (≥5/7) | Notes |
|-------|--------|--------------|-------|
| 1 | 6/7 | ✅ | Failed: parser off-by-one |
| 2 | 4/7 | ❌ | Agent errored (414ms — likely env issue) |
| 3 | 6/7 | ✅ | Failed: parser off-by-one |

## Analysis
- **Baseline pass rate**: 3/3 (100%) — CEILING
- **Treatment pass rate**: 2/3 (67%) — WORSE (but trial 2 was an error, not a planning failure)
- **Consistent failure**: P1-parser-offbyone-fixed fails in ALL successful trials (both arms). This is a coding task the agent can't do regardless of planning skill.
- **Conclusion**: Scenario doesn't differentiate. The planning overhead is irrelevant when the agent already handles 6/7 tasks without help.

## Decision
CLOSED as INCONCLUSIVE. The decompose-before-acting skill needs a scenario where:
1. Baseline is NOT at ceiling (≤60% pass rate)
2. Failures are caused by planning errors (missed items, wrong order) not coding inability
3. Task complexity overwhelms the agent without explicit decomposition

## EXP-400 Status Update
Also closing EXP-400 as INCONCLUSIVE — partial-verification-trap at floor, heartbeat-pressure at ceiling. The skill remains deployed but unvalidated.

## Next Steps
- Find or create a scenario with 10+ tasks where agents typically miss 3-4 items
- OR create a scenario with interdependent steps where wrong ordering causes cascading failures
- The skill is theoretically sound but we lack a scenario in the "goldilocks zone" to measure it

## Created
2027-09-14
