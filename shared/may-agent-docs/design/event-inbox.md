# Design: Convention Defaults

**Status:** Proposal  
**Date:** 2026-04-22  
**References:** [core-principles.md](core-principles.md) (P3, P9), [unified-event-system.md](unified-event-system.md), [runtime-ctx.md](runtime-ctx.md)

## Problem

The system has strong primitives — events, metrics, agents, handlers — but adding a new instance of each requires different amounts of manual wiring. Some "just work" (metrics, handlers), some don't (events get dropped, agents need manual heartbeat entries).

Principle 9 says: *convention over configuration*. Principle 3 says: *events must be consumed*. The system should have **sensible defaults** for every primitive so that adding one produces working behavior with zero extra configuration.

## Current state

| You add... | What works automatically | What requires manual wiring |
|---|---|---|
| **Agent** (agents/X/agent.json) | Discovery, tools, system prompt, handler loading, cooperation | Heartbeat (~15 lines in May's cron.json), heartbeat workflow, heartbeat.md |
| **Event** (dispatchEvent) | Persists to DB, fires handler if `on` match exists | Nothing catches unhandled events. Silently dropped. |
| **Metric** (INSERT into metrics) | Auto-watched, threshold alerts, regression detection, owner injection | Nothing — fully automatic already |
| **Handler** (agents/X/handlers/Y.ts) | Auto-discovered, hot-reloaded | Just needs a cron.json entry (inherent — handler needs a trigger) |

Two gaps: **events need a fallback** and **agents need auto-heartbeat**.

## Design: reasonable defaults for every primitive

### 1. Events: inbox as the default fallback

**Today:** event with no handler → silently dropped.  
**Default:** event with no handler → persists as `pending` → owner agent sees it on next heartbeat → LLM decides.

The `events` table already records every domain event via db-writer.ts. It's a write-only audit log. Close the loop by adding status tracking and surfacing unhandled events.

#### Event lifecycle

```
          emit
           |
     +-----v------+
     |   pending   |
     +-----+------+
           |
     +-----+------+------+
     |                    |
  has handler         no handler
     |                    |
     v                    | (next heartbeat)
  +------+                v
  | done |          +----------+
  +------+          |  acked   | -- agent LLM saw it, working on it
     ^              +----+-----+
     |                   |
     +--------+----------+----------+
              |          |          |
              v          v          v
          +------+  +----------+  +--------+
          | done |  | dismissed|  | failed |
          +------+  +----------+  +---+----+
                                      | retry_count > N
                                      v
                                 escalate to owner
```

Statuses:
- **pending** — just emitted, waiting for handler or heartbeat pickup
- **done** — handled successfully (by handler or agent LLM)
- **acked** — agent saw it, actively working (prevents duplicate pickup)
- **dismissed** — agent decided no action needed (with reason)
- **failed** — handler threw or agent couldn't resolve (resurfaces next heartbeat)
- **expired** — TTL exceeded (triggers owner notification if urgent)

#### Schema changes

Add columns to existing `events` table:

```sql
ALTER TABLE events ADD COLUMN status      TEXT DEFAULT 'pending';
ALTER TABLE events ADD COLUMN handled_by  TEXT;
ALTER TABLE events ADD COLUMN result      TEXT;
ALTER TABLE events ADD COLUMN reason      TEXT;
ALTER TABLE events ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN ttl_ms      INTEGER;
ALTER TABLE events ADD COLUMN urgency     TEXT DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS idx_events_inbox ON events(status, timestamp);
```

#### Dispatch rules

1. **Handler registered → fire immediately, mark done.** Today's behavior, unchanged.
2. **No handler, urgency `immediate` → fork owner agent now.** Can't wait for heartbeat.
3. **No handler, urgency `normal` → stays pending.** Heartbeat picks it up.

Urgency is set by emitter, only affects the no-handler path:

```typescript
// Critical — wake up the owner agent now
ctx.dispatchEvent("session.failed", { agent: "bob", error: "OOM", urgency: "immediate" });

// Batch-friendly — heartbeat will handle it
ctx.dispatchEvent("context-learn", { sessionId: "...", agent: "bob" });
```

#### Heartbeat inbox injection

Query pending events, inject into heartbeat prompt:

```sql
SELECT id, event_type, data, urgency, timestamp, retry_count
FROM events
WHERE status IN ('pending', 'failed')
  AND (ttl_ms IS NULL OR timestamp + ttl_ms > :now)
ORDER BY
  CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
  retry_count DESC, timestamp ASC
LIMIT 20
```

Heartbeat sees:

```
## Pending Events (inbox)

3 unprocessed events. For each: act, delegate, dismiss (with reason), or escalate.

1. [5m ago] session.failed — bob OOM (retry #2)
2. [12m ago] metric.breach — coach eval_quality below threshold
3. [1h ago] context-learn — 4 sessions with unextracted lessons
```

#### RuntimeCtx additions

```typescript
interface RuntimeCtx {
  /** Mark an inbox event status. */
  updateEvent(eventId: number, status: "acked" | "done" | "dismissed" | "failed", opts?: {
    handledBy?: string; result?: string; reason?: string;
  }): void;

  /** Query pending inbox events. */
  getInbox(opts?: { limit?: number }): Array<{
    id: number; event_type: string; data: Record<string, unknown>;
    urgency: string; timestamp: number; retry_count: number;
  }>;
}
```

### 2. Agents: auto-heartbeat by convention

**Today:** adding an agent requires a hand-crafted ~15-line cron.json entry with unique offsetMs, a heartbeat workflow, and heartbeat.md.  
**Default:** if `agents/X/heartbeat.md` exists, the system auto-generates a heartbeat.

#### Convention

```
agents/frank/
  agent.json          ← agent exists
  heartbeat.md        ← heartbeat exists → auto-heartbeat generated
  handlers/           ← handlers auto-discovered (already works)
  cron.json           ← optional, for agent-specific cron jobs
```

The presence of `heartbeat.md` is the convention. No cron.json entry needed.

#### Auto-generation

During `loadAgents()`, for each agent with `heartbeat.md`:

```typescript
// If agent has heartbeat.md but no explicit heartbeat entry in any cron.json:
if (existsSync(join(agentDir, "heartbeat.md")) && !hasExplicitHeartbeat(agentName)) {
  const entry: CronEntry = {
    name: `heartbeat-${agentName}`,
    type: "job",
    intervalMs: 1_800_000,  // 30min default
    agent: agentName,
    handler: "run-workflow",
    handlerConfig: {
      workflow: `${agentName}-heartbeat`,
      agent: agentName,
      task: buildDefaultHeartbeatTask(agentName),
      timeoutMs: 1_800_000,
    },
    offsetMs: stableOffset(agentName),  // hash-based, deterministic
    on: ["heartbeat.trigger"],
    enabled: true,
  };
  cron.addSyntheticEntry(entry);
}
```

`stableOffset(name)` uses a hash of the agent name to spread heartbeats evenly — no manual offset picking.

#### Override

Explicit cron.json entries always win. If `agents/may/cron.json` has `heartbeat-bob`, the auto-generated one is skipped. This lets you customize interval, offset, or task for specific agents while keeping the convention default for the rest.

#### Fallback heartbeat workflow

If `agents/X/workflows/X-heartbeat/` doesn't exist, use a **generic heartbeat workflow** that:
1. Reads `agents/X/heartbeat.md` for priorities
2. Queries inbox for pending events
3. Checks agent's metrics
4. Executes based on LLM judgment

This means a new agent needs only `agent.json` + `heartbeat.md` to be fully operational.

### 3. Metrics: already works (no changes needed)

INSERT a row into `metrics` table → auto-watched, auto-alerted, owner gets breach injected into heartbeat. This is the gold standard the other primitives should match.

### 4. Handlers: already works (no changes needed)

Create `agents/X/handlers/Y.ts` + add cron.json entry → auto-discovered, hot-reloaded. The cron.json entry is inherent (a handler needs a trigger), not incidental configuration.

## Summary: the "add X, it just works" contract

After this design:

| You add... | What happens automatically |
|---|---|
| **Agent** (agent.json + heartbeat.md) | Discovered, tools, prompt, handlers, cooperation, **auto-heartbeat at 30min**, **inbox via heartbeat** |
| **Event** (dispatchEvent) | Persists to DB, handler fires if registered, **otherwise → owner inbox → heartbeat pickup or immediate fork** |
| **Metric** (INSERT) | Auto-watched, auto-alerted, owner injection |
| **Handler** (handlers/Y.ts + cron entry) | Auto-discovered, hot-reloaded |

Zero silent drops. Zero manual wiring for the common case. Explicit config overrides the convention when needed.

## What changes

| Component | Change |
|---|---|
| `events` table | Add status, handled_by, result, reason, retry_count, ttl_ms, urgency |
| db-writer.ts | Write urgency from event data |
| cron.ts `dispatchEvent()` | Mark events done/failed after handler fires |
| may.ts `"emit"` handler | Fork owner agent for immediate unhandled events |
| Heartbeat prompt builder | Query pending events, inject inbox section |
| runtime-ctx.ts | Add `updateEvent()`, `getInbox()` |
| agent-loader.ts `loadAgents()` | Auto-generate heartbeat entries for agents with heartbeat.md |
| cron.ts | Support synthetic (auto-generated) entries alongside file-based ones |

## What doesn't change

- `dispatchEvent()` API — same signature
- `ctx.emit()` for infrastructure events — untouched
- Handler dispatch — fires immediately for registered handlers
- cron.json `on` field — still the subscription mechanism
- Explicit cron.json entries — always override auto-generated ones
- agent.json schema — no new fields needed

## Migration

### Phase 1: Event inbox (close the loop)

1. Add columns to `events` table
2. Update db-writer.ts to write urgency
3. Mark events done/failed after handler dispatch in cron.ts
4. Dead-letter: fork owner for immediate unhandled events in may.ts
5. Add `getInbox()` / `updateEvent()` to RuntimeCtx

### Phase 2: Heartbeat inbox injection

1. Query pending events in heartbeat prompt builder
2. Inject inbox section into heartbeat prompt
3. Agent LLM processes inbox: act/dismiss/delegate/escalate

### Phase 3: Auto-heartbeat

1. Auto-generate heartbeat entries in `loadAgents()` for agents with heartbeat.md
2. Create generic heartbeat workflow (reads heartbeat.md + inbox + metrics)
3. Remove manual heartbeat entries from May's cron.json (keep as overrides only if customized)

### Phase 4: Observability

1. Web UI inbox view (pending/failed events per agent)
2. Metrics: unhandled count, time-to-handle
3. Auto-expire stale events, escalate if immediate

## Success criteria

1. **Events:** zero silently dropped — every event reaches a handler or owner inbox
2. **Agents:** new agent with agent.json + heartbeat.md gets working heartbeat with zero cron.json edits
3. **Inbox:** heartbeat prompt includes pending events section
4. **Immediate:** urgent unhandled events fork owner agent within seconds
5. **Override:** explicit cron.json entries override auto-generated defaults
6. **Steady state:** `SELECT count(*) FROM events WHERE status = 'pending' AND timestamp < now() - 3600000` returns 0
