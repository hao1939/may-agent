# EXP-056: C2.3 Timeout Sensitivity — Confirm Budget Gap Hypothesis

**Sprint**: 20
**Status**: IN PROGRESS
**Parent**: EXP-055b
**Date**: 2026-04-07

## Question
Does the baseline agent consistently pass C2.3 (verify-after-edit) at 7-minute timeout?

## Background
- EXP-055 (5min): Baseline passes 0/3 C2.3 but 3/3 product → 10/11
- EXP-055b (7min): Baseline passes 1/1 C2.3 AND 3/3 product → 11/11
- N=1 is insufficient. Need N=5 to confirm.

## Hypothesis (H-087)
C2.3 failure is purely budget-driven. With 7-minute timeout, the baseline agent will pass C2.3 at ≥80% rate (4/5 or better).

## Protocol
- Scenario: `read-before-edit` (stock, no modifications)
- Agent: `coder` (stock, no lab forks)
- Timeout: 7 minutes (`--timeout 7`)
- Runs: 5
- Record per run: total score, C2.3 pass/fail, product checks (3 bugs), duration

## Success Criteria
- If ≥4/5 pass C2.3: CONFIRMED — budget gap. Recommend timeout increase.
- If 2-3/5 pass C2.3: PARTIAL — budget is a factor but not the whole story.
- If ≤1/5 pass C2.3: REJECTED — EXP-055b result was a fluke.

## Combined Evidence (including EXP-055b BL1)
Total N will be 6 (1 from EXP-055b + 5 new). Report combined pass rate.
