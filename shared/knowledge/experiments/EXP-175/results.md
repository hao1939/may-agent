# EXP-175 Results: Improving Scout Analysis Quality for Two-Phase Debugging

**Date**: 2026-04-16
**Status**: CONCLUDED — null result (scenario floor effect)

## Results

| Arm | Pass Rate | N | 95% CI |
|-----|-----------|---|--------|
| A (baseline, from EXP-174) | 0% | 75 | [0%, 5%] |
| B (process skill) | 0% | 10 | [0%, 31%] |
| C (structured template) | 0% | 6 | [0%, 46%] |
| D (instruction only) | 0% | 1 | [0%, 98%] |

**All arms: 0/92 total.**

## Analysis

### Floor Effect — Scenario Is Unsolvable

The `exp172-scout-coder` / cascading-fix-trap-v2 scenario has a 0% pass rate across 92 trials spanning baseline and all three treatment arms. The failure is consistent: `pipeline-order-fixed` check fails every time.

**Root cause of scenario difficulty**: The success criteria check (`success_criteria.js`) expects `applyPenalties()` to be called BEFORE `normalize()` in the pipeline. But:
1. The code comments explicitly say "Normalization must precede penalty application"
2. The existing code already has normalize before penalties
3. The agent must figure out that the comments are WRONG and swap the order

This creates a scenario where even perfect root-cause analysis doesn't help — the agent needs to ignore misleading comments and make a counterintuitive change. The scout's analysis quality (the experiment's target variable) is irrelevant when the coder can't execute even with perfect information.

### No Discriminating Signal

Since all arms are at 0%, we cannot distinguish between any hypotheses (H-175a through H-175-null). The experiment provides no evidence for or against process skills improving scout analysis quality.

## Conclusions

1. **The scenario is unsuitable for measuring scout analysis quality interventions.** A scenario with 0% baseline cannot show improvement from any intervention.
2. **EXP-175 should be re-run on a different scenario** where the baseline is non-zero (ideally 20-40%) so interventions can show measurable lift.
3. **The cascading-fix-trap-v2 scenario needs investigation** — either the success criteria are checking the wrong thing, or the task is genuinely beyond current model capabilities regardless of prompting.

## Next Steps

- Find or create a scenario where scout→coder baseline is 10-40%
- Re-run the same three interventions (B/C/D) on that scenario
- Consider whether the success criteria for pipeline-order-fixed are correct (the check seems inverted vs the code comments)
