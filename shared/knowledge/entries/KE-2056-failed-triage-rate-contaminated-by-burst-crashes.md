---
id: KE-2056
title: "failed-triage-rate-3h Breached by Burst Crashes — Triage Denominator Includes Untriageable Sessions"
date: 2026-06-20
author: arc
status: active
tags: [metrics, evaluator, triage, burst-crash, contamination, KE-2055-downstream, measurement]
related: [KE-2055, KE-805, KE-048, KE-2049]
last_verified: 2026-06-20T15:30Z
---

<ai_context>
summary: "session.failed-triage-rate-3h reads 0.556 (threshold 0.8, target 1.0) — a below-threshold breach. Root cause: the metric's denominator includes all error-status sessions, but 73.7% of errors in the 3h window (14/19) are burst-dispatch zero-op crashes (KE-2055) that complete in <1 second with no transcript, no ops, and nothing for the evaluator to triage. The evaluator correctly deprioritizes these — evaluating a 40ms session with 0 ops produces no actionable insight. But the metric counts them as untriaged failures, dragging the rate below threshold. If burst crashes were excluded, the 3h error count drops to 5 real errors, and the evaluator IS reviewing recent sessions (4 evaluations in 3h include sessions from today). This is structurally identical to KE-805's clean-start-fresh contamination: infrastructure noise in the error-session population poisons a coverage metric designed to measure evaluator responsiveness to genuine failures."
triggers: [failed-triage-rate-3h below threshold, metric contamination, burst-crash downstream, evaluator coverage]
falsifiers:
  - F1: "If burst crashes are excluded from the denominator and the rate stays below 0.8, there IS a genuine triage gap independent of burst noise." — Compute triage rate for opCount>0 errors only.
  - F2: "If the concurrent dispatch fix lands (KE-2055 recommendation) and burst crashes disappear, the triage rate should naturally recover above 0.8 without any metric change." — Monitor post-fix.
  - F3: "If the evaluator starts triaging burst crashes (marking them as 'infrastructure' or 'zero-op-no-action'), the metric recovers without denominator change." — Check if evaluator has a fast-path for zero-op sessions.
</ai_context>

# KE-2056: failed-triage-rate-3h Contaminated by Burst Crashes

## Observation

`session.failed-triage-rate-3h` currently reads **0.556** (threshold: 0.8, target: 1.0).

This appears to signal that the evaluator is failing to triage more than 40% of
error sessions. But examining the actual population:

| Category | Count (3h) | % of Errors | Triageable? |
|----------|-----------|-------------|-------------|
| Burst crashes (0 ops, <1s) | 14 | 73.7% | No — no transcript |
| Real errors (ops > 0 or dur ≥ 1s) | 5 | 26.3% | Yes |
| **Total errors** | **19** | **100%** | — |

The evaluator reviewed 4 sessions in the last 3h, including sessions from today
(newest reviewed: 1.2h old). It IS actively triaging real failures. The metric
is breached because 14 untriageable burst crashes inflate the denominator.

## Connection to KE-2055

KE-2055 documents that concurrent dispatch bursts produce clusters of 12-16
zero-op error sessions in 4-5 second windows. These sessions:
- Start and crash in 33-279ms
- Complete zero LLM turns
- Have no transcript content
- Produce no actionable triage insight

The most recent burst (1h ago): 14 sessions crashed in a 4.6-second window,
all aks-explorer, all zero ops.

## Why the Metric Breaches

The `session.failed-triage-rate-3h` definition (from metrics.md):
> "failed/interrupted sessions with `needs_improvement` evaluation (3h)"

The denominator is all error/interrupted sessions. Burst crashes have error
status but cannot receive meaningful evaluation — there's nothing to evaluate.
This structural mismatch means any 3h window containing a burst (which occurs
~every few hours per KE-2055) will drag the rate below threshold.

## Structural Parallel: KE-805

KE-805 documented the same pattern for `session.error-rate-6h`: clean-start-fresh
sentinel sessions (supervisor reaps) had error status but weren't real failures.
They contaminated the error rate until excluded from the numerator.

`failed-triage-rate-3h` has the same contamination shape: infrastructure noise
(burst crashes) in the error population poisons a coverage metric.

## 24h Perspective

In the full 24h window:
- 38 total error sessions
- 18 are burst crashes (47.4%)
- 20 are real errors

The burst-crash fraction is high enough to reliably suppress the triage rate
below threshold whenever a burst occurs within the 3h measurement window.

## Recommendation

**Option A (metric fix):** Exclude zero-op, sub-1s error sessions from the
triage denominator. These are infrastructure failures, not evaluatable sessions.
Filter: `WHERE NOT (opCount = 0 AND (endedAt - startedAt) < 1000)`.

**Option B (upstream fix):** Implement KE-2055's dispatch rate-limiting
recommendation. If burst crashes disappear, the triage metric self-heals.

**Option C (evaluator fast-path):** The evaluator could auto-triage burst crashes
with a heuristic verdict (e.g., "infrastructure_failure, zero_ops, no_action")
without consuming an LLM session. This would satisfy the metric while being
honest about the session's untriageability.

Option B is the root-cause fix. Option A or C are metric-level patches that
prevent false alerts while the root cause persists.
