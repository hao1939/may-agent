# Timer Triggers & Handlers

## Overview

Timer triggers are one way to invoke a handler. Event subscriptions and manual
operator triggers use the same handler interface.

The runtime file is still named `cron.json` and the CLI flag is still `--cron`,
but the behavior model is simpler:

```
timer/event/manual trigger -> handler -> workflow/code -> sessions/functions/metrics
```

A handler can be:

- a named TypeScript handler for deterministic code;
- a workflow-backed handler object for straightforward agent/workflow work.

Workflows are not a separate trigger mode. A workflow-backed handler implements
the same trigger interface as a code handler.

## How It Works

```
cron.json defines trigger entries -> timer/event/manual trigger fires -> handler runs
```

Named code handler:

```json
{
  "name": "metrics-snapshot",
  "handler": "metrics-snapshot",
  "intervalMs": 300000,
  "agent": "may",
  "enabled": true
}
```

Workflow-backed handler:

```json
{
  "name": "evaluator-aftermath",
  "handler": {
    "workflow": "evaluator-aftermath",
    "agent": "evaluator",
    "task": "Review the completed session and record evaluator signal.",
    "includeEvent": true,
    "timeoutMs": 900000
  },
  "enabled": true,
  "on": ["session.completed"]
}
```

- `intervalMs` — how often to fire (timer)
- `on` — event types that also trigger this handler (reactive). `trigger.<entry>`
  is an operator/control shortcut for manual firing; domain lifecycle events
  should use their canonical names such as `timer.tick` or
  `session.completed`.
- `handler: "name"` — filename in `agents/<agent>/handlers/`
- `handler: { workflow, agent, task }` — workflow-backed handler
- `agent` + `message` without a handler — compatibility path for detached agent jobs
- `type` — optional legacy field; current entries are jobs (`"job"` or omitted), not `"heartbeat"`

## Handler Structure

```typescript
// agents/may/handlers/metric-alert-router.ts
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: EventEnvelope) => {
    const sdk = ctx.sdk;
    await sdk.runWorkflow("some-workflow", "task/context from event", { source: entry.name });
    sdk.log("info", "done");
  };
};
```

Use a TypeScript handler when the work is deterministic infra logic: metrics,
query/projection, dedup, cooldown, state repair, reload/restart/shutdown, or
selecting which workflow should run.

Use a workflow-backed handler object when the handler would only run one known
workflow with a fixed task.

When a trigger entry subscribes with `on`, the handler receives the original
canonical event envelope:

```typescript
{
  type: "session.completed",
  source: "runtime",
  owner: "agent:may",
  data: { "sessionId": "s_123", "outcome": "done" },
  timestamp: 1778932481366
}
```

Cron does not wrap event-subscription payloads and does not lift fields out of
`data`. A handler that needs a session id reads `event?.data?.sessionId`; a
metric handler reads metric fields from `event.data`; a project handler reads
project fields the same way.

Direct handler logic is acceptable for mechanical infra work such as metric
snapshots, projections, cleanup/recovery state repair, reload/restart/shutdown,
and dispatch dedup. Direct `sdk.runAgent(...)` from a handler is exceptional;
prefer a workflow-backed handler or `sdk.runWorkflow(...)` from deterministic
handler code.

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

Agents with heartbeat workflows get auto-generated trigger entries:
- Hash-based offset (spreads heartbeats evenly)
- 30-minute default interval
- Opt-out: `"heartbeat": false` in agent.json

## Implementation

- **Trigger scheduler class:** `src/app/cron.ts` (historical name)
- **Handler loading:** `src/app/loader/handler-loader.ts` via the `src/app/agent-loader.ts` compatibility surface
- **Auto-heartbeat:** `generateAutoHeartbeats()` in `src/app/loader/heartbeat-loader.ts`
- **Workflow-backed handler adapter:** `createWorkflowHandler()` from `@may-agent/sdk`, used by the loader for `handler: { workflow, agent, task }`
