# Finding: QA Heartbeat Interrupt Root Cause (IT-21)

**Date**: 2026-04-15  
**Severity**: Medium  
**Status**: Root cause identified

## Summary

QA's 67% interrupt rate is NOT caused by QA's heartbeat being too complex or its budget being too small. It's caused by **external session abortion** — likely the cron system killing in-flight sessions when a new heartbeat cycle fires before the previous one completes.

## Evidence

### 1. Temporal Clustering — NOT a Persistent QA Problem

| Date Range | Done | Interrupted | Interrupt Rate |
|---|---|---|---|
| Apr 7-13 (7 days) | ~300 | ~2 | <1% |
| Apr 14 | 19 | 20 | 51% |
| Apr 15 | 18 | 10 | 36% |

The interrupt problem appeared suddenly on April 14 and is not a long-running QA issue. Something changed in the system on April 14 that started causing external aborts.

**Source**: `SELECT date(startedAt/1000, 'unixepoch') as day, status, COUNT(*) FROM sessions WHERE agent='qa' GROUP BY day, status ORDER BY day DESC`

### 2. NOT QA-Specific — System-Wide Problem

48h interrupt rates across all agents:
| Agent | Done | Interrupted | Rate |
|---|---|---|---|
| **qa** | 48 | 30 | **38.5%** |
| **coach** | 137 | 26 | 16% |
| **may** | 71 | 25 | 26% |
| **bob** | 147 | 18 | 11% |
| **optimizer** | 139 | 12 | 8% |
| **tech-lead** | 155 | 10 | 6% |
| **scout** | 85 | 8 | 9% |
| evaluator | 251 | 5 | 2% |
| coder | 33 | 1 | 3% |

QA is worst-hit but coach and may are also significantly affected. This points to a system-level issue, not a QA-specific problem.

### 3. All Interrupts Are "Request was aborted"

Every single interrupted QA session has `error: "Request was aborted."`. This is an external cancellation (AbortSignal), NOT a timeout or internal error. The session doesn't crash — it gets killed from outside.

### 4. Interrupted Sessions Were Nearly Done

| Metric | Done sessions | Interrupted sessions |
|---|---|---|
| Avg ops | 6.9 | 6.4 |
| Avg duration | 78s | 65s |

Interrupted sessions completed 93% as many ops as successful ones. They were doing the same work and nearly finished — they just got aborted ~10-15s before they would have called `finish()`.

### 5. Clear Temporal Pattern on April 15

The interrupted sessions cluster in a contiguous block (08:00-13:00 UTC), then ALL sessions succeed (13:30-18:30 UTC). This suggests a system change or restart around 13:00-13:30 that resolved the abort issue.

```
08:00 - interrupted (5 ops, 78s)
08:30 - interrupted (6 ops, 38s)
09:00 - interrupted (6 ops, 64s)
09:30 - interrupted (6 ops, 63s)
10:00 - done       (7 ops, 96s)   ← intermittent success
10:30 - done       (4 ops, 56s)
11:00 - interrupted (7 ops, 39s)
11:30 - interrupted (5 ops, 47s)
12:00 - interrupted (6 ops, 56s)
12:30 - interrupted (7 ops, 57s)
13:00 - interrupted (7 ops, 58s)
13:30 - done       (8 ops, 129s)  ← all done from here
14:00 - done ...
```

## Root Cause Hypothesis

The most likely cause is **heartbeat overlap**: the cron system fires a new heartbeat for QA before the previous one finishes, and the system aborts the old session to make room. QA's heartbeat takes 60-120s to complete, which is within a 30-minute interval, but if there's resource contention or the cron is firing more frequently than intended, sessions get killed.

The fact that this appeared suddenly on April 14 suggests a configuration or system change (possibly a restart with different cron timing, or increased system load causing slower LLM responses that push sessions past a tighter abort window).

## QA Heartbeat Analysis

The heartbeat itself (`agents/qa/heartbeat.md`, 49 lines) is well-structured and lean:
1. Check pending reviews (injected tasks)
2. If none, do ONE proactive scan (git log or code quality)
3. Append to journal
4. Call finish()

This is appropriate for 6-10 ops and 60-120s. The heartbeat is NOT the problem.

## Recommendations

### Do NOT Change
- QA's heartbeat.md — it's appropriately scoped
- QA's op count — 6-10 ops is fine

### Investigate (separate sessions)
1. **Check cron overlap handling**: Does `src/lib/cron-tool.ts` or the manager abort in-flight sessions when a new heartbeat fires? If so, it should wait for the current session to finish (or at minimum, give it 120s grace).
2. **Check what changed April 14**: Review git log and system changes around April 14 06:00 UTC that could have introduced the abort behavior.
3. **Monitor**: The problem may have self-resolved around 13:30 today. If interrupts stay at 0% through the next 24h, this is a transient issue that doesn't need a fix.

## Follow-Up Tasks
- [ ] Investigate cron overlap handling in `src/lib/cron-tool.ts` — does it kill running sessions?
- [ ] Check `git log --since="2026-04-14" --until="2026-04-15"` for system changes that could cause aborts
- [ ] Monitor QA interrupt rate over next 24h to see if the fix at ~13:30 holds
