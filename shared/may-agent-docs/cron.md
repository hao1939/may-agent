# Cron & Handlers

## Overview

The cron system schedules handler execution. Handlers are TypeScript functions that run on a timer or in response to events.

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

## Handler Structure

```typescript
// agents/may/handlers/metrics-snapshot.ts
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;
    const db = sdk.getDb();
    // ... do work ...
    sdk.log("info", "done");
  };
};
```

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
- **Handler loading:** `src/app/agent-loader.ts`
- **Auto-heartbeat:** `generateAutoHeartbeats()` in agent-loader.ts
