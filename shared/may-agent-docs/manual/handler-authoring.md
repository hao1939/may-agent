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
- `sdk.getDb()` — SQLite database
- `sdk.emit(type, data)` — emit events
- `sdk.runAgent(agent, task)` — run another agent
- `sdk.log(level, msg)` — logging
- `sdk.message(target, content)` — human or agent messages
- `sdk.escalate(target, reason)` — escalation
- `sdk.paths` — system directories

Via `ctx` (handler-specific):
- `ctx.agentName` — the agent that owns this handler
- `ctx.triggerNow(name)` — fire another handler immediately

## Hot Reload

Handlers are hot-reloaded on every tick. Edit the file → next fire picks up changes. No restart needed.

## Lifecycle Events

The cron system automatically emits:
- `handler.started` when your handler fires
- `handler.completed` when it finishes
- `handler.failed` if it throws

You don't need to emit these yourself.

## Example: Simple Metric Recorder

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

## Testing

Run your handler's tests:
```bash
bun test agents/<name>/handlers/__tests__/my-handler.test.ts
```
