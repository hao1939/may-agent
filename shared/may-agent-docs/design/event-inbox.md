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
**Default:** every agent gets an auto-generated heartbeat cron entry. No file, no config.

#### Convention

An agent exists (`agent.json`) → it gets a heartbeat. That's it.

```
agents/frank/
  agent.json          ← agent exists → auto-heartbeat generated
  heartbeat.md        ← optional: custom priorities for heartbeat prompt
  handlers/           ← handlers auto-discovered (already works)
  cron.json           ← optional: agent-specific cron jobs
```

#### Auto-generation

During `loadAgents()`, for each registered agent, auto-generate a heartbeat cron entry unless one already exists:

```typescript
for (const agent of registeredAgents) {
  if (hasExplicitHeartbeat(agent.name)) continue; // explicit entry wins
  if (agent.config.heartbeat === false) continue;  // opt-out

  const entry: CronEntry = {
    name: `heartbeat-${agent.name}`,
    type: "job",
    intervalMs: 1_800_000,  // 30min default
    agent: agent.name,
    handler: "run-workflow",
    handlerConfig: {
      workflow: `${agent.name}-heartbeat`,
      agent: agent.name,
      task: buildDefaultHeartbeatTask(agent.name),
      timeoutMs: 1_800_000,
    },
    offsetMs: stableOffset(agent.name),  // hash-based, deterministic
    on: ["heartbeat.trigger"],
    enabled: true,
  };
  cron.addSyntheticEntry(entry);
}
```

`stableOffset(name)` uses a hash of the agent name to spread heartbeats evenly — no manual offset picking.

#### Override and opt-out

- **Override:** explicit cron.json entry with `heartbeat-{name}` wins. Customize interval, task, etc.
- **Opt-out:** `"heartbeat": false` in agent.json. For leaf agents that only respond to calls and don't need periodic wakeups.

### 3. System awareness: default metrics for every primitive

**Today:** if a handler exists but never fires, nobody notices. If an agent runs but always errors, nobody notices. The system has primitives but no self-awareness about whether they're healthy.

**Default:** the system-status handler auto-computes health metrics for every primitive from existing DB tables. No metric rows to INSERT, no configuration. If it exists, it's watched.

#### Two layers, same pipeline

```
Layer 1: system-status handler (infrastructure defaults, automatic)
  - Queries existing tables: cron_history, sessions, events, evaluations
  - Computes health metrics for every handler, agent, event type, cron entry
  - Flags anomalies into the health log
  - Zero configuration — if the primitive exists, it's watched

Layer 2: metrics table (agent-defined, opt-in)  
  - Agents INSERT domain metrics: "coach.skill-effectiveness", "bob.hypothesis-validation-rate"
  - metrics-snapshot auto-watches, snapshots, alerts on threshold breach
  - Owner gets breach injected into heartbeat
  - Zero infrastructure work — INSERT a row and it's live

Both layers → anomalies → heartbeat prompt → agent LLM acts
```

#### Default health checks per primitive

**Handlers:**

| Check | Anomaly condition | Source |
|---|---|---|
| Fire count | Handler in cron.json but 0 fires in 24h | `cron_history` table |
| Error rate | > 50% of fires failed | `cron_history` status |
| Last fired | > 2x intervalMs since last fire | `cron_history` MAX(fired_at) |
| Duration | Avg duration > 80% of intervalMs (will overlap) | `cron_history` duration |

**Agents:**

| Check | Anomaly condition | Source |
|---|---|---|
| Session count | 0 sessions in 24h (for agents with heartbeat) | `sessions` table |
| Error rate | > 40% of sessions ended in error | `sessions` status |
| Cost trend | Avg cost/session > 2x 7-day average | `evaluations` table |
| Inbox depth | > 10 pending events for this agent | `events` table |

**Events:**

| Check | Anomaly condition | Source |
|---|---|---|
| Unhandled rate | > 50% of events of this type stay pending > 1h | `events` status |
| Stale pending | Any event pending > 2h | `events` timestamp |

**Cron entries:**

| Check | Anomaly condition | Source |
|---|---|---|
| Skip rate | > 80% of ticks skipped (overlap) | `cron_history` |
| Consecutive errors | > 3 consecutive failures | `cron_history` |

#### Implementation: expand system-status handler

The system-status handler (`agents/may/handlers/system-status.ts`) already queries sessions, evaluations, tsc results and produces anomalies. Add queries for handler/agent/event health against the same DB:

```typescript
// Handler health — flag handlers that exist but don't fire or always fail
const handlerStats = db.queryAll(`
  SELECT job, COUNT(*) as fires,
    SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as errors,
    MAX(fired_at) as last_fired
  FROM cron_history WHERE fired_at > ? GROUP BY job
`, [since24h]);

for (const entry of cronEntries) {
  const stat = handlerStats.find(s => s.job === entry.name);
  if (!stat || stat.fires === 0) {
    anomalies.push(`Handler "${entry.name}" — 0 fires in 24h`);
  } else if (stat.errors / stat.fires > 0.5) {
    anomalies.push(`Handler "${entry.name}" — ${pct(stat.errors/stat.fires)} error rate`);
  }
}

// Event health — flag event types with high unhandled rate
const eventStats = db.queryAll(`
  SELECT event_type, COUNT(*) as total,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
  FROM events WHERE timestamp > ? GROUP BY event_type
`, [since24h]);

for (const es of eventStats) {
  if (es.pending > 5) {
    anomalies.push(`Event "${es.event_type}" — ${es.pending} pending`);
  }
}
```

The anomalies array already flows into the health log → heartbeat prompt. No new pipeline.

#### How agents extend: domain metrics

Agents don't touch system-status. They add domain-specific metrics by INSERTing into the `metrics` table:

```sql
INSERT INTO metrics (id, name, source, owner, sql_query, threshold_min, status)
VALUES ('coach-skill-eff', 'coach.skill-effectiveness', 'auto', 'coach',
  'SELECT avg(score) FROM evaluations WHERE agent = "coach" AND created_at > ...',
  0.4, 'active');
```

The metrics-snapshot handler auto-watches it: runs the SQL, snapshots the value, checks thresholds, emits `metric.breach` if violated, injects into coach's heartbeat. Zero code changes.

**Two extension points, both zero-config:**
1. **Infrastructure health** — automatic from system-status, covers every primitive
2. **Domain health** — agent INSERTs a metric row, auto-watched by metrics-snapshot

### 4. Handlers: already works (no changes needed)

Create `agents/X/handlers/Y.ts` + add cron.json entry → auto-discovered, hot-reloaded. The cron.json entry is inherent (a handler needs a trigger), not incidental configuration. System-status auto-watches handler health (Section 3).

## Summary: the "add X, it just works" contract

After this design:

| You add... | What happens automatically |
|---|---|
| **Agent** (agent.json) | Discovered, tools, prompt, handlers, cooperation, **auto-heartbeat**, **inbox via heartbeat**, **health auto-watched** |
| **Event** (dispatchEvent) | Persists, handler fires if registered, **otherwise → owner inbox**, **unhandled rate auto-watched** |
| **Metric** (INSERT) | Auto-watched, auto-alerted, owner injection |
| **Handler** (handlers/Y.ts + cron entry) | Auto-discovered, hot-reloaded, **fire count / error rate auto-watched** |
| **Cron entry** (cron.json) | Auto-started, **skip rate / consecutive errors auto-watched** |

Zero silent drops. Zero manual wiring for the common case. Every primitive is self-aware — the system knows when something exists but isn't working.

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
| system-status handler | Add health checks for handlers, agents, events, cron entries |

## What doesn't change

- `dispatchEvent()` API — same signature
- `ctx.emit()` for infrastructure events — untouched
- Handler dispatch — fires immediately for registered handlers
- cron.json `on` field — still the subscription mechanism
- Explicit cron.json entries — always override auto-generated ones
- agent.json schema — no new fields needed
- metrics table — agents extend by INSERT, same as today

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

### Phase 4: Default health metrics

1. Expand system-status handler with handler/agent/event/cron health queries
2. Flag anomalies: zero-fire handlers, high-error agents, stale pending events
3. Anomalies flow into existing health log → heartbeat prompt pipeline

### Phase 5: Observability

1. Web UI inbox view (pending/failed events per agent)
2. Web UI health dashboard (handler fire rates, agent error rates)
3. Auto-expire stale events, escalate if immediate

## Success criteria

1. **Events:** zero silently dropped — every event reaches a handler or owner inbox
2. **Agents:** new agent with agent.json gets auto-heartbeat with zero cron.json edits (opt-out with `"heartbeat": false`)
3. **Inbox:** heartbeat prompt includes pending events section
4. **Immediate:** urgent unhandled events fork owner agent within seconds
5. **Override:** explicit cron.json entries override auto-generated defaults
6. **Self-awareness:** system-status flags handlers with 0 fires, agents with high error rates, events with stale pending
7. **Extension:** agents add domain metrics via INSERT — auto-watched, no code changes
8. **Steady state:** `SELECT count(*) FROM events WHERE status = 'pending' AND timestamp < now() - 3600000` returns 0
