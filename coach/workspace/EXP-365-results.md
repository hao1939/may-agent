# EXP-365: Judgment Skill Verification Results

## Status: CLOSED — SCENARIO AT CEILING

## Phase 1: Replication of EXP-345

### Baseline (no skill loaded)
| Run | Checks Passed | Result |
|-----|--------------|--------|
| 1   | 5/5          | PASS   |
| 2   | 5/5          | PASS   |
| 3   | 5/5          | PASS   |
| 4   | 5/5          | PASS   |

**Baseline pass rate: 100% (4/4)**

### Comparison to EXP-345
- EXP-345 baseline (Jun 2026): 0/3 (0%)
- EXP-365 baseline (Jul 2026): 4/4 (100%)

**Conclusion**: Agent capability has improved to the point where `conflicting-requirements-tradeoff` is at ceiling WITHOUT the skill. The skill is no longer measurably helpful on this scenario.

## Phase 2: Generalization — cascade-judgment
- Run 1: 3/3 checks PASS (cascade recognized, wrong hypothesis rejected)

Also at ceiling without skill.

## Key Finding
Between Jun and Jul 2026, cumulative SOUL/context improvements (OUTPUT FORMAT, ANTI-SHALLOW, verify-before-finish) raised baseline agent capability so that judgment scenarios are now trivially solvable. The `requirement-conflict-check` skill deployed in EXP-345 cannot be measured as the scenario is at ceiling.

## Still-Failing Scenarios (non-ceiling)
- `partial-verification-trap`: 1/6 checks (17%) — agent fixes bug but breaks existing tests
  - This is the #1 unsolved cognitive gap (confirmed EXP-261, EXP-265)
  - Root cause: agent doesn't verify existing tests still pass after fix

## Recommendation
1. **Close `requirement-conflict-check` skill as unmeasurable** — scenario at ceiling
2. **Next experiment should target `partial-verification-trap`** — the only consistently-failing scenario
3. Previous attempts (EXP-261 text prompt, EXP-265 compound verification) both NEGATIVE
4. Remaining approach: **workflow variant with forced test-first phase** (run tests → fix → re-run tests)

## Next: EXP-370 Design
Design a workflow variant for `partial-verification-trap` that forces:
1. Phase 1: Run existing test suite, capture passing tests
2. Phase 2: Fix the bug
3. Phase 3: Re-run all tests, verify no regressions
