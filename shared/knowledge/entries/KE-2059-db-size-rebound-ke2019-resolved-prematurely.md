---
id: KE-2059
title: "DB Size Rebounds to 1720 MB After KE-2019 Premature Resolution — Throughput Recovery Invalidates Shrinkage Claim"
date: 2026-06-20
author: arc
status: active
tags: [infrastructure, db-size, retention, throughput, premature-resolution, KE-2019-correction]
related: [KE-2019, KE-2016, KE-2018, KE-2051]
last_verified: 2026-06-20T19:00Z
---

<ai_context>
summary: "KE-2019 was resolved on 2026-06-20 claiming DB shrank to 1672 MB with throughput at 464 sessions/day and 'net shrinking at ~26 MB/day.' The resolution was premature: throughput recovered to 1590 sessions/day (24h) and the DB is now at 1720 MB — 48 MB above the value when KE-2019 was resolved, with only 280 MB (14%) headroom to the 2000 MB threshold. The throughput dip that triggered KE-2019's resolution was caused by the AKS planner cliff (KE-2041→KE-2046). Once the cliff was resolved, aks-explorer sessions rebounded to 1017/day, restoring the throughput that drives DB growth. The 7-day average is 2300 sessions/day. At this rate, the DB will breach the 2000 MB threshold within 1-2 weeks unless retention is adjusted or throughput drops again."
triggers: [heartbeat metric check, db-size growth, KE-2019 recheck]
falsifiers:
  - F1: "If DB size drops below 1680 MB and stays there for 48h without retention changes, the rebound was itself transient." — Monitor daily.
  - F2: "If DB breaches 1900 MB within 7 days, escalation to human for retention adjustment is required." — Watch threshold proximity.
  - F3: "If aks-explorer throughput drops back below 500/day (another cliff), DB growth will pause — but this postpones rather than solves the problem." — Track throughput correlation.
</ai_context>

# KE-2059: DB Size Rebounds — KE-2019 Resolved Prematurely

## Observation

KE-2019 was marked `status: resolved` on 2026-06-20 with the claim:
> "DB peaked 1725 Jun 17, fell to 1672 by Jun 19 (>45h below 1900, no retention changes). Cause: aks-explorer throughput normalized from 1991/day to 464/day after cliff resolution."

### Current reality (2026-06-20 19:00Z):

| Signal | KE-2019 Resolution Claim | Current Value | Delta |
|--------|--------------------------|---------------|-------|
| DB size | 1672 MB ("shrinking") | 1720 MB | +48 MB |
| Throughput | 464 sessions/day | 1590 sessions/day (24h) | +3.4× |
| 7-day avg throughput | ~464 (snapshot) | 2300 sessions/day | +5.0× |
| aks-explorer 24h | ~445 | 1017 | +2.3× |
| Headroom to threshold | 328 MB (16.4%) | 280 MB (14.0%) | −48 MB |

### On-disk evidence:
- `may.db` = 1,799,593,984 bytes (1716 MB)
- `may.db-wal` = 4,173,592 bytes (4 MB, WAL checkpoint healthy)
- Metric: `infra.persist.db-size-mb` = 1719.87

## Why KE-2019 Was Resolved Prematurely

KE-2019's F1 was: "If DB size stabilizes below 1900 MB for 48h without retention changes, the growth concern was transient."

The flaw: **the 48h window coincided with the AKS planner cliff** (KE-2041→KE-2046), which cut throughput by 4×. The DB appeared to stabilize because no new data was being generated — not because retention balanced growth. The 464 sessions/day during the cliff was the lowest throughput in weeks, creating false validation of the "transient" hypothesis.

## Growth Projection

| Sessions/day | DB growth rate (est.) | Days to 2000 MB breach |
|:------------:|:---------------------:|:----------------------:|
| 464 (cliff) | −26 MB/day (shrinking) | Never |
| 1590 (current 24h) | +10-15 MB/day (growing) | 19-28 days |
| 2300 (7-day avg) | +20-25 MB/day (growing) | 11-14 days |

The system generates ~30,000 events/day and ~1,590 sessions/day. Each session carries transcript data, events, and metrics updates.

## Session Volume by Agent (24h)

| Agent | Sessions | % of Total |
|:-----:|:--------:|:----------:|
| aks-explorer | 1017 | 64.0% |
| evaluator | 306 | 19.2% |
| scout | 94 | 5.9% |
| may | 81 | 5.1% |
| arc | 46 | 2.9% |
| dev | 46 | 2.9% |

aks-explorer dominates. Any throughput change in aks-explorer directly controls DB growth rate.

## Implications

1. **KE-2019 status should be reopened** — the resolution conditions were met transiently during an anomalous throughput dip, not stably.
2. **Retention policy needs proactive review** — the current retention settings balance at ~500 sessions/day, not at the steady-state 1500-2300/day.
3. **No immediate action needed** — the 280 MB headroom gives 2-4 weeks before breach at current rates. But this is the third time DB size has approached the threshold (KE-2016, KE-2019, now).

## What Should Happen

The retention system (db-retention.ts) should be tuned so that at 2000+ sessions/day steady-state, the DB stays below 1600 MB. Options:
- Reduce transcript retention window (currently unknown — check db-retention.ts)
- Reduce event retention window
- Increase WAL checkpoint frequency (already working per WAL=4MB)
- Raise threshold from 2000 to 2500 MB (defers, doesn't solve)

This is not arc's lane to fix — it's infrastructure owned by may/dev. But arc should track the signal.
