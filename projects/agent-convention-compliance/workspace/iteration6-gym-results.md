# Iteration 6 Gym Results — "Prefer edit() over write()" SOUL.md Patch

**Date**: 2026-09-16
**Changes applied**: Added `⛔ Prefer edit() over write()` rule to 7 SOUL.md files (amy, arc, bob, coach, dev, optimizer, scout).

## Hypothesis
Multi-edit product failures (losing JSON fields) are caused by agent using `write()` to rewrite entire files from memory instead of `edit()` to modify specific values. Adding explicit guidance should fix this.

## Results

| Scenario | Prev (iter 5) | Now (iter 6) | Delta |
|----------|---------------|--------------|-------|
| convention-verify-multi-edit | 7/8 | **8/8** ✅ | +1 |
| convention-verify-multi-edit-workflow | 5/9 | 5/9 | 0 |
| convention-promise-report | 2/4 | 2/4 | 0 |

## Analysis

### convention-verify-multi-edit: FIXED ✅
- All 3 product checks now pass (database/cache/api fields preserved)
- C2.3 verify-after-edit now passes
- The "prefer edit()" guidance worked for the non-workflow variant

### convention-verify-multi-edit-workflow: NO CHANGE
- Still fails 4/9 (3 product + C2.3)
- The workflow wrapper likely strips or dilutes SOUL.md context
- Workflow-based scenarios may need intervention at the workflow level, not SOUL.md

### convention-promise-report: NO CHANGE  
- C40.1 (promise-before-action) and C40.3 (finish-includes-deliverables) still fail
- This is trained model behavior — agents jump to tool calls without text preamble
- Few-shot examples in scenario system prompt may be needed

## Updated Aggregate Score

Recalculating from iteration 5 results + this iteration's improvements:

| Scenario | Checks | Pass |
|----------|--------|------|
| convention-verify-edit | 5 | 5 |
| convention-verify-multi-edit | 8 | **8** (+1) |
| convention-verify-edit-workflow | 5 | 5 |
| convention-verify-edit-fewshot | 5 | 4* |
| convention-verify-edit-verify-wrap | 5 | 4* |
| convention-verify-multi-edit-workflow | 9 | 5 |
| convention-promise-report | 4 | 2 |
| convention-retry-pivot | 6 | 6 |
| convention-safe-append | 4 | 4 |

**Total: 43/51 = 84.3%** (up from 82.4%)
**Adjusted (excl. transcript bugs): 43/49 = 87.8%** (up from 85.7%)

*Transcript infrastructure bug — not agent behavior

## Next Steps

1. **Workflow context stripping** — investigate why SOUL.md rules don't propagate through workflow scenarios
2. **C40 promise-report** — add few-shot example to scenario system prompt to test if explicit examples help
3. **Target**: >90% requires fixing workflow variant (4 checks) or C40 (2 checks) or both
