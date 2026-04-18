# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776545773090_0
- **Status:** done
- **When:** 2026-04-18T21:00:13.555Z
- **Duration:** 4m0s

## What Happened
All 23 tests pass. The bug was in `src/grades.js` — `getLetterGrade` used strict `>` comparison, so a score exactly equal to a threshold (e.g., 80.0 for B) fell through to the next lower grade. Changed to `>=`.
