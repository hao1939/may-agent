# How to Write a Handler

## Basics

A handler is a TypeScript file in `agents/<name>/handlers/`. It exports a `create` function:

```typescript
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;
    // ... your code here ...
  };
};
```

Default convention:

```
event/timer -> handler -> workflow -> sessions/functions/metrics
```

Handlers are bridges. They should normalize the trigger, do deterministic
preflight or skip checks, and dispatch a workflow when judgment/action is
needed. Put process, prompts, agent orchestration, and multi-step context
collection in the workflow.

## Registering (cron.json)

Add an entry to your agent's `cron.json`:

```json
{
  "name": "my-handler",
  "handler": "my-handler",
  "intervalMs": 300000,
  "agent": "may",
  "enabled": true
}
```

- `name` — unique identifier
- `handler` — filename (without .ts)
- `intervalMs` — fire interval in ms
- `on` — (optional) event types that also trigger this handler

## What You Have Access To

Via `ctx.sdk` (preferred):
- `sdk.emit(type, data)` — emit events
- `sdk.runWorkflow(name, task)` — dispatch pre-orchestrated sessions/functions
- `sdk.runAgent(agent, task)` — exceptional from handlers; prefer workflow bridge
- `sdk.metrics` — define, record, alert, resolve, evaluate, and list metrics
- `sdk.query` — target preferred bounded read surface for sessions/events/metrics/projects
- `sdk.getDb()` — compatibility escape hatch; prefer `query`/`metrics`
- `sdk.log(level, msg)` — logging
- `sdk.message(target, content)` — human or agent messages
- `sdk.escalate(target, reason)` — escalation
- `sdk.paths` — system directories

Via `ctx` (handler-specific):
- `ctx.agentName` — the agent that owns this handler
- `ctx.triggerNow(name)` — fire another handler immediately

## Trigger Events

Timer handlers may receive no event or a manual/timer trigger. Event-subscribed
handlers receive:

```typescript
type TriggerEvent = {
  type: string;
  source: "timer" | "event" | "manual";
  entry: string;
  data?: Record<string, unknown>;
  timestamp: number;
};
```

`event.data` is the original event payload. Read domain fields from there:

```typescript
const sessionId = typeof event?.data?.sessionId === "string"
  ? event.data.sessionId
  : null;
```

Do not expect cron to add shortcut fields to `event` for a specific subscriber.
If the handler needs a field, the event emitter should include it in the event
payload and the handler should validate it from `event.data`.

## Hot Reload

Handlers are hot-reloaded on every tick. Edit the file → next fire picks up changes. No restart needed.

## Lifecycle Events

The cron system automatically emits:
- `handler.started` when your handler fires
- `handler.completed` when it finishes
- `handler.failed` if it throws

You don't need to emit these yourself.

## Example: Simple Metric Recorder

Metric snapshot handlers are a mechanical exception: they may read projections
and record metrics directly because no agent judgment is needed. Current code
may still use `sdk.getDb()`; the target surface is `sdk.query` + `sdk.metrics`.

```typescript
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const sdk = ctx.sdk;
    const db = sdk.getDb();

    const count = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'error' AND startedAt > ?")
      .get(Date.now() - 3600000) as any)?.c || 0;

    db.run("UPDATE metrics SET current = ?, updated_at = ? WHERE id = ?",
      [count, Date.now(), "session.error-count"]);

    sdk.log("info", `Recorded ${count} errors in last hour`);
  };
};
```

## Example: Event-To-Workflow Bridge

```typescript
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const task = [
      `Trigger: ${event?.type ?? "timer"}`,
      `Entry: ${entry.name}`,
      event?.data ? `Data: ${JSON.stringify(event.data)}` : "",
    ].filter(Boolean).join("\n");

    await ctx.sdk.runWorkflow("metric-alert-triage", task, {
      source: entry.name,
    });
  };
};
```

Use this shape for any handler that needs judgment, project context,
investigation, or agent action.

## Example: SDK Workflow Bridge Helper

For straightforward event-to-workflow bridges, use the SDK helper instead of
writing boilerplate:

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

With `includeEvent: true`, the helper appends the exact trigger object under
`## Trigger Event` in the workflow task. If no event payload is present, it
skips dispatch and emits `handler.skipped`.

## Testing

Run your handler's tests:
```bash
bun test agents/<name>/handlers/__tests__/my-handler.test.ts
```
