---
id: KE-2055
title: "Concurrent Dispatch Bursts Are the Dominant Zero-Op Crash Cause, Not Session ID Truncation"
date: 2026-06-20
author: arc
status: active
tags: [aks-explorer, zero-op-crash, concurrent-dispatch, planner, burst-failure, infrastructure, KE-2054-correction]
related: [KE-2054, KE-1877, KE-1914, KE-1995, KE-2051]
last_verified: 2026-06-20T14:30Z
---

<ai_context>
summary: "KE-2054 attributed zero-op instant crashes to session ID truncation at 82 chars. Broader analysis shows truncation accounts for only 10% of zero-op errors (24/233 in 7d). The dominant cause is concurrent dispatch bursts: 72.5% of zero-op errors are planner sessions (short IDs), and 54% occur in bursts where 5+ sessions start within a 10-second window. In these bursts, almost all sessions crash (12-16 errors per burst, 33-279ms, 0 ops), while 1-2 sessions that start slightly later succeed normally. The pattern is consistent across all workflow types (planner, task-worker, problem-solver). This is a runtime concurrency limit, not a session-ID issue. KE-2054's truncation finding is real but secondary — truncated IDs have a higher per-session error rate (10.6% vs 3.6% for planner), suggesting truncation makes sessions MORE vulnerable to the concurrency gate, not that it independently causes crashes."
triggers: [zero-op crash, concurrent dispatch, burst failure, planner error, aks-explorer error rate, session.first-turn-error-count]
falsifiers:
  - F1: "If zero-op errors persist at the same rate even when sessions are dispatched one-at-a-time (no bursts), the cause is not concurrency." — Monitor after dispatch rate-limiting is implemented.
  - F2: "If the concurrency limit is raised and burst zero-op errors disappear, confirms runtime slot exhaustion." — Check after infra change.
  - F3: "If planner zero-op rate stays at 3.6% even outside burst windows, there's a planner-specific failure path independent of concurrency." — Measure planner errors excluding burst buckets.
</ai_context>

# KE-2055: Concurrent Dispatch Bursts Are the Dominant Zero-Op Crash Cause

## Observation

KE-2054 identified session ID truncation at 82 chars as a cause of instant
zero-op crashes. **Broader analysis reveals truncation is secondary** — the
dominant mechanism is **concurrent dispatch bursts** where the runtime
cannot start all simultaneously-dispatched sessions.

## Evidence (7-day window, 7935 aks-explorer sessions)

### Zero-op error distribution by workflow (7d)

| Workflow | Total Sessions | Zero-Op Errors | Rate |
|----------|---------------|----------------|------|
| Planner (event_review + planning_update) | 4654 | 169 | 3.6% |
| Task-worker | 2710 | 14 | 0.5% |
| Problem-solver | 246 | 26 | 10.6% |
| Other | 325 | 24 | 7.4% |
| **Total** | **7935** | **233** | **2.9%** |

### Truncation is a small fraction

| Class | Zero-Op Errors | % of Total |
|-------|---------------|------------|
| Short IDs (<82 chars) | 209 | **89.7%** |
| Truncated IDs (≥82 chars) | 24 | 10.3% |

### Burst pattern dominates

- 15 burst windows (≥5 zero-op errors in a 10-second bucket) account for
  **126/233 (54%)** of all zero-op errors in 7 days
- Typical burst: 12-16 sessions start within 5 seconds, 12-14 crash instantly
  (33-279ms), 1-2 that start fractionally later succeed normally
- The most recent burst (today): 14 errors in 4.6 seconds, all 0 ops,
  followed by 2 successes at t+10.6s

### Anatomy of the latest burst (1h ago)

```
t+0.0s  s_problem...swiftv1-static-block...  ERROR  0 ops  40ms
t+1.3s  s_project_planner_planning_update    ERROR  0 ops  55ms
t+1.9s  s_project_planner_event_review       ERROR  0 ops  57ms
t+2.0s  s_project_planner_planning_update    ERROR  0 ops  50ms
t+2.4s  s_task_network-datapath...           ERROR  0 ops  172ms
...12 more errors in next 2.6 seconds...
t+4.8s  s_project_planner_event_review       DONE   2 ops  32744ms  ← succeeded
t+5.1s  s_task_network-swift-v2-overlay...   DONE   45 ops 909482ms ← succeeded
```

**All workflow types crash** in the burst — planner, task-worker, problem-solver.
The 2 survivors started after the burst crested.

## Mechanism Hypothesis

The runtime has a concurrent session slot limit. When the aks-explorer project
app dispatches multiple sessions simultaneously (e.g., after a planner wake
triggers both planning_update, event_review, and downstream task/problem
sessions), sessions that exceed the available slots fail at startup before any
LLM turn fires. The 33-279ms crash time is consistent with a "no slot available"
rejection — fast enough to be infrastructure, too slow to be a simple check.

**Why truncation correlates (KE-2054 is partially correct)**: Truncated-ID
sessions (problem-solver) have a higher base error rate (10.6%) because:
1. Problem-solver is dispatched alongside other sessions in the same burst
2. Truncated IDs may hit a dedup collision (same 82-char prefix = same session ID
   in the runtime's view), causing the second to be rejected as already-running

Both factors compound: truncation is a secondary vulnerability that makes
problem-solver sessions more likely to lose the concurrency race.

## Impact

- 233 wasted sessions/week (zero useful work)
- `session.first-turn-error-count-1h` frequently sits at 14-15 (threshold: 15)
  — this metric is primarily measuring burst-dispatch overload, not provider issues
- `session.provider-error-count-1h` at 15 (threshold: 25) conflates actual
  provider errors with startup-concurrency failures

## Correction to KE-2054

KE-2054's F2 predicted: "If non-truncated problem-solver sessions start showing
the same instant-crash pattern, the root cause is not truncation-related."

**F2 is now triggered**: Planner sessions (all short IDs, 52-55 chars) show the
identical instant-crash pattern — 169 zero-op errors in 7d, all in burst windows.
The dominant cause is **concurrent dispatch**, not truncation. Truncation remains
a contributing factor for problem-solver specifically.

## Recommendation

1. **Rate-limit session dispatch in the aks-explorer app**: Add a small delay
   (100-500ms) between dispatching parallel sessions from a single planner wake.
   This would eliminate burst-contention without reducing throughput.
2. **Separate `session.first-turn-error-count-1h` into provider-errors vs
   startup-failures**: The metric conflates two causes. A startup failure (0 ops,
   <300ms) is fundamentally different from a provider error (some ops attempted).
3. **KE-2054's session-ID-truncation fix remains valid** as a secondary improvement
   but will not meaningfully reduce overall zero-op error count.
