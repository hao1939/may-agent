# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776363772626_0
- **Status:** done
- **When:** 2026-04-16T18:24:46.226Z
- **Duration:** 1m53s

## What Happened
Now I have the full picture. The bugs:

1. **`getLetterGrade` uses `>` instead of `>=`**: Score of exactly 80 gets C instead of B.

2. **Pipeline order issue - penalties recalculate from raw scores, ignoring normalization**: The `applyPenalties` function computes `adjusted_pct` from `record.score / record.max_score`, which is fine since normalize doesn't change `score`. But after penalties, the `pct` field (set by normalize) is stale for penalized records. However, `grades.js` reads `r.pct` for 
