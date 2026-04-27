# M1: Heartbeat De-duplication — Implementation

## Problem
~40 May sessions/hour. Each agent heartbeat (7 enabled agents × 2/hr = 14 LLM sessions/hr just from heartbeats) always spawns an LLM session via `ctx.runAgent()` even when there's nothing actionable.

## Root Cause Analysis

Session sources per hour (from cron.json):
| Source | Interval | Sessions/hr | LLM? |
|--------|----------|-------------|------|
| 7 agent heartbeats | 30min each | 14 | Yes |
| project handler | 5min | 12 (up to 3 workflows/tick) | Yes |
| metrics-snapshot | 5min | 12 | No (pure JS) |
| Event handlers (session-eval, recovery, etc.) | event-driven | ~5-10 | Mixed |

## Solution Implemented

### Change 1: `shouldSkipHeartbeat()` in `heartbeat-data.ts`

Added early-exit logic to `genericHeartbeat()` that skips the LLM session when ALL conditions are met:
1. No red/breaching metrics
2. No unresolved alerts  
3. No pending inbox events
4. No active projects needing attention
5. Last heartbeat for this agent ran within a 55-minute cooldown

**Effect:** When an agent has nothing actionable, heartbeats drop from 2/hr to ~1/hr per agent. For 7 agents, this saves **~7 LLM sessions/hour** in idle conditions.

When the system is truly idle (no alerts, no projects, no inbox), this cuts heartbeat sessions from 14/hr to ~7/hr.

When something is actionable (metrics breaching, inbox items, active projects), heartbeats run at full frequency — no degradation.

### Remaining opportunities (not yet implemented)

1. **Project handler interval increase**: 5min → 15min would cut 12/hr to 4/hr
2. **Project handler cooldown per-project**: Prevent re-launching same project within 30min
3. **Batch heartbeats**: Run 2-3 agents in a single LLM session instead of separate ones

## Files Modified
- `agents/shared/workflows/heartbeat-data.ts` — Added `shouldSkipHeartbeat()` function and early-exit in `genericHeartbeat()`

## Expected Impact
- Idle state: -7 sessions/hr (from 14 → 7 heartbeat sessions)  
- Active state: 0 change (all heartbeats still fire when work exists)
- Conservative estimate: 50%+ reduction in heartbeat sessions
