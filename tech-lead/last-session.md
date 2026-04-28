# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777345705520_0
- **Status:** done
- **When:** 2026-04-28T03:09:32.310Z
- **Duration:** 1m6s

## What Happened
Now I have the full picture. The key issue: `computeFinalGrades` uses `r.pct` for exam scores (line from normalizer, pre-penalty), but for students with late exams this would matter. More importantly, `penalties.js` recalculates `adjusted_pct` from `score/max_score * 100` instead of using the `pct` field from normalization. And the policy comment says penalty should be applied to RAW score BEFORE normalization, but the pipeline does normalization first.

Let me check the grade calculation for S002:

S002 hw3: 95/100, 3 days late → penalty 15%, adjusted_pct = 80%. But `penalties.js` computes `rawPct = score/max_score * 100` ignoring the `pct` field from normalization (they happen to be the same formula, so this is redundant but not buggy).

The real issue: `computeFinalGrades` uses `r.pct` for exams (not `r.adjusted_pct`). But exams have 0 late days so that's fine here.

Let me trace S002's grade: hw_avg after drop lowest = drop hw1(80), keep hw2(88), hw3(80 after penalty), hw4(87) → avg = (88+80+87)/3 = 85. midterm=72, final=80. Weighted = 85*0.4 + 72*0.25 + 80*0.35 = 34+18+28 = 80. That's exactly on the B/C boundary. With `score > threshold`, 80 > 80 is false, so it gets C not B.

The issue is `getLetterGrade` uses `>` instead of `>=`. But that's not an ordering issue.

Wait - the policy says "Applied to the RAW score before normalization" but the pipeline applies penalties AFTER normalization. That's the ordering bug.
