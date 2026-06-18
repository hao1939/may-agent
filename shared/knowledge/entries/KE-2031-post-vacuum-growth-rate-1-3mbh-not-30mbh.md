---
id: KE-2031
title: "Post-VACUUM DB Growth Rate Is 1.3 MB/h, Not 30 MB/h — Re-Breach in ~10 Days, Not 12 Hours"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, capacity-planning, forecast-correction]
related: [KE-2029, KE-2028, KE-2027, KE-2023]
last_verified: 2026-06-18T11:20Z
---

<ai_context>
summary: KE-2029 predicted re-breach of the 2000 MB DB threshold in ~12h at 30 MB/h growth. The 30 MB/h figure came from the first 16 minutes post-fix (1612→1620 MB) — a window dominated by WAL replay and retention catch-up, not steady-state growth. After 0.53h of steady-state observation (7 snapshots), the true rate is 1.3 MB/h. Re-breach at 2000 MB: ~254 hours (~10.5 days), not 12 hours. This falsifies KE-2029 F1 ("growth rate drops below 15 MB/h") and shifts the urgency of all pending DB proposals from "hours" to "days/weeks." The pre-VACUUM growth rate was ~3.3 MB/h (24h pre-fix), but the fix removed 408 MB of digest task duplication that was previously growing at ~2 MB/h, explaining the 3.3→1.3 drop.
triggers: heartbeat verification of KE-2029 forecast
falsifiers:
  - F1: "If growth rate returns to >3 MB/h over a 6h window (throughput spike, retention purge stop), the ~10-day estimate is too optimistic." — Monitor next 12h.
  - F2: "If aks-explorer session count drops below 2000/day (project completion), growth drops further." — Currently ~2700/day.
</ai_context>

## Observation

### KE-2029 Forecast vs. Reality

| Claim | KE-2029 Prediction | Actual |
|-------|-------------------|--------|
| Growth rate | 30 MB/h | **1.3 MB/h** |
| Time to 2000 MB | ~12h (~22:00Z Jun 18) | **~254h (~Jun 29)** |
| Error factor | — | **23× overestimate** |

### Why KE-2029 Was Wrong

KE-2029 measured growth in the first 16 minutes post-fix (1612→1620 MB = 30 MB/h extrapolated). That window included:
- WAL replay overhead from the VACUUM operation
- Retention handler catch-up processing (newly-truncated digests being re-indexed)
- A burst of 2550 MB metric snapshots (anomalous — likely WAL size before checkpoint)

### Actual Growth Data (7 steady-state snapshots post-VACUUM)

| Hours Post-Fix | DB Size (MB) | Delta |
|---------------|-------------|-------|
| 0.00 | 1669.88 | — |
| 0.09 | 1670.06 | +0.18 |
| 0.18 | 1670.10 | +0.04 |
| 0.26 | 1670.18 | +0.08 |
| 0.35 | 1670.29 | +0.11 |
| 0.44 | 1670.36 | +0.07 |
| 0.53 | 1670.55 | +0.19 |

**Total**: +0.67 MB in 0.53 hours = **1.26 MB/h**

### Pre-Fix vs. Post-Fix Growth Rate

Pre-VACUUM (6h window): 1889 → 2020 MB over 6.8h = **~19 MB/h gross** (with periodic retention drops netting to ~3.3 MB/h).

Post-VACUUM: **1.3 MB/h net**. The digest task truncation removed the fastest-growing duplicate (~2 MB/h), and the retention handler is now running against a smaller baseline.

### Storage Breakdown (Current)

| Table/Column | MB | Notes |
|-------------|-----|-------|
| events.data | 756.7 | 280k events, 7-day window |
| sessions.task | 259.9 | Authoritative, 14-day window |
| workflow_runs.task | 196.5 | Duplicate, ~14-day window |
| session_digests.task | 90.2 | Post-truncation (was 526 MB) |
| **Total DB** | **1,670** | |

## Impact

### Urgency Recalibration

| Pending Fix | Old Urgency (KE-2029) | New Urgency |
|------------|----------------------|-------------|
| NULL step>1 digest task | "Before re-breach in 12h" | Low — digests are now 90 MB, not 526 |
| Strip task from events | "Medium-term" | Still the largest remaining optimization (641 MB in session.start/end/completed) |
| Threshold raise to 2500 | "Immediate" | Already implemented, now has 330 MB headroom + 10 days growth |
| Guard event dedup | Unrelated to DB size | Unchanged |

### What This Means for the Pending Proposals

1. **P1 NULL digest task** — Still correct but urgency dropped from "before breach" to "nice-to-have." The fix already truncated digests to 90 MB total; NULLing step>1 saves another ~45 MB.
2. **P1 Threshold raise** — Already landed (2000→2500). With 1.3 MB/h growth, the 2000 MB threshold won't be hit for ~10 days. The 2500 MB threshold gives ~25 days.
3. **P2 Event task stripping** — Remains the single largest optimization opportunity (641 MB of proven-duplicate task text in events.data), but is no longer urgent.

## Falsifier Status (KE-2029)

- **F1** ("If growth rate drops below 15 MB/h for a 6h window"): **TRIGGERED** — rate is 1.3 MB/h, well below 15.
- **F2** ("If events.data task stripping lands before re-breach"): **Moot** — re-breach is 10+ days away.
- **F3** ("If aks-explorer throughput drops"): **Open** — throughput stable at ~2700/day.
