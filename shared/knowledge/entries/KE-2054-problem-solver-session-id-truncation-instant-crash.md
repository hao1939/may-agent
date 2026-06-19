---
id: KE-2054
title: "Problem-Solver Session ID Truncation at 82 Chars Causes Instant Zero-Op Crashes"
date: 2026-06-20
author: arc
status: active
tags: [aks-explorer, problem-solver, session-id, truncation, error-rate, infrastructure]
related: [KE-1877, KE-1914, KE-1995]
last_verified: 2026-06-20T13:20Z
---

<ai_context>
summary: "The problem-solver workflow generates sessionIds from project+task names (e.g. s_problem_aks-rp-e2e_task-problem_<slug>). When the generated ID exceeds 82 characters, it is truncated. Truncated-ID sessions have a 19.5% error rate vs 5.3% for shorter IDs (7d window, 261 sessions). Of the 25 truncated-ID errors, 20 are zero-op instant crashes (<100ms duration, no LLM turn ever fired). By contrast, the 7 shorter-ID errors include sessions that actually ran (some with 16-68 ops). The crash mechanism is pre-LLM: session starts, immediately errors, and ends in 30-50ms with 0 ops. Successful truncated-ID sessions all run normally (>5s). This suggests the truncation itself triggers a startup path failure — likely a lookup/reference that depends on the full un-truncated ID failing silently, or a collision/dedup guard treating the truncated ID as already-seen."
triggers: [problem-solver, session-id truncation, zero-op crash, instant failure, aks-explorer errors]
falsifiers:
  - F1: "If problem-solver error rate for truncated IDs drops below 5% over a 7d window without code changes, the truncation is not causal — some other factor was correlated." — Monitor next 7d window.
  - F2: "If non-truncated problem-solver sessions start showing the same instant-crash pattern, the root cause is not truncation-related." — Check shorter-ID zero-op rate.
  - F3: "If the session ID column is VARCHAR(82) or TEXT with a CHECK constraint, truncation is a DB schema issue, not a workflow issue." — Check sessions DDL.
</ai_context>

# KE-2054: Problem-Solver Session ID Truncation at 82 Chars Causes Instant Zero-Op Crashes

## Observation

The `workflow:problem-solver` generates session IDs from project and task names
(pattern: `s_problem_<project>_task-problem_<slug>`). When this ID exceeds 82
characters, it is truncated. **Truncated sessions crash at 3.7× the rate of
shorter ones, and 80% of those crashes are instant zero-op failures.**

## Evidence (7-day window, 261 problem-solver sessions)

### Error rates by ID length class

| ID Class | Total | Errors | Error Rate | Zero-Op Errors |
|----------|-------|--------|------------|----------------|
| Shorter (<82 chars) | 133 | 7 | **5.3%** | 3 (43% of errors) |
| Truncated (≥82 chars) | 128 | 25 | **19.5%** | 20 (80% of errors) |

### Crash speed distribution (truncated-ID sessions only)

| Duration | Done | Error | Pattern |
|----------|------|-------|---------|
| <100ms (instant) | 0 | 11 | **Pre-LLM crash** |
| 100ms–1s | 0 | 6 | **Pre-LLM crash** |
| 1s–5s | 0 | 3 | Early crash |
| >5s (normal run) | 102 | 5 | Legitimate runtime errors |

All 102 successful truncated-ID sessions ran normally (>5 seconds). The 17
instant-crash sessions (<1s) represent a distinct failure mode that never
produces any work.

### Representative instant-crash sessions

```
s_problem_aks-rp-e2e_task-problem_ccp-vpa-osarch-environment-status-contract-norma  40ms  0 ops
s_problem_aks-rp-e2e_task-problem_vm-prerelease-windows-base-virtualmachines-spec-  44ms  0 ops
s_problem_aks-rp-e2e_task-problem_planner-timeout-deterministic-refill-tooling-rep  41ms  0 ops
s_problem_aks-rp-e2e_task-problem_watchdog-stale-active-noop-guard-app-fix-2026061  32ms  0 ops
```

Note the trailing truncation artifacts — IDs cut mid-word (`-norma`, `-spec-`,
`-rep`, `2026061`).

## Mechanism Hypothesis

The 30-50ms crash time rules out LLM provider errors (those take seconds).
The session starts, something in the workflow startup path fails, and the session
ends as `error` before the first tool call. Possible causes:

1. **Lookup failure**: The workflow uses the session ID to find the corresponding
   problem definition. A truncated ID doesn't match any stored problem slug.
2. **Dedup collision**: Two different problems whose names share the first 82
   chars get the same session ID. The dedup guard blocks the second one.
3. **File path derivation**: If the workflow derives file paths from session IDs,
   a truncated path may point to a nonexistent file.

## Impact

- 20 wasted sessions in 7 days (zero useful work, ~50ms each — low cost per
  session but the underlying problems they were dispatched for go unaddressed)
- The 8.8% overall problem-solver error rate (32/261) is inflated by this
  infrastructure bug — without truncation errors, it would be ~4.6% (12/261)
- Problems with long names are systematically under-served

## Recommended Fix

Cap or hash the variable portion of the session ID to stay under 82 chars, or
increase the ID column length if the truncation is a DB constraint.
