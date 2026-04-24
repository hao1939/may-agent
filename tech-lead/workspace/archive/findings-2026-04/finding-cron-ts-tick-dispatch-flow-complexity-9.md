# Finding: cron.ts Tick Dispatch Flow Complexity

**File**: `src/app/cron.ts` (989 LOC)
**Date**: 2026-04-16
**Severity**: Medium — maintainability concern, not a bug

## Summary

A cron tick traverses **4 layers** from timer fire to handler execution. The critical issue is that two of these layers (`fire()` closure and `fireHeartbeat()`) are massively bloated with inline concerns that should be extracted.

## Tick Flow: Timer → Handler Execution

### Layer 1: Timer Infrastructure (L449–571)
`startEntry()` sets up a `setTimeout` → `setInterval` chain. The `setTimeout` handles resume delay calculation (staggering after restart). Clean and appropriate.

### Layer 2: `fire()` Closure (L453–554, ~100 lines inline)
The closure inside `startEntry()` handles:
1. **Overlap detection** — `isAgentHeartbeatRunning()` / `isRunning()` / PID checks (L455–530)
2. **Auto-pause state machine** — 50+ lines checking pause state, probe scheduling, escalation creation, recovery detection (L462–515)
3. **Mode dispatch** — 3-way switch to fireHeartbeat/fireHandler/fireDetachedJob (L541–551)

**Problem**: Auto-pause is ~50% of this closure. It's a full state machine (running → auto-paused → probing → recovered) with escalation tracking, notification, and probe scheduling — all inlined in a timer callback.

### Layer 3: `fireHeartbeat()` (L614–832, ~218 lines)
The largest method. Handles:
1. Request tracking (trackRequest/updateRequest) — L628–633
2. **Context injection** — reads heartbeat.md, queries pending tasks from DB, queries last interrupted session — L648–730 (~80 lines)
3. Probe task wrapping — L735–740
4. `manager.run()` call — L741 (the actual dispatch, 1 line)
5. `.waitFor()` result handling — L745–810 (~65 lines): request completion, probe recovery, auto-complete of injected requests, notification

**Problem**: `fireHeartbeat()` does 5 distinct jobs. The actual dispatch (`manager.run()`) is 1 line buried at L741 inside a 218-line method.

### Layer 4: `manager.run()` → session execution
External to cron.ts. Clean boundary.

## Key Coupling Points

| Coupling | Location | Impact |
|----------|----------|--------|
| Auto-pause state tracked in 3 places | `autoPauseEscalated` Set, `autoPauseActive` Map, and external `auto-pause.ts` | Recovery detection split across `fire()` (L505–515) and `fireHeartbeat()` result handler (L758–772) — same logic duplicated |
| Context injection reads DB directly | `fireHeartbeat()` L663–725 | Cron is coupled to request DB schema and session DB schema for task injection |
| Request lifecycle spans entire method | `trackRequest` at L628, `updateRequest` at multiple points through L810 | Error paths must remember to update request status — 3 separate catch blocks |

## Error Isolation

- **Between handlers**: Good. Each `fire*` method has its own try/catch and updates request status independently.
- **Within fireHeartbeat**: Fragile. Context injection failures are wrapped in nested try/catch (non-fatal), but the probe/auto-pause result handling in `.then()/.catch()` is complex — a bug in probe recovery tracking wouldn't surface clearly.
- **fire() closure**: Auto-pause escalation errors could prevent the heartbeat from firing (no try/catch around escalation block at L484–492).

## Unnecessary Indirection

Minimal unnecessary indirection — the layers are functionally distinct. The problem is **bloat within layers**, not too many layers:

1. `fire()` should delegate auto-pause checks to a single `shouldFire(entry, mode): boolean` method
2. `fireHeartbeat()` context injection (80 lines) should be extracted to `buildHeartbeatContext(entry): string`
3. `fireHeartbeat()` result handling should be extracted to `handleHeartbeatResult()`

## Recommended Action

**Extract, don't restructure.** Three targeted extractions would cut `fireHeartbeat()` from 218 to ~40 lines and `fire()` from 100 to ~30 lines:

1. `checkAutoPause(entry, agentName): "fire" | "probe" | "skip"` — encapsulate the state machine
2. `buildHeartbeatTaskMessage(entry, agentName): { message: string, injectedRequestIds: string[] }` — context injection
3. `handleHeartbeatCompletion(entry, agentName, requestId, ...)` — result/probe handling

This is a refactor task, not urgent. File is functional and error handling is adequate.

## Follow-up

- [ ] Extract auto-pause state machine from `fire()` closure
- [ ] Extract context injection from `fireHeartbeat()`
- [ ] Extract result handling from `fireHeartbeat()`
- [ ] Consider: auto-pause recovery detection is duplicated in `fire()` L505–515 and `fireHeartbeat()` `.then()` L758–772 — unify
