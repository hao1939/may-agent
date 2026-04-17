# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776406236539_0
- **Status:** done
- **When:** 2026-04-17T06:11:31.477Z
- **Duration:** 54s

## What Happened
The root cause is clear: `>` instead of `>=` in `getLetterGrade`. The CHANGELOG v3.0 says "strict comparison" but this makes scores exactly on thresholds get the wrong grade.
