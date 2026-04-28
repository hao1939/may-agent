# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777346019795_0
- **Status:** done
- **When:** 2026-04-28T03:14:57.289Z
- **Duration:** 1m17s

## What Happened
S002 gets weighted 80.00 exactly, and `score > 80` is false, so they get C instead of B. The `grade_scale` threshold check uses strict `>` — a score of exactly 80 should earn a B (standard grading: >= 80), but `getLetterGrade` uses `>`.

Also S002's homework: hw3 has 95 with 3 late days → 95 - 15 = 80 adjusted. So scores are 80, 88, 80, 87. Drop lowest (80), keep 88, 80, 87 → avg = 85. That's correct.

The issue is the `>=` vs `>` in grade thresholds — but that's not an ordering/sequencing issue. Let me re-check if there's actually a sequencing issue causing S002's grade.

Wait — the `pct` field. In `computeFinalGrades`, for exams it reads `r.pct`. The `pct` was set by `normalize()`. Then `applyPenalties()` updates `score` but does NOT update `pct`. So `r.pct` for exams still reflects the original pre-penalty percentage. But no exams have late days, so that doesn't affect current results.

The actual failing test is about the threshold comparison (`>` vs `>=`), which isn't a sequencing issue. But let me check if there IS a sequencing issue that's more subtle.

Actually, re-reading the task: the policy comment says penalties should be applied to RAW scores BEFORE normalization, but the pipeline does normalization first then penalties. The `penalties.js` code ignores `pct` and recomputes from raw `score/max_score` — so it works despite the ordering. But `pct` becomes stale after penalties. Then `computeFinalGrades` uses `r.pct` for exams — which is the PRE-penalty value. If an exam had late days, the penalty would be ignored for final grade computation. That's a sequencing/ordering bug: the `pct` field computed in step 3 is not updated after step 4.
