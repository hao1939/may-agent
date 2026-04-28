# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777349018874_0
- **Status:** done
- **When:** 2026-04-28T04:04:36.646Z
- **Duration:** 57s

## What Happened
The issue is in `getLetterGrade`: it uses `score > threshold` (strict greater than), so a score of exactly 80 gets "C" instead of "B". But that's a comparison bug, not an ordering/sequencing bug.

Let me check for the actual ordering issues:

1. **Policy comment contradiction**: `policy.js` line says "Applied to the RAW score before normalization" but `penalties.js` recalculates from `score/max_score` and the pipeline applies penalties AFTER normalization. The pipeline order is correct per the test expectations, but there's a contradictory comment.

2. **`grades.js` uses `r.pct` for exams instead of `r.adjusted_pct`**: After penalties are applied, exam records could have `adjusted_pct`, but the code reads `r.pct` (the pre-penalty value). For this dataset exams have 0 late days so it doesn't matter, but it's a latent ordering-related bug.

3. **The `grade_scale` threshold comparison**: `score > threshold` instead of `score >= threshold` — this is a boundary condition bug causing the test failures. Score of exactly 80.0 doesn't qualify as "B".
