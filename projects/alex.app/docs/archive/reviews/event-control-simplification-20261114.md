# Event/control simplification source audit — November 14, 2026

**Supports:** [Event and control plane proposal](../../proposals/control-socket-simplification.md).
This record distinguishes responsibilities that can converge from behavior
that still has consumers. It records source inspection, not installed behavior.

## Revision and method

Host source: `b16392bea9c445506ec5ef20bd6c5407690b2e3d` in
`projects/may-agent`. Apps base: `396572e7b027fe0b49374b682b4eb41574f13c4e`.
The earlier control-socket proposal was an untracked draft in the shared Apps
checkout; it was preserved before refinement. Concurrent App source and design
edits, including the HTTP contract, were outside this change.

Used `wc -l`, targeted source reads and `rg` across production writers,
subscribers, transport clients, worker relay, restart recovery and retention.
No live database, service operation, Task mutation or model call was used.
Counts exclude tests and use newline-based `wc -l` at the pinned revision.

| Source | Lines / relevant scope |
| --- | --- |
| `src/app/core/events/bus.ts` | 1,378 total; event declarations occupy roughly the first 800; EventBus class starts at 929 and is about 380 lines |
| `src/app/core/events/interface.ts` | 830; admission catalogue starts at 73, Event views/links at 533, facade at 780 |
| `src/lib/db-writer.ts` | 1,261; body/identity helpers, pair contracts, projections, journal insertion, delivery recording and maintenance |
| Three event files | 3,469 |
| Control `server.ts`, `client.ts`, `protocol.ts` | 1,375 + 402 + 113 = 1,890 |
| All eight production `packages/control/src/*.ts` files | 2,242; shared event types, envelope/binding and Task-wake helpers also remain |

`SOCKET_CONTROL_TYPES` contains **18** commands at this revision, rather than
21. No separate production Event Middleware implementation was found in the
inspected `src`/`packages` tree. It is an adapter direction, not a demonstrated
replacement already available to wire in. The package is not wholly transport
boilerplate, and the proposed 400-line
EventHub/100-line HTTP replacement is not an evidence-backed total.

## Publication, persistence and transactions

[EventInterface.publish](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/events/interface.ts#L780)
already normalizes input, stamps trusted context, selects the type contract,
reuses eligible saved submissions, emits and reads a durable receipt.
`getEventView` and its link readers account for substantial code outside dispatch.
`subscribe` wraps the asynchronous listener path; it has no replay cursor.

[EventBus dispatch](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/events/bus.ts#L1075)
persists before side-effect subscribers. If persistence joins a resource
transaction, it defers dispatch until the outer commit. Otherwise journal
append completes before durable routes and separate delivery recording.
Failed routes do not roll back an already committed Event. Keyed retries
restrict redelivery to idempotent routes; ordinary effects are not rerun.

[DbWriter.handler](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/lib/db-writer.ts#L495)
updates session records/results, applies selected metric mutations and normalizes
escalation feedback ownership, besides journaling. Session result evidence can
include filesystem artifacts; not all operations are one SQL transaction.
[insertEventRow](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/lib/db-writer.ts#L689)
handles identity hashes/scopes, saved receipt replay, attempt leases/generations,
complete body artifacts, envelope metadata, correlations, traces, exact Task
wakes and pair links. Replacing it with an INSERT alone loses these contracts.
`recordDelivery` preserves App admission independently of another route's receipt.

The [persisted loader](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/events/persisted.ts#L66)
validates envelope and full-body integrity. Truncated inline data is a search or
display projection, not necessarily replayable input.

## Actual subscribers and recovery

Production `bus.subscribe` has two call sites:

- [agent/session binding](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/daemon-events.ts#L141), updating the session lookup on start;
- [worker event relay](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/composition/workers/task-attempt-process.ts#L505), sending durable event identity to the parent.

No production registration uses `priority: "first"`. This is a concrete opening
for replacing generic synchronous priority tiers with explicit hooks.

Durable route registrations have three owning boundaries:

- [App admission](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/composition/app-inbox-runtime.ts#L1232);
- [Task controls](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/task-control-events.ts#L13);
- [session and runtime controls](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/command-router.ts#L239).

App admission uses pending markers, frozen plans, per-route commands, isolated
translation and exact local wakes. See
[admitAdmissionPlan](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/composition/app-inbox-runtime.ts#L754).
A Task does not cover input lost before Task creation. Deleting admission
recovery because Tasks exist would reintroduce that gap.

The [Task worker](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/composition/workers/task-attempt-process.ts#L488)
installs persistence but deliberately no delivery recorder. The parent calls
`fanoutPersisted` for the same row. Its fair, bounded relay and replay rules
must survive facade consolidation.

Passive listeners include metrics, Task-session associations/recovery wakes,
active-attempt input, Console, Telegram, logging and EventInterface observers.
They observe durable facts as well as transient output. Several are useful
accelerators whose authoritative state remains elsewhere; losing a hint must
not lose an obligation.

[Listener queues and failure reporting](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/core/events/bus.ts#L1187)
already bound each FIFO, yield between notifications, defer failure Events and
avoid reporting failures recursively. The claim that synchronous recursive
`subscriber.failed` emission is still the current design is inaccurate.
`src/app/metric-source-measurement.ts` consumes its durable one-hour count.

## Pair tracking still has consumers

[PAIR_CONTRACTS](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/lib/db-writer.ts#L413)
cover session, handler, workflow, escalation and two CLI-task phases. Their TTLs
mark diagnostic orphans; this mechanism is different from App admission retries.

| Consumer | Current behavior to migrate or deliberately retire |
| --- | --- |
| `src/app/daemon-events.ts` | Closes stale handler pairs and emits workflow interruption evidence after restart using workflow-run state |
| `src/lib/query-service.ts`, HTTP `event-routes.ts` | Exposes orphan/overdue pairs in delivery-health reads |
| `src/lib/db-writer.ts`, `src/lib/db/event-traces.ts` | Persists exact closure links and supports follow-up correlation |
| `src/app/modes/maintenance.ts`, `src/lib/db/maintenance.ts` | Runs expiry, orphan retirement and bounded event/pair deletion |
| `src/lib/db/schema.ts` | Protects referenced/open-pair Events from retention deletion |

Existing execution tables make some pair diagnostics redundant. That is a
reason to migrate consumers, not evidence that deleting every pair is safe now.
The historical assertion that all this predates the Tasks table was not
established by this audit and is not used to justify the proposal.

## Control transport and remaining resource reads

The [protocol catalogue](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/packages/control/src/protocol.ts#L3)
includes mutation wrappers, resource reads and subscriptions.
[Host composition](https://github.com/hao1939/may-agent/blob/b16392bea9c445506ec5ef20bd6c5407690b2e3d/src/app/transport/socket.ts#L72)
already supplies canonical callbacks. `getSessionId` is hardcoded empty there;
legacy chat filtering remains in the generic server. Server handlers duplicate
framing/error paths, and several controls translate to existing publication.

HTTP/SSE can replace those framing and request-correlation mechanisms. It does
not replace human/SDK Task views, workload readiness, live runtime status,
action-schema translation, privileged approvals or resource fencing. WAL reads
also cannot recover in-memory authorities by querying tables.

Existing `GET /api/events` is a bounded history query. The proposed SSE route
must be separate. Raw transient bus events have no durable ID; worker commits
need cross-process observation; generic event retention is selective. None of
these supports promising complete history from `afterEventId` without another
explicit contract. The proposal defers that additional capability and keeps
live notifications plus canonical rereads first.

## Validation and limits

This audit is static source evidence. No behavioral test was added or claimed
for an unimplemented facade or transport. Documentation validation results are
reported with the change. Future implementation must exercise the combined
append/admission/worker/recovery path, rather than rely only on isolated wrapper
tests. Earlier worker-wake findings remain in the
[workload comparison record](workload-owner-comparison-20261113.md).

No release, installed activation, throughput comparison or caller-delivery
acceptance was performed. Unrelated App work and existing live evidence remain
outside this proposal.
