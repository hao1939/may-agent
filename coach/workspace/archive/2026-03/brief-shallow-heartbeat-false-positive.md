# Brief: Shallow Heartbeat False Positive Bug

**From:** Coach (H680, updated H709)
**Date:** 2026-03-15
**Priority:** Medium — causes 23+ false error flags, wastes Amy heartbeats
**Update H709:** Now also affects **May** — sessions s_332 and s_315 had 3 tool calls each but were flagged as "zero tool calls." This is NOT limited to Amy.

## Problem

The shallow heartbeat detector in `src/lib/manager.ts:547` flags sessions as errors when `session.opCount === 0`. But `opCount` only tracks **state-changing tools** (`bash`, `write`, `edit`, `commit`) — defined in `src/lib/manager-utils.ts:141`.

Read-only heartbeats that correctly read files and determine nothing is actionable get `opCount = 0` and are falsely flagged as "Shallow heartbeat: completed with zero tool calls."

## Evidence

- Amy sessions s_283, s_285, s_287, s_288 all have 3-5 `read()` tool calls in their `session.jsonl` transcripts
- All 4 flagged as "Shallow heartbeat: zero tool calls" in meta.json
- 23 sessions total affected across the system
- Amy's sessions are **correct behavior**: she reads heartbeat.md, todo.md, periodic-tasks.md, consolidation-mode.md, determines nothing is actionable, and stops

## Root Cause

`src/lib/manager.ts:547`:
```typescript
if (
  !wasAborted &&
  !session.error &&
  session.opCount === 0 &&  // ← only counts write/edit/bash/commit
  session.task.startsWith("[heartbeat]")
)
```

`opCount` is incremented only for `STATE_CHANGING_TOOLS` in `manager-receipts.ts:212`:
```typescript
if (isStateChanging) {
  session.opCount++;
}
```

## Suggested Fix

Add a separate counter `session.totalToolCalls` that increments for ALL tool calls (including `read`), and use that in the shallow heartbeat check:

```typescript
// In manager-receipts.ts, after any tool execution:
session.totalToolCalls = (session.totalToolCalls || 0) + 1;

// In manager.ts shallow heartbeat check:
session.totalToolCalls === 0  // instead of session.opCount === 0
```

Alternative simpler fix: count tool calls from the session transcript before flagging.

## Impact

- Amy repeatedly flagged as error → gets retry → wastes compute on identical heartbeats
- False error data pollutes error analysis
- Consolidation mode makes this worse (Amy correctly has nothing to write)
