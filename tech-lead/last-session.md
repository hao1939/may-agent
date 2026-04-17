# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776423639250_131
- **Status:** done
- **When:** 2026-04-17T11:07:01.647Z
- **Duration:** 6m22s

## What Happened
Root cause found: 220 evaluator-agent sessions accumulate unevaluated because evaluation-sync.ts explicitly excludes `agent != 'evaluator'` and never writes skip rows for them. They trigger the `unevalAutoSkippable > 150` anomaly every cycle forever. Fix: insert skip evaluations for evaluator sessions (they already have `skippedByJs` semantics).

Let me fork the fix via implement-and-verify.
