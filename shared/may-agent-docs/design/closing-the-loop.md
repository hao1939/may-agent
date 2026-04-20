# Design: Closing the Loop — Principle-to-Implementation Gap Fixes

**Status:** Draft
**Date:** 2026-04-21
**References:** [core-principles.md](core-principles.md), [ownership-driven-system.md](ownership-driven-system.md), [open-problems.md](open-problems.md), [implementation-audit.md](implementation-audit.md)

---

## Purpose

Map every gap between our core principles and the actual implementation. For each gap: what's violated, the minimal fix, and the sequence.

## Previously Identified Gaps — Now Fixed

These were flagged in `implementation-audit.md` (2026-04-20). Verified against current code:

| Audit GAP | Issue | Status |
|-----------|-------|--------|
| GAP 1 | "Already in context" lie — listed files not actually injected | **FIXED** — `manager.ts:474` now says only SOUL.md + common-sense.md |
| GAP 2 | `buildSessionContext()` dead code | **FIXED** — removed, only comment references remain |
| GAP 3 | Metric alerts don't auto-fork | **Functional but needs refactoring** — `autoForkForAlert()` works but is coupled (see G9 below) |

## Remaining Gaps

### G1: No Owner Fallback on Events (violates P2, P3)

**Current:** `dispatchEvent()` in `src/app/cron.ts:211` checks for registered handler subscriptions. If none found, returns 0 silently. Event disappears.

**Principle says:** P3 — Events must be consumed. If no handler, owner picks it up.

**Fix:** In `src/app/may.ts:826`, after `dispatchEvent` returns 0:
- Extract owner from event data (events should carry `data.owner`)
- Fork owner with event context: `bus.emit({ type: "fork", agent: owner, task: "[event] ..." })`
- If no owner in data, default to "may"
- ~15 LOC

### G2: No `owner` Field on Cron Entries (violates P2)

**Current:** Cron entries in `agents/may/cron.json` have no `owner` field. When a handler fails, error is logged but nobody is accountable.

**Principle says:** P2 — Everything has an owner. Owner investigates when things go wrong.

**Fix:**
- Add `"owner"` field to cron.json entries (convention: `"may"` for system handlers, agent name for agent-specific handlers)
- In `src/app/cron.ts` error handling: on handler failure, `bus.emit({ type: "notification", agent: entry.owner, text: "Your handler failed: ..." })`
- ~10 LOC in cron.ts

### G3: Guard Block Messages Lack Escalation Template (violates P3)

**Current:** Guards emit messages like `"WRITE BLOCKED: Agent 'X' cannot modify Y"`. No indication of who to escalate to or how.

**Principle says:** P3 — Escalation chain is: agent -> session owner -> May -> Hao.

**Fix:** Update guard block messages to include:
1. What failed
2. How to fix it
3. Who to escalate to (use owner registry or default to May)
4. How to exit cleanly (`finish(status: "blocked")`)

Template per `guard-escalation.md`:
```
WRITE BLOCKED: [reason]
To resolve: [specific fix]
To escalate: agents('message', { agent: '<owner>', message: '...', priority: 'P0' })
To exit: finish(status: "blocked", blockers: [{ reason: "..." }])
```

~20 LOC across `compose-guards.ts` and `cross-edit-guard.ts`.

### G4: No Owner Registry (violates P2 — prerequisite for G1, G2, G3)

**Current:** Ownership is scattered:
- Metrics: `owner` column in `metrics` table
- Projects: `**Owner**` field in project.md
- Cron entries: `agent` field (not `owner`)
- Agents: implicit (may is supervisor)

No unified `getOwner(entity)` function.

**Principle says:** P2 — Everything has an owner.

**Fix:** Create `src/lib/owner-registry.ts` (~30 LOC):
```typescript
function getOwner(entity: string): string {
  // 1. Check cron entry owner field
  // 2. Check agent definitions (agent → supervisor mapping)
  // 3. Check metric DB (metric_id → owner)
  // 4. Default: "may"
}
```

Used by: event fallback (G1), cron error handling (G2), guard escalation template (G3).

### G5: Session Continuity Unsolved (violates P4)

**Current:** Agents start fresh each session. For project work, journal.md helps. For heartbeats and ad-hoc tasks — zero memory.

**Principle says:** P4 — Context is discovered, not dumped. But there's nothing to discover.

**Status:** Tracked by context-learning project (bob). Not redesigned here. The principle doc notes this as a known gap.

### G6: No CLI Event Emit (violates P1)

**Current:** Socket `{"type":"emit"}` works. No `may-agent --emit` CLI flag.

**Fix:** ~10 LOC — CLI flag sends emit command to socket. Low priority.

### G7: Preferred Workflows Slot Not Implemented (violates P4)

**Current:** `context-injection-design.md` describes a "Preferred Workflows" replaceable slot. `common-sense.md` references it: "Your preferred workflows are listed in a separate section of your context." It doesn't exist.

**Fix options:**
- A) Implement the slot
- B) Remove the reference from common-sense.md until evidence shows the slot helps

**Recommend:** B — per P5 (evidence first), remove the false reference. Implement when there's evidence agents freestyle when they shouldn't.

### G8: No General Circuit Breaker (violates P2)

**Current:** `active-nudge` handler runs every 5min, detects loops/stalls/ghost deliverables, cancels or nudges. Persistent-task has 5-iteration stall detection.

**Status:** Partially solved. Monitor whether active-nudge coverage is sufficient before building more.

### G9: Metric Alert Response Coupled to Measurement (violates P1, P2)

**Current:** `metrics-snapshot.ts` detects breach AND calls `autoForkForAlert()` directly. Measurement and response are the same handler.

**Principle says:** P1 — Everything is an event. P2 — Route to best-fit, not hardcoded.

**Fix:**
1. `metrics-snapshot` emits `{ type: "emit", event: "metric.breach", data: { metricId, value, threshold, owner } }` on breach
2. Remove `autoForkForAlert()` from metrics-snapshot — it only measures and emits
3. Create `metric-alert` handler in cron.json with `"on": ["metric.breach"]`
4. `metric-alert` handler does the routing: look up best-fit agent for the metric domain, fork them. Owner as fallback. Dedup via requests DB.
5. Same pattern as `project-resume` subscribing to `project.commented`

**Benefit:** Multiple handlers can subscribe to `metric.breach`. Telegram notifier, alert handler, dashboard updater — all independent subscribers. Measurement is decoupled from reaction.

## Implementation Sequence

### Phase 1: Foundation — Owner Registry (G4)
- Create `src/lib/owner-registry.ts`
- Add `owner` field to cron.json entries
- Prerequisite for everything else

### Phase 2: Closed Loop (G1 + G2 + G9)
- Owner fallback on event dispatch
- Cron handler error notification to owner
- Decouple metric alert: emit → subscribe → route
- This phase implements the core of P1 + P2 + P3

### Phase 3: Escalation (G3)
- Guard block messages with escalation template
- Uses owner registry from Phase 1

### Phase 4: Cleanup (G6 + G7)
- CLI emit flag (nice-to-have)
- Remove preferred workflows false reference from common-sense.md

### Not Addressed Here
- **G5** (session continuity) — context-learning project
- **G8** (circuit breaker) — monitor active-nudge first
- **G10** (project-resume WorkflowContext is minimal) — no workflow run records saved, child sessions lack `workflowRunId`. Tracking gap, not functional.
- **G11** (evaluator runs as project owner) — self-evaluation bias risk. Monitor false-done rates before adding independent evaluator agent.
