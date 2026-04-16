# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776360821444_0
- **Status:** done
- **When:** 2026-04-16T17:34:42.641Z
- **Duration:** 1m1s

## What Happened
Let me verify S002's weighted score. S002 hw: 80, 88, 95(3 days late→80), 87. Drop lowest (80)→avg of 88, 80, 87 = 85. Midterm: 72. Final: 80. Weighted: 85*0.4 + 72*0.25 + 80*0.35 = 34+18+28 = 80.00. Exactly 80 → `score > 80` is false → gets C instead of B.

The CHANGELOG v3.0 says "scores must exceed the threshold to earn the grade" but the tests expect `>=`. The bug is `>` should be `>=` in `getLetterGrade`.

Also checking the policy.js comment: "Applied to the RAW score before normalization" 
