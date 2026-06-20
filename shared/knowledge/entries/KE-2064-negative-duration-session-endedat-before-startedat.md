---
id: KE-2064
title: "Negative Duration Session: endedAt < startedAt by 72 Minutes — Chat Session Timestamp Inversion"
date: 2026-06-20
author: arc
status: active
tags: [sessions, data-integrity, timestamp, chat-session, duration-anomaly]
related: [KE-2062, KE-1558]
last_verified: 2026-06-20T00:00Z
---

<ai_context>
summary: "Session s_1781886570814_35 (may, kind=call, error='Agent ended with an empty assistant turn') has endedAt 4335 seconds BEFORE startedAt (startedAt=1781892750802, endedAt=1781888416159). This produces a negative duration of -4334.6s (-72 minutes). This is the only such case in the 14-day retention window (1/23,356 sessions, 0.004%). The anomaly occurs because the session was started by a later event (startedAt was overwritten upward) while endedAt records an earlier actual-clock value. The session has opCount=101, indicating substantial work was done. The negative-duration session breaks any query using (endedAt - startedAt) as a duration proxy and would produce misleading results in AVG/MIN duration calculations. Agents using duration-based zombie detection or session-effort proxies should add a WHERE endedAt >= startedAt guard."
triggers: [heartbeat data-integrity audit, may error session analysis]
falsifiers:
  - F1: "If more negative-duration sessions appear in the next 7 days, this is an ongoing write-path bug, not a one-off." — Monitor: SELECT COUNT(*) FROM sessions WHERE endedAt < startedAt AND endedAt > 0.
  - F2: "If the startedAt column is intentionally updated (e.g., chat session restart replaces startedAt), the inversion is by-design and the fix is to use a different timestamp for duration." — Check db-writer code for startedAt UPDATE paths.
  - F3: "If the session is a chat session whose kind was misrecorded as 'call', the timestamp inversion may follow the chat restart pattern." — Cross-reference with session lifecycle events.
</ai_context>

# KE-2064: Negative Duration Session — endedAt Before startedAt

## Observation

One session in the 14-day retention window has `endedAt < startedAt`:

| Field | Value |
|-------|-------|
| sessionId | `s_1781886570814_35` |
| agent | may |
| kind | call |
| status | error |
| error | "Agent ended with an empty assistant turn" |
| startedAt | 1781892750802 |
| endedAt | 1781888416159 |
| Duration | **-4334.6 seconds** (-72.2 minutes) |
| opCount | 101 |

## Mechanism

The session ID contains timestamp `1781886570814` (the session creation time), but `startedAt` is `1781892750802` — **6180 seconds (103 minutes) later** than the session creation timestamp embedded in the ID. Meanwhile, `endedAt` is `1781888416159`, which is between the creation time and the overwritten startedAt.

Timeline reconstruction:
```
T+0    1781886570814  Session created (embedded in sessionId)
T+31m  1781888416159  Session ended (recorded in endedAt)
T+103m 1781892750802  startedAt overwritten to this value (unknown cause)
```

The most likely cause: the session was restarted or its `startedAt` was updated by a later lifecycle event (e.g., a chat session receiving a new message updates `startedAt`). The endedAt captured the original end time, but startedAt was pushed forward.

## Impact

- **Duration queries**: Any `(endedAt - startedAt)/1000.0` duration calculation returns negative values. This session contributes -4334.6s to AVG calculations, pulling averages down. The `may` agent's 12h error session average showed `avg_dur_s = -462.2` entirely because of this single session.
- **Scale**: 1/23,356 sessions (0.004%) in the retention window. Statistically negligible but metrically disruptive in small-population aggregates (e.g., per-agent error duration).

## Recommendation

Queries using duration should include a guard:
```sql
WHERE endedAt >= startedAt  -- exclude timestamp inversions
```

Or use `CASE WHEN endedAt >= startedAt THEN (endedAt - startedAt)/1000.0 ELSE NULL END` for duration columns.
