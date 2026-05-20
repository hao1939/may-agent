# How to Author Handlers

## Basics

A handler is what runs when a timer, event subscription, or manual
`trigger.<entry-name>` fires.

For straightforward workflow work, configure a workflow-backed handler directly
in `cron.json`:

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

Write a TypeScript handler only when the handler must do deterministic infra
work before deciding what to do. A TypeScript handler lives in
`agents/<name>/handlers/` and exports a `create` function:

```typescript
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: EventEnvelope) => {
    const sdk = ctx.sdk;
    // ... your code here ...
  };
};
```

> **Import path**: Use `from "@may-agent/sdk"`. Runtime handler imports resolve
> through the repo/workspace `node_modules/@may-agent/sdk` package link; compiled
> builds map the same package at build time. Avoid relative imports into private
> source files or old shared SDK files.

Default convention:

```
timer/event/manual trigger -> handler -> workflow/code -> sessions/functions/metrics
```

Handlers are bridges. They should normalize the trigger, do deterministic
preflight or skip checks, and dispatch a workflow when judgment/action is
needed. Put process, prompts, agent orchestration, and multi-step context
collection in the workflow.

## Typical Scenarios

| Scenario | Handler should do | Usually avoid |
|----------|-------------------|---------------|
| Timer measures a fact | Read bounded state, update metrics, emit/resolve metric events if needed | Starting an agent just to count rows |
| Event needs judgment | Validate the event payload, build a compact task, run the owning workflow | Doing multi-step reasoning inside the handler |
| Event is missing required fields | Emit `handler.skipped` with the reason and return | Guessing fields from subscriber-specific shortcuts |
| Owner action is needed | Use a workflow-backed handler, or route to a workflow with `sdk.runWorkflow(...)` when deterministic preflight is needed | Calling many agents directly from handler code |
| External blocker is clear | Use `sdk.escalate(...)` with owner, evidence, and requested action | Sending an informal message and calling it escalation |
| Operator manually fires a job | Treat `trigger.<entry-name>` as a control shortcut for that trigger entry | Treating `trigger.*` as a domain lifecycle event |

## Registering Trigger Entries

Add an entry to your agent's `cron.json`. The filename is historical; each
entry describes triggers plus the handler to run.

Named TypeScript handler:

```json
[
  {
    "name": "my-handler",
    "handler": "my-handler",
    "intervalMs": 300000,
    "agent": "may",
    "enabled": true
  }
]
```

Workflow-backed handler:

```json
[
  {
    "name": "scout-daily-digest",
    "handler": {
      "workflow": "scout-daily-digest",
      "agent": "scout",
      "task": "Compile today's research digest and send it to Hao.",
      "timeoutMs": 300000
    },
    "intervalMs": 86400000,
    "enabled": true
  }
]
```

- `name` — unique identifier
- `handler` — filename without `.ts`, or `{ workflow, agent, task }`
- `intervalMs` — fire interval in ms. **Minimum: 10000 (10 seconds).** Entries
  below the floor are rejected at load time (an error is emitted via the scheduler's
  error channel) — the rest of `cron.json` continues to load. If you need
  sub-10s reactions, use an event subscription via `on` instead.
- `on` — (optional) event types that also trigger this handler

**Gate: `agent.json` must include `"cron"` in its `tools[]` array, or the
entire `cron.json` is silently ignored** (the loader emits an info-level
warning at startup; check daemon logs if your handlers aren't firing).

## Module-level state is wiped on every fire

Each handler invocation re-imports the handler module fresh (hot-reload via
`?t=<ts>` cache-busting). Module-level `let counter = 0` resets to 0 every
fire — do **not** use module-scope variables for cross-fire state. Persist
state via:

- `sdk.metrics.record(...)` for counters and gauges (read back via `sdk.metrics.list()`),
- `sdk.getDb()` raw SQL for richer state,
- emitting events and reading them back via `sdk.query.events(...)`.

This applies to handler files only — not to workflow files (which are loaded
once per dispatch) or SDK helpers (resolved through node_modules and
cached normally).

## What You Have Access To

Via `ctx.sdk` (preferred):
- `sdk.emit(type, data, envelope?)` — emit canonical events
- `sdk.runWorkflow(name, task)` — dispatch pre-orchestrated sessions/functions
- `sdk.runAgent(agent, task)` — exceptional from handlers; prefer workflow-backed handlers
- `sdk.metrics` — define, record, alert, resolve, evaluate, and list metrics
- `sdk.query` — target preferred bounded read surface for sessions/events/metrics/projects
- `sdk.getDb()` — compatibility escape hatch; prefer `query`/`metrics`
- `sdk.log(level, msg)` — logging
- `sdk.message(target, content)` — human or agent messages
- `sdk.escalate(reason, opts?)` — escalation; defaults to `owner: "agent:may"`
- `sdk.paths` — system directories

Via `ctx` (handler-specific):
- `ctx.agentName` — the agent that owns this handler
- `ctx.triggerNow(name)` — fire another handler immediately

## Handler Events

Handlers receive the canonical event envelope directly. Timer/manual triggers
use the same shape as event subscriptions:

```typescript
type EventEnvelope = {
  type: string;
  source: string;
  owner: string;
  timestamp?: number;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  data: Record<string, unknown>;
};
```

For event subscriptions, the handler receives the original event unchanged. Read
domain fields from `event.data`:

```typescript
const sessionId = typeof event?.data?.sessionId === "string"
  ? event.data.sessionId
  : null;
```

Do not expect the trigger runtime to add shortcut fields to `event` for a specific subscriber.
If the handler needs a field, the event emitter should include it in the event's
`data` payload and the handler should validate it from `event.data`.

Example: a handler subscribed to `metric.breach` receives the `metric.breach`
event envelope. The envelope `owner` is the routable owner, and metric details
live under `event.data`.

```typescript
const owner = typeof event?.owner === "string" ? event.owner : null;
const metricId = typeof event?.data?.metricId === "string"
  ? event.data.metricId
  : null;

if (!owner || !metricId) {
  ctx.sdk.emit("handler.skipped", {
    handler: entry.name,
    reason: "metric.breach missing owner or metricId",
  });
  return;
}
```

## Hot Reload

Handlers are hot-reloaded on every tick. Edit the file → next fire picks up changes. No restart needed.

## Lifecycle Events

The trigger runtime automatically emits:
- `handler.started` when your handler fires
- `handler.completed` when it finishes
- `handler.failed` if it throws

You don't need to emit these yourself.

## Example: Simple Metric Recorder

Metric snapshot handlers are a mechanical exception: they read projections
and record metrics directly because no agent judgment is needed. Use
`sdk.metrics.record()` followed by `sdk.metrics.evaluate(id)` so the
breach/recovery pipeline actually runs.

**Pitfall:** writing `metrics.current` via raw SQL (`db.run("UPDATE metrics ...")`)
updates the value but **does not** trigger alert evaluation. The breach hook
fires only inside `sdk.metrics.record()`/`evaluate()`. If you go through raw
SQL you'll see the value change but never see `metric.breach` events.

```typescript
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: EventEnvelope) => {
    const sdk = ctx.sdk;
    const db = sdk.getDb();

    const count = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'error' AND startedAt > ?")
      .get(Date.now() - 3600000) as any)?.c || 0;

    // Record + evaluate. record() updates current; evaluate() runs the
    // breach/recovery pipeline and emits metric.breach / metric.recovered
    // events with metric_alerts rows.
    await sdk.metrics.record("session.error-count", count);
    await sdk.metrics.evaluate("session.error-count");

    sdk.log("info", `Recorded ${count} errors in last hour`);
  };
};
```

## Example: TypeScript Event-To-Workflow Bridge

```typescript
import type { CronEntry, EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: EventEnvelope) => {
    const task = [
      `Trigger: ${event?.type ?? "timer"}`,
      `Entry: ${entry.name}`,
      event?.data ? `Event: ${JSON.stringify(event.data)}` : "",
    ].filter(Boolean).join("\n");

    await ctx.sdk.runWorkflow("metric-alert-triage", task, {
      source: entry.name,
    });
  };
};
```

Use this shape when deterministic handler code must inspect or validate state
before the workflow dispatch. If the entry always runs the same workflow, prefer
the workflow-backed handler object in `cron.json`.

## SDK Workflow Bridge Helper

`createWorkflowHandler()` is the adapter used by workflow-backed handler config.
Use it directly only when you are writing a reusable TypeScript handler module:

```typescript
import { createWorkflowHandler } from "@may-agent/sdk";

export const create = createWorkflowHandler({
  workflow: "evaluator-aftermath",
  includeEvent: true,
  task: (_ctx, event) => {
    const sessionId = event?.data?.sessionId;
    return `Review completed session ${sessionId}`;
  },
  shouldRun: (_ctx, event) => typeof event?.data?.sessionId === "string",
});
```

With `includeEvent: true`, the helper appends the exact event envelope under
`## Trigger Event` in the workflow task. If no event payload is present, it
skips dispatch and emits `handler.skipped`.

## Testing

Run your handler's tests:
```bash
bun test agents/<name>/handlers/__tests__/my-handler.test.ts
```
