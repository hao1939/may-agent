# Design: Unified Event Model

**Status**: draft
**Date**: 2026-04-29

## Current State (messy)

Three separate paths:
- **Bus typed events** (SessionEvent, SystemEvent) → handled by subscribers in real-time
- **Domain events** (handler.started, project.iteration) → persisted to events table via `as any` hack
- **DbWriter** subscribes to bus and writes to sessions/events/evaluations tables separately

Duplication: `session_end` bus event writes to sessions table AND `session.completed` domain event writes to events table. Same fact, two records.

## Unified Model

**One event. One bus. One persistence path.**

Everything that happens is an event. All events:
1. Go through the bus (for real-time subscribers: UI, telegram, cron dispatch)
2. Get persisted to the events table (the append-only log)
3. Optionally update cache tables (sessions, projects) for fast queries

```
Something happens
    ↓
emit(event) → bus
    ↓
├── Real-time subscribers (UI, telegram, cron dispatch)
├── Events table (append-only log, source of truth)
└── Cache tables (sessions, projects — derived, for fast queries)
```

## Event Types

All lifecycle events in one typed union:

```typescript
type SystemEvent =
  // Session lifecycle
  | { type: "session.started"; sessionId: string; agent: string; task: string; ... }
  | { type: "session.ended"; sessionId: string; agent: string; status: string; ... }
  // Handler lifecycle
  | { type: "handler.started"; handler: string; agent: string }
  | { type: "handler.completed"; handler: string; agent: string; durationMs: number }
  | { type: "handler.failed"; handler: string; agent: string; error: string; durationMs: number }
  // Project lifecycle
  | { type: "project.iteration"; project: string; iteration: number }
  | { type: "project.status_changed"; project: string; from: string; to: string }
  // Notifications
  | { type: "notification"; agent: string; target: string; text: string }
  // System
  | { type: "metric.snapshot"; metricId: string; value: number }
  | { type: "info"; message: string }
```

No more `DomainEvent`. No more `as any`. All events are typed.

## Persistence

DbWriter subscribes to the bus and:
1. **Always**: appends to events table (every event, no filtering)
2. **On session.started**: upserts sessions table (cache)
3. **On session.ended**: updates sessions table (cache)
4. **On project.status_changed**: updates projects table (cache)

## What Changes

| Before | After |
|--------|-------|
| `bus.emit({ type: "session_start", ... })` | `bus.emit({ type: "session.started", ... })` |
| `this.emitEvent?.({ type: "handler.started", ... } as any)` | `bus.emit({ type: "handler.started", ... })` |
| DbWriter handles session_start separately from domain events | DbWriter handles ALL events uniformly |
| `DomainEvent` interface with catch-all | Removed — all events typed |
| Cron subscribes to bus for dot-events only | Cron subscribes to all events, filters by handler `on` config |

## Migration

1. Add all lifecycle event types to the typed union
2. Remove DomainEvent interface and all `as any` casts
3. Unify DbWriter: one subscriber, all events → events table + cache updates
4. Remove `session.completed`/`session.failed` domain events (redundant with session.ended)
5. Rename bus events: `session_start` → `session.started`, `session_end` → `session.ended`
