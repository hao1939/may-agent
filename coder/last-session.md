# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776546565539_0
- **Status:** done
- **When:** 2026-04-18T21:10:25.711Z
- **Duration:** 1m0s

## What Happened
All 23 tests pass. The bug was in `getLetterGrade` in `src/grades.js`: it used `score > threshold` which excluded scores exactly at a threshold (e.g., 80.0 would fall through B to C). Changed to `score >= threshold`.
