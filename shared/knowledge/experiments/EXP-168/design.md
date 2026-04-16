# EXP-168: F1 Dose-Response — Partial Hints

**Date**: 2026-04-16
**Status**: Running
**Scenario**: cascading-fix-trap-v2 (0% baseline, 100% with full F1)

## Research Question
How much expert information is needed for F1 (expert analysis injection) to be effective?

## Hypothesis
There's a minimum threshold of specificity needed. Vague nudges won't help (agents already explore); moderate hints that identify the problem but not the fix may partially help; full analysis reliably solves it.

## Arms
| Arm | Variant | Hint Level | N | Source |
|-----|---------|-----------|---|--------|
| 1 | baseline | None | 16 | EXP-165 (reuse) |
| 2 | nudge | Vague attention direction | 10 | New |
| 3 | moderate-hint | Problem identified, no fix | 10 | New |
| 4 | f1 (full) | Complete root cause + fix | 15 | EXP-165 (reuse) |

## Hint Content

**Arm 2 (nudge)**: "The documented architecture may not be optimal for this codebase. Consider whether the current processing order is actually correct before diving into individual fixes."

**Arm 3 (moderate-hint)**: "The pipeline ordering in the architecture doc is wrong — the documented flow reverses two processing stages. Additionally, there may be an off-by-one or boundary comparison issue in the grading logic."

**Arm 4 (full)**: Existing ROOT_CAUSE_ANALYSIS.md with complete analysis and fix instructions.

## Method
- Create scenario variants cascading-fix-trap-v2-nudge and cascading-fix-trap-v2-moderate-hint
- Run 10 trials each via gym-batch.sh
- Compare pass rates across 4 dose levels
- Statistical test: Fisher's exact test for pairwise comparisons

## Expected Outcomes
- Arm 1: ~0% (established)
- Arm 2: 0-20% (vague hint unlikely to overcome recognition bottleneck)
- Arm 3: 30-70% (knows what's wrong but must figure out fix)
- Arm 4: ~100% (established)
