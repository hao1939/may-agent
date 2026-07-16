# Root Cause Analysis

The pipeline stages in `run()` (src/pipeline.js) were reordered during a recent
refactor. The original correct order was: penalize → normalize. The current broken
order is: normalize → penalize.

This means late-submission penalties are applied to already-normalized percentage
values instead of raw scores. For assignments where max_score ≠ 100, this produces
different deduction amounts, causing cascading failures in homework averages,
weighted scores, and all downstream computations.

## Fix

Swap the applyPenalties and normalize calls back to the original order:
1. applyPenalties(validated) first — apply penalties to raw scores
2. normalize(penalized) second — convert to percentages after penalties

The penalty and normalize functions themselves are correct — only the calling
order in the pipeline needs to change. Make sure downstream steps receive the
correctly-ordered data.

Do NOT modify the penalty logic, normalizer, or hack expected values.
