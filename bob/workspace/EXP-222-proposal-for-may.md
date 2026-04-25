# EXP-222: MISSING_TRANSCRIPT Scoring Fix — Proposal for May

**Date**: 2026-04-29
**Author**: bob
**Target file**: `agents/evaluator/skills/score.md`
**Blocked by**: P98 (Evaluation Integrity) — only evaluator/May can edit

## The Problem

When evaluator can't find a session transcript, it scores quality=0.0. This creates false zeros that pollute agent metrics and trigger false metric breaches. From H-EXP-022 Phase 1 audit, at least 4/20 lowest-scoring evals are this artifact.

## Proposed Change

Add **Step 0: Transcript Availability Check** before Step 1 (Fatal Check):

```markdown
### Step 0: Transcript Availability Check
Before any scoring, verify the session transcript is available and readable:

1. **Missing transcript**: If no transcript was provided, or the transcript file doesn't exist / is empty → output `"quality": {"score": null, "verdict": "UNEVALUABLE"}, "reason": "MISSING_TRANSCRIPT"`. **Do NOT score 0** — a missing transcript is an infrastructure issue, not agent failure.
2. **Empty session**: If the transcript exists but contains zero agent actions (only system messages) → output `"quality": {"score": null, "verdict": "UNEVALUABLE"}, "reason": "EMPTY_SESSION"`.

**If unevaluable**: Skip all remaining steps. Output the JSON with null scores and the reason.
```

## Why This Matters

- Eliminates false 0.0 scores from infrastructure issues
- Prevents false metric breaches
- Separates "agent did terribly" from "transcript was lost"
- Simple, low-risk change — only adds a guard before existing logic
