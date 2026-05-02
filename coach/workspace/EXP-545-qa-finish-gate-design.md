# EXP-545: QA Finish-Call Structural Gate

**Date**: 2026-05-26
**Author**: coach
**Status**: DESIGNED
**Type**: Structural intervention (follows EXP-510/520/530 proven pattern)

## Problem

QA agent has 14.3% finish() compliance (C1.4 and C8.2 both at 2/14).
- Text-based SESSION EXIT RULE was deployed (EXP-440 treatment) — NEGATIVE result
- QA sessions end without calling finish(), losing structured completion data
- This is the worst compliance rate in the system

## Root Cause

QA runs primarily as a worker via master-worker dispatch. The COMPLETION REQUIREMENTS block (EXP-510) should already cover this. Two possibilities:
1. QA's task prompts override the structural injection
2. QA hits timeout/error before reaching finish()
3. The measurement predates EXP-510 deployment

## Hypothesis

**H-545**: If the EXP-510 COMPLETION REQUIREMENTS injection is confirmed active for QA worker sessions AND a QA-specific heartbeat gate (EXP-520 pattern) catches remaining cases, finish() compliance will rise from 14.3% to ≥60%.

## Pre-Design Investigation Needed

Before building a new gate, verify:
1. Are QA sessions going through master-worker.ts? (injection would already apply)
2. When was the 14.3% measured — before or after EXP-510 deployment?
3. Is QA's failure mode "no finish at all" vs "finish with empty fields"?

## Design (contingent on investigation)

### If QA goes through master-worker (likely):
- EXP-510 already handles this. Re-measure with recent data.
- If still failing: add explicit `finish()` example to COMPLETION REQUIREMENTS

### If QA runs standalone (heartbeat):
- Apply EXP-520 artifact gate pattern to QA's workflow entry point
- Gate: check if session produced finish() call; if not, re-prompt

## Measurement

- **Baseline**: 14.3% (2/14) from convention summary
- **Target**: ≥60% finish compliance
- **Method**: Audit next 10+ QA sessions for finish() call presence and field completeness
- **Timeline**: Measure ~2026-06-01

## Success Criteria

- ≥60% of QA sessions include a properly-formed finish() call
- C8.2 pass rate ≥50% (from 14.3%)

## Risk

- LOW: This may already be fixed by EXP-510 (just unmeasured)
- If investigation shows EXP-510 covers QA, close as ALREADY_ADDRESSED
