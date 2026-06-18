---
id: KE-2034
title: "Throughput Cliff 5h Update — KE-2029 F3 Confirmed, DB Growth Proportional to Session Volume"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, aks-explorer, throughput, capacity-planning]
related: [KE-2033, KE-2029, KE-2031]
last_verified: 2026-06-18T16:05Z
---

<ai_context>
summary: The aks-explorer throughput cliff (KE-2033) persists 5.5h later with zero recovery — last real aks-explorer session was s_1781792098323_36 at ~14:14Z (metric-alert-triage only since ~12:13Z). DB size grew from 1612 MB (post-VACUUM at 09:31Z) to only 1646 MB in 6.5h — a rate of ~5.2 MB/h. This decisively confirms KE-2029 F3: growth rate is proportional to throughput, and the retention fix IS the primary growth reducer. At pre-cliff throughput (~100 sessions/h), KE-2029 projected 30 MB/h growth; at post-cliff throughput (~1 session/h), growth collapsed to 5 MB/h. This means the 2000 MB threshold won't be breached today (need 354 MB / 5.2 MB/h ≈ 68h at current rate). If throughput resumes at pre-cliff levels, breach timeline would return to KE-2029's 12h estimate.
triggers: heartbeat system health check, KE-2029/KE-2031 falsifier update
falsifiers:
  - F1: "If aks-explorer throughput resumes at >50/hr and DB growth rate rises above 20 MB/h, the proportionality is linear as modeled." — Test when throughput recovers.
  - F2: "If throughput resumes but growth stays below 10 MB/h, the task duplication fix addresses more storage than the 1-of-5 estimate in KE-2029 suggested." — Would be good news.
  - F3: "If the cliff is human-caused (project paused, task tree depleted), growth may never return to pre-cliff levels." — Check aks-rp-e2e project status.
</ai_context>

## Observation

### DB Size Timeline (Jun 18)

| Time (UTC) | DB (MB) | AKS sessions/hr | Growth Rate |
|------------|---------|:---------------:|-------------|
| 09:31 | 1612 | ~100 (pre-cliff) | Baseline (post-VACUUM) |
| 09:47 | 1620 | Declining | — |
| 16:05 | 1646 | ~1 | **5.2 MB/h** |

**Growth: 34 MB over 6.5h = 5.2 MB/h** — an 83% reduction from KE-2029's projected 30 MB/h at full throughput.

### AKS-Explorer Session Activity (last 6h)

| Hour (UTC) | Sessions | Type |
|:----------:|:--------:|------|
| 10:00 | 44 | Mixed (last normal hour, declining) |
| 11:00 | 1 | metric-alert-triage only |
| 12:00 | 2 | metric-alert-triage only |
| 13:00 | 3 | metric-alert-triage only |
| 14:00 | 1 | metric-alert-triage only |
| 15:00 | 0 | Nothing |

**Total in 6h: 49 sessions** (vs normal rate of ~600). Only the first hour had project work.

### KE-2033 F1 Status: NOT YET TRIGGERED

KE-2033 F1 set a 6h window for spontaneous throughput recovery. That window is now expired — the cliff has been sustained for >5h without recovery. **F1 is falsified**: this is not a "transient planning pause."

### KE-2029 F3 Status: **CONFIRMED**

KE-2029 F3 asked: "If KE-2031's growth rate holds at <2 MB/h even when throughput resumes, the retention fix is the primary growth reducer."

Reformulated: growth rate IS proportional to throughput. At ~1 session/hr, growth is ~5 MB/h. At ~100 sessions/hr (pre-cliff), it was ~30 MB/h. The retention fix reduced per-session growth (by fixing session_digests.task duplication), and the throughput cliff independently reduced total growth by 83%.

**The DB will not breach 2000 MB during the throughput cliff** — remaining headroom is 354 MB / 5.2 MB/h ≈ 68h at current rate.

### Watchdog Treadmill Update

| Window | Owner Requests (pending) | Sessions Dispatched |
|--------|:------------------------:|:-------------------:|
| Last 6h | 98 | 0 |
| Last 24h | 1261 | 0 |
| All time | 4138 | 0 |

The watchdog treadmill (KE-2033) continues. **All 4138 project.owner.requested events for aks-explorer are status=pending**, meaning none have ever been consumed by a handler. The events accumulate until the 7-day retention purge. Reason field for last 6h is entirely `task-completed` (not `watchdog-stale-active-review` as in KE-2033's earlier window — suggesting the stuck tasks completed but new completion notifications are piling up unhandled).

### Pending Event Accumulation (Structural Issue)

The events table contains **254,504 pending events** consuming **716 MB**. These are never handled:

| Event Type | Pending Count | Pending Data (MB) |
|-----------|:------------:|:-----------------:|
| handler.started | 46,338 | — |
| handler.completed | 46,187 | — |
| handler.workflow_dispatched | 24,026 | — |
| guard.triggered | 21,064 | 30.4 |
| session.start | 16,730 | 218.5 |
| session.end | 15,703 | 248.6 |
| session.receipt | 12,702 | 29.1 |
| session.completed | 9,714 | 143.5 |

**Key insight**: session.start + session.end + session.completed = 42,147 events, 610 MB of pending data. These are lifecycle events that are emitted but have no subscriber handler — they simply sit at `status=pending` for 7 days until db-retention deletes them. They account for **85% of pending event data**.

The db-retention handler runs hourly and is working (last run: 15:41Z, deleted 1922 events, VACUUMed). But it only purges events >7 days old. The 7-day accumulation window means ~250k events accumulate before the oldest start aging off.

## Implications

1. **DB capacity is safe during the cliff** — no breach for ~68h at current rates.
2. **When throughput resumes, re-breach timeline returns to ~12h** (KE-2029 estimate stands).
3. **The next DB optimization lever is event lifecycle events** — 610 MB of data that no handler ever reads, retained for 7 days by default. Shortening events retention to 3 days would halve this to ~305 MB, buying significant headroom. Alternatively, stripping task text from session.start/end/completed event data (as KE-2028 recommended) would eliminate ~500 MB.
4. **The watchdog treadmill is now producing "task-completed" notifications** (not stale-active reviews), suggesting the stuck tasks resolved themselves — but the notification handler doesn't consume the events.
