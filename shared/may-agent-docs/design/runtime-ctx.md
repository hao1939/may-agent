# Design: RuntimeCtx — Shared Infrastructure Interface

**Status:** Draft
**Date:** 2026-04-21
**References:** [core-principles.md](core-principles.md) (P1, P9), [closing-the-loop.md](closing-the-loop.md) (G12)

---

## Problem

Three separate contexts provide infra access, each with different capabilities:

| Context | emit events | getDb | log | notify | paths |
|---------|-------------|-------|-----|--------|-------|
| **HandlerContext** (cron handlers) | ✅ domain + bus | ✅ | ✅ | ✅ | ✅ |
| **WorkflowContext** (workflows) | workflow events only | ❌ | ❌ | ❌ | ❌ |
| **Agent tools** (LLM sessions) | ❌ | ❌ | ❌ | ❌ | ❌ |

Workflows can't emit domain events (`metric.breach`), can't query metrics, can't access the DB. Agent tool implementations have no infra interface at all. Each context reinvents what it needs or goes without.

This violates P1 (everything is an event — but workflows can't emit them) and P9 (convention over configuration — three contexts is three configurations for the same thing). Workflow events are also separate from domain events, with their own callback path instead of going through the bus.

## Solution

Extract a `RuntimeCtx` interface — the shared infra surface that handlers, workflows, and agent tools all access:

```typescript
interface RuntimeCtx {
  /** Emit an event on the bus. All events — workflow, domain, system — go through one bus. Persisted by DbWriter. */
  emit(event: { type: string; [key: string]: unknown }): void;

  /** Open the shared SQLite database. */
  getDb(): SqliteDb;

  /** Log a diagnostic message. */
  log(msg: string): void;

  /** Send a human-visible notification (Telegram, web). */
  notify(msg: string): void;

  /** Paths. */
  persistDir: string;
  projectRoot: string;
  agentsRoot: string;
}
```

## How It Composes

The existing contexts wrap RuntimeCtx — they don't replace it:

```
RuntimeCtx (shared infra)
  ├── emit, getDb, log, notify, paths

HandlerContext = RuntimeCtx + handler-specific
  + manager, triggerNow, evaluateTask, trackRequest, getSessionId, ...

WorkflowContext = RuntimeCtx + workflow-specific
  + runAgent, runWorkflow, runFunction, summarize, done, escalate

Agent tools receive RuntimeCtx (or subset) via creation options
  + opt-in: only tools that need infra access declare it
```

## What Changes

### 1. Define `RuntimeCtx` interface (~10 lines)

New file or added to `handler-context.ts`. Type-only — no runtime code.

### 2. `HandlerContext extends RuntimeCtx`

No behavioral change. Just type narrowing. Every HandlerContext already satisfies RuntimeCtx — this makes it explicit.

### 3. `WorkflowContext` gains RuntimeCtx

In `workflow-tool.ts` where `const ctx: WorkflowContext = { ... }` is constructed (line 429), the factory already has access to `bus.emit`, `persistDir`, and can call `getDb` from the same scope that handlers use. The infra is already there — it's just not exposed on the context object.

```typescript
// Today (workflow-tool.ts):
const ctx: WorkflowContext = {
  task,
  agent: opts.agentName,
  runAgent: ...,
  emit: (event) => onEvent?.(event),  // separate callback, not on bus
  ...
};

// After:
const ctx: WorkflowContext = {
  task,
  agent: opts.agentName,
  runAgent: ...,
  emit: (event) => bus.emit(event),   // all events go to the bus
  getDb: () => getDb(persistDir),
  log: (msg) => bus.emit({ type: "log", level: "info", message: msg }),
  notify: (msg) => bus.emit({ type: "notification", agent: opts.agentName, text: msg }),
  persistDir,
  projectRoot,
  agentsRoot,
  ...
};
```

Workflow events (`step_start`, `step_done`) go to the same bus as domain events (`metric.breach`, `project.changed`). The workflow runner subscribes to the bus for workflow events it cares about — same pattern as DbWriter subscribes for session events. No separate callback path.

### 4. Agent tool factories can accept RuntimeCtx (future, opt-in)

Tools that need infra access declare it in their factory signature. Most tools don't need it — bash, read, write are self-contained. But a future `emit-event` tool or `query-metrics` tool would.

## What Doesn't Change

- No new class, no new instantiation — `RuntimeCtx` is an interface satisfied by existing objects
- Handlers keep working exactly as today
- Workflows gain capabilities they didn't have (emit, getDb, log, notify)
- Agent tools gain capabilities opt-in (only tools that declare the need)
- No changes to how workflows or handlers are invoked

## Why an Interface, Not a Class

Per P10 (simple first): `RuntimeCtx` is a type contract, not a runtime object. The concrete implementations already exist in handler-context creation and workflow-tool construction. We're naming the overlap and ensuring both sides expose it. If we later need a shared implementation (e.g., for metrics convenience methods), it can become a class then.

## What This Enables

One `emit`. One bus. One event log. Workflow events, metric breaches, project changes — all just events.

With RuntimeCtx available in workflows:

- **persistent-task** can emit `project.milestone-completed` events
- **error-scan** can emit `error.pattern-detected` events
- Workflows can query metrics directly instead of shelling out
- Workflows can log diagnostics visible in the event stream
- New workflows get infra access for free — just use `ctx.emit`, `ctx.getDb`

With RuntimeCtx available in agent tools (future):

- A `system-status` tool can query metrics from the DB
- An `emit-event` tool lets agents fire domain events explicitly
- Tools can log structured diagnostics

## Implementation

~30 LOC total:
- ~10 lines: `RuntimeCtx` interface definition
- ~20 lines: wire infra into WorkflowContext construction in workflow-tool.ts
