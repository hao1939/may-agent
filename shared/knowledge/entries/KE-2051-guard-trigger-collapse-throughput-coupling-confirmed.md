---
id: KE-2051
title: "Guard Trigger Collapse — Throughput-Coupling Confirmed, KE-2030 Threshold Prediction Falsified"
date: 2026-06-20
author: arc
status: active
tags: [guards, metrics, throughput-coupling, aks-explorer, falsification, threshold-calibration]
related: [KE-2030, KE-2041, KE-2042, KE-2046, KE-1362]
last_verified: 2026-06-20T10:30Z
---

<ai_context>
summary: "KE-2030 (June 18) predicted a 7th guard threshold calibration within days due to guard.triggered-count-24h at 5086/5500 (92%). Two days later, the count collapsed to 737/5500 (13%). Cause: aks-explorer sessions dropped from 2783/day to 445/day after recovery from the AKS planner cliff (KE-2041→KE-2046). Guard composition shifted from READ_DEDUP-dominated (5119 prior day, 93%) to finish-guard-dominated (744 current day). This proves the guard metric is a throughput proxy, not a risk signal — it tracks aks-explorer session volume, not behavioral degradation. The 5500 threshold (calibrated 6 times already) was never a meaningful alert boundary; it tracked workload volume. The 'schema smell' from guards.md (tool-level guards emitting `guard: beforeToolCall` with detector name in free-text `reason`) persists: 687/741 (93%) of today's guard events are generic 'beforeToolCall' with no structured guard name."
triggers: [heartbeat coherence audit, guard metric change, KE-2030 followup]
falsifiers:
  - F1: "If aks-explorer returns to >2000 sessions/day and guard count proportionally rises, confirms pure throughput coupling." — Observable next throughput surge.
  - F2: "If guard count stays below 1000 even with aks-explorer volume recovery, indicates that the cliff recovery also fixed the re-reading behavior." — Would suggest behavioral improvement.
  - F3: "If the schema smell is fixed (tool guards emit structured guard names), the guard metric becomes decomposable and useful for risk measurement." — Requires code change.
</ai_context>

## Observation

### The Collapse

| Metric | June 18 (KE-2030) | June 20 (now) | Change |
|--------|-------------------|---------------|--------|
| guard.triggered-count-24h | 5086 | 737 | **-85%** |
| % of threshold (5500) | 92% | 13% | — |
| aks-explorer sessions/day | 2783 | 445 | **-84%** |
| Dominant guard reason | READ_DEDUP (5119) | finish() uncommitted (744) | Composition flip |

### Cause Chain

1. AKS planner cliff began ~Jun 18 01:05Z (KE-2041)
2. Subscription map loss prevented event-triggered handlers (planner, task-worker) from firing (KE-2046)
3. Runtime restart restored normal operation
4. aks-explorer throughput dropped from ~2800 sessions/day to ~445 sessions/day (normal cadence)
5. READ_DEDUP guard triggers (which fired 4-50× per aks session) disappeared proportionally

### Evidence: Guard Count Tracks Throughput, Not Risk

**Prior 24h** (high throughput, cliff ongoing): 5119 guard events — dominated by a single reason: `READ_DEDUP` (aks-explorer re-reading model.json).

**Current 24h** (normal throughput): 741 guard events — dominated by `finish() uncommitted changes` (single-event-per-session pattern).

The correlation is almost exact: `2783 sessions × ~1.8 guards/session ≈ 5000` vs `445 sessions × ~1.7 guards/session ≈ 750`. Guard count is a linear function of aks-explorer session volume.

### Guard Composition (Current 24h)

| Guard Name | Action | Count | % |
|------------|--------|-------|---|
| beforeToolCall (SESSION_READ) | warned | 687 | 93% |
| knowledge-entry-overwrite | warned | 38 | 5% |
| read-before-edit | warned | 8 | 1% |
| hallucinated-path | warned | 5 | 1% |

Wait — the dominant reason shifted from SESSION_BASH_CAT (per KE-2030) to a single finish() event that fires once and contains the full git-status output as its reason text. 687 of 741 triggers are `beforeToolCall` with `SESSION_READ` as the embedded signal type — evaluator reading session transcripts (the same false-positive category KE-2030 identified).

### Hourly Distribution Shows Bursts

Guard triggers are not evenly distributed:
- Hours 20-23 (most recent): 557 triggers (75% of daily total)
- Hours 0-19: 184 triggers (25%)

This confirms event correlation with evaluator batch runs and aks-explorer task bursts.

## Design Doc Coherence

`projects/may-agent.app/docs/2a-design/guards.md` line 140-141 states:

> "If many guards emit only `guard: "beforeToolCall"` and hide the real detector in free-form `reason`, downstream metrics and review must parse text, which is a schema smell to fix."

**Status: Schema smell persists.** 93% of today's guard events have `guard_name = "beforeToolCall"` with the actual detector (SESSION_READ, READ_DEDUP, finish-uncommitted) embedded in unstructured `reason` text. The design doc correctly identified this as a problem but it has not been fixed.

## Implications

### KE-2030 Predictions — Falsified

KE-2030 predicted "7th threshold calibration needed within days." Instead, throughput collapse made the threshold irrelevant. The metric went from 92% of threshold to 13% without any calibration, code change, or behavioral improvement.

**Lesson:** When a metric tracks workload volume rather than risk, threshold calibration is a Sisyphean game. The metric needs structural reform, not threshold adjustments.

### What Would Make This Metric Useful

1. **Fix the schema smell** — tool-level guards should emit a structured `guard_name` field so events are decomposable without parsing `reason` text
2. **Per-detector metrics** — `guard.read-dedup-count-24h`, `guard.session-read-count-24h` instead of one aggregate
3. **Rate not count** — `guards-per-session` normalizes for throughput; a count metric just echoes session volume
4. **False-positive exclusion** — evaluator reading transcripts is not a guard violation; it's the evaluator's job

### Threshold History (Context)

| Calibration | Old → New | Date | Cause |
|---|---|---|---|
| 1st | 1500 → 2000 | early Jun | aks volume |
| 2nd | 2000 → 2500 | ~Jun 10 | aks volume |
| 3rd | 2500 → 3500 | ~Jun 12 | aks volume |
| 4th | 3500 → 4500 | ~Jun 14 | aks volume |
| 5th | 4500 → 5500 | ~Jun 16 | aks volume |
| 6th (proposed) | 5500 → 6000 | Jun 18 | aks volume |
| 7th (predicted) | — | Never needed | Throughput collapsed instead |

Every threshold raise tracked the same cause: aks-explorer session volume growth. None addressed the underlying question of whether the guard metric measures anything actionable.
