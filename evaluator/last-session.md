# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776834936771_110
- **Status:** done
- **When:** 2026-04-22T05:15:41.604Z
- **Duration:** 4s

## What Happened
WHAT_HAPPENED: May investigated repeated stuck/metric alerts by querying `.state/may.db` for breaching metrics, alert counts, and alert lifecycles, then inspected `agents/may/handlers/metrics-snapshot.ts` alert creation/dedup and recovery-resolution logic. They identified many alerts being created and resolved in the same tick (0-minute duration) and traced this to threshold/measurement behavior (metric sometimes equals the threshold, immediately triggering auto-resolve) and lack of hysteresis, plus noted remaining current breaches. They also began tracing how metric alerts generated agent forks, suspecting routing from the heartbeat-context handler.
OUTCOME: partial
STILL_OPEN: Confirm the exact cause of same-tick create+resolve (measurement timing vs resolveRecoveredAlerts criteria) and implement/adjust hysteresis or threshold policy to stop alert flapping; fix or validate the evaluator.coverage measurement (currently ~3 vs threshold 80); address may.alert-to-reaction-time breach; complete the heartbeat-context routing trace to prevent unnecessary agents.fork spam.
