# Storage: a state service backed by SQLite

**Design status:** Request-to-Task slice approved for implementation; broader
extraction remains conditional on its evidence.
**Implementation status:** Host candidate `54b9eecf` (`refactor/request-task-state`)
implements the request-to-Task slice using the existing SQLite stores, fenced
transitions and request leases. The broader storage layout, combined
capacity/claim ownership and a separate API server remain unimplemented choices.
Source checks and temporary-state experiments below are not deployment proof.
**Date:** 2026-09-10.
**Source baseline:** Host `350552a4ba9a4278fe30897430619667bb7bb7f3` (PR #105).
The original inventory is source inspection, not deployment proof. Candidate
concurrency and restart evidence is recorded below. Separate settlement/retry
candidates are tracked in the [controller proposal](task-controller-pattern.md).

## Goal and recommendation

Make shared-state changes easy to use correctly and cheaper to maintain. Give
core storage a small Host-internal interface with meaningful operations such as
claiming an attempt, attaching a request, accepting a result and cancelling work.
Keep SQLite as the authority underneath those operations.

Apps define what we want; controllers move work forward; the state service keeps
recorded truth consistent. This proposal owns the storage boundary, operation
contracts, code organization and extraction evidence. The
[controller proposal](task-controller-pattern.md) owns reconciliation, bounded
execution and recovery behavior. Neither implementation depends on completing a
broad rewrite of the other.

Follow the [value/cost rules](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff):
this is frequently used core, so long-term maintenance, failure and runtime cost
matter. Start with one demonstrated coordination problem and compare the total
cost with retaining today's sequence. Safe affordable redo remains preferable
to precise recovery machinery. Apply the 20/80 rule by making common mechanics
reliable while leaving varied judgment with Apps.

Removal should degrade capability while preserving the remaining system's
correctness. Optional producers, interfaces and reporting may be absent;
canonical storage and its consistency guarantees are required for admitted work.

## State service inside core storage

SQLite is the agreed on-disk authority for spec, status and related work records.
Call this core component **State and storage**. Its Host-internal interface offers
resource reads and meaningful operations; SQLite tables and write coordination
are private implementation details. Reuse the existing admission, transition and
store code. The service starts with Tasks and requests, where coordination is
demonstrated; it does not absorb every SQL-backed feature.

| Owner | Responsibility |
| --- | --- |
| App | Interpret input; choose outcome, acceptance, scope and repair/stop decisions |
| Controller and execution Host | Discover candidates, request a claim, arrange bounded execution, manage live capacity and submit outcomes |
| State service | Validate shape, authority, eligibility and versions; commit related resource changes; preserve retry identity and accepted results |
| SQLite implementation | Execute short transactions, constraints and bounded queries |
| Event system and routes | Admit typed requests/facts, invoke the appropriate operation and expose changes |

The controller may select a candidate from a stale read. The state service must
recheck eligibility and ownership when claiming or committing. App judgment and
provider calls happen outside transactions; the service checks whether the
resulting decision still applies. Apps/executors keep their existing SDK
capabilities and do not receive this Host-private service or database access.

```text
Interface / producer                  Controller / Host worker
        |                                      |
        v                                      | typed operation
Existing event ingress and route               |
        |                                      |
        +------------------+-------------------+
                           v
                 Core state service
                 validate -> commit -> return
                           |
                    SQLite transaction

After commit: route/composition publishes change hints
              -> controller queues and interface observations
```

Events connect components; they do not make a multi-write change atomic. An
external event route and an internal caller invoke the same operation. Keep
one transaction owner for each operation and reuse SQL helpers within it;
wrapping independently committing stores would retain the original gaps or
create nested transactions. No event is needed for each SQL statement.

Change hints can be recovered by rereading canonical state. If publication
creates new work, persist that responsibility through existing admission records
or an exact durable wake; an optional post-commit callback is insufficient.
Do not add a universal outbox merely for replaceable observation notifications.

## Existing uses that justify the boundary

This inventory comes from Host `350552a4`; it identifies current mechanisms and
possible consolidation, not newly reproduced defects. Operation names below
are illustrative Host-internal names, not proposed SDK or event schemas.

| Operation family | Consistency requirement | Existing source/mechanism |
| --- | --- | --- |
| Admit input; create or revise Task | Same request identifies the same work; concurrent changes and replaced specs are checked | `createAppInboxItem`, `observeAppTaskIntent`: idempotency keys, admission records and version fences |
| Claim, renew or release ownership | One current owner; old workers cannot commit after replacement | `claimObservedAppTask`, `renewAppTaskAttemptLease`; request claims use lease owner/generation |
| Claim a Conversation request | Only one active handler per App/Conversation; waiting on work releases that ownership | `claimNextAppInboxItem`, `waitAppInboxClaim` |
| Attach or delegate a request | Request, Task/child requests, dependency and Topic links agree | `app-inbox-host.ts`: separate attachment/wait/link writes and completion-before-wait checks |
| Settle an attempt or request | Accepted result and related state change together | `completeAppTask`, `deferAppTask`, `markAppTaskAttention`; request completion already commits its result and dependent wakes together |
| Record relevant input or resolve Conditions | Preserve input and readiness across concurrent execution and wait registration | `recordAppTaskTrigger`, `trackAppTaskConditionEventForTasks` |
| Cancel or deliberately retry | Apply to the intended version; repeated commands retain the accepted outcome | `task-control-events.ts`, Task control receipts and fenced transitions |
| Publish a fact from an attempt | Reject new emissions from stale attempts; preserve event identity and exact target wake | `app-task-emitter.ts` and `DbWriter.insertEventRow` share a SQLite ownership check/commit |

Task updates belong here as much as claims do. A meaningful `settleAttempt`
operation can commit the result, receipt, admitted Task actions and relevant wait
changes together. The caller should not separately request each row update.
App acceptance checks still determine whether the outcome is enough; the service
enforces the mechanical contract for accepting that judgment.

The source has several useful pieces already. For example, cancel/retry uses a
typed event route, checked mutation and durable receipt. Preserve that working
pattern rather than replacing it with a generic command engine.

## First comparison: attach a request to its work

The current `app-inbox-host.ts` attachment path creates/finds the Task, records
the request wait, links its Topic and then checks whether the Task completed
before the wait existed. Child-request delegation has a similar final check.
Those checks handle real ordering concerns; their presence alone is not a bug.

Compare that caller sequence with one bounded operation:

```text
attachRequestToTask(requestClaim, resolvedAttachment)
  -> verify current request ownership and Task state
  -> create/find Task and preserve admitted input identity
  -> record request dependency and required Topic link
  -> leave request ready if the Task already finished, otherwise waiting
  -> commit together and return the identities/disposition
```

App mapping runs before the operation. Its selected Task and relevant versions
are revalidated inside the commit. Attachment checks completion while registering
the wait in one transaction. Task completion updates the same dependency records
in its own transaction, so either ordering is safe. Neither transaction spans
execution or App/agent judgment. Prototype this boundary only if it removes caller
repair/check paths at acceptable cost; do not build distributed transactions for
cross-provider effects.

### Selected implementation boundary

Implement attachment and durable request readiness together. One local operation
owns the SQLite transaction for Task admission, the exact request dependency,
release of its Conversation handler claim, and any required Topic link. Reuse
the existing fenced Task transition code, joining the outer transaction rather
than independently committing. No App callback, session interruption, queue
notification or provider call runs inside that transaction.

Task commits also make linked requests ready when their work settles or requires
review, including recovery and cancellation. Attachment checks the current
generation and pending input, not merely whether an old receipt exists. This
closes both orderings: settlement before attachment and attachment before
settlement. Events remain prompt notification hints; the ready scan can discover
the durable obligation after a missed notification. Keep bounded dependency
recovery for policy changes and other dependency kinds, not as the primary
repair for this operation's partially committed writes.

Use the accepted request as the initial admission identity. Before commit, a
failed attempt has accepted no Task attachment and its pure App mapping can be
recomputed. After commit, the stored dependency is authoritative. Retrying the
same attachment cannot choose different work or add its input again. A deliberate
App-policy replacement is a distinct operation, fenced to the current request
claim and previous dependency; it is not an automatic retry. Reuse the request
row and Task admission records instead of adding a generic operation journal.

Start with `core/state/requests.ts` and `lib/db/transaction.ts`, a shared synchronous transaction helper;
do not move all stores or introduce a service class. Keep existing claim and
Task-transition rules authoritative. Capacity ownership, process layout, and
child-request delegation are outside this slice. Conversational follow-up
admission without a request claim retains its existing idempotent sequence; it
does not acquire this slice's atomic request-binding guarantee.

The initial key is `task:<requestId>`. A replacement selected by App policy uses
`task:<requestId>:replace:<claimGeneration>`. Storage validates the key, App,
accepted request input, exact target when present, and claim before admitting
work. Rechecks of an unchanged binding do not admit the input again. A repeated
accepted operation returns the binding without reapplying it; this is not a
promise to freeze the Task's later status or replay an identical response body.

## Operation results and safe repetition

Reuse stable request/operation identities, expected versions and attempt tokens
where the operation needs them. A repeated accepted command should return its
recorded outcome; reuse of its identity with different input is an error.
Use existing receipts or resource identity when sufficient. Add durable outcome
storage only for an operation whose lost-reply behavior requires it.

Distinguish `recorded`/pending admission from an applied state change. A service
call returns an applied result or an explicit reason such as stale ownership,
conflict or ineligibility. It must not imply that Task execution is complete.
If a reply is lost, inspect/retry the same operation identity; timeout does not
undo a committed change. Request expiry, if needed, limits when an unapplied
command may be accepted. It is separate from an ownership lease.

## Capacity and attempt claims

Both need an authority: capacity protects an aggregate execution limit; a claim
protects ownership of one Task. Both may sit behind a coordinating API. There is
no architectural rule making only capacity suitable for an event protocol.

Today capacity is an in-memory allocator owned by the parent Host, while Task
claims coordinate durable SQLite state across workers. Keep capacity with live
execution scheduling initially; a state service does not require persisting it.
An exploratory `startAttempt(taskId)` could reserve capacity and claim the Task
behind one operation, returning one attempt handle. This is not yet an agreed
implementation and an SQLite transaction alone cannot make an in-memory
reservation and process launch atomic.

Compare separate and coordinated ownership across no capacity, failed claim,
failed launch, completion, cancellation and Host/worker crash. Release must be
safe to repeat; an expired lease does not stop a worker. Reusing capacity must
account for whether execution has actually stopped. Adopt the combined operation
only if it simplifies those paths without weakening the bound. Foreground work
also uses capacity and must remain accounted for.

## Start local; keep the deployment choice separate

Start with ordinary typed functions and the existing event routes in the current
Host/worker arrangement. A shared module can enforce one contract while several
processes use SQLite transactions; one authority does not require one process.
If a separate API server later removes meaningful duplication or coordinates
multiple Hosts, compare its availability, transport, timeout and retry costs
against that concrete use. The logical API boundary does not commit us to that
deployment or to routing every internal call through events.

Schedules retain their existing time-slot identities and normal input/fact
publication. Queue coalescing, timers, projections and metric collection remain
with their owners. Extend the service when a demonstrated resource guarantee
needs it, not just because some code stores data.

## Code organization

The proposed destination, as operations become coherent, is:

```text
src/app/core/
  state/
    tasks.ts           # typed Task transitions and authoritative reads
    requests.ts        # request claims, attachment and settlement
    sqlite.ts          # private resource SQL and transaction integration
  tasks/
    controller.ts      # dispatch and bounded retry timing
    queue.ts           # coalesced identity hints
  events/              # existing publication and routing contracts
src/app/composition/   # connect state operations, execution and event routes
src/lib/db/            # existing shared connection and canonical schema
```

This is a target layout, not the current implementation or a request to create
empty modules. Keep one canonical schema in `src/lib/db/`; moving it is not a
prerequisite. Split private SQL files by resource only if their size warrants it.
Use ordinary imports and narrow typed dependencies, not a service registry,
generic repository or new public package.

Controllers and routes call state operations. The state implementation does not
import controllers, executors, interfaces or installed App policy. It returns
committed results and affected identities for composition to notify. Durable
event writes that belong in the operation use the same transaction; passive
EventBus callbacks do not run inside that transaction. Extract SQL and transition
rules together so old callers do not keep a second authoritative write path.
The full reconciler should not simply move wholesale into `state/` if it still
mixes execution coordination with state rules.

## Apply in small steps

Evaluate the storage extraction independently of the settlement and retry
candidates tracked in the controller proposal:

1. Trace one operation's callers, writes and failure windows on the exact
   implementation revision used. Compare request attachment with leaving the
   current idempotent sequence in place.
2. Extract that bounded operation behind a typed Host-private function and the
   existing SQLite authority. Switch its callers and remove the superseded
   coordination. Keep schema, event transport and process layout unchanged where
   possible; justify any required change explicitly.
3. Prove its concurrency and restart behavior below, then compare removed caller
   branches, added state and transaction duration. Continue to another operation
   only if the first improves understanding and long-term maintenance cost.

Capacity/claim unification and a separate API server are later comparisons, not
prerequisites for this extraction or automatic follow-ups. Rebase the source
inventory on the chosen implementation revision; those candidates may have
changed settlement/retry code since this review's baseline.

## Evidence required

Use the affected production operation with temporary state. Extend existing
coverage only where needed; the following are acceptance criteria, not results:

| Case | Required evidence |
| --- | --- |
| Two workers claim or update the same resource | File-backed SQLite with separate connections/processes preserves one current owner and detects conflicting versions |
| Commit succeeds but its reply is lost | Repeating the same identity returns the accepted operation outcome without duplicating work; changed input is rejected |
| Task completes before or after request attachment | Request retains the exact dependency and becomes ready appropriately; required Topic correlation survives either ordering |
| Request handler waits on a long Task | Another message in the same Conversation can be handled; concurrent active handlers remain excluded |
| Crash before commit or after commit before a change hint | Related writes are all-or-nothing; recovery discovers committed work without depending on the missed hint |
| Stale attempt submits a result or emits a new fact | State/event admission rejects it; existing accepted retry identities remain readable |
| Optional producer, reporter or interface is absent | Previously admitted work retains correctness; capability degrades without breaking state transitions |

If capacity coordination is prototyped, additionally prove no leaks on failed
claim/launch, safe repeated release, cancellation and crash handling, and no
reuse that oversubscribes still-running work. Do not infer these guarantees from
SQLite transaction tests. Check event-loop responsiveness and bounded transaction
cost on representative data if an operation grows; centralizing writes is not
permission to serialize all App execution behind one queue.

## Review decision

Apply the selected local state-operation boundary, beginning with request-to-Task
attachment and durable request readiness. Keep typed local calls and existing event routes as the first
arrangement. Broaden only after the first extraction removes enough caller
coordination to justify its transaction and maintenance cost.

Report removed branches, added state/dependencies, restart behavior and bounded
transaction cost against the same baseline scenarios. If the change mostly
moves code or adds forwarding layers, keep the current implementation and
reconsider the boundary. A schema addition or weaker guarantee needs an explicit
value/cost decision; neither is assumed by this proposal.

Capacity/claim unification and a separate API server remain later comparisons.
The first slice does not authorize a live deployment, new metrics service or
App merger.

## First-slice implementation evidence

The candidate implements the selected slice, not the entire target layout:

- `core/state/requests.ts` owns Task-input admission and atomic request attachment.
  App mapping and runtime descriptor lookup stay outside it; execution wake-up
  and session interruption happen after commit.
- The Task store joins an outer transaction through SQLite savepoints. A failed
  Topic link rolls back Task admission and the request wait as well. Cached Task
  snapshots are invalidated while an outer transaction is still uncommitted.
- Task settlement, attention and cancellation persist linked request readiness
  through the existing fenced store commit. Pending input prevents old completion
  or attention state from being used as the new request's ready result.
- Event hints schedule already-ready requests too. The cross-App round-trip test
  caught the former assumption that only a newly changed readiness row needed
  scheduling; retaining it would delay the request until the next ready scan.
- The request schema is extracted, unchanged, to `lib/db/app-inbox-schema.ts`
  and shared by Host and standalone Task storage. There are no new schema fields,
  operation receipts, queues, timers, daemons or public events.

The caller no longer separately writes the wait, writes its Topic link, or runs
an asynchronous completion-before-link callback. Storage adds explicit request
claim/input checks and a small shared transaction helper; this is not merely a
forwarding facade. Child-request delegation and policy-driven dependency recovery
retain their existing behavior.

Regression coverage uses production operations with file-backed SQLite, separate
connections and child processes. It covers competing bindings, stale claims,
repetition and changed input, deliberate replacement, both completion orderings,
pending newer work, App-scoped wakes, wake-write rollback, Conversation claim
release, and actual `SIGKILL` before/after commit. No EventBus is present in the
cross-process settlement test.

At Host `54b9eecf`, `bun run ci` passed: 2,514 tests passed, 3 existing
installation-dependent skips, and no failures. The 16 new state-operation cases
are included in that count. The affected installed-App golden-trace fixture also
passed separately. `bun run check:may-design` passed with no errors and six
pre-existing workspace-layout warnings. Hosted checks and live deployment are
separate from these local results.

A local state-only comparison against Host `350552a4` used fresh WAL databases,
300 attachments per version and the final 250 timing samples. It excluded App
mapping, controller execution and notifications on both sides. The old sequence
measured 5.92 ms median / 8.71 ms p95; the candidate measured 4.48 ms / 6.36 ms.
Candidate settlement made 1,001 exact linked requests ready in 7.28 ms without
an event hint; the baseline left them waiting for its notification/recovery path.
These single-machine samples show no observed transaction penalty for this trial,
not a production speed guarantee or a bound for arbitrarily large fan-out.

Broader storage extraction, capacity coordination and a separate API server still
need a demonstrated problem and a fresh value/cost decision. No live installation
was changed by this candidate.

## Sources and related contracts

- [Current storage contract](../2a-design/storage.md): canonical records, artifacts and bounded reads/writes.
- [Task resource contract](../2a-design/task-resource-engine.md#resource-authority): existing Task authority and versions.
- [Event contract](../2a-design/events.md): publication, admission and observation boundaries.
- [Core principles](../1-principles/core-principles.md) and [system boundary](../2a-design/system-boundary.md).
- [Controller proposal](task-controller-pattern.md) and [core organization proposal](task-runtime-organization.md).
- [Task transitions and claims at the reviewed revision](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-reconciler.ts).
- [Request attachment and delegation](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-inbox-host.ts#L1256), [request/Conversation claims](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-inbox-store.ts#L660).
- [Transactional Task store](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-resource-store.ts#L1207), [fenced event persistence](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/lib/db-writer.ts#L638), [Host capacity](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/host-capacity.ts).
