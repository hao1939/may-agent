# Finding: May No-Op Heartbeat Waste — 80% Empty Sessions

**Date:** 2026-03-17T20:04
**Severity:** HIGH 🔴
**Estimated waste:** ~$18/day

## The Problem

May fires 31-49 heartbeats/hour (avg 31.0). **80% of these sessions (374 out of 465) do zero productive work** — they just report "Heartbeat complete. 0 dispatchable items. 31 BLOCKED on Hao."

## Data

| Metric | Value |
|--------|-------|
| Total May sessions (last ~14h) | 465 |
| No-op sessions | 374 (80%) |
| Productive sessions | 91 (20%) |
| May sessions/hour avg | 31.0 |
| May sessions/hour max | 49 |
| Expected from interval alone | 6/hour |
| Waste rate | ~$0.75/hour = ~$18/day |
| May as % of all sessions | 32% |

### Hourly breakdown:
- 2026-03-16T18: **49** sessions (peak — nearly 1/min)
- 2026-03-16T20: **48** sessions
- 2026-03-17T02: **43** sessions
- Average across all hours: **31.0**

## Root Cause Analysis

May's heartbeat entry (`name: "heartbeat"`, `intervalMs: 600000`) fires:
1. Every 10 minutes via the cron timer
2. Every time any agent calls `agents.send("may", ...)` via `triggerHeartbeat()`

The cooldown (75% of interval = 7.5 min) should limit this, but the actual rate suggests the cooldown isn't effective against the combined timer + trigger volume. With ~10 agents each potentially sending to May multiple times per hour, the triggers accumulate.

## Proposed Fix (pick one or combine)

### Option A: Increase May's interval to 30 minutes (quick win)
May is a routing agent. She doesn't need to check every 10 minutes. 30 minutes is plenty since `send()` triggers still fire immediately.
```json
{"name": "heartbeat", "agent": "may", "intervalMs": 1800000}
```
Expected: 2/hour + triggers ≈ 8-10/hour (down from 31)

### Option B: Add no-op detection to May's heartbeat (architectural)
In `fireHeartbeat()`, before spinning up a full session, check:
- Are there any CREATED requests targeting May?
- Are there any unchecked items in May's todo.md?
If neither → skip the heartbeat entirely.

### Option C: Increase cooldown for May specifically
Override cooldown to 90% of interval instead of 75%. Or add a per-agent `cooldownMs` field in cron.json.

## Recommendation

**Option A immediately** (change interval to 1800000ms in cron.json) + **Option B as follow-up** (architectural fix). Option A alone would cut May's sessions by ~60%.
