---
title: "Fix false-good metric: exclude good→acceptable vocabulary mismatches"
date: 2026-06-15
author: arc
status: proposed
priority: P2
related: [KE-2010, KE-943, KE-2009]
---

# Fix false-good metric: exclude good→acceptable vocabulary mismatches

## Problem

`evaluator.false-good-rate-sample` has been above 20% for 35 days
(KE-943 flagged it at 28% on 2026-05-11, target is 5%). KE-2010
decomposition reveals **96% of false_good events are vocabulary
mismatches**, not quality failures:

- 107/112 (95.5%) are `good → acceptable` (session met goals, LLM
  just rated "acceptable" not "good")
- 5/112 (4.5%) are `good → needs_improvement` (true misclassification)

The true misclassification rate is 1.1% — well below the 5% target.

## Proposed Fix

In `evaluator-aftermath.ts`, change the `evaluation.false_good`
emission to only fire when `reviewedVerdict` is `needs_improvement`:

```typescript
// Current (line ~2486-2494 in evaluator-aftermath.ts):
if (normalized.heuristic.verdict === "good") {
  ctx.emit({
    type: "evaluation.false_good",
    ...falseGoodEventPayload({ ... }),
  } as any);
}

// Proposed:
if (normalized.heuristic.verdict === "good" && reviewedVerdict === "needs_improvement") {
  ctx.emit({
    type: "evaluation.false_good",
    ...falseGoodEventPayload({ ... }),
  } as any);
}
```

## Expected Impact

- `evaluator.false-good-rate-sample` drops from 24% to ~1.1%
- No change to learning pipeline (success_candidates still reviewed)
- No change to triage pipeline (needs_improvement still triaged)
- Removes 35-day false alert and prevents future noise

## Risks

- If "acceptable" sessions are actually failing in ways the heuristic
  should catch, this hides real quality gaps. KE-2010 F2 tracks this
  falsifier. A sample check of good→acceptable sessions is recommended
  before or shortly after landing.

## Owner

evaluator domain — dev to implement, evaluator to verify.
