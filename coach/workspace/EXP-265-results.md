# EXP-265 Results: Compound Verification Skill

**Date**: 2026-07-01
**Status**: CLOSED — No effect. Both arms 0%.

## Results

| Arm | Scenario | Runs | Pass Rate |
|-----|----------|------|-----------|
| A (baseline) | partial-verification-trap | 3 (+7 historical) | 0/10 (0%) |
| B (treatment) | partial-verification-trap-compound | 3 | 0/3 (0%) |

## Analysis

The "preserve-before-fix" text skill had **zero effect** — consistent with KE-002 (text skills achieve ~0% behavior change).

However, the deeper issue is that **both arms fail on product checks**, not behavioral ones:
- `bug-fixed`: FALSE in all runs
- `existing-tests-pass`: FALSE in all runs  
- `ran-tests`: TRUE (agent does run tests)

The agent runs the test suite (behavioral check passes) but **cannot fix the pagination bug correctly**. This is a coding competence issue, not a verification skill gap. The scenario is too hard for the current agent — it's bottlenecked on implementation ability, not on verification behavior.

## Decision

**REJECT** the preserve-before-fix skill. Text injection doesn't work (reconfirmed). The scenario needs a difficulty recalibration — it's at floor (0%) for both arms, providing no signal for behavioral interventions.

## Implications

1. Scenarios at 0% baseline are useless for measuring skill interventions — need scenarios in the 20-60% range
2. This reconfirms KE-002: 14th experiment showing text-only skills don't change behavior
3. For partial-verification-trap to be useful, need to first ensure agents can solve the base task
