# Root Cause Analysis

The pipeline stages in `run()` (src/pipeline.js) were reordered during a recent
refactor. The original correct order was: penalize → normalize. The current broken
order is: normalize → penalize.

This means late-submission penalties are applied to already-normalized percentage
values instead of raw scores. For assignments where max_score ≠ 100, this produces
different deduction amounts, causing cascading failures in homework averages,
weighted scores, and all downstream computations.
