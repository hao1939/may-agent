# Lens A: agent-loader.ts Architecture Review (854 LOC)

**File**: `src/app/agent-loader.ts`  
**Date**: 2026-04-16  
**Reviewer**: tech-lead

## Summary

agent-loader.ts has **5 responsibilities**: config loading/validation, tool factory dispatch, session ID tracking, handler auto-discovery/hot-reload, and cleanup/cron lifecycle management. The file is moderately well-structured but contains significant internal duplication and a handler subsystem (~250 LOC) that could be its own module.

## Findings

### F1: Duplicated triggerHeartbeat closures (Severity: Medium)
Lines 197-204 and 220-226 contain **identical** `triggerHeartbeat` lambda implementations — one for the "agents" preset and one for "message-only". Both iterate `agentCrons.values()` with the same logic.

**Recommendation**: Extract to a shared `createTriggerHeartbeat()` helper.

### F2: Duplicated handler resolution logic (Severity: Medium)
The handler file resolution pattern (check jsPath, then tsPath, import with cache-buster, validate `create()`, wrap in hot-reload closure) appears **twice**: once in `loadAgentHandlers()` (lines ~680-750) and again in the `setHandlerResolver` callback (lines ~770-830). This is ~60 lines of near-identical code.

**Recommendation**: Extract a `resolveAndRegisterHandler(ctx, cron, entry, handlerDir, bus)` helper.

### F3: Handler subsystem is a separate concern (~250 LOC) (Severity: Low)
`loadAgentHandlers()` and its dynamic resolver (lines 600-854) handle cron handler auto-discovery, hot-reload, and dynamic resolution. This is a distinct subsystem from agent loading/registration. It imports its own dependencies (`HandlerContext`, `HandlerModule`, `getDb`, `trackRequest`, `loadAllSessionMetas`, `evaluateTask`, `log`).

**Recommendation**: Extract to `src/app/handler-loader.ts`. Would reduce agent-loader.ts to ~600 LOC and improve cohesion.

### F4: Module-level mutable state (Severity: Low)
Three module-level `Map` instances (`agentSessionIds`, `agentCleanups`, `agentCrons`) hold runtime state. These are accessed via exported getters/setters. This makes testing and reloading harder — state persists across `loadAgents()` calls.

**Recommendation**: Consider bundling into a `LoaderState` object passed to functions, or at minimum document the lifecycle expectations.

### F5: No dead exports detected (Non-finding)
All exports (`loadAgents`, `reloadAgents`, `loadAgentHandlers`, `getAgentCrons`, `runAgentCleanup`, `getAgentSessionId`, `setAgentSessionId`, `validateAgentConfig`) are consumed by `src/app/may.ts` (the sole consumer outside `src/lib/index.ts` re-export). No dead code found.

## Severity Table

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| F1 | Duplicated triggerHeartbeat closures | Medium | 15 min |
| F2 | Duplicated handler resolution logic | Medium | 30 min |
| F3 | Handler subsystem should be separate module | Low | 1 hr |
| F4 | Module-level mutable state | Low | Informational |

## Coupling Surface

- **Imports from**: `node:fs`, `node:path`, `../lib/index.js` (tool factories), `../lib/tools/agent-growth.js`, `../lib/tools/send-tool.js`, `./event-bus.js`, `./cron.js`, `../lib/handler-context.js`, `../lib/cron-tool.js`, `../lib/requests.js`, `../lib/persistence.js`, `../lib/evaluator.js`, `../lib/log.js`
- **Consumed by**: `src/app/may.ts` (sole consumer), `src/lib/index.ts` (re-export)
- **12 imports, 2 consumers** — high fan-in, low fan-out. Typical for a loader/bootstrap module.
