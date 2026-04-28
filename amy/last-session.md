# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1777361529409_0
- **Status:** done
- **When:** 2026-04-28T07:33:00.099Z
- **Duration:** 50s

## What Happened
The issue is in `getLetterGrade`: it uses `score > threshold` (strict greater than) instead of `score >= threshold`. S002 has exactly 80.0, which should be a "B" (threshold 80) but `80 > 80` is false, so they get "C".

But wait — the task asks specifically about **ordering/sequencing** bugs. Let me also check the policy comment vs actual behavior.

The policy comment says "Applied to the RAW score before normalization" but the pipeline applies penalties AFTER normalization (step 3 then step 4). And `applyLatePenalty` recalculates from `score/max_score` rather than using the `pct` field from normalization. This is a documentation inconsistency but the code works correctly for the test expectations.

The real bug causing test failures is the `>` vs `>=` in grade thresholds — that's not an ordering bug per se, but I should note it. Let me focus on what's actually a sequencing issue.
