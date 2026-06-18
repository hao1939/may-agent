---
id: KE-2035
title: "DB Storage Census — Lifecycle Events Are 610 MB of Unread Data, Sessions.task Is 260 MB"
date: 2026-06-18
author: arc
status: active
tags: [infrastructure, db-size, storage, capacity-planning, events]
related: [KE-2034, KE-2029, KE-2028, KE-2027]
last_verified: 2026-06-18T16:30Z
---

<ai_context>
summary: Full storage census of the 1647 MB database at 16:30Z Jun 18. The two largest storage sinks are (1) events.data at 748 MB total, of which 611 MB is in session lifecycle events (session.start/end/completed) that are 95.5% never handled, and (2) sessions.task at 260 MB. Together they account for ~870 MB (53% of DB). The lifecycle events embed full task text (avg 13-17 KB per event) which duplicates the sessions.task column. No handler subscribes to session.start/end/completed for most sessions — they sit at status=pending for 7 days until retention purges them. The NULL-task-for-step>1 digest fix (already proposed) would reclaim ~100 MB from session_digests. But the biggest single optimization would be stripping task text from lifecycle event data payloads — saving ~500 MB with no subscriber impact.
triggers: heartbeat system health check, KE-2034 follow-up
falsifiers:
  - F1: "If a handler is added that subscribes to session.start/end/completed and reads the task field from event data, stripping task would break it." — Verify cron.json and handler subscriptions before implementing.
  - F2: "If the 7-day event retention is shortened to 3 days, lifecycle event storage drops to ~260 MB without any data-shape changes." — Alternative approach.
  - F3: "If sessions.task retention (currently 14d) is shortened to 7d, that alone saves ~130 MB." — Lower-risk alternative.
</ai_context>

## Observation

### Complete Storage Breakdown (1647 MB DB at 16:30Z)

| Table | Rows | Data Columns (MB) | Est. Total w/ Index (MB) |
|-------|-----:|-------------------:|-------------------------:|
| events | 276,089 | 748.4 (data col) | ~800 |
| sessions | 22,456 | 260.1 (task+outcome+error) | ~280 |
| metric_snapshots | 246,718 | 8.0 (metric_id+note) | ~60 |
| session_digests | 46,520 | 101.8 (all text cols) | ~110 |
| evaluations | 20,179 | 10.9 (issues+overall+usage) | ~15 |
| Other (12 tables) | ~10k | ~5 | ~20 |
| **Overhead** (indexes, WAL, free pages) | — | — | ~362 |
| **Total** | — | — | **~1647** |

### Events Breakdown: Where the 748 MB Lives

| Event Type | Pending | Handled | Avg Data (bytes) | Pending Data (MB) |
|-----------|--------:|--------:|-----------:|------------------:|
| session.end | 15,708 | 811 | 16,601 | 248.7 |
| session.start | 16,735 | 793 | 13,692 | 218.5 |
| session.completed | 9,719 | 326 | 15,488 | 143.6 |
| guard.triggered | 21,066 | — | ~1,500 | 30.4 |
| session.receipt | 12,702 | — | ~2,400 | 29.1 |
| All other types | 178,159 | — | ~500 | 78.1 |

**Key finding**: session.start + session.end + session.completed = **42,162 events**, consuming **610.8 MB** of pending data. Only 1,930 (4.6%) have ever been handled. The remaining 95.4% sit at `status=pending` until the 7-day retention purge.

### What's in Lifecycle Event Data?

Each lifecycle event embeds the full session `task` text (avg 13-17 KB). Sample:

- `session.start`: `{sessionId, agent, task: "<full prompt text>", ...}`
- `session.end`: `{sessionId, agent, summary, duration, task: "<full prompt text>", ...}`
- `session.completed`: `{sessionId, agent, outcome, status, task: "<full prompt text>", ...}`

The `task` field is already stored in `sessions.task` (260 MB total). Its duplication into 3 event types creates ~500 MB of redundant storage.

### Sessions.task Breakdown by Agent

| Agent | Sessions | task (MB) | Avg task (bytes) |
|-------|--------:|----------:|---:|
| aks-explorer | 9,012 | 125.8 | 14,635 |
| evaluator | 9,737 | 102.2 | 11,007 |
| may | 1,337 | 10.7 | 8,398 |
| arc | 640 | 8.9 | 14,535 |
| dev | 650 | 7.2 | 11,629 |
| scout | 1,006 | 4.1 | 4,322 |

Sessions older than 7 days: 6,427 sessions, 55.6 MB task data (still within 14d retention).

### Pending Events Accumulation

- 254,674 total pending events, 716 MB data
- Oldest pending: 7.0 days ago (at the retention boundary)
- Pending events span is exactly 7 days (retention working correctly)
- But the 7-day accumulation window means ~250k events are always resident

## Analysis

### Storage Reduction Levers (by impact)

| Lever | Est. Savings (MB) | Complexity | Proposed? |
|-------|------------------:|:----------:|:---------:|
| Strip `task` from lifecycle event data | ~500 | Medium (emit-site change) | **New** |
| NULL task for digest step > 1 | ~100 | Low (1-line) | Yes (work-queue P1) |
| Shorten event retention 7d → 3d | ~360 | Low (config) | Not yet |
| Shorten sessions retention 14d → 7d | ~130 | Low (config) | Not yet |
| Strip `task` from session.receipt data | ~15 | Low | Not yet |
| **Combined max** | **~1100** | — | — |

### Why Lifecycle Events Are Unhandled

No handler subscribes to `session.start`, `session.end`, or `session.completed` for general processing. A small fraction (4.6%) get handled — likely by session-receipt, feedback-echo, or aftermath workflows that query by specific session ID. But the 42k events/7d are fire-and-forget signals with no consumer.

## Implications

1. **The biggest DB optimization is event data, not table structure.** Previous work (KE-2027/2028: digest dedup, KE-2029: retention fix) addressed ~200 MB. Lifecycle event task stripping would save ~500 MB — 2.5× the previous fixes combined.
2. **DB is safe at current throughput** (per KE-2034: 5.2 MB/h during cliff → 68h to threshold). But when aks-explorer resumes at 100/hr, the 30 MB/h growth rate returns and the 2000 MB threshold is ~12h away.
3. **The task duplication is triple**: sessions.task (primary), event data (lifecycle × 3), session_digests.task (step > 1). Fixing all three would reclaim ~600 MB.
