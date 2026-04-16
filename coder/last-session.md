# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776361991744_0
- **Status:** done
- **When:** 2026-04-16T17:54:44.967Z
- **Duration:** 1m33s

## What Happened
Now I see the full picture. The penalties module recalculates pct from raw scores (ignoring that normalize already set `pct`), and doesn't update the `pct` field. But `grades.js` uses `r.pct` for exams. Since penalties recalculates from raw `score/max_score`, and normalize already did this... actually for non-late records, `adjusted_pct` equals `pct`. For late records, `adjusted_pct` has the penalty but `pct` doesn't. So exams with late days would be affected, but no exams have late days in the 
