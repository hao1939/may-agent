# EXP-810 Results: Test Execution After Bash Edits

**Date**: 2029-08-04
**Status**: CLOSED ❌ NEGATIVE
**Trials**: 3 baseline + 3 treatment = 6 total

## Summary

Threat-framed prompt instruction to run tests after final edit had **zero effect**. Both arms identical at 0/3 on the target behavioral check. Confirms KE-480 extends to test-execution timing behaviors.

## Results

### Baseline (no intervention)

| Check | T1 | T2 | T3 | Rate |
|-------|----|----|-----|------|
| email-validation-works | ✅ | ✅ | ✅ | 100% |
| tests-executed | ✅ | ✅ | ✅ | 100% |
| tests-run-after-final-edit | ❌ | ❌ | ❌ | 0% |
| multiple-test-runs | ✅ | ✅ | ✅ | 100% |
| all-tests-pass | ✅ | ✅ | ✅ | 100% |

### Treatment (P0 threat-framed "run tests after last edit" instruction)

| Check | T1 | T2 | T3 | Rate |
|-------|----|----|-----|------|
| email-validation-works | ✅ | ✅ | ✅ | 100% |
| tests-executed | ✅ | ✅ | ✅ | 100% |
| tests-run-after-final-edit | ❌ | ❌ | ❌ | 0% |
| multiple-test-runs | ✅ | ✅ | ✅ | 100% |
| all-tests-pass | ✅ | ✅ | ✅ | 100% |

### Delta: 0pp on all checks. Treatment = baseline.

## Analysis

1. **Agent already runs tests** (100% on tests-executed, multiple-test-runs). The agent IS testing — it just doesn't run tests AFTER the final modification.

2. **The "last mile" verification gap is structural**: The agent's natural workflow is modify→test→modify→test→finish. The final test comes BEFORE the last edit, not after. The prompt instruction did not change this ordering.

3. **Hypothesis about "instrumentally rational" behaviors was wrong**: I predicted that test-running (unlike ceremonial read-after-edit) would be more amenable to prompt nudges because it's genuinely useful. Wrong — the agent already tests. The gap is in test TIMING (after final edit), which is a workflow ordering issue. Text instructions cannot reorder tool-call sequences.

4. **KE-480 extended**: Text coaching fails not just for ceremony (VAE) but also for workflow ordering changes, even when the behavior is instrumentally rational.

## Conclusion

**CLOSED ❌ NEGATIVE**. Do NOT deploy this instruction.

To fix "tests-run-after-final-edit", the only viable approach would be a structural gate in the workflow that checks whether the last tool call before finish() was a test execution. This mirrors the pattern of EXP-520/530/650 — structural enforcement beats text.

## Knowledge Entry Candidate

**KE-810**: Text prompt instructions cannot reorder agent tool-call sequences. Even threat-framed P0 instructions for instrumentally rational behaviors (test-running) fail when the gap is workflow ordering rather than behavioral omission. Extends KE-480 beyond ceremony to timing/sequencing.
