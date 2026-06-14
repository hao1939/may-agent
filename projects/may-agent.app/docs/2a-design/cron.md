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
- `handler: "name"` — filename in `handlers/` beside the owning `cron.json`
- `handler: { workflow, agent, task }` — workflow-backed handler
- `context` — local docs/projects/agent files that explain why this trigger
  exists and where maintenance/improvement should happen
- `message` — not a trigger mode; use `handler.task` for workflow-backed work
- `type` — optional legacy field; current entries are jobs (`"job"` or omitted), not `"heartbeat"`

## Handler Structure

```typescript
// agents/may/handlers/metric-alert-router.ts
import type {
  CronEntry,
  EventEnvelope,
  HandlerContext,
  HandlerModule,
} from "@may-agent/sdk";

export const create: HandlerModule["create"] = (
  ctx: HandlerContext,
  entry: CronEntry,
) => {
  return async (event?: EventEnvelope) => {
    const sdk = ctx.sdk;
    await sdk.runWorkflow("some-workflow", "task/context from event", {
      source: entry.name,
    });
    sdk.log("info", "done");
  };
};
```

## Handler Ownership

A handler belongs to the trigger entry that registers it. In practice, that means
it is scoped by the `cron.json` file it sits beside:

| Scope              | Trigger file                                       | Named handler file                                          | Use for                                                                                  |
| ------------------ | -------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Agent-owned        | `agents/<agent>/cron.json`                         | `agents/<agent>/handlers/<name>.ts`                         | Agent/system duties such as May project reconciliation, evaluator scans, metric handling |
| Project-owned (V2) | `projects/<project>/.app/agents/<agent>/cron.json` | `projects/<project>/.app/agents/<agent>/handlers/<name>.ts` | Legacy V2 embedded-app projects (backward compat)                                        |

V3 sibling apps do not use project-local `cron.json`. They declare schedules,
workflow handlers, actions, and event adapter behavior in
`projects/<project>.app/app.ts`. Their `agents/` folders are worker identities
and owner-inference inputs, not trigger-definition roots.

The runtime's legacy project-agent discovery still scans two project-agent
locations for backward compatibility:

1. **V2 embedded app:** `projects/<project>/.app/agents/`
2. **Flat:** `projects/<project>/agents/`

V3 is canonical for new and migrated projects. V2 paths remain for backward
compatibility but should not be used in new projects (see `project-app-v3.md`).

Project-wide platform behavior, such as reconciling all projects or routing
canonical escalation events, remains owned by a global agent such as May. A
project-local handler is for project-specific automation, not for changing shared
infra policy.

Workflow-backed handlers follow the same ownership rule. The trigger entry owns
the wake-up policy; the configured workflow owns the work.

Each trigger entry should include a small `context` array. These are not loaded
automatically into every run; they are durable pointers for humans and agents
who need to maintain, debug, or improve the loop:

```json
{
  "name": "metric-alert-reactor",
  "handler": "metric-alert-reactor",
  "context": [
    "projects/system-operations/project.md",
    "projects/may-agent.app/docs/2a-design/metrics.md"
  ]
}
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
    const count = ctx.sdk.query.sessions({
      status: "error",
      windowMs: 3600000,
    }).length;
    ctx.sdk.metrics.record("session.error-count", count, {
      measuredBy: entry.name,
    });
  };
};
```

Current mechanical handlers may still use `sdk.getDb()` directly. That should
remain an escape hatch, not the default for new judgment/action handlers.

Named handler files are **hot-reloaded** — edit the file, next tick picks up
changes. No restart needed.

Trigger declarations are a separate reload surface. Editing `cron.json` changes
the wake policy and is picked up by the scheduler config watcher. Editing a
project app manifest (`projects/*.app/app.ts`) changes app-owned handlers,
schedules, actions, or event routing and is picked up by the project-app
manifest watcher or explicit runtime reload.

## Handler Lifecycle Events

Every handler fire emits lifecycle events. The full set observed in production
(24h sample, last updated 2026-06-13):

```
handler.started              → handler.completed | handler.failed
                             → handler.workflow_dispatched  (workflow-backed handlers)
handler.skipped              (handler declined to run — dedup, no-op, classifier chose nothing)
handler.routed               (rare — handler forwarded to another handler)
```

| Event                         | Typical 24h volume | Purpose                                                                                                                                                           |
| ----------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handler.started`             | ~5000              | Handler fire began                                                                                                                                                |
| `handler.completed`           | ~5000              | Handler fire finished successfully                                                                                                                                |
| `handler.skipped`             | ~1400              | Handler decided no action needed (e.g., session-recovery skipping non-recoverable events, classifier chose nothing, metric auto-handler already covers the alert) |
| `handler.workflow_dispatched` | ~2600              | Workflow-backed handler dispatched an agent session                                                                                                               |
| `handler.failed`              | ~40                | Handler fire threw an error (dominated by task-execution-worker timeouts)                                                                                         |
| `handler.routed`              | ~2                 | Handler forwarded work to another handler                                                                                                                         |

The `handler.skipped` events are significant — roughly 28% of handler starts
result in a skip. This is healthy behavior (handlers checking preconditions and
bailing early), not waste. Top skip reasons include: session-recovery filtering
non-recoverable events, classifiers choosing no action, and metric auto-handlers
already covering an alert. The skip rate has increased from ~20% (2026-06-10) as
the project execution engine's dedup and precondition checks have broadened.

These events drive the `handler.success-rate`, `handler.fires-per-hour`, and
`handler.p95-duration` metrics.

## Auto-Heartbeat

Agents with heartbeat workflows get auto-generated trigger entries:

- Hash-based offset (spreads heartbeats evenly)
- 30-minute default interval
- Opt-out: `"heartbeat": false` in agent.json

## Implementation

All paths below are relative to the platform repo (`projects/may-agent/`):

- **Trigger scheduler class:** `src/app/cron.ts` (historical name)
- **Handler loading:** `src/app/loader/handler-loader.ts` via the `src/app/agent-loader.ts` compatibility surface
- **Agent/project discovery:** `src/app/loader/agent-discovery.ts` (scans both `agents/` and `.app/agents/` under projects)
- **Auto-heartbeat:** `generateAutoHeartbeats()` in `src/app/loader/heartbeat-loader.ts`
- **Workflow-backed handler adapter:** `createWorkflowBackedHandler()` (internal) wraps `createWorkflowHandler()` from `@may-agent/sdk`
