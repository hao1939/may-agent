---
id: KE-2029
title: "DB Retention Fix Landed — 408 MB Reclaimed, Re-Breach in ~12h at Current Growth"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, capacity-planning, retention, task-duplication]
related: [KE-2028, KE-2027, KE-2023, KE-2024]
last_verified: 2026-06-18T09:50Z
---

<ai_context>
summary: May's db-retention fix (85a38a6fd, session_digests.task truncation to 2KB) landed at ~09:28Z and reclaimed 408 MB (2020→1612 MB). DB is now at 1620 MB with 2000 MB threshold — 380 MB headroom. Growth rate post-fix is ~30 MB/h, giving ~12.5h to re-breach (~22:00Z Jun 18). The fix eliminated 408 MB from session_digests, but 558 MB of task text remains duplicated in events.data across session.start/session.end/session.completed events, and 195 MB in workflow_runs.task. The structural problem (KE-2028's "task stored 6×") is partially addressed (1 of 5 duplicate locations fixed). Next recurrence will come from events.data growth unless task is stripped from event payloads or events retention is shortened.
triggers: heartbeat post-fix verification, KE-2028 F3 update
falsifiers:
  - F1: "If growth rate drops below 15 MB/h for a 6h window (indicating retention catching up), the 12h re-breach estimate is too pessimistic."
  - F2: "If events.data task stripping lands before re-breach, the ~558 MB event task duplication stops growing and DB stabilizes."
  - F3: "If aks-explorer throughput drops (e.g., project completion), growth rate drops proportionally and re-breach timeline extends."
</ai_context>

## Observation

### Fix Execution Timeline

| Time (UTC) | DB Size (MB) | Event |
|------------|-------------|-------|
| 08:07 | 1992 | Pre-breach growth |
| 08:43 | 2002 | **Breach** — crossed 2000 MB threshold |
| 09:10 | 2014 | Alert #1940 fired; may committed fix (85a38a6fd) |
| 09:25 | 2020 | Last measurement before fix execution |
| 09:31 | 1612 | **Fix complete** — db-retention handler truncated session_digests.task + VACUUM |
| 09:47 | 1620 | Current measurement |

**Reclaim: 408 MB** (2020 → 1612 MB). This aligns with KE-2027's estimate of ~250 MB step>1 duplication, plus additional savings from truncating step=1 task text from avg 12KB to 2KB max.

### Post-Fix Storage Breakdown

| Location | Size (MB) | Status |
|----------|-----------|--------|
| sessions.task | 258 | Authoritative — untouched |
| session_digests.task | 91 | **Reduced** — was 530+ MB, now 91 MB (truncated to 2KB) |
| events.data (session.start $.task) | 214 | **Still duplicated** |
| events.data (session.end $.task) | 206 | **Still duplicated** |
| events.data (session.completed $.task) | 137 | **Still duplicated** |
| workflow_runs.task | 195 | **Still duplicated** |
| **Total task storage** | ~1,101 | 68% of 1,620 MB DB |
| **Remaining duplication** | ~752 | events + workflow_runs |

### Growth Rate

Post-fix growth: 1612→1620 in ~16 min = **~30 MB/h**. At this rate:
- Re-breach at 2000 MB: **(2000 - 1620) / 30 = ~12.5 hours** (~22:00Z Jun 18)

The 30 MB/h rate is driven primarily by:
- events.data growth: 276 MB in last 24h (68,655 events)
- Each session generates 3-6 events with full task text embedded in data JSON

### KE-2028 Falsifier Updates

- **F3** ("If db-retention runs a VACUUM and drops DB below 1800 MB...the duplication is within tolerance"): **Partially validated** — VACUUM did drop below 1800, but growth rate means re-breach in 12h, so tolerance is temporary not structural. The fix buys time but doesn't resolve the growth driver.

## Impact

The session_digests fix addresses **1 of 5** duplicate task storage locations. The remaining 4 (3 event types + workflow_runs) contain 752 MB of task text that grows at ~20 MB/h. The system needs either:

1. **Strip task from event payloads** — stop embedding full task text in session.start/session.end/session.completed events. Events can reference sessions.task via sessionId JOIN.
2. **Shorten events retention** — current 7d events retention allows large accumulation at 68k events/day.
3. **Throughput governance** — reduce aks-explorer's 2777 sessions/day (KE-2025 amplification loop).

Without one of these, re-breach is structural, not a one-time event.
