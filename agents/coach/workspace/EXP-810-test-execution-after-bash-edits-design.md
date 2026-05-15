# EXP-810: Test Execution Verification After Bash Edits

**Date**: 2029-05-04
**Status**: DESIGNED
**Author**: coach
**Builds on**: KE-800 (agents prefer bash), KE-480 (text coaching dead for verification), EXP-575 (VAE closed/reframed)

## Problem Statement

KE-800 proved agents use `bash` (heredoc/sed) for 90%+ of file edits, bypassing the `edit()` tool entirely. The "real" verification is **running tests after changes**, not calling `read()`. But do agents consistently run tests?

Current state: Unknown. We've measured verify-after-edit (9-17%) but never measured **test-after-modify** rate.

## Hypothesis

**H-810**: A prompt-level instruction ("After ANY file modification, run the test suite before proceeding") combined with a success_criteria check will establish a baseline test-execution rate and determine if prompt-level nudges can improve it (since test-running is a natural, rational behavior unlike ceremonial read-after-edit).

**Key difference from VAE**: Running tests is *instrumentally valuable* (finds real bugs), unlike read-after-edit which is ceremony. Agents may already do it at high rates. If baseline is <70%, a prompt nudge may work because it's reinforcing a rational behavior, not imposing ceremony.

## Design

### Phase 1: Baseline Measurement
- **Scenario**: `test-after-bash-edit` (new)
- **Task**: Agent modifies 3 files via bash to implement a feature, project has existing test suite
- **Success criteria**: 
  1. Feature implemented correctly (functional check)
  2. Tests executed at least once after each file modification (behavioral check)
  3. All tests pass (correctness check)
- **Trials**: 3 baseline runs

### Phase 2: Treatment (if baseline <70%)
- **Intervention**: Prompt injection: "EXECUTION RULE: After ANY file modification (edit, write, bash sed/cat/echo), run `npm test` before proceeding to the next file."
- **Trials**: 3 treatment runs
- **Target**: ≥+20pp improvement over baseline

## Scenario Design: `test-after-bash-edit`

```
Task: Add input validation to a REST API endpoint
- Project has 3 source files (routes.js, validator.js, middleware.js)  
- Project has passing test suite (test/api.test.js with 5 tests)
- Agent must modify all 3 files to add email validation
- Tests exist that will FAIL if validation is incorrect
- success_criteria checks:
  1. email-validation-works: POST /users with invalid email returns 400
  2. tests-run-after-routes: bash history shows test execution after routes.js modification
  3. tests-run-after-validator: bash history shows test execution after validator.js modification
  4. all-tests-pass: final test run shows 0 failures
```

## Success Criteria for Experiment

- **Baseline ≤60%** on test-execution checks: experiment is in goldilocks zone, proceed to treatment
- **Baseline >80%**: agents already do this naturally → CEILING, close experiment
- **Treatment ≥+20pp over baseline**: POSITIVE → deploy instruction to master-worker.ts
- **Treatment <+10pp**: NEGATIVE → confirms KE-480 extends to all prompt-level interventions

## Expected Outcome

Unlike VAE (ceremony), test-running is rational. I predict:
- Baseline: 40-60% (agents sometimes skip tests when confident)
- Treatment: 70-80% (prompt nudge works because behavior is instrumentally valuable)

If confirmed, this would be the first POSITIVE text intervention since EXP-565's gym-only result — and would transfer to production because it reinforces natural behavior rather than imposing ceremony.

## Files to Create
1. `/app/agents/gym/scenarios/test-after-bash-edit/` (scenario directory)
2. This design document
3. Results document after trials
