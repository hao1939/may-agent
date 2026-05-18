# Cron & Handlers

## Overview

The cron system schedules handler execution. Handlers are TypeScript functions
that run on a timer or in response to events.

Default convention:

```
timer/event -> handler -> workflow -> sessions/functions/metrics
```

Handlers are bridges. They normalize the trigger, do deterministic preflight or
skip checks, then dispatch a workflow when judgment/action is needed. Workflows
own process and agent orchestration.

## How It Works

```
cron.json defines entries → Cron class schedules ticks → handler or detached job fires
```

Each cron entry:
```json
{
  "name": "metrics-snapshot",
  "handler": "metrics-snapshot",
  "intervalMs": 300000,
  "agent": "may",
  "on": ["trigger.metrics-snapshot"]
}
```

- `intervalMs` — how often to fire (timer)
- `on` — event types that also trigger this handler (reactive)
- `handler` — filename in `agents/<agent>/handlers/`
- `agent` + `message` without a handler — detached agent job in a separate OS process
- `type` — optional legacy field; current entries are jobs (`"job"` or omitted), not `"heartbeat"`

## Handler Structure: Event-To-Workflow Bridge

```typescript
// agents/may/handlers/metric-alert-router.ts
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;
    await sdk.runWorkflow("some-workflow", "task/context from event", { source: entry.name });
    sdk.log("info", "done");
  };
};
```

When a cron entry subscribes with `on`, the handler receives a trigger object:

```typescript
{
  type: "session.completed",
  source: "event",
  entry: "evaluator-aftermath",
  data: { "sessionId": "s_123", "outcome": "done" },
  timestamp: 1778932481366
}
```

`data` is the original event object/payload. Cron does not special-case or lift
fields out of it. A handler that needs a session id reads
`event?.data?.sessionId`; a metric handler reads metric fields; a project
handler reads project fields.

Direct handler logic is acceptable for mechanical infra work such as metric
snapshots, projections, cleanup/recovery state repair, reload/restart/shutdown,
and dispatch dedup. Direct `sdk.runAgent(...)` from a handler should be
exceptional; prefer `sdk.runWorkflow(...)`.

## Mechanical Handler Exception

Metric snapshot handlers may record metrics directly because they are
deterministic measurement, not agent judgment. Target form after the query
facade lands:

```typescript
// agents/may/handlers/metrics-snapshot.ts
export const create: HandlerModule["create"] = (ctx, entry) => {
  return async () => {
    const count = ctx.sdk.query.sessions({ status: "error", windowMs: 3600000 }).length;
    ctx.sdk.metrics.record("session.error-count", count, { measuredBy: entry.name });
  };
};
```

Current mechanical handlers may still use `sdk.getDb()` directly. That should
remain an escape hatch, not the default for new judgment/action handlers.

Handlers are **hot-reloaded** — edit the file, next tick picks up changes. No restart needed.

## Handler Lifecycle Events

Every handler fire emits paired events:
```
handler.started    → handler.completed | handler.failed
```

These are used for health monitoring (success rate, duration, coverage).

## Auto-Heartbeat

Agents with heartbeat workflows get auto-generated cron entries:
- Hash-based offset (spreads heartbeats evenly)
- 30-minute default interval
- Opt-out: `"heartbeat": false` in agent.json

## Implementation

- **Cron class:** `src/app/cron.ts`
- **Handler loading:** `src/app/loader/handler-loader.ts` via the `src/app/agent-loader.ts` compatibility surface
- **Auto-heartbeat:** `generateAutoHeartbeats()` in `src/app/loader/heartbeat-loader.ts`
- **Workflow bridge helper:** `createWorkflowHandler()` from `@may-agent/sdk`
