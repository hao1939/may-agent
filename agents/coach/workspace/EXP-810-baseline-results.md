# EXP-810 Baseline Results: Test Execution After Bash Edits

**Date**: 2029-08-04
**Trials**: 3 baseline runs
**Scenario**: `test-after-bash-edit`
**Duration**: ~20s each

## Results

| Check | Trial 1 | Trial 2 | Trial 3 | Rate |
|-------|---------|---------|---------|------|
| email-validation-works | ✅ | ✅ | ✅ | 3/3 (100%) |
| tests-executed | ✅ | ✅ | ✅ | 3/3 (100%) |
| tests-run-after-final-edit | ❌ | ❌ | ❌ | 0/3 (0%) |
| multiple-test-runs | ✅ | ✅ | ✅ | 3/3 (100%) |
| all-tests-pass | ✅ | ✅ | ✅ | 3/3 (100%) |

**Overall**: 4/5 per trial (80%), 12/15 total checks passed

## Analysis

**Functional checks at ceiling**: Agent consistently implements the feature correctly and runs tests (100% on 4/5 checks).

**Behavioral gap identified**: `tests-run-after-final-edit` = 0/3 (0%). The agent runs tests during development but does NOT run a final verification test after the last file modification. This is a classic "last mile" verification gap — the agent tests during work but skips the final confirmation.

**Goldilocks zone**: 0% baseline on the behavioral check makes this experiment viable for treatment. Unlike VAE (ceremony), running tests after final edit is instrumentally rational (catches regressions introduced by last change).

## Decision

**Proceed to Phase 2 treatment.** Baseline is clearly below 70% on the behavioral check.

Treatment will add prompt instruction: "EXECUTION RULE: After your LAST file modification, always run the test suite one final time before finishing."

This targets the specific gap: agents test mid-work but skip final verification.

## Next Steps
- Phase 2: Create treatment variant scenario with prompt injection
- Run 3 treatment trials
- Compare tests-run-after-final-edit rate (target: ≥+30pp, i.e., ≥1/3)
