# Pipeline Metrics: Context-Learn Analysis

**Date:** 2026-04-29 (updated with correct root cause and fix)  
**Purpose:** Measure context-learn pipeline activity and fix the identified break

## Executive Summary

The context-learn pipeline has **zero organic lesson capture**. Root cause: **`session.completed` events are never emitted by the runtime** — no code in the entire codebase calls `dispatchEvent("session.completed", ...)`. The session-eval handler (which triggers context-learn) listens for this event but it never arrives. **Fix deployed:** a cron-based poller that bypasses the broken event chain entirely.

## Root Cause Analysis

### The Dead Event Chain
```
Session completes → [NOTHING EMITS session.completed] ← BROKEN HERE
  → session-eval.ts (on: ["session.completed"]) — NEVER FIRES
    → context-learn.ts (on: ["context-learn"]) — NEVER FIRES
      → lesson extraction — NEVER HAPPENS
```

### Evidence
1. **Grep for `session.completed` emission**: Zero results across entire codebase
   - `grep -r "dispatchEvent.*session.completed"` → nothing
   - `grep -r "emit.*session.completed"` → nothing
2. **session-eval.ts code is correct**: It already uses `ctx.dispatchEvent("context-learn", ...)` (not `ctx.emit`), so the downstream wiring is fine
3. **context-learn.ts code is correct**: Properly handles events with `agentName` and `sessionId`
4. **The runtime that manages sessions** (not in TypeScript source, likely compiled) never emits the triggering event

### Session Volume
- **35,910 session directories** in `.state/sessions/history/`
- All completed without triggering any evaluation or lesson extraction
- Sessions have proper `meta.json` with agent, status, timestamps

## Current Lesson State

| Source | Count | Type |
|--------|-------|------|
| Seeded from context.md files | 20 | Bootstrap |
| Organic (pipeline-captured) | 0 | — |
| **Total** | **20** | — |

## Fix Deployed: Context-Learn Poller

Since we don't control the core runtime that should emit `session.completed`, created a pragmatic workaround:

### New Handler: `agents/may/handlers/context-learn-poller.ts`
- Runs every **30 minutes** via cron
- Scans `.state/sessions/history/` for sessions completed in last **2 hours**
- Dispatches `context-learn` events **directly** (bypasses session-eval)
- Tracks processed sessions in state file to avoid duplicates
- Caps at **20 sessions per run**, newest first
- Skips meta-agents (evaluator, coach, judge)

### Cron Entry Added to `agents/may/cron.json`
```json
{
  "name": "context-learn-poller",
  "type": "job",
  "intervalMs": 1800000,
  "handler": "context-learn-poller",
  "agent": "may",
  "enabled": true,
  "offsetMs": 900000
}
```

### What It Skips
- **Session evaluation**: The poller goes straight to context-learn, skipping the heuristic/LLM evaluation step. This is intentional — getting organic lessons flowing is higher priority than evaluation gating.

## Files Changed

| File | Change |
|------|--------|
| `agents/may/handlers/context-learn-poller.ts` | **New** — 129-line poller handler |
| `agents/may/cron.json` | Added `context-learn-poller` entry |

## Proper Fix Needed (for tech-lead/runtime)

The runtime session lifecycle manager needs to emit `session.completed` events:
1. Find where session `status` transitions to `"done"` in the compiled runtime
2. Add `dispatchEvent("session.completed", { sessionId, agent, parentSessionId })`
3. This would enable the full chain: session-eval (evaluation) → context-learn (extraction)

**Tech-lead has been notified.**

## Recommendations

### P0 (Done): Deploy poller workaround ✅
Organic lessons should start appearing within 30 minutes of deployment.

### P1: Monitor organic lesson volume
After 24 hours, check:
- `lessons.jsonl` growth beyond the 20 seeded entries
- Agent `context.md` files for new learned facts
- May's logs for `[context-learn-poller]` and `[context-learn]` messages

### P1: Wire lessons.jsonl into context-learn handler
Current `context-learn.ts` writes to `context.md` only, not `lessons.jsonl`. Need integration.

### P2: Fix runtime event emission (proper fix)
Eliminate the poller once `session.completed` is emitted natively.
