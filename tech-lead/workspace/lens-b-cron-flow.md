# Lens B: Cron-to-Heartbeat Flow Complexity

**Date**: 2026-04-19  
**Severity**: Low (no unnecessary indirection found)

## Flow Trace

When a cron timer fires for a heartbeat agent (e.g., coach), the path is:

1. **`setInterval` callback** → calls `fire()` closure (`cron.ts:544`)
2. **`fire()`** → overlap check, auto-pause check, then `this.fireHeartbeat(entry)` (`cron.ts:546`)
3. **`fireHeartbeat()`** (`cron.ts:617`) → tracks request via `trackRequest()` (`cron.ts:629`), builds enriched task message, then calls `this.manager.run(agentName, taskMessage, ...)` (`cron.ts:878`)
4. **`manager.run()`** → creates the LLM session directly

**Total layers: 3** (timer → fireHeartbeat → manager.run). No unnecessary indirection — each layer has a distinct job.

## Injection Complexity Inside `fireHeartbeat()`

The bulk of complexity is not in layer count but in the **~250 lines of context injection** inside `fireHeartbeat()`. It builds up to 7 injection blocks before calling `manager.run()`:

1. `heartbeat.md` file content (`cron.ts:649-651`)
2. Pending tasks from request DB (`cron.ts:665-681`)
3. Owned metrics from metrics table (`cron.ts:690-723`)
4. Last interrupted session info (`cron.ts:740-772`)
5. Recent activity dashboard — 6h fleet stats (`cron.ts:781-845`)
6. Active project injection via `buildProjectInjection()` (`cron.ts:856`)
7. Pending notifications injection (further down)

Each injection is wrapped in its own try/catch for resilience (`cron.ts:641` outer try, individual inner try blocks).

## Comparison: `type: "job"` vs `type: "heartbeat"`

- **heartbeat**: `fire() → fireHeartbeat() → manager.run()` — 3 layers
- **job with handler**: `fire() → fireHandler()` — calls a JS function directly, 2 layers
- **job with `run-agent-task` handler**: `fire() → fireHandler() → handler calls manager.callAgent()` — 3 layers, same as heartbeat

No asymmetry or unnecessary indirection between the paths.

## Finding

The cron-to-heartbeat flow is **lean at the dispatch level** (3 hops, each justified). The complexity lives in the injection phase inside `fireHeartbeat()`, which is a monolithic ~250-line function assembling 7 context blocks. This is a readability/maintainability concern but not a performance or architectural issue — each block is independently try/caught and non-fatal.

**Recommended action**: None urgent. If `fireHeartbeat()` grows further, consider extracting injection blocks into helper functions. Not worth a separate session.
