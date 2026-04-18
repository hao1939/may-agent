# Audit: evaluation-sync Handler Outage — Root Cause Analysis

**Date**: 2026-04-12
**Lens**: C (Dead Weight) → D (Fragility)
**Status**: FIXED — Handler resolver implemented in `cron.ts` + `agent-loader.ts`

## The Problem

`evaluation-sync` cron handler has **never fired** since the handler file was created on 2026-04-10. 125+ unevaluated sessions have accumulated. The cron entry is enabled in `agents/may/cron.json` with 10-minute interval.

## Evidence

1. **Zero requests** in the `requests` table with `artifact = 'evaluation-sync'`
2. **Zero requests** for `session-sync` too (same creation timeframe, same problem)
3. All other handlers fire correctly (active-nudge: 5,213 fires, research-sync: 171, etc.)
4. Last heuristic evaluation written at `2026-04-11T23:28:08` — from `writeHeuristicEvaluations()` startup sweep, NOT from evaluation-sync

## Root Cause

**The main may-agent process (PID 65829) has been running since 2026-04-08 23:23:24.**

The handler files were created AFTER the process started:
- `evaluation-sync.ts` — created 2026-04-10 18:53:42 (+44 hours after process start)
- `session-sync.ts` — created 2026-04-10 15:33:40 (+40 hours after process start)

### The Handler Registration Gap

`loadAgentHandlers()` runs exactly ONCE at startup (line 1147 in may.ts). It:
1. Iterates `agentCrons` map
2. For each agent's Cron, reads entries that have `.handler` field
3. Imports the handler file from disk
4. Calls `cron.registerHandler(entryName, hotHandler)`

When cron.json is **hot-reloaded** (file-watch detects changes):
1. `Cron.reload()` re-reads entries — finds new `evaluation-sync` entry
2. `startEntry()` is called for the new entry
3. `resolveMode()` checks `this.handlers.get("evaluation-sync")` → **undefined** (never registered)
4. Since entry has no `agent` field either, `resolveMode()` returns `null`
5. Entry is **silently skipped** with error: `Cron entry "evaluation-sync" has no handler and no agent — skipping`

### Why Other Handlers Work

Other handlers were created before the process started (Apr 8). Their handler files existed at startup, so `loadAgentHandlers()` successfully registered them. The hot-reload mechanism re-imports existing handlers on each fire (via `?t=` cache-buster), but it cannot discover NEW handler files.

## The Design Flaw

There's an asymmetry between cron entry hot-reload and handler registration:

| Capability | Hot-reload? | Mechanism |
|-----------|-------------|-----------|
| New cron entries | ✅ Yes | `Cron.reload()` via file-watch on cron.json |
| Modified cron entries | ✅ Yes | `Cron.reload()` smart diff |
| Modified handler code | ✅ Yes | `?t=` cache-buster in handler wrapper |
| **New handler files** | ❌ No | Only `loadAgentHandlers()` at startup |

When a new cron entry with a handler is added, the entry is detected but the handler is never registered. This creates a permanent silent failure that persists until process restart.

## Fix Options

### ~~Option A: Re-register handlers on cron reload (recommended)~~ ✅ IMPLEMENTED
When `Cron.reload()` detects new entries that have `.handler` but no registered handler, trigger handler registration for those entries. This requires the Cron class to have access to the handler loading logic, or emit an event that may.ts listens for.

**Implementation (2026-04-12)**:
1. `Cron` class now has a `setHandlerResolver()` method that accepts an async callback `(entryName, entry) => Promise<boolean>`
2. `reload()` checks for entries with `.handler` but no registered handler — calls the resolver before `startEntry()`
3. `loadAgentHandlers()` in `agent-loader.ts` sets a handler resolver on each Cron instance that dynamically imports the handler file and registers a hot-reload wrapper
4. Error handling: resolver failures log a warning and still call `startEntry()` (graceful degradation — entry falls through to resolveMode which will log the standard skip message)
5. Tests: `src/app/cron-handler-resolver.test.ts` — 5 test cases covering resolver invocation, skip-if-already-registered, failure warnings, error recovery, and backward compatibility

### Option B: Call `loadAgentHandlers()` periodically
Add a cron job that re-runs handler registration every N minutes. Fast (only processes unregistered entries), but wasteful for a rare event.

### Option C: Add `agent: "may"` to all handler entries
If the entry has `agent` set, `resolveMode` falls through to "job-detached" instead of null. This would spawn a separate process — wrong behavior for in-process handlers, but at least not silent.

### Option D: Restart the process
The simplest fix for today. There are already 14 undeployed commits since Apr 6. A restart would:
1. Register both new handlers (evaluation-sync, session-sync)
2. Deploy 14 pending commits
3. Clear the 125-session evaluation backlog via startup sweep

## Immediate Recommendation

**Short-term**: Restart the may-agent process. This is overdue anyway (14 undeployed commits).

**Medium-term**: Implement Option A — when `resolveMode()` returns null for an entry that has `.handler`, log a prominent error AND attempt dynamic handler registration. This closes the gap permanently.

## Impact

- **evaluation-sync**: 125 sessions unevaluated, evaluation data stale for 28+ hours
- **session-sync**: Unknown impact — needs investigation of what session-sync does
- **Silent failure**: No alerts, no errors visible to operators. The only signal is stale evaluation timestamps.

## Related Findings

The Lens A audit (workspace/audit-evaluation-architecture.md) proposed removing `writeSkippedEvaluations()` and `writeHeuristicEvaluations()` startup sweeps in favor of evaluation-sync. **This would have been catastrophic** — evaluation-sync was silently broken, and the startup sweeps were the only thing producing heuristic evaluations.

**Updated recommendation**: Fix evaluation-sync first, verify it runs for at least 48h successfully, THEN consider removing startup sweeps.
