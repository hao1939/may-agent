# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776360939186_0
- **Status:** done
- **When:** 2026-04-16T17:36:48.315Z
- **Duration:** 1m9s

## What Happened
Now I see the issue. After penalties, `penalties.js` recalculates `adjusted_pct` from raw score/max_score and updates `score`, but the `pct` field (set by normalizer) is NOT updated. Then `grades.js` reads `r.pct` for exams — which is the pre-penalty pct. But homework uses `adjusted_pct` correctly.

Wait, but the test says S002 weighted score passes ✓. So the weighted score is correct but the letter grade is wrong. That means the only bug is `>` vs `>=` in `getLetterGrade`.

All 4 failures are a
