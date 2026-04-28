# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777361787273_0
- **Status:** done
- **When:** 2026-04-28T07:37:44.435Z
- **Duration:** 1m17s

## What Happened
S002 has weighted_score=80 exactly, gets 'C' because `getLetterGrade` uses `score > 80` (strict greater than) instead of `score >= 80`. This is a threshold/boundary issue, not strictly an ordering bug. But the ordering issue is:

S002's hw3 has 3 late days. The penalty recalculates from `score/max_score` in `penalties.js` (ignoring the `pct` from normalization), producing `adjusted_pct=80`. Then `homework.js` uses `adjusted_pct`. But `grades.js` uses `r.pct` (pre-penalty) for exams. The sequencing issue is that **the penalty output (`adjusted_pct`) is not consumed by `computeFinalGrades` for exam scores**.
