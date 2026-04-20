# Design: Closing the Loop — Principle-to-Implementation Gap Fixes

**Status:** Draft
**Date:** 2026-04-21
**References:** [core-principles.md](core-principles.md), [ownership-driven-system.md](ownership-driven-system.md), [open-problems.md](open-problems.md), [implementation-audit.md](implementation-audit.md)

---

## Purpose

Map every gap between our core principles and the actual implementation. For each gap: what's violated, the minimal fix, and the sequence.

## The Unifying Insight: Events + Persistence = Closed Loop

Today the system has three separate routing mechanisms:

| Mechanism | Path | Storage |
|-----------|------|---------|
| Events (`emit`) | Bus → handler subscribes → immediate | In-memory only — lost if no subscriber |
| Messages (`message`) | Bus → requests DB → heartbeat pickup | Persisted |
| Fork (`fork`) | Bus → manager.run() → immediate session | Persisted (session) |

**The gap:** Events are ephemeral. If no handler subscribes, the event vanishes. Messages and forks are durable. This violates P3 (events must be consumed).

**The fix:** Unify them. Everything enters through the bus. **All events are persisted.** The DB is the complete record of everything that happened:

```
Event fires on bus
  → DB persists it (always — complete event log)
  → Handler registered? → runs immediately
  → Nobody subscribes? → owner sees it in heartbeat via DB query
      Owner decides:
      a) handle it now
      b) register a handler so next time it's automatic
      c) triage and dismiss
```

The event log is the **single source of truth**. Consumed vs unconsumed is just a column (`handled_by`). No separate fallback logic. No special persistence path for unhandled events. The architecture itself guarantees the closed loop.

Benefits:
- **Complete audit trail** — "what happened and when" is always queryable
- **New handlers can catch up** — register a handler for `metric.breach` today, query the DB for past breaches to backfill
- **Observability** — "how many unhandled events per day?" is a trivial SQL query
- **Graceful degradation** — even before building a handler, events are captured and visible to owners

### What changes in `may.ts`

The `case "emit"` handler (line 818) currently:
1. Dispatches to subscribed cron handlers
2. Logs how many handlers triggered
3. **If 0 triggered — does nothing** (the gap)

After unification:
- **All** `emit` events are persisted to an events table (new DB writer subscriber)
- Handlers that fire mark the event as handled (`handled_by`)
- Unconsumed events (`handled_by IS NULL`) are visible to owners in heartbeat via: `SELECT * FROM events WHERE owner = ? AND handled_by IS NULL`

The persistence is a **DB writer subscriber** on the bus — same pattern as session events. Not special-case code in `may.ts`. The emit handler just dispatches; the DB subscriber persists everything.

```typescript
// New bus subscriber (in DB writer or standalone)
bus.subscribe((event) => {
  if (event.type === "emit") {
    db.prepare("INSERT INTO events (event_type, data, owner, timestamp) VALUES (?,?,?,?)")
      .run(event.event, JSON.stringify(event.data), event.data?.owner, Date.now());
  }
});
```

~15 LOC for the subscriber + schema.

### Messages become events

Today `agents.message("bob", "review this")` goes directly to `trackRequest()`. In the unified model, it emits an event first:

```
agents.message("bob", task)
  → bus.emit({ type: "emit", event: "message.received", data: { to: "bob", task, from: "coach" } })
  → if bob has a handler for "message.received" → immediate
  → if not → persisted to requests table → heartbeat pickup (today's behavior)
```

This is a future step — today's `message` path already persists correctly. The unification lets us add immediate handling for messages later without changing the API.

## Previously Identified Gaps — Now Fixed

| Audit GAP | Issue | Status |
|-----------|-------|--------|
| GAP 1 | "Already in context" lie | **FIXED** — `manager.ts:474` now says only SOUL.md + common-sense.md |
| GAP 2 | `buildSessionContext()` dead code | **FIXED** — removed |
| GAP 3 | Metric alerts don't auto-fork | **Functional but coupled** — see G5 below |

## Remaining Gaps

### G1: Events Are Ephemeral (violates P1, P3)

**Current:** `emit` events live only on the bus. If no handler subscribes, gone. Even consumed events have no record.

**Fix:** Persist **all** `emit` events to an `events` table via a DB writer subscriber. Columns:
- `event_type` — `metric.breach`, `project.commented`, etc.
- `source` — who/what emitted it (handler name, agent name, "human")
- `owner` — from event data or derived via owner registry
- `data` — JSON payload
- `handled_by` — NULL if unconsumed, handler name if consumed
- `timestamp`

Owners query unconsumed events in heartbeat: `SELECT * FROM events WHERE owner = ? AND handled_by IS NULL`.

This replaces the need for any "fallback" logic. The DB is the safety net.

### G2: No `owner` Field on Cron Entries (violates P2)

**Current:** Cron entries have `agent` but not `owner`. Handler failures are logged but nobody is accountable.

**Fix:**
- Add `"owner"` to cron.json entries (convention: `"may"` for system handlers, agent name for agent-specific)
- On handler failure: notify owner via bus
- ~10 LOC in cron.ts

### G3: Guard Block Messages Lack Escalation Template (violates P3)

**Current:** Guards say "WRITE BLOCKED" but don't tell agents who to escalate to or how.

**Fix:** Block messages include:
```
WRITE BLOCKED: [reason]
To resolve: [specific fix]
To escalate: agents('message', { agent: '<owner>', message: '...', priority: 'P0' })
To exit: finish(status: "blocked", blockers: [{ reason: "..." }])
```
~20 LOC across `compose-guards.ts` and `cross-edit-guard.ts`.

### G4: Ownership Convention Incomplete (violates P2)

**Current:** Metrics, projects, and agent definitions already have explicit owners. Cron entries don't. Events sometimes carry `data.owner`, sometimes don't.

**Fix:** Convention, not code:
- Add `"owner"` field to cron.json entries
- Events must carry `data.owner` (emitter's responsibility)
- No registry. No lookup utility. Owner is always stated explicitly where it's needed.

| Thing | Where owner lives |
|-------|------------------|
| Metric | `metrics.owner` column |
| Project | `**Owner**` field in project.md |
| Cron entry | `owner` field in cron.json |
| Event | `data.owner` in payload |
| Agent | implicit (may is supervisor) |

### G5: Metric Alert Response Coupled to Measurement (violates P1, P2)

**Current:** `metrics-snapshot.ts` detects breach AND calls `autoForkForAlert()` directly.

**Fix:** Decouple into emit + subscribe:
1. `metrics-snapshot` emits `metric.breach` event on breach
2. Remove `autoForkForAlert()` from metrics-snapshot
3. Create `metric-alert` handler with `"on": ["metric.breach"]`
4. `metric-alert` routes to best-fit agent. Owner as fallback.
5. Whether or not `metric-alert` handler exists, the breach event is persisted (G1) and visible to the owner in heartbeat

This is the unification in action: even if we haven't built the `metric-alert` handler yet, the breach event won't vanish — it persists and the owner sees it.

### G6: Session Continuity Unsolved (violates P4)

**Status:** Tracked by context-learning project (bob). Not redesigned here.

### G7: No CLI Event Emit (violates P1)

**Fix:** `may-agent --emit <event> [json]` → socket. ~10 LOC. Low priority.

### G8: Preferred Workflows Slot (violates P4)

**Recommend:** Remove false reference from common-sense.md. Implement when evidence shows agents freestyle when they shouldn't.

### G9: No General Circuit Breaker (violates P2)

**Status:** Partially solved by `active-nudge` (5min scan for loops/stalls/ghosts). Monitor coverage before building more.

### G10: project-resume WorkflowContext is Minimal

No workflow run records saved, child sessions lack `workflowRunId`. Tracking gap, not functional.

### G11: Evaluator Runs as Project Owner

Self-evaluation bias risk. Monitor false-done rates before adding independent evaluator agent.

## Implementation Sequence

### Phase 1: Foundation
- **G4** — Add `owner` field to cron.json entries, ensure events carry `data.owner`
- **G2** — On handler failure, notify owner via bus
- Convention only — no new code files

### Phase 2: Event Persistence (the big win)
- **G1** — Events table + DB writer subscriber — all events persisted, unconsumed events visible to owners
- **G5** — Decouple metrics: emit `metric.breach`, create `metric-alert` handler
- This phase implements the closed loop: every event is recorded, consumed or not

### Phase 3: Escalation
- **G3** — Guard block messages with escalation template using event `data.owner`

### Phase 4: Cleanup
- **G7** — Remove false preferred-workflows reference from common-sense.md
- **G8** — Remove stale common-sense references per common-sense-followups.md

### Not Prioritized
- **G6** (CLI emit) — nice-to-have
- **G9** (circuit breaker) — active-nudge covers it
- **G10** (workflow tracking) — tracking gap, not functional. Note: blocks project-tracking-db queries until fixed.
- **G11** (evaluator independence) — needs evidence of bias first
- **G12** (reviewer quality) — the reviewer in persistent-task is the weakest link. Tracked by reviewer-effectiveness project (bob, P0). A bad reviewer wastes all the infrastructure above.
