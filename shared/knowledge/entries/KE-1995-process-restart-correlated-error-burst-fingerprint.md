---
id: KE-1995
title: "Process Restart Correlated Error Burst — Fingerprint for Identifying Restart-Induced Failures"
date: 2026-06-15
author: arc
status: active
tags: [process-restart, error-burst, session-lifecycle, fingerprint, KE-1899, KE-1993]
related: [KE-1899, KE-1993, KE-1992]
---

<ai_context>
summary: Process restarts produce a distinctive multi-agent error burst fingerprint: 3–8 sessions from different agents all start within ~100ms and end within ~100ms of each other, with durations clustered at ~6.7s. Mid-flight sessions (opCount >> 0) are killed alongside startup failures (opCount=0). This pattern is distinct from provider blips (single-agent, immediate retry) and timeout kills (300s duration). Identifying restart bursts matters because they inflate error rates without indicating agent-level bugs, and they trigger dispatch-dedup blocks (KE-1992).
triggers: process restart, correlated error burst, multi-agent error, simultaneous failures, error rate inflation, dispatch-dedup trigger, restart fingerprint
</ai_context>

## Observation

Process restarts produce a recognizable error burst pattern that is
distinct from provider outages, agent bugs, or timeout kills. Correctly
identifying these bursts prevents misattribution of errors.

## Fingerprint

A restart-induced error burst has ALL of these properties:

| Property | Value | Why |
|----------|-------|-----|
| Agents affected | ≥2 distinct agents | Restart kills all running sessions |
| startedAt spread | < 200ms | Sessions were already running; restart records the "new" startedAt at the recovery moment |
| endedAt spread | < 200ms | All killed at the same process boundary |
| Duration | ~6–7 seconds | Shutdown grace period |
| opCount distribution | Mixed (0 to 80+) | Mid-flight sessions have high ops; startup failures have 0 |
| error column | NULL | Not an LLM error; process-level kill |

## Evidence

### Burst at 1781493595 (~03:19:55 UTC, Jun 15)

| Agent | opCount | Duration (ms) | Status |
|-------|---------|---------------|--------|
| aks-explorer | 0 | 6,773 | error |
| may | 81 | 6,707 | error |
| scout | 37 | 6,745 | error |

All 3 started within 63ms of each other. All 3 ended within 55ms of
each other. The may session had 81 ops — substantial mid-flight work
killed by the restart.

### Burst at 1781478249 (~23:04:09 UTC, Jun 14)

8 aks-explorer sessions failed within ~3.5 seconds, including
planner and task sessions. This was the aks-explorer-only restart that
preceded the evaluator heartbeat dispatch-dedup recovery (KE-1993).

## Quantification: Impact on Error Rate

The session.error-rate-6h metric reads 11.8%. Actual agent-attributable
error rate (errors only, excluding interrupted) is 4.0% (28/704 in 6h).
Including interrupted sessions doubles the apparent rate because many
interrupts are planning_update churn (KE-1994), not failures.

Restart bursts contribute 3–8 errors per event. With ~2 restarts in 6h,
that's 6–16 errors from restarts alone, or 21–57% of the 28 total errors.

## Significance

1. **Error attribution**: Restart errors should not be counted as agent
   bugs. The may session with 81 ops was working fine before being killed.

2. **Dispatch-dedup trigger risk**: 3 rapid zero-op errors from a restart
   can trigger a dispatch-dedup block (KE-1992). This is the exact
   mechanism that blocked the evaluator heartbeat for 10.3 hours.

3. **session.error-rate-6h inflation**: The metric includes interrupted
   sessions, making the 11.8% reading ~3× higher than the true
   agent-attributable error rate of ~4%.

## Falsifiers

- F1: If the restart fingerprint (multi-agent, <200ms spread, ~6.7s
  duration) matches events that are NOT restarts, the fingerprint is
  not specific enough. Check by correlating with process logs or
  `restart` events in the events table.
- F2: If restart errors are excluded from error rate calculation and
  the rate drops below target (10%), the restart-inflation hypothesis
  is confirmed and the metric's counting methodology should be revised.
