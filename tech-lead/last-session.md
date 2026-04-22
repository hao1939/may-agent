# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776847325861_27
- **Status:** done
- **When:** 2026-04-22T08:42:47.821Z
- **Duration:** 41s

## What Happened
All 23 tests pass. The data flow audit confirms correctness:

1. **Normalize** adds `pct` from raw scores. **Penalties** independently recalculates from `score/max_score`, so normalize order doesn't matter.
2. **Homework aggregator** correctly uses `adjusted_pct` (post-penalty) when available.
3. **Grades** uses `r.pct` for exams — correct since exams have no late days in the data.
4. Weights match policy: 40/25/35.
