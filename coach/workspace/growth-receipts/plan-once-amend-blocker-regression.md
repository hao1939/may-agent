# Growth Cycle: plan-once-amend handles-blocker-efficiently Regression

**Date**: 2026-04-09  
**Agent**: Coder  
**Scenario**: `plan-once-amend`  
**Failing Check**: `handles-blocker-efficiently`  
**Coach Session**: s_1775699744552_101

## Summary

The `handles-blocker-efficiently` regression is **resolved**. 4/4 gym runs now pass 8/8.  
Root cause: the skill update on April 7 (commit `ecaf6923`) added explicit "at most 2 attempts for missing files" guidance to `structured-plan-writing.md`, directly addressing the failure pattern.

## Timeline

| Date | Event | Score |
|------|-------|-------|
| 2026-04-03 | EXP-019: skill-injection tested, 2/2 treatment at 8/8 | 8/8 |
| 2026-04-03 | Skill promoted to `agents/coder/skills/structured-plan-writing.md` | — |
| ~2026-04-05 | EXP-024: Regression check → fails handles-blocker-efficiently | 7/8 |
| 2026-04-07 | Commit `ecaf6923`: skill updated with "Critical rule for missing files" | — |
| 2026-04-09 | This investigation: 4/4 runs pass 8/8 | 8/8 |

## Root Cause Analysis

### The Original Regression (EXP-024)
The `handles-blocker-efficiently` check counts tool calls where the path/command contains "health-check" — max 3 allowed. The scenario environment deliberately omits `src/health-check.ts`. An efficient agent discovers it's missing (1-2 ops), marks the step BLOCKED, and pivots to other tasks (alerting, errors, runbook).

**Before the April 7 update**, the skill's RISK section said:
```
Risk: File might not exist at expected path → search with grep/find
```
This open-ended guidance ("search with grep/find") didn't bound the search effort. The agent would try read → grep → find → find with different args → etc., exceeding the 3-op limit.

### The Fix (April 7, ecaf6923)
The skill was updated with three targeted changes:

1. **Example tightened**: `→ ONE quick search (find/ls), then mark BLOCKED if not found`
2. **Explicit rule added**: "Critical rule for missing files: at most 2 attempts (one read, one search). If still not found, mark the step BLOCKED and move on. Do NOT keep searching."
3. **Rationale bounded**: "search until found is worse than try once, then pivot"

These changes directly address the failure mode: the agent now has a concrete upper bound on missing-file searches.

### Why The Fix Works
This is consistent with KE-065 findings on skill effectiveness:
- **Skills with concrete examples and bounded protocols** show ~33% effectiveness (per KE-059)
- The original skill had unbounded guidance ("search with grep/find") — no clear stopping criterion
- The updated skill has a bounded protocol ("at most 2 attempts → BLOCKED") — clear stopping criterion
- The improvement from ~33% → higher rate suggests bounded protocols with explicit numbers work better than open-ended advice

## Verification Evidence

### Run 1: 8/8 ✅
All checks passed including `handles-blocker-efficiently`.

### Run 2: 8/8 ✅
All checks passed including `handles-blocker-efficiently`.

### Run 3: 8/8 ✅
All checks passed including `handles-blocker-efficiently`.

### Run 4: 8/8 ✅
All checks passed including `handles-blocker-efficiently`.

**Pass rate**: 4/4 (100%) vs the reported regression rate of consistent 7/8.

## Conclusion

**Status: RESOLVED — No action needed.**

The regression was a real issue caused by unbounded search guidance in the skill file. It was fixed by the April 7 skill update that added explicit bounds ("at most 2 attempts"). The current 4/4 pass rate confirms the fix is stable.

### Key Insight
When writing skills for behavioral checks, **bounded protocols** (specific numbers, explicit stopping criteria) outperform **unbounded guidance** (general advice to "search" or "try"). The difference between "search with grep/find" and "at most 2 attempts then BLOCKED" is the difference between 7/8 and 8/8.

## Follow-Up Recommendations

1. **Update experiments log**: Mark the plan-once-amend regression as resolved in any tracking docs.
2. **Knowledge entry candidate**: The "bounded vs unbounded protocol" insight could strengthen KE-065.
3. **No skill changes needed**: Current skill is working correctly.
