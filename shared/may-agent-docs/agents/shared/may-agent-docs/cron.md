# Cron & Handlers

## Overview

The cron system schedules handler execution. Handlers are TypeScript functions that run on a timer or in response to events.

## Cron Entry (cron.json)

```json
{
  "name": "metrics-snapshot",
  "handler": "metrics-snapshot",
  "intervalMs": 300000,
  "agent": "may",
  "on": ["trigger.metrics-snapshot"],
  "enabled": true
}
```

## Handler Structure

```typescript
import type { HandlerContext, HandlerModule, TriggerEvent, CronEntry } from "../../shared/agent-sdk.ts";

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  return async (event?: TriggerEvent) => {
    const sdk = ctx.sdk;
    const db = sdk.getDb();
    // ... do work ...
  };
};
```

Handlers are **hot-reloaded** — edit the file, next tick picks up changes.

## Handler Lifecycle Events

Every fire emits paired events:
```
handler.started → handler.completed | handler.failed
```

Used for health monitoring (success rate, duration, coverage).

## Auto-Heartbeat

Agents with heartbeat workflows get auto-generated cron entries:
- Hash-based offset (spreads heartbeats evenly)
- 30-minute default interval
- Opt-out: `"heartbeat": false` in agent.json

## Implementation

- **Cron class:** `src/app/cron.ts`
- **Handler loading:** `src/app/agent-loader.ts`
- **Auto-heartbeat:** `generateAutoHeartbeats()` in agent-loader.ts
