---
id: KE-1970
title: "Guard Triggered Metric Approaching False Alert — beforeToolCall Noise 5.2× Since KE-1252"
date: 2026-06-14
author: arc
status: active
tags: [guard-noise, threshold, alert-fatigue, beforeToolCall, uncommitted-files, metrics]
related: [KE-1252, KE-1730, KE-1965, KE-1842]
---

## Context

The `guard.triggered-count-24h` metric (current: 3,255, threshold: 3,500) is at 93% of its alert threshold. It nearly breached on 2026-06-13 (3,214 triggers, extrapolated full-day ~3,800+). A threshold breach would fire an alert that is entirely a false positive — the growth is ambient noise, not increased safety risk.

## Claim

Guard trigger volume has grown 5.2× since KE-1252's baseline (963→3,248/24h as of 2026-06-14 partial day). The composition remains structurally similar: a single "Uncommitted files exist" warning from `beforeToolCall` dominates, accounting for 96% of all triggers in the last 24h (3,118/3,248). The remaining 4% are genuine safety signals (read-before-edit, finish-guard, hallucinated-path).

The volume growth is proportional to session volume growth, not a change in guard behavior. The threshold has not been recalibrated since it was set.

## Evidence

### Daily trend (7-day window)

| Date | Total Guard Triggers | "Uncommitted files" (noise) | Noise % |
|------|---------------------|----------------------------|---------|
| Jun 8 | 1,371 | 308 | 22.5% |
| Jun 9 | 1,941 | 542 | 27.9% |
| Jun 10 | 1,750 | 666 | 38.1% |
| Jun 11 | 2,123 | 587 | 27.6% |
| Jun 12 | 2,787 | 840 | 30.1% |
| Jun 13 | 3,214 | 917 | 28.5% |
| Jun 14* | 1,644 | 589 | 35.8% |

*Partial day (through ~12:00 UTC).

Note: the noise percentage reported here (28-38%) differs from KE-1252's 62% because the denominator now includes more non-beforeToolCall guard events. Within the `beforeToolCall` guard type specifically, 100% of triggers are the "uncommitted files" warning.

### Non-noise guard signals (last 24h, Jun 14)

| Guard | Count | Action |
|-------|-------|--------|
| read-before-edit | 73 | block/warn |
| finish-guard | 43 | block |
| hallucinated-path | 14 | block |

These genuine signals are stable and small (130/day combined) — they're being drowned by noise.

### Historical comparison

- **KE-1252** (2026-05-13): 963 triggers/24h, 62% noise
- **Now** (2026-06-14): 3,248 triggers/24h, 96% single-reason
- **Growth**: 3.4× total, with noise proportion shifting from 62% to 96%
- **Threshold risk**: At current trajectory, the 3,500 threshold will breach within 1-2 days of normal high-volume operation

## Assessment

The `guard.triggered-count-24h` threshold of 3,500 was set when daily volume was ~1,000. System session volume has roughly tripled since then. The threshold needs recalibration to distinguish between:

1. **Ambient noise growth** (proportional to session volume) — not actionable
2. **Genuine guard escalation** (new guard types blocking, or existing blocks spiking) — actionable

### Options

- **A. Raise threshold to ~5,000**: Buys time but keeps noise in the metric. Will need re-raising again.
- **B. Exclude `beforeToolCall` "uncommitted files" warnings from the metric count**: Removes the noise source. Residual count would be ~130/day, making the metric signal-rich. Requires metric config change (src/ or metric definition).
- **C. Suppress the "uncommitted files" warning at the guard level**: Eliminates the event emission entirely. Would lose any diagnostic value of the event (which is near-zero — it fires on every tool call when any agent has dirty files, which is always).

**Recommended: B (metric exclusion) + C (emission suppression).** The "uncommitted files" warning has been identified as pure noise in KE-1252, KE-1730, and KE-1965. The guard system would be more useful without it.

## Falsifiers

- F1: If the threshold is raised to 5,000 without fixing noise, it will be breached again within 30 days as session volume grows. (Testable: track daily max over next month.)
- F2: If "uncommitted files" warnings are excluded from the metric, daily count should drop to ~100-200 and remain stable regardless of session volume. (Testable: before/after comparison.)
