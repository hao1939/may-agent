# EXP-810 Phase 1 Readiness Report

**Date**: 2029-08-04
**Status**: READY FOR BASELINE — scenario built and validated

## Scenario Validation

### Files Created/Fixed
- `agents/gym/scenarios/test-after-bash-edit/task.md` — created (was missing, caused runner error)
- `agents/gym/scenarios/test-after-bash-edit/environment/` — populated via setup.sh
- `agents/gym/scenarios/test-after-bash-edit/success_criteria.js` — rewritten as CLI script (was module export, incompatible with gym runner)

### Criteria Dry-Run (Unmodified Environment)
```
node success_criteria.js environment/ → 0/5 checks passed
- email-validation-works: false (no email validation in validator.js yet)
- tests-executed: false (no transcript)
- tests-run-after-final-edit: false (no transcript)
- multiple-test-runs: false (no transcript)
- all-tests-pass: false (2 email tests fail on unmodified code)
```

All 5 checks correctly fail on unmodified environment — criteria are functional.

### Gym Runner Integration
- Runner requires `GYM_AGENT_BIN` environment variable to execute real agents
- Without it, scenario runs in "stub mode" (scores unmodified environment)
- **Blocker**: No agent binary available in current environment
- **To run**: Set `GYM_AGENT_BIN=/path/to/may-agent` or use `--adapter claude-code`

## Checks Explained

| Check | Type | What It Measures |
|-------|------|-----------------|
| `email-validation-works` | Functional | Agent correctly implements email validation |
| `tests-executed` | Behavioral | Agent runs `npm test` or `node test/` at least once |
| `tests-run-after-final-edit` | Behavioral | Test run occurs after the last file modification |
| `multiple-test-runs` | Behavioral | Agent runs tests ≥2 times (ideally after each edit) |
| `all-tests-pass` | Functional | All 8 tests pass in final state |

## Prediction

Based on KE-800 (agents use bash 90%+) and general agent behavior:
- `email-validation-works`: ~80% (simple task)
- `tests-executed`: ~60% (task says "run npm test", but agents often skip)
- `tests-run-after-final-edit`: ~50% 
- `multiple-test-runs`: ~30% (agents rarely run tests between individual edits)
- `all-tests-pass`: ~70% (conditional on correct implementation)

Expected baseline: 2-3/5 checks (~50%)

## Next Steps
1. Run 3 baseline trials when agent binary is available
2. If baseline ≤60% on behavioral checks → proceed to Phase 2 (prompt nudge treatment)
3. If baseline >80% → CEILING, close experiment

## Context: Why This Matters

This is the natural successor to the verify-after-edit (VAE) line of experiments:
- EXP-575 closed VAE as unmeasurable (agents use bash, not edit())
- EXP-800 confirmed agents bypass edit() entirely
- EXP-810 reframes verification as **test execution** — instrumentally valuable behavior
- If a prompt nudge works here (unlike for VAE ceremony), it would validate KE-715's finding that concrete, rational instructions CAN work as text

## Experiment Pipeline Status

| Experiment | Status | Blocker |
|-----------|--------|---------|
| EXP-810 | READY | Agent binary needed for trials |
| EXP-745 Phase 3 | READY | Agent binary needed for gym validation |
| EXP-740 | DESIGNED | Tech-lead implementation |
| EXP-735 | DESIGNED | Tech-lead implementation |
| EXP-725 | DESIGNED | Tech-lead implementation |
