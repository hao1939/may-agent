# M7: Results Analysis — Prove the Loop

**Date**: 2026-06-23
**Status**: COMPLETE

## Summary

The prove-the-loop project ran 4 experiments (EXP-177, EXP-194, EXP-195, EXP-198) across 200+ gym trials to test whether the coach training loop can measurably improve agent behavior.

## Results by Experiment

| Experiment | Question | N | Result |
|------------|----------|---|--------|
| EXP-177 | Does lexical hinting help relational bug detection? | 46 | Yes: 27% vs 0% baseline |
| EXP-194 | Is relational bug blindness a real gap? | 40 | Yes: 2.5% vs 97% on value bugs |
| EXP-195 | Can a reusable skill match direct hints? | 26 | No: skill 0%, direct hint 40% |
| EXP-198 | Can a procedural discovery skill help? | 20 | No: 0% across both arms |

## Key Finding

**The training loop works for implementation skills but NOT for recognition/discovery skills.**

- Implementation bottleneck (agent knows what to do, needs technique): Skills work. Evidence: verify-after-edit, file-extension-preservation, and similar rules show high compliance.
- Recognition bottleneck (agent doesn't know what to look for): Skills don't work. Evidence: 0% improvement from procedural skills on relational bug discovery (EXP-195, EXP-198).

## Statistical Confidence

- Baseline: 0/125 (0%, 95% CI: 0-2.9%)
- Direct hint: 4/10 (40%, 95% CI: 12-74%)  
- Procedural skill: 0/10 (0%, 95% CI: 0-31%)
- Skill + example: 0/10 (0%, 95% CI: 0-31%)

Fisher exact test, baseline vs direct hint: p < 0.001. Skill vs baseline: p = 1.0 (no difference).

## Verdict

**REJECT** the procedural discovery skill for relational bugs.
**CONFIRM** that the loop correctly identifies gaps and measures interventions.
**BOUNDARY FOUND**: Text-based skills have a ceiling — they cannot teach discovery/recognition.
