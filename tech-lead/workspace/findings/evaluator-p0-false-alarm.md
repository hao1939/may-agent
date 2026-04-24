# Evaluator P0 False Alarm — opCount=0 is Expected

**Date:** 2026-04-24
**Status:** Dismissed — no action needed

## Summary

Multiple P0 escalations (fb142a52, 7e13d435, b535691d) report the evaluator pipeline as "broken" because 353 sessions in 6h all have opCount=0.

**This is expected behavior, not a bug.** The evaluator is a pure-reasoning agent that only uses `read`, `cite-source`, and `finish` — none of which are state-changing tools. opCount only increments for `bash`, `write`, `edit`, `commit`.

## Evidence

- Prior diagnosis: `tech-lead/workspace/archive/findings-2026-04/evaluator-zero-op-diagnosis.md`
- Historical: 5231 total evaluator sessions, avg opCount=0.71 (most of those >0 are from rare retries)
- Last 6h: 353 sessions, all opCount=0, all status=done — working correctly
- The evaluator-heartbeat handler already correctly filters `opCount > 2` when selecting candidates

## Root Cause of False Alarms

May's general health monitoring interprets opCount=0 as "agent did nothing" without an agent-specific exclusion for the evaluator. The optimizer also flagged this as "98% waste" — also a misinterpretation.

## Recommendation

Add evaluator to the exclusion list for opCount-based health alerts, similar to how `evaluator-heartbeat.ts:229` already excludes `('evaluator', 'may')` from its candidate selection.
