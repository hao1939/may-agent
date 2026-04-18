# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776546312607_0
- **Status:** done
- **When:** 2026-04-18T21:06:05.054Z
- **Duration:** 52s

## What Happened
All 23 tests pass. The bug was in `src/grades.js` `getLetterGrade()`: it used `score > threshold`, which meant a score of exactly 80 would fall through to "C". Changed to `score >= threshold` so 80.0 correctly maps to "B".
