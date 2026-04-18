# Root Cause Analysis — Pipeline Ordering Bug

## The Problem

The pipeline stages in `run()` (src/pipeline.js, lines ~57-61) were reordered
during a recent refactor.

**Current (broken) order**: normalize (Step 3) → applyPenalties (Step 4)
**Original (correct) order**: applyPenalties (Step 3) → normalize (Step 4)

The CHANGELOG v3.1 says "normalization now runs before penalty application so
that penalties are deducted in percentage points." This sounds reasonable but
produces incorrect results. The test expectations were calculated assuming
penalties are applied to raw scores before normalization.

## Specific Impact

- `normalize(validated)` on line ~57: Converts raw scores to percentages first.
  A score of 85/100 becomes 85.0, but a score of 42/50 becomes 84.0.
- `applyPenalties(normalized)` on line ~59: Deducts penalty percentages from
  already-normalized values. For max_score=100 this is the same, but for
  max_score≠100 assignments, the deduction amount differs from expectations.
- `aggregateHomework(penalized)` on line ~62: Receives wrongly-penalized data,
  producing incorrect homework averages.
- `computeFinalGrades(penalized, hwAggs)`: Wrong weighted scores cascade through.

## Fix

Reorder the calls in `run()`:
```javascript
// Step 3: Apply late penalties FIRST (to raw scores)
const penalized = applyPenalties(validated);

// Step 4: THEN normalize to percentages
const normalized = normalize(penalized);
```

Then pass `normalized` (not `penalized`) to `aggregateHomework` and
`computeFinalGrades`.

The stage functions are correct — only the calling order is wrong.
Do NOT modify individual stage functions, penalty logic, or adjust expected values.
