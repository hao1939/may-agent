# EXP-430: Test-First Debugging — Treatment Results

## Summary
**NEGATIVE** — Test-first-debugging skill shows no improvement over baseline on partial-verification-trap.

## Results

| Trial | Checks Passed | Pass Rate | Key Failures |
|-------|--------------|-----------|--------------|
| 1     | 1/6          | 17%       | bug-fixed ✗, existing-tests-pass ✗, exact-multiple-clamped ✗, normal-pagination-works ✗, added-edge-case-test ✗ |
| 2     | 1/6          | 17%       | Same as above |
| 3     | 1/6          | 17%       | Same as above |

**Treatment pass rate**: 0/3 (0%) at ≥5/6 threshold
**Baseline (EXP-261)**: 11% (1/9 at ≥5/6)

## Analysis

The test-first skill did NOT help. The agent consistently:
- Ran tests (✓ `ran-tests`)
- Failed to fix the bug correctly
- Failed to add edge-case test coverage
- Broke existing tests

This confirms the scenario is **ability-bound** (the agent cannot implement correct pagination clamping logic), not **process-bound**. No amount of procedural prompting — whether decompose-before-acting (EXP-420: 0%), procedural bug-fix (EXP-261: 6%), or test-first (EXP-430: 0%) — helps when the underlying coding ability is insufficient.

## Conclusion

**CLOSED — NEGATIVE**. Test-first-debugging skill does not improve partial-verification-trap performance.

The partial-verification-trap scenario is conclusively ability-bound. It should not be used for testing process/planning skills. Its value is as a coding-ability benchmark only.

### Knowledge Entry
- **KE-430**: Test-first debugging (write failing test → fix → verify green) shows 0% improvement on ability-bound scenarios. Process skills only help when the task failure mode is process-related (e.g., hidden-constraints-refactor where decompose-before-acting showed +33pp). partial-verification-trap is confirmed ability-bound across 4 experiments (EXP-261, 265, 420, 430).

## Date
2025-09-14
