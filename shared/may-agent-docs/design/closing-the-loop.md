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
- Owners see their events in heartbeat via: `SELECT * FROM events WHERE owner = ? ORDER BY timestamp DESC`

The persistence is a **DB writer subscriber** on the bus — same pattern as session events. Not special-case code in `may.ts`. The emit handler just dispatches; the DB subscriber persists everything.

```typescript
// New bus subscriber (in DB writer or standalone)
bus.subscribe((event) => {
  if (event.type === "emit") {
    db.prepare("INSERT INTO events (event_type, source, owner, data, timestamp) VALUES (?,?,?,?,?)")
      .run(event.event, event.data?.source, event.data?.owner, JSON.stringify(event.data), Date.now());
  }
});
```

~15 LOC for the subscriber + schema.

### Messages become events (future)

Today's `message` path already persists correctly via `trackRequest()`. Eventually messages could enter as events too, enabling immediate handling by subscribers. Not in scope — just noting the natural direction.

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
- `source` — who/what emitted it
- `owner` — from `data.owner`
- `data` — JSON payload
- `timestamp`

Owners query their events in heartbeat: `SELECT * FROM events WHERE owner = ? ORDER BY timestamp DESC`.

No consumption tracking. No `handled_by` column. If an owner needs to know whether an event was acted on, they check whether a follow-up exists (session started, request created) — that's already in the DB.

### G2: No `owner` Field on Cron Entries (violates P2)

**Current:** Cron entries have `agent` but not `owner`. Handler failures are logged but nobody is accountable.

**Fix:**
- Add `"owner"` to cron.json entries (convention: `"may"` for system handlers, agent name for agent-specific)
- On handler failure: notify owner via bus
- ~10 LOC in cron.ts

### G3: Guard Block Messages Don't Mention Escalation (violates P3)

**Current:** Guards say "WRITE BLOCKED" but don't hint at escalation.

**Fix:** Add one line to guard block messages: `"Can't resolve? Escalate to May."`

Agents already know the escalation chain from common-sense.md. They don't need a templated API call — just a reminder that escalation exists. ~5 LOC.

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

**Fix:** Decouple measurement from reaction:
1. `metrics-snapshot` emits `metric.breach` event on breach instead of calling `autoForkForAlert()`
2. Remove `autoForkForAlert()` from metrics-snapshot — it only measures and emits
3. Breach events are persisted (G1) — owner sees them in heartbeat
4. If heartbeat-based response proves too slow, add a `metric-alert` handler with `"on": ["metric.breach"]` later

Start simple: emit + persist. Add immediate handling when there's evidence the delay matters.

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

### Phase 3: Polish
- **G3** — Add escalation hint to guard block messages

### Phase 4: Cleanup
- **G7** — Remove false preferred-workflows reference from common-sense.md
- **G8** — Remove stale common-sense references per common-sense-followups.md

### Not Prioritized
- **G6** (CLI emit) — nice-to-have
- **G9** (circuit breaker) — active-nudge covers it
- **G10** (workflow tracking) — tracking gap, not functional. Note: blocks project-tracking-db queries until fixed.
- **G11** (evaluator independence) — needs evidence of bias first
- **G12** (reviewer quality) — the reviewer in persistent-task is the weakest link. Tracked by reviewer-effectiveness project (bob, P0). A bad reviewer wastes all the infrastructure above.
