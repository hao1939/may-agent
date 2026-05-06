# Evaluator heartbeat — 2026-05-06

## Pipeline liveness (DB = canonical)

- sessions max(startedAt): **2026-05-06T04:50:19.470Z** (ms=1778043019470)
- evaluations max(createdAt): **2026-05-06T00:46:42.653Z** (ms=1778028402653)
- last 24h counts:
  - sessions: **1154**
  - evaluations: **27**
  - implied coverage: **2.34%**

Evidence: bun:sqlite queries captured in heartbeat transcript.

## Legacy artifact directory

`.state/evaluations/` newest visible mtimes are **Apr 29** and older; many are **Mar 24**. This appears to be *legacy output drift* rather than evaluation pipeline being dead, since DB has fresh evaluations today.

## Observations / hypotheses

1. **Coverage is very low (2.34%)** relative to session volume. This could be intended sampling, or the cron scope is too narrow.
2. **Agent distribution mismatch**: 955 sessions attributed to `evaluator` in last 24h, but evaluations only cover other agents (bob/may/optimizer/tech-lead). This suggests many `evaluator` sessions are heartbeats / internal runs and may be intentionally excluded from eval.

## Proposed next actions

- Confirm intended evaluation sampling rate / target coverage. If target is higher, widen scope or increase cron frequency.
- Locate the `evaluate-session-llm` cron / job runner config and document:
  - how it selects sessions
  - how it writes (DB only vs legacy dir)
  - expected lag and expected coverage.
