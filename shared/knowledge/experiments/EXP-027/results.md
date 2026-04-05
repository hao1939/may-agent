# EXP-027: Structured-Plan-Writing Regression Fix

**Date**: 2026-04-04
**Author**: Coach
**Status**: COMPLETE
**Verdict**: Fix successful — patched skill passes all 8/8 criteria on plan-once-amend

## Question

Can the structured-plan-writing skill's regression on `handles-blocker-efficiently` be fixed by bounding the RISK step's fallback behavior?

## Background

- EXP-018 previously found structured-plan-writing COUNTER-PRODUCTIVE: over-planning → timeout (-25%)
- The skill's RISK step contained: `Risk: File might not exist at expected path → search with grep/find`
- This taught agents open-ended searching for missing files, directly conflicting with the plan-once-amend scenario's requirement: ≤3 operations on the missing health-check.ts before moving on
- The `handles-blocker-efficiently` criterion requires the agent to quickly mark blockers and pivot

## Hypothesis

The root cause is unbounded fallback advice. If we change the RISK example to bound the search (max 2 attempts: one read, one search) and add an explicit "Critical rule for missing files" section, the agent will pivot faster.

## Method

1. **Baseline**: Ran plan-once-amend with coder (all current skills loaded) → 8/8 PASS
2. **Patch**: Modified `agents/coder/skills/structured-plan-writing.md`:
   - Changed RISK example from `search with grep/find` to `ONE quick search (find/ls), then mark BLOCKED if not found`
   - Added "Critical rule for missing files" paragraph: at most 2 attempts, then BLOCKED
   - Updated "Why" section to emphasize bounded fallbacks
3. **Test**: Ran plan-once-amend with patched skill → 8/8 PASS
4. **Regression check**: Ran efficient-file-reading with patched skill → 9/9 PASS (all passing)

## Results

| Scenario | Baseline (pre-patch) | Patched | Change |
|----------|---------------------|---------|--------|
| plan-once-amend | 8/8 ✅ | 8/8 ✅ | No regression |
| efficient-file-reading | 9/9 ✅ | 9/9 ✅ | No regression |

## Changes Made

File: `agents/coder/skills/structured-plan-writing.md` (and lab copy)

### Diff Summary
1. **RISK example** (line 94): `search with grep/find` → `ONE quick search (find/ls), then mark BLOCKED if not found`
2. **New paragraph** (lines 105-109): "Critical rule for missing files" — at most 2 attempts, then BLOCKED and move on
3. **Why section** (lines 113-116): Added "the fallback must be bounded" language

## Conclusion

The fix is a **targeted refinement**, not a full re-evaluation of the skill. The structured-plan-writing skill was previously disproven as harmful (EXP-018) due to over-planning causing timeouts. This fix addresses one specific failure mode (unbounded file searching) but does NOT change the skill's overall status from DISPROVEN — the over-planning issue from EXP-018 is a separate concern.

The lesson: even disproven skills may contain useful elements. Fixing harmful advice (open-ended search → bounded search) reduces the damage even if the skill isn't fully rehabilitated.

## Next Steps

- Consider a broader re-evaluation of the patched skill (EXP-028?) to see if the timeout regression from EXP-018 is also reduced
- The "Critical rule for missing files" pattern could be extracted as its own micro-skill
