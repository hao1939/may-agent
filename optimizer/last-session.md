# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776594513891_10
- **Status:** done
- **When:** 2026-04-19T10:32:06.374Z
- **Duration:** 3m32s

## What Happened
Now I have the full picture. The metric is flawed — LLM evaluations overwrite heuristic evaluations via `INSERT OR REPLACE`, setting `evaluatedByHeuristic=false`, so sessions that were heuristic-evaluated AND then LLM-upgraded count against the metric. The real adoption is ~99% (only 40/3828 skipped), but the metric shows 67%.
