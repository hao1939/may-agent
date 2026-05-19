# How to Write a Handler

## Basics

A handler is a TypeScript file in `agents/<name>/handlers/`. It exports a `create` function:

```typescript
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;
    // ... your code here ...
  };
};
```

> **Import path**: Prefer `from "@may-agent/sdk"` — the compiled binary
> registers a Bun plugin that resolves the bare specifier for dynamically-loaded
> handlers. The legacy relative path (`from "../../../shared/agent-sdk.ts"`)
> still works but is deprecated.

Default convention:

```
event/timer -> handler -> workflow -> sessions/functions/metrics
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
| Owner action is needed | Route to a workflow with `sdk.runWorkflow(...)` and set `source` to the owner/entry that should appear in trace | Calling many agents directly from handler code |
| External blocker is clear | Use `sdk.escalate(...)` with owner, evidence, and requested action | Sending an informal message and calling it escalation |
| Operator manually fires a job | Treat `trigger.<entry-name>` as a control shortcut for that cron entry | Treating `trigger.*` as a domain lifecycle event |

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
- `sdk.emit(type, data, envelope?)` — emit canonical events
- `sdk.runWorkflow(name, task)` — dispatch pre-orchestrated sessions/functions
- `sdk.runAgent(agent, task)` — exceptional from handlers; prefer workflow bridge
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

## Trigger Events

Timer handlers may receive no event or a manual/timer trigger. Event-subscribed
handlers receive:

```typescript
type TriggerEvent = {
  type: string;
  source: "timer" | "event" | "manual";
  entry: string;
  data?: EventEnvelope;
  timestamp: number;
};
```

`EventEnvelope` is the canonical event shape from
[events.md](../2a-design/events.md): top-level `type/source/owner/urgency` plus
event-specific `data`.

For event subscriptions, `event.data` is the original event envelope. Read
domain fields from `event.data.data`:

```typescript
const original = event?.data;
const sessionId = typeof original?.data?.sessionId === "string"
  ? original.data.sessionId
  : null;
```

Do not expect cron to add shortcut fields to `event` for a specific subscriber.
If the handler needs a field, the event emitter should include it in the event's
`data` payload and the handler should validate it from `event.data.data`.

Example: a handler subscribed to `metric.breach` receives a trigger whose
`event.data` is the original event envelope. The envelope `owner` is the
routable owner, and metric details live under `event.data.data`.

```typescript
const envelope = event?.data;
const owner = typeof envelope?.owner === "string" ? envelope.owner : null;
const metricId = typeof envelope?.data?.metricId === "string"
  ? envelope.data.metricId
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
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "@may-agent/sdk";

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
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
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
    const sessionId = event?.data?.data?.sessionId;
    return `Review completed session ${sessionId}`;
  },
  shouldRun: (_ctx, event) => typeof event?.data?.data?.sessionId === "string",
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
