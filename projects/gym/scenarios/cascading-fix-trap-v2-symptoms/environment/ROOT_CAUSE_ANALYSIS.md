# Investigation Notes

## Observed Failures

Tests fail because computed homework averages and weighted final scores don't
match expected values.

Tracing the data flow in `run()` (src/pipeline.js):

- Line ~57: `normalize(validated)` — converts raw scores to percentages. A score
  of 42/50 becomes 84.0%. This runs as Step 3.
- Line ~59: `applyPenalties(normalized)` — deducts late penalties from the
  already-converted percentage values. A 2-day late penalty (10%) on the 84.0%
  value deducts 8.4 percentage points.
- Line ~62: `aggregateHomework(penalized)` — averages the penalized percentages.
  The resulting averages don't match what the tests expect.

The test expectations assume different intermediate values at each stage. The
penalty deduction amounts seem to depend on whether penalties are computed against
raw scores or percentage values — for max_score=100 assignments the result is the
same, but for other max_score values the deductions differ.
