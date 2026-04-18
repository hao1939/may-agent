# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776531982578_431
- **Status:** done
- **When:** 2026-04-18T17:08:11.245Z
- **Duration:** 1m48s

## What Happened
129 evaluator sessions out of 167 non-evaluator sessions = 77% sampling rate, way above target 30%. The issue: evaluation-sync runs on cron repeatedly, and each run samples 30% of the *unevaluated* batch. But since evaluator sessions themselves become "done" sessions, they could be re-evaluated... wait, `SKIP_LLM_EVAL_AGENTS` includes "evaluator" (`evaluation-sync.ts:10`). The high rate is because cron fires frequently and each run gets a fresh batch.

Now let me write the finding.
