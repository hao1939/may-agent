# Event → App admission: recovery boundary and cost

PR #336 closes a gap between saving an Event and saving its App admission.
An Event can survive a crash or failed database write before an admission plan
or inbox entry exists. The existing recovery paths cannot select that missing
record. A receipt from an unrelated Event consumer does not prove App admission.

## Reuse existing recovery

| Saved state | Recovery owner |
|---|---|
| Event, without durable App admission | The existing input recovery scan retries the App route using the Event's pending marker. |
| Admission plan | Existing plan recovery retries its unresolved commands. |
| App inbox entry | Existing inbox recovery attaches the input to its Task. |
| Task and linked result | Existing Task reconciliation and result recovery continue the work. |

Saving an admission plan transfers unresolved work to plan recovery. The pending
marker clears later, when the App route's accepted result is recorded, or directly
after inspection finds no App work. If plan persistence succeeds but that later
acknowledgement is lost, both scans may observe the same stable Event/input work;
their idempotent identities prevent a second consequential admission. Retries do
not replay ordinary fanout or controls. Delivery is at least once.

Producer retry helps only if the producer runs again and retries that Event.
Failure logs and evaluation can support diagnosis, but neither substitutes for
an indexed record of admission still owed. This change adds no queue, generic
route registry, recovery timer, or model call.

## Incremental cost over main before this PR

Every newly journaled Event starts with `app_admission_pending=1`, including
Events that ultimately need no App work. This avoids a second routing decision
inside the Event writer.

| Operation | Added cost |
|---|---|
| Event journal write | One field in the existing INSERT, plus pending-index maintenance. |
| Accepted App admission | Clear the field in the existing receipt UPDATE. |
| Inspected no-work | One extra UPDATE to clear the marker; this path can be common. |
| Pending recovery | Existing scan reads a fixed high-water mark and up to 64 indexed IDs per pass, loading at most 16 readable Events. |
| Addressed agent message | One indexed lookup by origin Event on admission, preserving a previously accepted recipient after lost acknowledgement. |
| Storage | One new partial pending-Event index, reuse of the existing full inbox-origin index, their write maintenance, and retention of still-pending Events. |

An empty recovery scan does not read historical Event bodies. Persistent
failures remain pending and retry on the existing cadence; this PR does not
add a new escalation policy or guarantee recovery from corrupt evidence.

Migration preserves the old outstanding Conversation recovery subset: pending
or unhandled `conversation.message.created` Events with approval metadata or an
external body. Other historical Events remain unmarked. Older stranded reports
need a separate, verified recovery of their exact Events, not blanket replay.

## Verification and limits

```sh
bun test src/app/composition/direct-event-recovery.test.ts
bun test src/app/core/events/bus.test.ts src/lib/db/schema.test.ts src/lib/db/maintenance.test.ts
```

These tests exercise real persistence and admission, restart, a second-process
SQLite writer lock, independent receipts, stable identities, current routing
before a plan, retained recipients afterward, no-work settlement, fair retry,
Stop non-replay, migration and retention. Query-plan assertions cover
`idx_events_app_admission_pending` and `idx_app_inbox_origin_event`.

This is a statement and query-plan accounting, not a performance benchmark.
No latency, throughput or contention improvement has been measured. Check live
write cost and recovery backlog after deployment before adding optimizations.
