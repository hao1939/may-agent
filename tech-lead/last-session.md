# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777345779080_0
- **Status:** done
- **When:** 2026-04-28T03:10:53.759Z
- **Duration:** 1m14s

## What Happened
Now let me check the `getLetterGrade` function — it uses `score > threshold` which means exactly 80 gets a C, not B. That's likely a `>=` issue but that's not an ordering bug.

Let me focus on the two ordering issues:

1. **Policy says penalties on RAW scores before normalization**, but pipeline does normalize→penalize (and penalties recalculate from raw anyway, ignoring `pct`)
2. **`grades.js` uses `r.pct` for exams instead of `r.adjusted_pct`** — penalty adjustments on exams are lost
