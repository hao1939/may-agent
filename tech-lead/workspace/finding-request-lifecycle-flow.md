# Finding: Request Lifecycle Flow Complexity

**Lens**: B (Flow Complexity)  
**Date**: 2026-04-18  
**Severity**: Low (works correctly, but has unnecessary indirection)

## Summary

The request lifecycle has **3 separate completion paths** that evolved organically. While functional, this creates maintenance risk — a bug in any one path silently leaves requests stuck.

## Request Creation (1 layer, clean)

All requests are created via `trackRequest()` (`requests.ts:412`). Call sites:

- **agents.call()**: `manager-agents-tool.ts:261` — tracks before `callAgent()`, updates inline after return
- **agents.fork()**: `manager-agents-tool.ts:338` — tracks before `runAgent()`, passes `requestId` into session options
- **finish().new_items**: `session-subscribers.ts:78` — creates self-assigned requests from `new_items` array
- **auto-pause escalation**: `auto-pause.ts:265` — creates escalation requests
- **manager.escalate()**: `manager.ts:929` — creates escalation requests

## Request Completion (3 paths — the complexity)

### Path 1: Inline after call (synchronous)
`manager-agents-tool.ts:284` — after `callAgent()` returns, immediately calls `updateRequest()` with COMPLETED/FAILED. Clean, no indirection.

### Path 2: finish() with requestId (asynchronous fork)
`lifecycle.ts:268` — when a forked session calls `finish()`, it checks `options.requestId` and calls `updateRequest()`. The `requestId` flows: `trackRequest` → `runAgent(opts.requestId)` → session options → `finish()` handler.

### Path 3: completed_items fuzzy match (best-effort)
`session-subscribers.ts:97-122` — when `finish()` includes `completed_items`, fuzzy-matches each string against pending requests for that agent. Uses word-overlap scoring with 0.3 threshold (`session-subscribers.ts:116`). Only matches `method IN ('message', 'notify', 'send', 'fork', 'run')` — excludes `call` (which uses Path 1).

## Observations

1. **Path 2 and Path 3 can double-complete**: A forked session with a `requestId` will complete via Path 2 in `lifecycle.ts:268`, but if the agent also lists the task in `completed_items`, Path 3 fires too. The second `updateRequest()` is a no-op (already COMPLETED) but wastes cycles.

2. **Path 3's fuzzy matching is fragile**: The word-overlap algorithm at `session-subscribers.ts:113-116` can false-match short tasks. A `completed_items` entry like "Fix metrics" would match any pending request containing "fix" and "metrics" with >30% overlap.

3. **No completion path for notify**: The `notify` tool (`send-tool.ts`) creates requests via `trackRequest`, but notifications are fire-and-forget — there's no mechanism to mark them COMPLETED. They age out only via `archiveOld()` (`requests.ts:568`).

## Layers Count

- Creation: 1 layer (`trackRequest`)
- Completion: 3 independent paths, no shared abstraction
- Metrics: queries directly against `requests` table (no additional layer)
- Total indirection: reasonable for creation/queries, fragmented for completion

## Recommended Action

**No immediate fix needed.** The system works. If stuck-request metrics become noisy again, consider:
1. Deduplicate Path 2 + Path 3 by skipping fuzzy match when `requestId` already resolved the request
2. Auto-expire notify requests after delivery (they're inherently fire-and-forget)
