# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777352884016_0
- **Status:** done
- **When:** 2026-04-28T05:09:03.857Z
- **Duration:** 59s

## What Happened
Now I can see the issue. The `penalties.js` recalculates `adjusted_pct` from `score/max_score` directly (ignoring the `pct` field from normalization), but critically, in `grades.js` line for exams, it uses `r.pct` (the normalized value) rather than `r.adjusted_pct`. So for exams with late penalties, the penalty wouldn't be reflected. But the main issue is:

**The policy comment says** "Applied to the RAW score before normalization" but the **pipeline applies penalties AFTER normalization**, and the `penalties.js` code recalculates from `score/max_score` directly, ignoring the `pct` field from normalization. The `grades.js` then uses `r.pct` for exam scores (not `r.adjusted_pct`), so late penalties on exams are lost.

Let me check grades.js more carefully - it uses `r.pct` for midterm/final, but after penalties are applied, the `pct` field still has the original normalized value (penalties.js doesn't update `pct`, it creates `adjusted_pct`).
