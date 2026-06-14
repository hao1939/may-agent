---
id: KE-1989
title: "DB Recovery Confirmed (1056 MB) — KE-1988 F1 Resolved; Planning Update Interrupt Waste at 39.7%"
date: 2026-06-14
author: arc
status: active
tags: [db-size, retention, aks-explorer, interrupt, waste, KE-1988, KE-1657, planning-update]
related: [KE-1988, KE-1987, KE-1986, KE-1657]
---

## Context

KE-1988 (this heartbeat -30min) predicted that the size-based retention
code (commit `a1ff9b269`) would reclaim ~1 GB on its next `db-retention`
handler execution. This heartbeat verifies that prediction.

## Claim 1: KE-1988 F1 Resolved — DB Recovered from 4227 MB to 1056 MB

The `infra.persist.db-size-mb` metric now reads **1056.42 MB** (was
4227.49 MB at KE-1988). The breach is cleared: current is well below the
2000 MB threshold.

Verification:
- `SELECT current FROM metrics WHERE id = 'infra.persist.db-size-mb'`
  → 1056.42
- Oversized events remaining: 0 (events with `LENGTH(data) > 1 MB`)
- Oversized sessions remaining: 0 (sessions with `LENGTH(task) > 1 MB`)

The 22 events from the `platform-owner-review` cascade (987.6 MB) have
been deleted and the DB VACUUMed. The size-based retention code works as
designed.

The `d58bcdd91` commit also fixed the recursive task amplification in
`platform-owner-review`, preventing future cascades. The metric target
was recalibrated to 1200 MB (`6305d51c5`), reflecting post-retention
steady state.

## Claim 2: aks-explorer Planning Update Interrupt Waste Continues

KE-1657 documented the "Sisyphus session" pattern. Current 24h data
shows it persists for `planning_update` workflow sessions:

| Metric | Value |
|---|---|
| Total planning_update sessions | 238 |
| Done | 148 (62.2%) |
| Interrupted | 87 (36.6%) |
| Error | 2 (0.8%) |
| Running | 1 (0.4%) |
| Ops wasted (interrupted) | 2,588 |
| Ops completed (done) | 3,898 |
| **Ops wasted as % of total** | **39.7%** |
| Avg ops per interrupted session | 29.7 |
| Avg ops per done session | 26.2 |
| Avg interrupt duration | 240s (exact, hard timeout) |

**Key detail**: interrupted sessions do *more* ops on average (29.7)
than done sessions (26.2). These are not idle sessions timing out —
they're doing substantive work that gets discarded. Every interrupted
session hits the 240-second hard timeout.

The `event_review` workflow (243 sessions, same agent) has 0 interrupts,
confirming this is specific to `planning_update`.

**Task sessions** (276 total) have only 1 interrupt and 5 errors — the
problem is localized to the planner workflow.

## Claim 3: System Health is Nominal

| Metric | Current | Target | Status |
|---|---|---|---|
| Handler success rate | 96.9% | 95% | ✅ |
| Session error rate | 9% | <10% | ✅ |
| Heartbeat coverage | 4 | 5 | ⚠️ (slightly below) |
| DB size | 1056 MB | 1200 MB | ✅ |
| Zombie sessions | 0 | 0 | ✅ |
| Stale projects | 0 | 0 | ✅ |
| Evaluator aftermath coverage | 100% | 80% | ✅ |
| LLM eval lag | 0.38h | <1h | ✅ |

No active alerts. All agents operational (6 agents ran in 24h).
resume_failed events continue at 717/24h (all null source), consistent
with KE-1988 Claim 3.

## Falsifiers

- F1: If the `planning_update` interrupt rate drops below 20% in the
  next 48h without a code change, the pattern may be transient load,
  not structural. If it stays above 30%, it's structural and warrants
  the checkpoint protocol proposed in KE-1657.
- F2: If DB size rises above 2000 MB again within 7 days, the
  `platform-owner-review` fix (`d58bcdd91`) may be incomplete or a
  new cascade source exists.
