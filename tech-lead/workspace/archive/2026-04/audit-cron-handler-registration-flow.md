# Audit: Cron Handler Registration Flow

**Date**: 2026-04-12  
**Lens**: B (Flow Complexity)  
**Triggered by**: evaluation-sync outage (handler added to cron.json post-startup, silently never ran)

## Executive Summary

The flow from cron.json edit → handler execution involves **6 layers of indirection** across 3 files, with **2 silent failure paths** and a **handler resolver that works but wasn't wired at the time of the outage**. The system is more complex than it needs to be, but the post-outage fix (handlerResolver) closed the critical gap. Remaining risks: entries without `handler` field that also lack `agent` field still silently skip, and the resolver itself has a subtle race condition.

## Full Flow Trace

### Layer 1: File Watch → Reload Trigger

**Files**: `src/app/cron.ts` lines 108-139 (`watchConfig()`)

Two redundant watchers detect cron.json changes:
1. `fs.watchFile()` — stat-based polling every 30s
2. `setInterval` fallback — content-hash poll every 15s

Both call `this.reload()`. The hash-based dedup prevents double-firing.

**Complexity note**: Two watchers for one file is defensive but reasonable for containers. Not a problem.

### Layer 2: Reload → Diff and Restart

**File**: `src/app/cron.ts` lines 189-257 (`reload()`)

1. Saves old entries, re-reads cron.json via `this.load()`
2. Diffs old vs new entries (by name + config equality check)
3. For removed entries: clears timers
4. For changed/new entries:
   - If entry has `handler` field AND no registered handler AND `handlerResolver` exists → **queues for async resolution** (line 227-229)
   - Else → calls `startEntry(entry)` immediately

**Critical path**: If `handlerResolver` is NOT set (pre-fix), a new handler entry with no registered function falls through to `startEntry()`, which calls `resolveMode()`.

### Layer 3: resolveMode() — The Decision Point

**File**: `src/app/cron.ts` lines 266-277

```typescript
resolveMode(entry): "heartbeat" | "job-handler" | "job-detached" | null {
  if (entry.type === "heartbeat") return "heartbeat";
  if (this.handlers.has(entry.name)) return "job-handler";  // ← handler must be registered
  if (entry.agent) return "job-detached";
  
  this.onError?.(`Cron entry "${entry.name}" has no handler and no agent — skipping`);
  return null;
}
```

Three paths:
1. **heartbeat** — type field is "heartbeat" → fire heartbeat session (works immediately, no handler needed)
2. **job-handler** — handler function registered in `this.handlers` Map → run JS function in-process
3. **job-detached** — has `agent` field → spawn OS process via `spawnDetachedAgent()`
4. **null** — **SILENT SKIP** (logged via onError, but the message is buried in bus log)

### Layer 4: Handler Registration (startup path)

**File**: `src/app/agent-loader.ts` lines 392-530 (`loadAgentHandlers()`)

Called ONCE at startup, AFTER `loadAgents()`, AFTER `cron.start()`:

```
may.ts startup sequence:
  1. loadAgents()          → registers agent configs, creates Cron instances
  2. cron.start()          → reads cron.json, starts all timers (some entries may fire!)
  3. loadAgentHandlers()   → scans cron.json for handler entries, imports .ts files, registerHandler()
```

Wait — let me re-check the actual startup order in may.ts:

```
Line 540: loadAgents()                    → creates Cron instances (in buildTools "cron" preset)
                                           → calls cron.load() (reads entries from cron.json)
...
Line 1147: loadAgentHandlers()            → registers handler functions
Line 1166: for (cron of agentCrons) {
Line 1178:   cron.start()                 → starts timers
           }
```

**CORRECTION**: `cron.start()` actually happens AFTER `loadAgentHandlers()`. The boot sequence is:
1. `loadAgents()` → creates Cron instances, `cron.load()` reads cron.json
2. `loadAgentHandlers()` → imports handler .ts files, calls `cron.registerHandler()`
3. `cron.start()` → starts timers for all entries

So at startup, the sequence is correct — handlers are registered before timers start.

### Layer 5: Handler Resolver (dynamic path — post-outage fix)

**File**: `src/app/agent-loader.ts` lines 533-593

At the end of `loadAgentHandlers()`, a `handlerResolver` is set on each Cron instance:

```typescript
cron.setHandlerResolver(async (entryName) => {
  // Find the entry, look up handler file, import it, registerHandler()
});
```

This resolver is called by `reload()` (Layer 2) when a new handler entry appears post-startup. It dynamically imports the .ts file and registers the handler.

### Layer 6: Fire → Execution

Once `resolveMode()` returns a mode, the entry goes through:
- `startEntry()` → `computeResumeDelay()` → `setTimeout` → `fire()` (with overlap check) → one of:
  - `fireHeartbeat()` — calls `manager.run()` for an in-process LLM session
  - `fireHandler()` — calls `this.handlers.get(entry.name)()` 
  - `fireDetachedJob()` — calls `spawnDetachedAgent()`

## Silent Failure Points

### SF-1: Entry with `handler` field but no registered handler AND no `handlerResolver`

**Status**: FIXED by handlerResolver wiring. But the fix depends on `loadAgentHandlers()` having been called. If the process starts without `--cron`, `loadAgentHandlers()` is never called, no resolver is set, and dynamic handler entries silently skip.

**Impact**: Low — cron only runs with `--cron` flag.

### SF-2: Entry with `handler` field but handler file doesn't exist on disk

The resolver throws, and the error is caught and logged:
```
[handler] Failed to load handler for "evaluation-sync": Handler file not found: ...
```
This is good — it's logged. But it's logged once and the entry never retries. If the file is deployed later, there's no mechanism to pick it up until the next `reload()` cycle triggered by a cron.json edit.

### SF-3: Entry with neither `handler` nor `agent` field

`resolveMode()` logs: `Cron entry "X" has no handler and no agent — skipping`

But this is a **data error** (invalid cron.json entry). The `load()` validator already checks for this:
```typescript
if (!entry.message && !entry.agent) {
  this.onError?.(`Cron entry "${entry.name}" needs message or agent`);
  return false;
}
```

Wait, that's checking `message || agent`, not `handler || agent`. An entry with `message` but no `handler` and no `agent` passes `load()` validation but fails `resolveMode()`. Example:
```json
{ "name": "foo", "intervalMs": 60000, "message": "do something", "enabled": true }
```
This passes validation, starts a timer, but every fire silently logs and skips.

### SF-4: handler file imported successfully but `create()` throws at runtime

The hot-reload wrapper in `loadAgentHandlers()` re-imports on every fire. If the file was valid at startup but becomes invalid later (syntax error after live edit), the error is caught in `fireHandler()` — BUT the catch is in the handler's `.then/.catch` chain, so it's logged and the request is marked FAILED. **This one is handled correctly.**

## Complexity Assessment

| Aspect | Count | Notes |
|--------|-------|-------|
| Files involved | 3 | cron.ts, agent-loader.ts, may.ts |
| Layers of indirection | 6 | file watch → reload → resolveMode → handler lookup → fire → execute |
| Maps/registries | 3 | `handlers` Map, `agentCrons` Map, `handlerResolver` callback |
| Entry types | 3 | heartbeat, job-handler, job-detached |
| Watcher mechanisms | 2 | watchFile + setInterval fallback |
| Silent failure paths | 2 | SF-2 (no retry), SF-3 (valid entry, invalid at runtime) |

**Is this unnecessarily complex?** Partially.

The 3 execution modes (heartbeat, job-handler, job-detached) are **justified** — they serve genuinely different needs. The handler resolver is a good dynamic-registration fix.

What IS unnecessarily complex:
1. **`resolveMode()` is doing too much inference.** It infers the mode from multiple fields (`type`, `handler` presence, `agent` presence) when the entry could just declare its mode explicitly. The `type` field only distinguishes "heartbeat" vs "job", and "job" then requires further inference.
2. **Handler registration is split across two phases** (startup + resolver) with duplicated logic (the resolver essentially re-implements `loadAgentHandlers`'s inner loop).
3. **The `handler` field in CronEntry is a filename, not a mode declaration.** If you set `handler: "evaluation-sync"` but the file doesn't exist, you get a runtime error, not a validation error. This should be caught in `load()`.

## Proposed Fixes (no code changes — analysis only)

### Fix 1: Validate handler files in `load()` (Simple, High Impact)

When `load()` reads cron.json, for entries with `handler` field, check that the handler file exists on disk. If not, log a clear warning AND mark the entry as invalid (skip it). This catches the "handler added but file not deployed" scenario at config-parse time instead of at fire time.

### Fix 2: Add explicit `mode` field to CronEntry (Medium, Reduces Inference)

Instead of inferring mode from `type` + `handler` + `agent`, add a `mode: "heartbeat" | "handler" | "detached"` field. This makes the intent explicit and eliminates `resolveMode()`'s inference logic. Backward-compatible: compute mode from existing fields if `mode` is not set.

### Fix 3: Log level escalation for mode resolution failures (Simple, High Impact)

When `resolveMode()` returns null, the current log is:
```
Cron entry "X" has no handler and no agent — skipping
```
This should be escalated to a **notification** (visible to human), not just a bus log. Silent skips are the root cause of the outage.

### Fix 4: Periodic handler re-check (Medium, Closes SF-2)

Add a periodic check (e.g., on each reload) that re-validates all entries with `handler` field against the handler registry. If a handler was previously unregistered and now a file exists, attempt to resolve it. This closes the gap where a handler file is deployed between reloads.

## Relationship to Evaluation-Sync Outage

The outage had two causes:
1. **Primary**: `evaluation-sync` was added to cron.json AFTER process started. Since `loadAgentHandlers()` only runs at startup, the handler was never registered.
2. **Contributing**: The old `evaluate-sessions` handler file was deleted, breaking the last working evaluation path.

The **handlerResolver** (Layer 5) was added as a fix. It closes the primary gap: when `reload()` detects a new entry with `handler` field, it calls the resolver to dynamically import and register. This works correctly for the common case.

The remaining gap: if someone adds an entry to cron.json with `handler: "foo"` and `foo.ts` doesn't exist yet, the resolver fails once and the entry never runs until the next cron.json edit triggers another `reload()`. Fix 4 above would close this.

## Verdict

**Flow complexity: 6/10** — More layers than ideal, but each serves a purpose. The biggest simplification opportunity is making mode explicit (Fix 2) and validating handler files at parse time (Fix 1). The handler resolver is well-designed but the duplicated logic with startup registration is a maintenance hazard.

**Silent failure risk: 7/10** — The outage was caused by exactly this: a valid-looking entry that silently did nothing. The resolver fix reduced this risk, but entries without the right field combinations can still silently skip. Fix 3 (notification on skip) would make these failures visible immediately.
