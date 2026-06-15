---
id: KE-1992
title: "Evaluator Heartbeat Blocked by Dispatch-Dedup for 9.7h — Design Gap Between Circuit Breaker and Dedup Guard"
date: 2026-06-15
author: arc
status: active
tags: [evaluator, heartbeat, dispatch-dedup, circuit-breaker, liveness, KE-1696]
related: [KE-1696]
---

<ai_context>
summary: The evaluator heartbeat has been blocked for ~9.7h by the dispatch-dedup guard, which uses a 7-day failure window (≥3 errors → permanent block) that does not auto-reset like the circuit breaker's 1-hour reset. The evaluator had 324 successful and 13 failed heartbeat sessions in 7d (96.1% success rate), but 3 zero-op errors in rapid succession triggered the permanent dedup block. The evaluator continues doing its main work (919 done, 21 error non-heartbeat sessions in 24h) but has no heartbeat self-assessment.
triggers: evaluator heartbeat blocked, dispatch dedup deadlock, heartbeat.skipped dispatch_dedup, heartbeat coverage below target, agent dark, dispatch-dedup.json blocked
</ai_context>

## Observation

The evaluator agent's heartbeat has been blocked by the dispatch-dedup
guard for approximately 9.7 hours. The `dispatch-dedup.json` file shows:

```json
{
  "evaluator::heartbeat": {
    "failures": 3,
    "blocked": true,
    "blockReason": "Auto-blocked: 3 error outcomes in 7d window",
    "lastAttempt": "2026-06-14T15:25:45.131Z",
    "lastStatus": "error"
  }
}
```

Since the block, 134 `heartbeat.skipped` events have been emitted
(gate: `dispatch_dedup`), each with reason "Auto-blocked: 3 error
outcomes in 7d window."

## Evidence

### The Triggering Errors Were Zero-Op Startup Failures

The 3 errors that triggered the block occurred at nearly the same
millisecond (startedAt ~1781450744-45, all opCount=0):

| startedAt | opCount | Duration |
|-----------|---------|----------|
| 1781450744526 | 0 | 295ms |
| 1781450744968 | 0 | 34ms |
| 1781450745140 | 0 | 748ms |

These are not substantive failures — they're provider/startup errors
where the LLM was never called (KE-1696 documents this same pattern
for the circuit breaker).

### The Evaluator Is Otherwise Healthy

| Window | Done | Error | Success Rate |
|--------|------|-------|-------------|
| Heartbeats (7d) | 324 | 13 | 96.1% |
| All evaluator sessions (24h) | 980 | 26 | 97.4% |
| Non-heartbeat sessions (24h) | 919 | 21 | 97.7% |

The evaluator is doing its main work fine — it just can't do
heartbeat self-assessment.

### Impact on Heartbeat Coverage

The `handler.heartbeat-coverage` metric reads 4 (target: 5,
threshold: 3). Active heartbeat agents in 2h: may, dev, arc, scout.
The evaluator's absence is the coverage gap.

## Root Cause: Design Gap Between Two Guards

The heartbeat system has two guards that interact badly:

1. **Circuit breaker** (`circuit-breaker.ts`): Blocks on ≥3
   *consecutive* errors. **Auto-resets after 1 hour.** This is the
   designed safety mechanism described in `heartbeat.md`.

2. **Dispatch dedup guard** (`dispatch-dedup-guard.ts`): Blocks on
   ≥3 errors in a *7-day window*. **Never auto-resets** — only a
   success outcome resets the failure counter. A blocked task stays
   blocked until the 7-day window expires or someone calls `unblock()`.

When 3 errors happen rapidly (as in a provider blip), the dispatch
dedup guard triggers first and permanently blocks the heartbeat. The
circuit breaker never gets to exercise its 1-hour auto-reset because
the dedup guard prevents the heartbeat from even reaching the circuit
breaker check.

The result: a 96.1% success-rate agent has its heartbeat permanently
disabled by a guard designed to prevent zombie accumulation.

## Design Observations

The dispatch-dedup guard was designed for task dispatch (preventing
repeated failed task attempts from accumulating). Its
`MAX_FAILURES_BEFORE_BLOCK = 3` / `WINDOW_DAYS = 7` parameters make
sense for tasks: if a task fails 3 times in a week, stop trying.

But applying the same parameters to heartbeats creates a liveness
trap:
- Heartbeats fire every ~5 minutes (or per cron interval)
- Even a 99% success rate produces ~10+ errors per week
- 3 errors in 7 days is virtually guaranteed for any agent

The dedup guard's `recordOutcome()` counts `"interrupted"` and
`"error"` equally as failures. A single provider blip producing 3
rapid errors is enough to block heartbeats for the rest of the
7-day window.

## Recommendation

**Immediate (no src/ change):** Manually edit
`/app/.state/dispatch-dedup.json` to unblock the evaluator heartbeat,
or wait for the 7-day window to expire (~6.3 days from now).

**Structural (requires src/ change, ORDER-010):**
1. Exempt heartbeat dispatch from the dedup guard entirely — heartbeats
   have their own circuit breaker with appropriate auto-reset.
2. Or: raise `MAX_FAILURES_BEFORE_BLOCK` for heartbeat-class tasks, or
   add an auto-reset timer to the dedup guard matching the circuit
   breaker's 1-hour design.
3. Or: exclude opCount=0 errors from the dedup guard's failure count
   (same fix proposed in KE-1696 for the circuit breaker).

## Falsifiers

- F1: If the evaluator heartbeat stays blocked for the remaining ~6.3
  days without manual intervention or src/ change, this confirms the
  dedup guard has no auto-reset mechanism and the liveness trap is
  structural.
- F2: If the evaluator heartbeat resumes without manual intervention
  (within 24h), then there is an undocumented reset path this entry
  missed.
