# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776363985596_0
- **Status:** done
- **When:** 2026-04-16T18:27:44.328Z
- **Duration:** 1m18s

## What Happened
Found it. The bug is in `getLetterGrade` in `src/grades.js`: uses `score > threshold` (strict) but should use `score >= threshold`. S002's weighted score is exactly 80, which needs `>=` to get B.
