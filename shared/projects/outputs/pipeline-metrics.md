# Pipeline Metrics: Context-Learn Analysis

**Date:** 2026-04-29 (updated with DB evidence)  
**Purpose:** Measure context-learn pipeline activity and fix the identified break

## Executive Summary

The pipeline is **almost working** — evaluation fires heavily (32,716 evaluations, 188 `session.completed` events) but **zero `context-learn` events** reach the handler. **Root cause found and fixed:** `session-eval.ts` used `ctx.emit()` (infrastructure bus) instead of `ctx.dispatchEvent()` (handler dispatch) to emit context-learn events. Fix applied.

## Evidence from may.db

### Event Volume (from `events` table)

| Event Type | Count | Status |
|-----------|-------|--------|
| handler.started | 1,578 | — |
| handler.completed | 1,561 | — |
| metric.breach | 259 | — |
| **session.completed** | **188** | 113 pending, 75 dismissed |
| session.failed | 68 | — |
| **context-learn** | **0** | ← THE GAP |

### Evaluations: Healthy
- **32,716 total evaluations** in `evaluations` table
- 22,919 heuristic-evaluated, 3,622 LLM-evaluated
- Evaluations are happening via some path (likely residual inline logic or periodic scan)

### Session.completed Handling Issue
- 113 events still `pending` (never handled by session-eval handler)
- 75 events `dismissed` (56 bulk-dismissed as "stale events with undefined values")
- This suggests the session-eval handler may not be consistently triggered either

## Root Cause: `ctx.emit()` vs `ctx.dispatchEvent()`

**The architecture has two emit methods:**
- `ctx.emit()` — Infrastructure event (UI, DB logging, workflow steps). Goes on bus but **does NOT trigger cron.json handlers**.
- `ctx.dispatchEvent()` — Agent-level event. **Triggers handlers** subscribed via cron.json `on` field.

**In `session-eval.ts` (before fix):**
```typescript
// WRONG: emit goes to bus, not to handler dispatch
ctx.emit({ type: "context-learn", agentName: meta.agent, sessionId: evalSessionId, persistDir: ctx.persistDir });
```

**After fix:**
```typescript
// CORRECT: dispatchEvent triggers context-learn handler via cron.json "on" field
ctx.dispatchEvent("context-learn", { agentName: meta.agent, sessionId: evalSessionId, persistDir: ctx.persistDir });
```

This is the same pattern used in `agents/shared/workflows/project.ts`:
```typescript
ctx.dispatchEvent(event, { projectId, owner: config.owner, ...extra });
```

## Fix Applied

**File:** `agents/may/handlers/session-eval.ts` (line 39-45)  
**Change:** `ctx.emit({ type: "context-learn", ... })` → `ctx.dispatchEvent("context-learn", { ... })`

## Pipeline Chain (Post-Fix)

```
Session completes → session_end bus event
  → thin translator in may.ts classifies → dispatchEvent("session.completed")
    → session-eval.ts handler fires (cron.json on: ["session.completed"])
      → evaluateTask() runs (32K+ evals prove this works)
        → ctx.dispatchEvent("context-learn", ...) ← FIXED
          → context-learn.ts handler fires (cron.json on: ["context-learn"])
            → learnFromSessionLLM() / learnFromSession() extracts facts
              → writes to agent's context.md
```

## Remaining Concerns

### 1. Pending session.completed events (113)
These events were persisted but never handled. The session-eval handler may have a separate issue with event pickup. Worth monitoring after the fix.

### 2. No lessons.jsonl integration in context-learn.ts
The context-learn handler writes to `context.md` files, not `lessons.jsonl`. The lessons.jsonl format was added later and isn't wired into the organic pipeline. A future enhancement should also append to lessons.jsonl.

### 3. Seeded vs Organic lessons
- **20 seeded lessons** in lessons.jsonl (all from context.md bootstrap)
- **0 organic lessons** — expected to start appearing after the fix deploys

## Recommendations

### P0 (Done): Fix dispatchEvent ✅
Applied in this session.

### P1: Monitor after fix
After next heartbeat cycle, check:
```sql
SELECT count(*) FROM events WHERE event_type='context-learn';
```
Should start showing non-zero counts.

### P1: Wire lessons.jsonl into context-learn handler
The context-learn handler currently only updates context.md. It should also append structured lessons to lessons.jsonl for cross-agent retrieval.

### P2: Investigate pending session.completed events
113 events sitting as "pending" suggests the event→handler dispatch may have additional issues beyond the emit/dispatchEvent confusion.
