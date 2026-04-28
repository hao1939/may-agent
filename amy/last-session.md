# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777352748256_0
- **Status:** done
- **When:** 2026-04-28T05:07:06.488Z
- **Duration:** 1m18s

## What Happened
Now I can see the issue. The `policy.js` comment says penalty should be "Applied to the RAW score before normalization", but `pipeline.js` applies normalization first (step 3) then penalties (step 4). Meanwhile, `penalties.js` recalculates from `record.score / record.max_score` ignoring the `pct` field from normalization. But critically, in `grades.js` line 18, it uses `r.pct` for exam scores — this is the **pre-penalty** `pct` from normalization, not `adjusted_pct`. So for S002's midterm/final (which have 0 late days), that's fine. But the real issue is that `grades.js` uses `r.pct` (the normalized percentage) for exams instead of `r.adjusted_pct`, meaning if an exam had late days, the penalty wouldn't be reflected.

But the actual failing tests are about S002's grade being C instead of B. Let me trace S002:

S002 hw3 has 3 late days → penalty = 15%. Raw pct = 95%, adjusted = 80%. 
HW scores: 80, 88, 80, 87. Drop lowest (80 from hw1 or hw3-adjusted). Sorted: 80, 80, 87, 88. Drop 1 → kept: 80, 87, 88. Avg = 85.

But wait — the `getLetterGrade` function uses `score > threshold` (strict greater than). So B requires > 80. If S002's weighted score lands at exactly 80, they'd get C instead of B. That's a threshold issue, not ordering.

Let me look more carefully at the ordering issue with `pct` vs `adjusted_pct` in `grades.js`:

The pipeline passes `penalized` records to `computeFinalGrades`. After penalties, records have both `pct` (from normalization) and `adjusted_pct` (from penalties). For exams, `grades.js` uses `r.pct` — the pre-penalty value. This is the ordering/sequencing bug: the `pct` field is set during normalization (step 3) and never updated after penalties (step 4), so `computeFinalGrades` reads stale pre-penalty data for exams.

For S002 specifically, exams have 0 late days so it doesn't matter there. The real problem might be that `grades.js` should use `adjusted_pct` for consistency across all assignments.

Wait, let me recalculate S002's grade properly:
- HW avg: drop lowest of [80, 88, 80, 87] → drop one 80 → avg(80, 87, 88) = 85
- Midterm: 72
- Final: 160/200 = 80

Weighted: 85*0.4 + 72*0.25 + 80*0.35 = 34 + 18 + 28 = 80.0

With `score > 80` for B, S002 gets C. The grade_scale uses strict `>`, so 80.0 is NOT > 80, yielding C.

But the test expects B. The issue: penalties are applied AFTER normalization, but `penalties.js` recalculates the percentage from raw scores independently. The `pct` field (set in normalization) becomes stale. If penalties were applied BEFORE normalization, then `pct` would already reflect the penalty.

The key ordering bug: normalization sets `pct`, then penalties set `adjusted_pct` but don't update `pct`. Then `grades.js` reads `pct` for exams instead of `adjusted_pct`. The correct order should be: apply penalties first (to raw scores), THEN normalize — so `pct` reflects penalized scores everywhere.
