# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776405990948_0
- **Status:** done
- **When:** 2026-04-17T06:07:39.491Z
- **Duration:** 1m8s

## What Happened
Now I have enough info. The bug is in `getLetterGrade` — it uses `score > threshold` (strict) instead of `score >= threshold`. S002's weighted score is exactly 80, so `80 > 80` is false, giving C instead of B.
