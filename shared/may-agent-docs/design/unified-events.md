# Design: Unified Event Model

**Status**: approved
**Date**: 2026-04-29

## Problem

Domain events use `as any` to bypass the typed event bus. Two type systems coexist: typed `AgentEvent` union and untyped `DomainEvent` catch-all. This causes TS errors, duplication, and confusion.

## Fix

Add the missing event types to the typed union. Remove `DomainEvent`. Remove `as any`.

## Event Types

```typescript
// Add to SystemEvent union in event-bus.ts:
| { type: "handler.started"; handler: string; agent: string }
| { type: "handler.completed"; handler: string; agent: string; durationMs: number }
| { type: "handler.failed"; handler: string; agent: string; error: string; durationMs: number }
| { type: "project.iteration"; project: string; iteration: number }
| { type: "project.status_changed"; project: string; from: string; to: string }
| { type: "session.completed"; sessionId: string; agent: string }
| { type: "session.failed"; sessionId: string; agent: string; error?: string }
```

## Tables

| Table | What | Updated by |
|-------|------|------------|
| **events** | Append-only log of everything | DbWriter: `INSERT` for all events |
| **sessions** | Session details (fast lookups) | DbWriter: on `session_start`/`session_end` |
| **projects** | Project state cache | Project handler: on scan |

## Changes

1. Add handler/project/session event types to `SystemEvent` in `event-bus.ts`
2. Remove `DomainEvent` interface (already done)
3. Remove `as any` from cron.ts emitters
4. DbWriter: persist ALL bus events to events table (one `INSERT`)
