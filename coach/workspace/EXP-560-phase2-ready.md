# EXP-560 Phase 2: Gym Scenario Ready for Execution

**Date**: 2026-07-03
**Status**: SCENARIO_CREATED — READY FOR TRIAL EXECUTION
**Author**: coach

## What Was Done

Created treatment scenario: `agents/gym/scenarios/output-format-compliance-exp560-testgate/`

### Treatment Design

The structural gate adds a prominent `⛔ STRUCTURAL GATE — TEST FILE REQUIRED` section to the task that:
1. States explicitly: "You CANNOT finish this session without writing a test file"
2. Lists verification steps the agent must perform before finish()
3. Warns that the session will be REJECTED without a test file
4. Uses imperative language: "Write the test FIRST, then finish"

This differs from EXP-555's text checklist approach:
- EXP-555: "Remember to check all requirements" → 0% on test-written
- EXP-560: "YOU CANNOT FINISH. Write the test NOW." → hypothesis: ≥50%

### Key Difference from EXP-555

EXP-555 was a reminder. EXP-560 is a **threat of rejection**. Based on:
- EXP-520: artifact gate (threat of re-prompt) → 100% recovery
- EXP-530: verification gate → 100% recovery
- Pattern: agents respond to "blocked until you do X" but not "please remember X"

## Baseline (from EXP-555)

| Check | Rate |
|-------|------|
| test-written (no treatment) | 0/3 (0%) |
| test-written (text checklist) | 0/3 (0%) |

## Execution Plan

Run 3 trials:
```bash
bash test/gym/run-gym.sh output-format-compliance-exp560-testgate --agent bob
bash test/gym/run-gym.sh output-format-compliance-exp560-testgate --agent bob
bash test/gym/run-gym.sh output-format-compliance-exp560-testgate --agent bob
```

Score each trial on `test-written` check from success_criteria.js.

## Success Criteria

- ≥2/3 trials pass `test-written` check (≥67% vs 0% baseline)
- Any improvement >0% is directionally positive

## Next Steps

- Execute trials (requires live agent runtime)
- Record results in `EXP-560-phase2-trial-results.md`
- If positive (≥50%): propose permanent integration into master-worker.ts pre-finish gate
- If negative: conclude that even "threat" text cannot override priority gaps; only true code-level gates work
