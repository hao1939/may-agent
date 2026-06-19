---
id: KE-2019
title: "DB Size Approaching 2000 MB Threshold — Throughput Growth Outpacing Retention"
date: 2026-06-17
author: arc
status: active
tags: [infrastructure, db-size, retention, aks-explorer, throughput, capacity-planning]
related: [KE-2016, KE-2018, KE-1986, KE-2051]
last_verified: 2026-06-21T21:00Z
---

<ai_context>
summary: "REOPENED (KE-2059 evidence). DB rebounded to 1745 MB (Jun 21) after KE-2059 showed the premature resolution coincided with the AKS planner cliff transient. Throughput recovered to 1873 sessions/day (24h), aks-explorer at 1158/day. DB is now at 87% of 2000 MB threshold with 255 MB headroom. F1 was validated during a transient throughput dip, not at steady state. F2 is now relevant: throughput recovered but hasn't sustained >2500/day aks-explorer. Current trajectory: breach in 2-3 weeks unless retention is tuned or threshold raised."
triggers: heartbeat metric check, db-size growth analysis, KE-2059 rebound
falsifiers:
  - F1: "If DB size drops below 1680 MB and stays there for 48h at >1500 sessions/day throughput, growth has genuinely stabilized." — Monitor daily.
  - F2: "If DB breaches 1900 MB, escalation to human for retention or threshold change is required." — Watch metric.
  - F3: "If throughput drops below 500 sessions/day again (another cliff), DB may shrink, but this is deferral not resolution." — Track throughput.
</ai_context>

## Observation

At 2026-06-17 ~13:30Z:

| Metric | Value | Threshold | Headroom |
|--------|-------|-----------|----------|
| infra.persist.db-size-mb | 1725 MB | 2000 MB | 275 MB (14%) |

## KE-2016 WAL Issue: Resolved ✓

| File | Jun 16 | Jun 17 | Change |
|------|--------|--------|--------|
| may.db (main) | 1,352 MB | 1,719 MB | +367 MB |
| may.db-wal | 1,356 MB | 4 MB | **−1,352 MB** |
| Total disk | 2,708 MB | 1,726 MB | −982 MB |

The WAL checkpoint fix in db-retention.ts (PRAGMA wal_checkpoint(TRUNCATE)) is
working. WAL no longer accumulates unboundedly. However, the main DB file has
absorbed content that was previously in WAL, plus new data.

## New Growth Driver: Throughput Increase

### AKS-explorer session volume trend

| Date | Sessions | Daily Change |
|------|----------|-------------|
| Jun 11 | 277 | — |
| Jun 12 | 684 | +147% |
| Jun 13 | 737 | +8% |
| Jun 14 | 783 | +6% |
| Jun 15 | 1,044 | +33% |
| Jun 16 | 941 | −10% |
| Jun 17 | 1,991 | **+112%** |

### Root Cause: Planner Fix Increased Dispatch Rate

Commit `24a7a60fc` (KE-2018) fixed planning_update sessions:
- **Before:** Avg duration 252s, 60% interrupted → wasted compute
- **After:** Avg duration 63s, 6% interrupted → sessions complete 4x faster

The handler dispatch rate didn't change (same cron), but each session completes
faster, allowing the next one to start sooner. Net effect: more sessions per
hour — a throughput increase from a quality improvement.

### Today's Dispatch Breakdown

| Source | Sessions/day | Per hour |
|--------|-------------|----------|
| project-planner | 1,250 | ~52 |
| task-worker | 620 | ~26 |
| metric-alert-triage | 61 | ~3 |
| other | 66 | ~3 |
| **Total aks-explorer** | **1,997** | **~83** |

## DB Steady-State Estimate

| Table | Rows | Avg Size | Estimated MB | Retention |
|-------|------|----------|-------------|-----------|
| events | 259,586 | 3.5 KB | 870 | 7d |
| sessions | 20,669 | 15.4 KB | 304 | 14d |
| session_digests | 42,965 | 11.2 KB | 460 | 14d |
| workflow_runs | 38,173 | 9.2 KB | 335 | 14d |
| evaluations | 18,842 | ~3 KB | 54 | 30d |
| metric_snapshots | 241,628 | ~0.2 KB | 46 | 14d |
| **Total** | | | **~2,069** | |

SQLite actual file (1725 MB) is ~83% of raw estimate (compression + overhead
balance). At current throughput, steady state will settle around 1800-2200 MB.

## Retention Is Working

- db-retention runs hourly, deleting 1500-2700 rows per run
- VACUUM runs when >1000 deleted (currently every run)
- WAL checkpoint working (4 MB WAL)
- Oldest event: Jun 10 (correct for 7d window)

The retention system is healthy. The issue is that the threshold was set when
throughput was lower.

## Recommendation

**Option 1 (preferred): Raise threshold to 2500 MB.** The current 2000 MB
threshold was set before aks-explorer throughput grew 3-7x. The metric should
alert on actual disk pressure, not on the legitimate steady-state of a
growing system. With the WAL fix applied, total disk usage (main + WAL)
is well-controlled.

**Option 2: Reduce event retention from 7d to 5d.** Saves ~250 MB at
steady state but reduces analytical history.

**Option 3: Reduce session_digests retention to 7d.** Saves ~230 MB
(digests reference sessions, so they're useful as long as sessions exist,
but evaluator can work with shorter history).

## Action Required

This is an escalation-worthy finding: the threshold will likely breach
within 2-4 days if aks-explorer throughput stays at current levels.
The fix is a configuration change (threshold raise or retention reduction),
not an agent behavioral change.
