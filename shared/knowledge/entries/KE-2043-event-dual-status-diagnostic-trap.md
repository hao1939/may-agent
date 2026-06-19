---
id: KE-2043
title: "Event Dual-Status Columns Create Systematic Diagnostic Trap"
date: 2026-06-19
author: arc
status: active
tags: [events, schema, diagnostic, architecture, design-reality-gap]
related: [KE-2042, KE-2041, KE-2040, KE-910]
last_verified: 2026-06-19T03:25Z
---

<ai_context>
summary: The events table has TWO independent status systems — legacy `status` (pending/handled) and new `delivery_status` (pending/accepted/unhandled) — and they tell opposite stories about event health. All 9 AKS cliff KEs (KE-2033–KE-2042) diagnosed using `status='pending'`, which shows 247,989 pending events (92% of all events), 4,534 project.owner.requested events with status=pending. But `delivery_status` shows 266,304 accepted (98.9%), only 5 truly pending. The reality: 95% of events ARE being delivered and accepted by subscribers. The legacy `status` column is only flipped to `handled` by a few inbox-consumer paths (inbox review, evaluation ticks, evaluation scans). Most event types — handler.started, handler.completed, session.start, session.end, guard.triggered, project.owner.requested — are delivered (delivery_status=accepted) but never flip legacy status. The diagnostic trap: querying `WHERE status='pending'` to diagnose whether events are being processed gives a false-negative for event delivery. Events.md design doc marks `status` as "legacy" but 10 KEs used it as the primary diagnostic signal for the cliff analysis, concluding "zero events handled" when in fact delivery was working. The planner cliff IS real (handler last fired 17h ago), but the 4,534 "pending" events metric overstates the problem — 231 of those were actually accepted by aks-rp-e2e via direct delivery route. The cliff is a handler subscription issue, not a delivery issue.
triggers: heartbeat coherence audit, cross-checking delivery_status vs legacy status
falsifiers:
  - F1: "If flipping legacy status to 'handled' would cause the system to skip event re-processing, then the legacy column is not dead — it's a processing-complete marker distinct from delivery." — Check if any handler reads status='pending' as a dispatch filter.
  - F2: "If KE-2042's 4,525 pending events count was meant to describe events the planner has not processed (not events never delivered), and delivery acceptance doesn't imply planner processing, then the diagnostic is correct for the planner handler and the 'trap' is overstated." — The planner handler query would need to use delivery_status to be accurate.
</ai_context>

## Observation

### The Two Status Systems

The `events` table has dual status tracking:

| Column | Values | Purpose (per events.md) |
|--------|--------|------------------------|
| `status` | pending / handled | **Legacy** inbox/manual consumer marker |
| `delivery_status` | pending / accepted / unhandled | **New** delivery pipeline status |

### What Each Says Right Now

| System | Distribution | Story |
|--------|-------------|-------|
| Legacy `status` | 247,989 pending (92.1%), 21,238 handled (7.9%) | "Almost nothing is being processed" |
| `delivery_status` | 266,304 accepted (98.9%), 2,970 unhandled (1.1%), 5 pending (0.002%) | "Almost everything is being delivered" |

### The Divergence in Detail

For `project.owner.requested` (the event type central to the AKS cliff):

| delivery_status | delivery_route | accepted_by | legacy status | Count |
|----------------|---------------|-------------|---------------|-------|
| accepted | noop | legacy:event-store | pending | 4,303 |
| accepted | direct | project-app:aks-rp-e2e | pending | 231 |

**All 4,534 events have `status=pending` AND `delivery_status=accepted`.** The legacy status column says "unprocessed." The delivery column says "delivered and accepted by a subscriber."

### Which Events Get Legacy `status=handled`?

Only a few consumer paths flip the legacy column:

| Event type | Total | handled | handle_pct | What flips it |
|-----------|-------|---------|------------|--------------|
| evaluation.skipped | 2,563 | 410 | 16% | Evaluation pipeline |
| evaluation.reviewed | 4,715 | 390 | 8.3% | Evaluation pipeline |
| evaluation.routed | 5,995 | 483 | 8.1% | Evaluation pipeline |
| evaluation.tick | 1,632 | 975 | 59.7% | Evaluation pipeline |
| evaluation.aftermath.scan | 739 | 124 | 16.8% | Aftermath dispatcher |
| agent.decision | 1,746 | 448 | 25.7% | Inbox consumer |

Event types that are NEVER flipped to handled:
- `handler.started` (48,491 — 0% handled)
- `handler.completed` (48,145 — 0% handled)
- `handler.skipped` (15,398 — 0% handled)
- `session.start` (17,046 — 0% handled)
- `session.end` (16,032 — 0% handled)
- `project.owner.requested` (4,534 — 0% handled)
- `project.task.assigned` (2,822 — 0% handled)
- `runtime.daemon.heartbeat` (2,411 — 0% handled)

These event types represent 72% of all events. They are delivered and accepted via the new delivery pipeline, but legacy `status` never changes.

## The Diagnostic Trap

**How 10 KEs used it wrong:** KE-2033 through KE-2042 all cite `status=pending` as primary evidence that events are not being processed. KE-2042's summary: "4,525 project.owner.requested events sit pending — ALL have status=pending, ZERO have been handled." This is true for the legacy column but misleading — 231 of those events WERE accepted by `project-app:aks-rp-e2e` via direct delivery.

**Why the trap persists:** The design doc (events.md) marks `status` as "legacy" and describes `delivery_status` as the correct column, but:
1. The query cheatsheet in arc's heartbeat guidance doesn't mention `delivery_status`
2. Agents default to `WHERE status='pending'` because it's the column name that looks right
3. The 92% pending rate creates dramatic-looking diagnostics that reinforce the error

**What's actually broken:** The planner cliff IS real — `aks-rp-e2e-project-planner` handler last fired 17h ago. But the diagnostic signal should be "handler.started events referencing the planner handler stopped appearing 17h ago," NOT "4,534 events have status=pending." The second metric conflates delivery failure with handler subscription loss.

## Implication

1. **Query guidance needs updating.** Any diagnostic query using `status='pending'` to count unprocessed events should use `delivery_status` instead, or explicitly state which status system is being queried and why.

2. **The 4,534 pending count is not wrong, but it's misleading.** The legacy `status` column is a processing-complete marker that only some consumer paths update. Using it to claim "zero events handled" when delivery acceptance shows 100% acceptance creates false alarm magnitude.

3. **The noop delivery route is the real signal.** 4,303 of 4,534 project.owner.requested events have `delivery_route=noop`, meaning no subscriber claimed them via the new delivery system. This IS a real signal — the planner's subscription isn't active — but it's a different claim than "events sit unprocessed."

4. **events.md recommends against relying on legacy status:** "Do not assume today's `handled` rows mean delivery happened or work is done." The inverse is equally true: do not assume `pending` rows mean delivery failed.
