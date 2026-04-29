# Pipeline Fix Plan: Context-Learn Poller

## Problem
The `session-eval` handler listens for `session.completed` events, but **nothing in the codebase emits this event**. The entire chain (session completes → session-eval → context-learn → lesson extraction) is dead.

## Root Cause
- `session-eval` in `cron.json` has `"on": ["session.completed"]`
- Searched entire codebase for `dispatchEvent.*session.completed` and `emit.*session.completed` — zero results
- The runtime that manages session lifecycle doesn't emit this event when sessions finish

## Fix Implemented: Cron-Based Poller

Created `agents/may/handlers/context-learn-poller.ts` — a pragmatic workaround:

1. **Runs every 30 minutes** via cron (added to `agents/may/cron.json`)
2. **Scans `.state/sessions/history/`** for sessions completed in the last 2 hours
3. **Dispatches `context-learn` events directly** — bypasses session-eval, goes straight to lesson extraction
4. **Tracks processed sessions** in `context-learn-poller-processed.json` to avoid duplicates
5. **Caps at 20 sessions per run** to avoid overload

### Design Decisions
- **Skips evaluation step**: session-eval does heuristic evaluation before context-learn. The poller skips this because getting ANY organic lessons is more important than perfect evaluation gating.
- **2-hour window**: Only processes recent sessions to avoid backfilling entire history on first run
- **Processes newest first**: Prioritizes recent sessions if there are many
- **State file caps at 500 entries**: Prevents unbounded growth

### Files Changed
- `agents/may/handlers/context-learn-poller.ts` — new handler (129 lines)
- `agents/may/cron.json` — added `context-learn-poller` entry (30min interval, 15min offset)

## Proper Fix Needed (for tech-lead)
The runtime session lifecycle manager needs to emit `session.completed` events when sessions finish. This would fix the entire chain properly:
1. Find where session status transitions to "done" in the runtime
2. Add `dispatchEvent("session.completed", { sessionId, agent, parentSessionId })` 
3. This enables both session-eval (evaluation) AND context-learn (lesson extraction)
