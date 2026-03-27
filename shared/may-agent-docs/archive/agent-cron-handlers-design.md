# Agent-Owned Cron Handlers

> **Archive**. This design was **implemented**. Handlers live in
> `agents/<name>/handlers/` and are auto-discovered by `loadAgentHandlers()`
> in `agent-loader.ts`. See [Cron System](../architecture/cron-system.md)
> for the current architecture.

## Problem

Cron job handlers (JS functions that replace LLM calls) are hardcoded in `run/may.ts`:

```typescript
// run/may.ts — 50 lines of hardcoded handler registration
if (name === "may") {
  cron.registerHandler("system-status", async () => { ... });
  cron.registerHandler("evaluate-sessions", async () => { ... });
  cron.registerHandler("drain-todo", createDrainTodoHandler(...));
  cron.registerHandler("optimizer-drain-todo", createDrainTodoHandler(...));
  cron.registerHandler("bob-drain-todo", createDrainTodoHandler(...));
}
```

The actual handler logic lives in `run/handlers/` — infrastructure code that implements agent-specific business logic. Adding a new JS handler requires editing two infrastructure files (`run/may.ts` and a new file in `run/handlers/`).

## Design: Agent-owned handlers

### Directory structure

```
agents/may/
  cron.json                          # declares jobs (unchanged)
  handlers/
    system-status.ts                 # JS handler — was run/handlers/system-status.ts
    evaluate-sessions.ts             # JS handler — was run/handlers/evaluate-sessions.ts
    drain-todo.ts                    # JS handler — was run/handlers/drain-todo.ts
    daily-brief.ts                   # JS handler — was run/handlers/daily-brief.ts

agents/bob/
  cron.json                          # bob could define own handlers too
  handlers/
    some-handler.ts                  # hypothetical future handler
```

### Handler interface

Each handler file exports a `create` factory function:

```typescript
// agents/may/handlers/system-status.ts
import type { HandlerContext } from "../../../run/handler-context.js";

export function create(ctx: HandlerContext): () => Promise<void> {
  return async () => {
    // ... system status logic, using ctx.persistDir, ctx.manager, etc.
  };
}
```

### HandlerContext

A single interface provides everything handlers need:

```typescript
// run/handler-context.ts
export interface HandlerContext {
  manager: SubagentManager;    // for run(), followUp(), etc.
  persistDir: string;          // .state directory
  projectRoot: string;         // repo root
  agentsRoot: string;          // agents/ directory
  agentName: string;           // "may", "bob", etc.
  sessionId: string | null;    // agent's persistent session (for followUp)
  emit: (msg: string) => void; // send message to bus (shows in console/telegram)
}
```

### Discovery flow

In `agent-loader.ts`, during agent registration:

```
For each agent:
  1. Load cron.json entries
  2. For each entry with "handler" field:
     a. Look for agents/<name>/handlers/<handler>.ts
     b. Dynamic import: const mod = await import(handlerPath)
     c. Call mod.create(ctx) to get the handler function
     d. cron.registerHandler(entry.name, handlerFn)
  3. If handler file not found, warn and skip (fall back to LLM task)
```

### What changes

| Before | After |
|--------|-------|
| Handler logic in `run/handlers/*.ts` | Handler logic in `agents/<name>/handlers/*.ts` |
| Registration hardcoded in `run/may.ts` | Auto-discovered by `agent-loader.ts` |
| Only May can have JS handlers | Any agent can have JS handlers |
| Adding handler = edit 2 infra files | Adding handler = drop file + cron.json entry |

### What stays the same

- `cron.json` format unchanged — `"handler": "system-status"` still works
- `Cron` class unchanged — `registerHandler()` API stays the same
- Three execution modes unchanged: heartbeat, job-handler, job-task
- Job history tracking unchanged

### Cron entry linking

The cron entry's `"handler"` field names the handler file:

```json
{
  "name": "system-status",
  "handler": "system-status",
  "type": "job",
  "intervalMs": 14400000
}
```

Maps to: `agents/may/handlers/system-status.ts`

### drain-todo: multi-agent pattern

`drain-todo.ts` is special — it handles three cron entries (`drain-todo`, `optimizer-drain-todo`, `bob-drain-todo`) with different configs. Two approaches:

**Option A: One handler file, multiple cron entries with config**
```json
{ "name": "drain-todo", "handler": "drain-todo", "handlerConfig": { "sourceAgent": "may", "mode": "followUp" } }
{ "name": "optimizer-drain-todo", "handler": "drain-todo", "handlerConfig": { "sourceAgent": "optimizer", "mode": "run" } }
```

The `create()` function receives the full cron entry and can read `handlerConfig`.

**Option B: Separate handler files** (simpler but repetitive)
```
agents/may/handlers/drain-todo.ts
agents/may/handlers/optimizer-drain-todo.ts
agents/may/handlers/bob-drain-todo.ts
```

**Recommended: Option A** — it's the same logic with different parameters. The `create` function signature becomes:

```typescript
export function create(ctx: HandlerContext, entry: CronEntry): () => Promise<void> {
  const config = entry.handlerConfig as DrainTodoConfig;
  // ...
}
```

### Error handling

- If `agents/<name>/handlers/<handler>.ts` doesn't exist → log warning, handler not registered → cron falls back to spawning an LLM task (the `"message"` field is still there)
- If `create()` throws → log error, handler not registered → same fallback
- If handler function throws at runtime → caught by `Cron.fireJobHandler()`, logged to job history (existing behavior)

### Migration steps

1. Create `run/handler-context.ts` with `HandlerContext` interface
2. Move `run/handlers/*.ts` → `agents/may/handlers/*.ts`
3. Refactor each to export `create(ctx, entry)` factory
4. Add handler discovery to `agent-loader.ts`
5. Remove hardcoded registration from `run/may.ts`
6. Remove empty `run/handlers/` directory
7. Update tests

## Implementation Status — 2026-03-06

✅ **Steps 1-5 complete.** Handler context, handler files, auto-discovery, and may.ts cleanup all done.

Remaining:
- Step 6: `run/handlers/` files still exist — tests import from them. Can be removed once tests are updated to import from `agents/may/handlers/` instead.
- Step 7: Tests still reference `run/handlers/` for unit-testing individual handler functions. The auto-discovery integration works but doesn't have dedicated tests (tested via full startup).

Key files:
- `run/handler-context.ts` — `HandlerContext` + `HandlerModule` interfaces
- `run/agent-loader.ts` — `loadAgentHandlers()` function (lines 525-604)
- `agents/may/handlers/` — 4 handler files (system-status, evaluate-sessions, drain-todo, daily-brief)
- `agents/may/cron.json` — 5 entries with `handler` field (3 use drain-todo with different handlerConfig)
