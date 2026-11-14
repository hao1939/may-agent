# Proposal: simplify the event and control plane

**Supports:** [Events and Task admission](../2a-design/events.md) and the
[Host/App boundary](../2a-design/system-boundary.md). Give callers one way to
submit input and observe results, while reducing the machinery on that path.

**Choice basis:** [Simple first and one authority](../1-principles/core-principles.md#one-authority-for-each-resource)
and [robust enough for the goal](../1-principles/design-philosophy.md#robust-enough-for-the-goal).
Retain owed input and exact control evidence; allow replaceable display updates
to be lost and repaired by reading current resources.

**Design status:** Proposal for review. Expands the earlier control-socket
proposal; its JSON-line framing and multiplexing plan is superseded by the
HTTP transport direction below.
**Implementation status:** Unimplemented. The existing EventInterface already
provides `publish`, `get` and live `subscribe`; this proposal simplifies their
implementation and transport. Source findings and counts are pinned in the
[November 14 audit](../archive/reviews/event-control-simplification-20261114.md).
Source review is separate from installed behavior; no activation is proposed.

## Decision

Use one Host event service, called **EventHub** here, with two internal paths:

- **Durable publication:** validate input, journal it, retain or apply admission,
  and return an EventReceipt. Existing resource owners execute the work.
- **Live observation:** send committed facts, resource wakes and transient
  execution output to bounded subscribers. Observation never accepts work.

Expose that service through ordinary calls and a thin Unix HTTP/SSE adapter.
Event middleware adapts these same operations; it adds no second router or
subscription authority. Keep typed resource reads alongside it. The external vocabulary is
**publish, read, subscribe**; `publish` and `subscribe` alone cannot replace Task,
Conversation, workload, action-discovery and runtime-status reads.

```text
Caller / adapter
  -> publish(input, trusted context)
       -> event journal + local required projections
       -> existing admission owners / retained admission plans
       -> receipt: recorded or accepted
       -> post-commit live notifications

Reader -> typed resource read -> current Task / Conversation / Event / status
Observer -> subscribe(filter) -> committed notifications or transient output
```

One service means one entry and authority boundary, with small internal
components. It does not mean merging storage, controls and streaming into one
large class. Internal resource writers remain ordinary typed calls and
transactions; this is not a requirement to turn every mutation into an event.

## What the current size tells us

The three named files contain 3,469 lines at the audited revision. However,
`bus.ts` includes roughly 800 lines of event declarations; the EventBus class
itself is about 380 lines. `interface.ts` includes the admission catalogue and
Event read/link projection. `DbWriter` also owns payload artifacts, deduplication,
traces, attempt fences, exact wakes, session projections and lifecycle evidence.
The control package implements reads and privileged controls as well as fanout.
These are distinct responsibilities, not four interchangeable event buses.

The useful reduction is to delete overlapping dispatch and obsolete behavior:

| Current mechanism | Proposed disposition |
| --- | --- |
| EventInterface validation and receipt view | Keep as EventHub's public facade; keep one admission catalogue |
| Persistence subscriber and delivery-recorder installation | Replace with explicit journal/admission dependencies |
| `first` and `normal` synchronous tiers | Remove after migrating the two ordinary production subscribers to explicit hooks; no production caller uses `first` |
| Durable route subscribers | Explicit bounded admission composition using existing App and control owners; retain independent route recovery |
| Passive `listen` queues | Keep one bounded observer mechanism shared by local and transport subscribers |
| Pair matching and TTLs | Retire family by family after handling restart, health, trace and retention consumers |
| `subscriber.failed` machinery | Simplify reporting while retaining failure visibility and its existing metric consumer |
| Separate socket mutation handlers | Translate to existing event builders and publish; resource owners retain fencing and authority |
| Custom JSON-line request protocol | Replace with standard HTTP requests and SSE responses after migrating clients |

Moving the event catalogue out of `bus.ts` makes the runtime easier to inspect;
it is not a LOC saving. There is no defensible 400-line service or 4,500-line
saving estimate yet. Measure production code deleted, remaining responsibilities
and whole-path cost after each cut, including new clients and compatibility code.

## Participants and responsibilities

| Participant | Owns |
| --- | --- |
| Publisher / ingress adapter | Semantic input and retry identity; trusted adapter supplies provenance and authorization context |
| EventHub facade and journal | Admission schema, immutable event identity/body, exact replay identity, traces and receipt inspection |
| Admission/resource owner | Exact controls or durable responsibility for input; per-route recovery and resource updates |
| Task and execution runtime | Work, capacity, attempts, settlement and recovery; execution evidence remains separate from Task closure |
| Observer / transport | Bounded delivery of hints and output, reconnect and reread; no acceptance or business interpretation |

Apps still own meaning, requirements and closure. Funding and event transport
grant no additional authority. App subscriptions that create obligations stay
in durable App admission; they must not become passive EventHub listeners.

## Durable publish contract

An ordinary example is `app.input.requested`: the caller supplies an App, input
and idempotency key. The Host validates trusted context and shape, saves the
Event, and records the existing input or admission plan. It returns the Event
identity and known links. The caller follows the Task or request for results.

Preserve the accepted [admission contract](../2a-design/events.md#admission-contracts):

1. Normalize input and assign trusted provenance. An exact keyed replay must
   match the saved canonical input before reusing its identity. Reuse must not
   fail merely because mutable target state changed after the original request.
   Changed input under the same key is rejected.
2. Save the Event, verified complete body/reference, trace and required local
   projections in the owning SQL transaction. Validate Task-attempt emission
   fences before admitting a new effect; exact replay follows its existing rule.
3. Run only bounded admission updates on the publication path. Broader App
   translation may proceed from the existing frozen admission plan in its
   worker. Do not execute workflows, model calls or external I/O there.
4. Return `recorded` when saved but not yet accepted, or `accepted` when the
   relevant admission authority has retained responsibility. Neither means
   Task completion, all independent routes succeeded, or caller delivery.
5. Notify observers only after the relevant commit. Publication inside a
   resource transaction defers routing/notification until the outer commit;
   rollback exposes no committed Event or notification.

**One publish call does not imply one transaction around every route.** Today
the append can commit before routing, routes can have their own transactions,
and broad admission crosses a worker boundary. Keep the existing journal and
admission markers to recover these gaps. Combine local writes where their
owner requires atomicity; do not hold a SQLite writer lock across workers,
App execution or runtime effects to make the diagram look atomic. Current
session projection calls can precede journal insertion; extraction must check
that failure boundary rather than claim all existing writes are already atomic.

If a process stops after append and before admission, recovery loads that
same verified Event and resumes only its pending idempotent routes. Another
route's acceptance cannot erase an outstanding App admission, and recovery
cannot repeat already accepted ordinary effects. Denials retain their exact
input, responsible route, failure/disposition and existing next wake. No second
outbox, broker or recovery scheduler is needed.

Worker publication remains the same Event: the worker appends through the
journal, relays its durable ID, and the parent performs its pending admission
and local notification without another insert. Child persistence alone cannot
claim parent-route delivery. Lost relays recover through retained admission.

Retry returns the same event identity with its **current** admission view;
the receipt need not be byte-for-byte identical as admission advances. A
transport may retry a post-send-unknown result only for a type with a durable,
retained idempotency contract covering that effect. A key on an Event alone
does not make restart, Stop or external sends exactly-once. Preserve existing
operation-specific replay rules and define the retry horizon before deleting
keyed records. Automatic retry stops at that horizon; the caller must resolve
the prior outcome before deliberately submitting new work.

## Live observation and optional journal replay

Transient text, tool output and progress remain live-only. They have no durable
cursor and need not be inserted into SQLite. Durable facts and resource wakes
join this observation path after commit. A listener receives both today; the
current synchronous tiers are not simply an ephemeral stream.

Use one filtered, bounded queue per subscriber. Preserve per-listener order
and event-loop fairness, contain exceptions, and disconnect/reset slow remote
consumers rather than accumulating unbounded buffers. A slow observer cannot
veto admission. On reconnect or overflow, subscribe first and then reread the
watched resource, retaining wakes during the read so a racing change triggers
another read. Coalesce only replaceable resource wakes, never business facts
or transcript chunks. Async notifications can arrive after an attempt settles;
they must not start another attempt from stale execution evidence.

The first transport version keeps this **live + reread** contract. This is
sufficient for Task/Conversation views and avoids building a second work queue.
It accepts lost transient output; committed input and current results remain
recoverable from their owners.

`afterEventId` is a separately scoped extension for journal inspection, not a
prerequisite for replacing the bus or transport. If a concrete consumer needs
continuous history, its implementation must satisfy all of these rules:

- Replay only durable Events, never transient output or admission/control effects.
- Drain bounded SQL pages in committed ID order from one journal cursor;
  register for commit hints before the initial drain. Hints trigger another
  drain rather than appending independently ordered callback payloads.
- Include worker commits and missed relay recovery. In-memory notifications
  alone cannot establish completeness across processes; use a bounded catch-up
  read, reusing an existing wake/maintenance cadence where suitable.
- Bind the cursor to the database identity and subscription filter. Expose a
  reset when retention has removed required history or the database changed;
  event IDs need not be consecutive, and a remaining minimum ID does not prove
  an intact retained interval. Bound catch-up work and retained-history promises.
- Load verified complete bodies through the persisted-event reader. A damaged
  body cannot be replayed as a truncated projection. Clients deduplicate IDs;
  a cursor records observation, never successful work consumption.

This extension requires an explicit retention/completeness contract first.
`GET /api/events` already serves bounded historical queries; SSE must not
silently replace that response or promise unlimited event history.

## Thin control transport and reads

Proposed local daemon endpoints, using standard HTTP over a Unix socket:

| Operation | Endpoint / owner |
| --- | --- |
| Publish | `POST /events` -> EventHub with trusted ingress context |
| Inspect receipt | `GET /events/:id` -> existing Event view |
| Subscribe | `GET /events/stream` -> filtered live SSE; replay only when separately implemented |
| Read resources | Typed Task, Conversation, workload, action-discovery and status handlers |

HTTP supplies request/response correlation and connection reuse. SSE supplies
stream framing. Do not first build custom `requestId` multiplexing and a new
JSON-line parser that the next phase removes. The adapter still owns request
size/connection limits, subscription cleanup, backpressure, socket permissions
and inode-safe shutdown. Connecting must not implicitly scan status tables.

All external Task controls use existing event builders with exact generations,
resource versions and reasons. Remove duplicate transport checks only when the
owning control route covers them. Formal approvals and operator-only reopening
retain their trusted authorization context; changing wire format cannot turn
payload `source` claims into authority. App actions keep one declared schema
validation/`toInput` translation before publishing ordinary App input.

Keep typed reads using the same canonical reader in and out of process.
SQLite WAL permits concurrent reads; it does not make raw tables a public API
or provide in-memory registry and runtime status. Existing direct reads of
Host-owned stores may remain where already supported. Do not move Task,
Conversation or workload semantics into each client under “direct WAL reads.”
Read failures must remain failures rather than empty boards.

The browser-facing HTTP/WebSocket adapter may forward to these same operations.
Replacing browser WebSockets with SSE is independent: terminal interaction and
other bidirectional streams need their existing transports. CLI, Console,
Telegram, web mode and maintenance clients must be inventoried before cutover.
Use a temporary fixture socket for validation; production reuse of `host.sock`
requires a coordinated Host/client upgrade. An old protocol must fail explicitly.
Do not dual-publish to old and new transports. Any necessary compatibility
adapter calls the same service and has a named removal point.

## Pair tracking and failure reporting

Tasks own durable work, but they do not automatically replace session,
workflow, handler, escalation and CLI execution evidence. Current pairs support
restart interruption facts, health reads, trace closure links and retention.
An orphan is diagnostic evidence, not proof of Task failure or permission to
rerun work. These are separate from App admission redelivery.

Start with session/workflow pairs where authoritative execution records already
exist. For each family, either derive the still-useful bounded diagnostic from
its owner or explicitly retire that diagnostic and its consumer. Preserve
historical trace/receipt reads and referenced Events. Remove fallback acceptance,
pair writes, sweeps and schema protection only with that family's callers and
restart behavior accounted for. Do not create another generic pair tracker in
the replacement journal.

The bus already defers `subscriber.failed` and prevents reporting failures from
recursing. Replace its generic failure dispatch only if the existing failure
metric and admission diagnostics still have evidence. Retain the original Event
and route identity; reporting remains passive, with a logger fallback when
storage fails. Observer reporting cannot change accepted state or create work.

## Incremental delivery and verification

Each step removes a mechanism before expanding scope. Runtime implementation
is future work; use source-only fixtures and existing owning tests.

| Step | Change and deletion | Evidence required |
| --- | --- | --- |
| 1. Explicit event core | Separate the catalogue, inject journal/admission directly, migrate session binding and worker relay hooks, delete generic priority tiers | Public and internal publish, nested commit/rollback and projection failures, keyed retry, worker append/parent delivery, reload without duplicate hooks |
| 2. One control write path | Migrate redundant mutation handlers and slash-command rewriting to canonical input/builders; retain action translation | Same authority/version rejection and acceptance from all adapters; replay after target state changes; unknown post-send disposition |
| 3. HTTP/SSE transport | Replace custom framing and mutation dispatch after migrating current clients; retain typed reads | Real Unix client/daemon fixtures, subscribe/read race, disconnect/overflow, fairness, ownership-safe socket cleanup; no status SQL on connect |
| 4. Retire redundant lifecycle machinery | Migrate or retire pair consumers family by family; simplify failure reporting | Interrupted execution/restart and historical health/trace/retention checks; remaining App admission still recovers independently |

Retiring `chat.start.requested` and old CLI execution modes is a separate
behavior cut: Hosted App work uses Tasks and ad-hoc execution uses standalone.
Migrate current non-interface callers before deletion; a transport cleanup must
not silently remove a supported execution mode. Coordinate with the invocation
proposal through its owning [workflow contract](../2a-design/workflows.md).

Use focused event, persistence, transaction, admission, worker and control
suites for the changed boundary, plus real adapter integration tests. Before a
Host PR is ready, run the repository's full Quality/Container gates on the final
revision. Add regressions for broken contracts, not parallel tests of every
wrapper. Compare publication latency and interface responsiveness during worker
bursts and a slow subscriber; count deleted production code and compatibility
code together. Run `bun run check:may-design` for documentation changes.

The next implementation slice is **step 1**, preserving the current wire and
receipt contracts. Its result should be an easier-to-follow publish path and
fewer dispatch mechanisms. HTTP migration, pair retirement and optional history
replay remain separately reviewable changes.
