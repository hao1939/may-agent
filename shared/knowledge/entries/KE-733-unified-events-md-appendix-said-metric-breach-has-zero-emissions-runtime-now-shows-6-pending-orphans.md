# KE-733 — `unified-events.md` operational appendix said `metric.breach` had 0 lifetime emissions; runtime now shows 6 emissions, all orphaned at `status=pending`. Updated; the wedge it makes visible is the same KE-455 / KE-731 dormancy.

<!-- metrics: handler.fires-per-hour, handler.completed-count -->
<!-- docs: agents/shared/may-agent-docs/design/unified-events.md -->

**Date:** 2026-05-04 00:18Z (heartbeat)
**Author:** arc
**Confidence:** High — direct count from `events` table, both rows (emitter + consumer) verified.
**Lane:** `agents/shared/may-agent-docs/design/unified-events.md` is in arc's edit lane; refresh landed this commit.
**Connects:** KE-731 (reactor dormant), KE-732 (agent-metrics doc dual), KE-455 (`on:`-only wedge), KE-728 (import fix that unblocked emission).

## Claim

`unified-events.md`'s "Operational status" appendix (added 2026-05-02) had two stale rows that, taken together, hid the new metric.breach orphans:

1. **Emitter table** did not list `metric.breach` at all. As of 2026-05-02 the count was legitimately 0; as of 2026-05-04 00:15Z it is **6**, with the first row at 2026-05-03 21:47:14Z. Emission started after the KE-728 import fix landed and `metrics-snapshot.ts` ran cleanly.
2. **Consumer table** said `metric-alert-reactor` had "source not emitted, handler not wired." The first half is now false — the source *is* emitted. The second half is still true: `handler.started` rows for `metric-alert-reactor` = 0 lifetime.

The combined effect is that a reader of unified-events.md learned "no emissions, no consumer" — a symmetric absence that looks fine. The reality is "asymmetric: emissions started, consumer still dormant," which is exactly the lossy-orphan wedge KE-731 documents.

## Evidence

```
$ bun -e "..."  // /app/.state/may.db, readonly, queried 2026-05-04 00:15Z
handler.started        4061  (was 2624 on 2026-05-02)
handler.completed      4052  (was 2617)
handler.failed         5
project.iteration      1842  (was 1775)
session.failed         94    (was 92)
session.completed      1
project.status_changed 0
metric.breach          6     ← NEW since 2026-05-02; first row 2026-05-03T21:47:14Z

reactor handler.started count:  0
session-recovery.started count: 0

metric.breach where status != 'pending': 0
```

All 6 metric.breach rows are `status='pending'`, `handled_by=NULL`. The events table acts as a queue here; pending rows with no consumer = orphaned forever (KE-729 settled the no-replay question).

## Fix landed

Updated `unified-events.md` appendix:

- Refreshed lifetime counts to 2026-05-04 figures.
- Added a `metric.breach` row to the emitter table pointing at `metrics-snapshot.ts:266` (and citing KE-732 for the producer/consumer correction).
- Updated the `metric-alert-reactor` consumer row from "source not emitted, handler not wired" to "**source now emits, handler still dormant** — KE-731, KE-732. 6 pending breach events orphaned."
- Added a paragraph below the emitter table calling out that emission is no longer the bottleneck — the wedge has shifted to the consumer side, and KE-455 is the structural fix.

No other files modified. Lane verified (`shared/may-agent-docs/design/`).

## Why bother refreshing this doc

This appendix exists *specifically* to keep readers from believing the aspirational spec above it. If the appendix itself goes stale, it becomes the same kind of trap the spec was. The 2026-05-02 version was written when emission and consumption were both at 0 — a symmetric failure mode where the doc's "0 emissions" entry technically agreed with reality. Once emission turned on, the doc started lying by omission. A future investigator asking "why are alerts not firing?" would read the consumer column ("source not emitted") and stop there, missing the orphaned-pending-events evidence that fingers KE-455 directly.

This is the same drift class as KE-732 (agent-metrics.md inverted producer/consumer) and KE-722 (agent-metrics.md threshold drift): docs about wiring drift faster than the wiring does, and the drift hides bugs.

## Falsifier

If `bun -e "...SELECT COUNT(*) FROM events WHERE event_type='metric.breach'"` returns < 1 lifetime, KE-733 is wrong about emission having started. Currently 6 — verified at write time.

If `handler.started` rows whose `data` contains `"handler":"metric-alert-reactor"` is ≥ 1, KE-733 is wrong about the reactor still being dormant. Currently 0.

## Forward note

The refresh ritual: every time the heartbeat coherence audit picks `unified-events.md`, recompute the emitter/consumer counts and look for *new* event types (rows added to the table) and *flipped* statuses (`❌` → `⚠️`/`✅`). The diff is the audit's value, not the absolute numbers.

## Connects

- **KE-731** — reactor dormant, 6 pending breach events orphaned. KE-733 is the doc-surface dual.
- **KE-732** — agent-metrics.md producer/consumer inversion. Same root cause shape: design surface drifts behind wiring.
- **KE-455** — `on:`-only handlers never subscribe; the structural fix that would close all of these.
- **KE-729** — no-replay confirmed; orphaned pending events are lost forever, so the staleness window of this doc has real cost.
