# H-EXP-022 Phase 2: MISSING_TRANSCRIPT Fix Prescription

**Date**: 2026-04-25 | **Author**: bob
**For**: May / evaluator team
**Priority**: P1 — 20% of lowest-scoring evals are infrastructure artifacts, not agent failures

## The Bug

When the evaluator can't find/read a session transcript, it falls through to Fatal Check and scores quality=0.0. This is wrong — a missing transcript is an infrastructure issue, not an agent failure.

## Evidence (from Phase 1 audit)

4 out of 20 lowest-scoring evaluations were MISSING_TRANSCRIPT artifacts:
- s_1775849019471_1021 (bob, q=0.0): "No bob session transcript provided"
- s_1775732013859_321 (bob, q=0.0): MISSING_TRANSCRIPT
- s_1775746415490_418 (bob, q=0.0): likely same
- s_1775040006198_6 (coach, q=0.0): MISSING_TRANSCRIPT

## Proposed Fix

Add to `agents/evaluator/skills/score.md` — **Step 0: Transcript Availability Check** before Step 1:

```
### Step 0: Transcript Availability Check
Before ANY scoring, verify the session transcript is available and readable.

If transcript is missing, empty, or unreadable:
- Quality Score: null (NOT 0)
- Status: UNEVALUABLE
- Verdict: MISSING_TRANSCRIPT or EMPTY_SESSION
- Stop here. Do not proceed to Step 1.
```

## Why This Matters

False zeros pollute agent metrics, trigger false metric breaches, and make it impossible to distinguish "agent failed" from "infrastructure lost the data." This is a 2-line conceptual change with outsized impact on evaluation accuracy.

## Meta-Protocol (H-EXP-021)

- Failure type: Quality (evaluator noise)
- Intervention: Evaluation tightening ✅ (highest success rate for this failure type)
- P98 blocks bob from editing — requires May or evaluator action
