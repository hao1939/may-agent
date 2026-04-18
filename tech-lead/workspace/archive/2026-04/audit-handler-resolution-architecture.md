# Audit: Handler Resolution Architecture — From Cron Entry to Execution

**Date**: 2026-04-12  
**Lens**: A (System Architecture)  
**Prior work**: audit-cron-handler-registration-flow.md (Lens B), audit-cron-architecture.md (Lens B)

---

## Executive Summary

The handler resolution system maps cron entries to executable code through **5 layers** and **3 registries**, with a **4th-layer meta-handler pattern** that adds another layer of indirection for 6 of 39 active entries. The system evolved to handle real needs (hot-reload, dynamic registration, generic task delegation) but has accumulated **architectural debt**: duplicated resolution logic between startup and dynamic paths, an inference-based mode resolver instead of explicit declarations, and a meta-handler pattern that masks the true execution target.

The biggest simplification opportunity: **make `resolveMode()` unnecessary** by adding an explicit `mode` field to CronEntry. The biggest risk reduction: **validate handler file existence at load-time**, not fire-time.

---

## The 5 Layers

### Layer 1: Config Loading (cron.json → CronEntry[])

**File**: `src/app/cron.ts` — `load()` method  
**What happens**: Reads `agents/may/cron.json`, parses JSON, validates basic fields (name, intervalMs, message|agent).

**Registry**: None — returns plain array.

**Weakness**: Validation only checks `name + intervalMs + (message || agent)`. Does NOT validate:
- Whether `handler` file exists on disk
- Whether `type` matches other fields (e.g., type=heartbeat with handler field)
- Whether the `handler` + `agent` combination makes sense

A cron entry like `{ name: "foo", intervalMs: 60000, message: "x" }` passes validation but will silently fail at fire time because `resolveMode()` returns null (no handler, no type=heartbeat, no agent).

### Layer 2: Mode Resolution (CronEntry → execution strategy)

**File**: `src/app/cron.ts` — `resolveMode()` method  
**What happens**: Infers the execution mode from entry fields.

```
resolveMode(entry):
  if entry.type === "heartbeat"     → "heartbeat"
  if handlers.has(entry.name)       → "job-handler"
  if entry.agent                    → "job-detached"
  else                              → null (logged error, silently skipped)
```

**Registry consulted**: `this.handlers` Map (name → CronHandler function)

**Critical issue**: This is **inference, not declaration**. The mode depends on runtime state (what's in the handlers Map), not just the entry's data. The same entry can resolve differently depending on when `resolveMode()` is called:
- Before `loadAgentHandlers()`: an entry with `handler: "foo"` falls through to `agent` check or null
- After `loadAgentHandlers()`: same entry resolves to "job-handler"

This temporal coupling is what caused the evaluation-sync outage.

### Layer 3: Handler Registration (handler name → JS function)

**File**: `src/app/agent-loader.ts` — `loadAgentHandlers()` function  
**What happens**: For each agent with a cron, scans its cron.json entries for `handler` fields, resolves them to `.ts` files in `agents/<name>/handlers/`, dynamically imports them, calls `registerHandler()`.

**Two registration paths** (duplicated logic):

| Path | When | Location |
|------|------|----------|
| **Startup** | Process boot | `loadAgentHandlers()` main loop (lines 444-530) |
| **Dynamic** | cron.json edit post-startup | `handlerResolver` callback (lines 533-593) |

Both paths do the same thing:
1. Resolve `agents/<agent>/handlers/<handler>.js|.ts`
2. `import()` with cache-buster
3. Check `mod.create` exists
4. Wrap in hot-reload closure
5. Call `cron.registerHandler()`

The duplication is ~60 lines of near-identical code. The dynamic path was added to fix the outage but wasn't refactored to share with the startup path.

**Registry populated**: `Cron.handlers` Map (entry.name → async function)

### Layer 4: Handler Execution (registered function → actual work)

**File**: `src/app/cron.ts` — `fireHandler()`, `fireHeartbeat()`, `fireDetachedJob()`

Three execution strategies:

| Mode | Method | What it does |
|------|--------|-------------|
| `heartbeat` | `fireHeartbeat()` | Assembles injected context (pending tasks, interrupted session, heartbeat.md), calls `manager.run()` |
| `job-handler` | `fireHandler()` | Calls `this.handlers.get(entry.name)()` — the hot-reload wrapper re-imports on each fire |
| `job-detached` | `fireDetachedJob()` | Calls `spawnDetachedAgent()` — separate OS process |

Each method tracks the execution as a request in may.db.

### Layer 4b: Meta-Handler Indirection (optional extra layer)

**Files**: `agents/may/handlers/run-agent-task.ts`, `agents/may/handlers/run-workflow.ts`

6 of 39 active entries use `handler: "run-agent-task"` — a generic handler that:
1. Reads `entry.agent` and `entry.message` from the cron entry
2. Runs optional preflight checks
3. Calls `ctx.manager.run(entry.agent, entry.message)` — spawning an LLM session

This is **a handler that does what `fireDetachedJob()` already does** (run an agent), but in-process instead of detached. The benefit is preflight checks and timeout control. The cost is an extra layer: cron → handler → run-agent-task → manager.run().

Similarly, `run-workflow` calls `ctx.manager.run()` with a workflow-structured task.

### Layer 5: HandlerContext (runtime API surface)

**File**: `src/lib/handler-context.ts`

Each handler receives a `HandlerContext` with 12 API methods (manager, DB, emit, notify, trackRequest, etc.). This is the stable contract between the cron system and handler code.

**This layer is well-designed** — it isolates handlers from internal module imports, enabling binary deployments where source isn't on disk. No change needed.

---

## The 3 Registries

| Registry | Type | Where populated | Where consumed |
|----------|------|----------------|----------------|
| `Cron.handlers` | `Map<string, CronHandler>` | `loadAgentHandlers()` + `handlerResolver` | `resolveMode()`, `fireHandler()` |
| `agentCrons` | `Map<string, Cron>` | `buildTools()` (cron preset) | `loadAgentHandlers()`, `may.ts` startup |
| `handlerResolver` | callback on Cron instance | `loadAgentHandlers()` tail | `Cron.reload()` |

**Coupling**: `agentCrons` is a module-level Map in `agent-loader.ts` that's exported and consumed by `may.ts`. The other two are instance-level on Cron. This means handler registration can only happen through the `agent-loader.ts` → `Cron` path — there's no way to register a handler from a handler or from a tool.

---

## Current State by the Numbers

```
Total cron entries:        55 (39 enabled, 16 disabled)
Entry types:
  heartbeat (type field):  10 (8 enabled, 2 disabled)
  job-handler (direct):    25 enabled
  job-handler (meta):       6 enabled (via run-agent-task/run-workflow)
  job-detached:             0 enabled
  no-mode:                  0 enabled (1 disabled)

Unique handler .ts files:  27 on disk
Handler files referenced:  28 in cron.json (1 missing: evaluate-sessions, disabled)

Meta-handlers:
  run-agent-task:          Used by 6 entries (optimize, lesson-consolidation, etc.)
  run-workflow:            Used by 1 entry (training-sprint, disabled)
```

---

## Unnecessary Indirection — What Can Be Simplified

### 1. `resolveMode()` should be eliminated

**Problem**: Mode inference from runtime state creates temporal coupling and silent failures.

**Fix**: Add explicit `mode: "heartbeat" | "handler" | "detached"` to CronEntry. Compute it once at `load()` time:
- If `type === "heartbeat"` → mode = "heartbeat"
- If `handler` field present → mode = "handler"  
- If `agent` field present (no handler) → mode = "detached"
- Otherwise → validation error at load time (not fire time)

This eliminates the runtime dependency on the handlers Map for mode decisions. `resolveMode()` becomes a lookup, not inference. Invalid entries are rejected at parse time.

**Impact**: Eliminates SF-3 silent failure. Makes the system predictable — an entry's mode never changes after load.

### 2. Handler registration paths should be unified

**Problem**: The startup path (loadAgentHandlers main loop) and dynamic path (handlerResolver callback) duplicate ~60 lines of handler import/registration logic.

**Fix**: Extract a `resolveAndRegisterHandler(cron, agentName, entry, ctx)` function called by both paths. 

**Impact**: ~60 lines removed, single place to fix handler resolution bugs.

### 3. The `run-agent-task` meta-handler conflates two concerns

**Problem**: `run-agent-task` is a handler that runs agents — it's a handler whose job is to do what the cron system already does (fire an agent session). It exists for preflight checks and in-process execution.

**Fix options**:
- **A) Add preflight support to cron.ts directly.** Move the preflight check logic (80 lines in run-agent-task.ts) into `startEntry()` so any entry can have a preflight without needing the meta-handler wrapper. This would let the 6 run-agent-task entries become direct heartbeat or handler entries.
- **B) Keep it.** The meta-handler pattern is ugly but works. Only 6 entries use it. The cost of abstraction is low.

**Recommendation**: Option A for cleanliness, but not P0. The meta-handler isn't causing bugs.

### 4. Handler file validation should happen at load time

**Problem**: An entry with `handler: "nonexistent"` passes `load()` validation, starts a timer, then fails at fire time. The error is logged once and the entry retries every interval, failing every time.

**Fix**: In `load()`, when an entry has a `handler` field, check that `agents/<agent>/handlers/<handler>.(js|ts)` exists. If not, log a warning and mark the entry invalid. This catches deployment mistakes at startup.

**Impact**: Eliminates SF-2. Would have caught the evaluate-sessions handler deletion immediately.

---

## Architecture Diagram

```
                    cron.json (data)
                         │
                    ┌────▼────┐
                    │  load() │  ← Layer 1: Parse + validate
                    └────┬────┘
                         │
                    CronEntry[]
                         │
              ┌──────────▼──────────┐
              │   resolveMode()     │  ← Layer 2: Infer execution strategy
              │  (consults handlers │     from type/handler/agent fields
              │   Map at runtime)   │     + handlers registry
              └──────────┬──────────┘
                         │
           ┌─────────────┼──────────────┐
           │             │              │
      "heartbeat"   "job-handler"  "job-detached"
           │             │              │
    ┌──────▼──────┐ ┌────▼─────┐  ┌────▼──────┐
    │fireHeartbeat│ │fireHandler│  │fireDetach │  ← Layer 4: Execute
    │ (injects    │ │(hot-reload│  │ (spawn    │
    │  context,   │ │ wrapper,  │  │  separate │
    │  manager.   │ │ re-import │  │  OS proc) │
    │  run())     │ │ on fire)  │  │           │
    └─────────────┘ └─────┬────┘  └───────────┘
                          │
              ┌───────────▼────────────┐
              │    Handler .ts file    │  ← Layer 3: Registration
              │  create(ctx, entry)    │     (happened earlier, at startup
              │  → async () => {...}   │      or dynamically via resolver)
              └───────────┬────────────┘
                          │
                   ┌──────▼──────┐
                   │ HandlerCtx  │  ← Layer 5: Runtime API
                   │ (12 methods)│
                   └─────────────┘
                          │
              ┌───────────▼────────────┐
              │  Meta-handler?         │  ← Layer 4b (optional)
              │  run-agent-task:       │     Some handlers just call
              │    preflight check     │     manager.run() themselves
              │    → manager.run()     │
              └────────────────────────┘
```

---

## Consolidation Opportunities — Priority Ranked

| # | Change | Lines saved | Risk reduced | Effort |
|---|--------|-------------|-------------|--------|
| 1 | Validate handler files at `load()` | ~0 (add check) | High — eliminates SF-2 | Small |
| 2 | Unify startup + dynamic registration | ~60 | Medium — single fix point | Small |
| 3 | Add `mode` field, deprecate inference | ~15 + clarity | High — eliminates SF-3 | Medium |
| 4 | Move preflight checks into cron.ts | ~80 from meta-handler | Low — convenience | Medium |
| 5 | Extract heartbeat injection to module | ~150 from cron.ts | Low — readability | Medium |

**Recommended first action**: Items 1 and 2 together — validate handler files at load time, and unify the two registration paths into one shared function. This is a focused change (~80 lines touched) with the highest risk reduction.

---

## Comparison with Prior Audits

| Audit | Focus | Key finding |
|-------|-------|-------------|
| **cron-handler-registration-flow** (Lens B) | End-to-end trace | 6 layers, 2 silent failure paths, handler resolver closes main gap |
| **cron-architecture** (Lens B) | Complexity & cost | 959-line class, dead auto-pause handler, 28K ops/week heartbeat cost |
| **This audit** (Lens A) | Architecture structure | 5 layers + meta-handler sublayer, 3 registries, inference-based mode resolution is root architectural weakness |

The Lens B audits documented *what* is complex. This audit documents *why* — the inference-based mode resolution creates temporal coupling between registration timing and mode decisions, which is the architectural root cause of the outage class.
