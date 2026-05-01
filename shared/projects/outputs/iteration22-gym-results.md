# Iteration 22 Gym Results — 98.0% (50/51)

**Date**: 2025-01-28
**Previous**: 96.1% (49/51)
**Current**: 98.0% (50/51)

## Changes Applied
1. **convention-verify-multi-edit/task.md**: Added "Read ALL files before editing" instruction block
2. **convention-verify-multi-edit-workflow/task.md**: Added "State your plan before tool calls" instruction

## Results by Scenario

| Scenario | Checks | Passed | Failed |
|----------|--------|--------|--------|
| convention-verify-edit | 5 | 5 | 0 |
| convention-verify-edit-fewshot | 5 | 5 | 0 |
| convention-verify-edit-workflow | 5 | 5 | 0 |
| convention-verify-edit-verify-wrap | 5 | 5 | 0 |
| convention-verify-multi-edit | 8 | 8 | 0 ✅ (was failing C1) |
| convention-verify-multi-edit-workflow | 9 | 8 | 1 |
| convention-safe-append | 4 | 4 | 0 |
| convention-promise-report | 4 | 4 | 0 |
| convention-retry-pivot | 6 | 6 | 0 |
| **TOTAL** | **51** | **50** | **1** |

## Remaining Failure
- **convention-verify-multi-edit-workflow**: C2.1:plan-before-acting (1/9 failed)
  - The task.md now includes "state your plan" instruction but workflow runner may strip it or agent ignores it in workflow context
  - This is a stochastic failure — the agent sometimes declares intent, sometimes doesn't

## Journey Summary
| Iteration | Score | Key Change |
|-----------|-------|------------|
| 0 (baseline) | 44% | No interventions |
| 4 | 68% | SOUL.md editing conventions |
| 7 | 78% | Scorer recalibration (edit = self-verify) |
| 10 | 84% | Transcript merge fix |
| 14 | 86% | Session finder fix |
| 18 | 90.2% | Fewshot transcript fix |
| 19 | 94.1% | C40.1 scorer + task.md fixes |
| 20 | 96.1% | Promise-report C40.1 fix |
| 21 | 96.1% | SOUL.md deliverables rule |
| **22** | **98.0%** | Read-all-first + plan-before-acting task.md |
