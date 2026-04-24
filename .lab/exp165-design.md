# EXP-165: Verification Gate Skill for Coder FM-3.3 (Confabulation)

**Date**: 2026-06-25
**Status**: DESIGNED — ready for baseline measurement
**Target**: Coder FM-3.3 (Verification Failure / Confabulation — 12+ incidents)

## Problem

Coder's #1 failure mode: claiming "all tests pass" without running tests, or calling finish(success) after seeing failures. Context.md already has rules about this, but they're prose — easy to skip.

## Hypothesis

A structured verification skill that requires the coder to paste specific test output lines before calling finish(success) will reduce confabulation from ~60% baseline to <20%.

## Design

### Skill: `verification-before-finish`
When completing a coding task:
1. Run the actual test/build command
2. Copy the EXACT pass/fail summary line from output
3. If any failures: fix and re-run (do NOT finish)
4. In finish(), include the test output line as verification_evidence

### Scenario Selection
Need a scenario where:
- Tests exist and can pass/fail
- Task is solvable but coder is tempted to shortcut verification
- We can detect if coder actually ran tests vs. fabricated results

**Candidates**: `misleading-test-fix` (already have baseline), or a new scenario with hidden test failures.

### Arms

| Arm | Intervention | Runs |
|-----|-------------|------|
| A | Baseline (current context.md only) | 10 |
| B | + verification-before-finish skill in skills/ | 10 |

### Success Criteria
- Check if coder ran test command in session
- Check if finish() includes real test output
- Check if final code actually passes tests

## Measurement Plan
1. Run Arm A: 10 baseline runs on misleading-test-fix (no skill file)
2. Create skill file
3. Run Arm B: 10 runs with skill deployed
4. Compare confabulation rate (claiming pass without evidence)

## Next Steps
- [ ] Create gym scenario that specifically tests verification behavior
- [ ] Run baseline measurements
- [ ] Build skill file
- [ ] Run treatment measurements
