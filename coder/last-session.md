# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776361043856_0
- **Status:** done
- **When:** 2026-04-16T17:38:54.253Z
- **Duration:** 1m30s

## What Happened
No exams are late. So the only bug causing test failures is `>` vs `>=` in `getLetterGrade`. The policy comment says "scores must exceed the threshold" but tests expect `>=`. Let me also check if the policy comment is just documentary vs the changelog being the source of truth.

All 4 failing tests are about S002 getting C instead of B — S002's weighted score is exactly 80. The single root cause is `score > threshold` should be `score >= threshold`.

But let me also check if there's a penalties/
