---
id: KE-2024
title: "System Capacity Under Dual Pressure — DB and Guard Thresholds Converging"
date: 2026-06-18
author: arc
status: active
tags: [capacity-planning, db-size, guard-system, jevons-paradox, threshold-management]
related: [KE-2023, KE-2021, KE-2022, KE-952]
---

<ai_context>
summary: Two capacity constraints are converging simultaneously. DB at 1889/2000 MB (94.5%, breach in ~26h at 4.3 MB/h). Guard triggers at 4974/5500 (90.4%, stabilizing near threshold). Both are driven by the same root cause: aks-explorer throughput scaling to 2568 sessions/day without a quantity cap. KE-952 correctly identified the Jevons paradox — per-unit efficiency improvements (eval skip, commit-guard fix) were consumed by volume increases. The system now needs either throughput governance or higher static limits. Three proposals await human approval under ORDER-010, none of which have landed in 24+ hours.
triggers: heartbeat health check, dual metric convergence, KE-952 validation
falsifiers:
  - F1: "If both DB threshold (2500) and guard dedup proposals are approved and land within 24h, the dual pressure resolves to comfortable headroom — this entry becomes historical."
  - F2: "If aks-explorer throughput decreases below 1500 sessions/day naturally (project completion), both pressures relieve without intervention."
  - F3: "If db-retention interval is shortened from daily to hourly, DB growth rate may decrease enough to defer the threshold raise."
</ai_context>

## Observation

Two system capacity constraints are converging toward breach simultaneously:

| Metric | Current | Threshold | Headroom | Time to Breach |
|--------|---------|-----------|----------|----------------|
| `infra.persist.db-size-mb` | 1889 MB | 2000 MB | 5.6% | ~26h at 4.3 MB/h |
| `guard.triggered-count-24h` | 4974 | 5500 | 9.6% | Stabilizing near threshold |

Both are driven by the same structural cause: **aks-explorer throughput** (2568 sessions/day, 125/hr), which is the single largest system consumer by volume.

## Connection to KE-952 (Jevons Paradox)

KE-952 documented that per-unit efficiency savings (evaluator skip rate 0.4% → 50.8%) were consumed by proportional volume increases (aks-explorer 275 → 2250 sessions/day). The same dynamic drives both current pressures:

1. **DB growth**: More sessions = more rows in sessions, events, evaluations, session_digests, workflow_runs tables. Retention is working (7d events, 14d sessions), but the steady-state volume within those windows grows linearly with throughput.

2. **Guard triggers**: More sessions × per-session guard fire rate = more events. The Spec 3 commit-guard fix eliminated ambient noise, but READ_DEDUP (1391/day from 139 sessions averaging 7.9 triggers each) scales with session count.

**KE-952's recommendation was correct and unacted upon**: "Any proposed efficiency improvement must be paired with a quantity limit (rate ceiling, project completion gate, or sampling strategy) to capture the savings rather than inflating them away."

## Pending Fixes (All Awaiting ORDER-010 Approval)

| Proposal | Effect | Status |
|----------|--------|--------|
| DB threshold 2000→2500 MB | Buys ~142h at current rate | Proposed 2026-06-17, P1 |
| Per-session guard dedup | Eliminates ~1700 triggers/day | Proposed 2026-06-18, P2 |
| Guard threshold 5500→6000 | Stopgap, ~4h headroom extension | Proposed 2026-06-18, P2 (superseded by dedup) |

## Structural Observation

The system has no throughput governor. aks-explorer's project handler dispatches tasks at whatever rate the planner generates them. Session count has grown 9.3× in 7 days (275 → 2568/day) while productive output (runnable tasks completed, model quality improvements) has remained approximately flat (per KE-952 evidence). The overhead-to-output ratio is increasing: more sessions, more guard events, more DB rows, more evaluator runs — but the aks-rp-e2e project's task tree has shown minimal structural advancement.

This is not a proposal to throttle aks-explorer (that's a platform decision requiring human judgment). It is an observation that **all static resource limits will eventually breach as long as throughput grows without a ceiling**, and the current fix cadence (threshold raises) has a decreasing half-life (4d → 3d → 1d → <1d between calibrations for guards).
