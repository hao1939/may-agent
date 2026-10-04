# Storage: a state service backed by SQLite

**Supports:** [Runtime Storage](../2a-design/storage.md). Converges atomic state changes behind the existing owning storage boundary.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** The local state-service boundary is accepted. Input-to-Task
attachment is implemented; Conversation state and handler extraction below is
the next proposed slice. Broader extraction remains conditional on evidence.
**Implementation status:** The request-to-Task slice merged as Host `569e4da0`
in PR #108 using the existing SQLite stores, fenced
transitions and request leases. The broader storage layout, combined
capacity/claim ownership and a separate API server remain unimplemented choices.
Source checks and temporary-state experiments below are not deployment proof.
**Date:** 2026-09-10.
**Source baseline:** The Conversation review used Host `99bc1a31`; the sequential
implementation plan starts from `743aa5de`, including merged #127. Historical
attachment evidence uses `569e4da0` (PR #108), with the original inventory and
candidate at `350552a4` and `54b9eecf`. Settlement/retry slices also merged and
are tracked in the [controller proposal](../archive/reviews/task-controller-pattern.md).

**Vocabulary:** In the historical attachment sections, "request" means an inbox
item and caller correlation. An accepted human ask is a separate **Request**.
[Message Lifecycle](../2a-design/message-lifecycle.md#mental-model) owns the terms;
the next slice removes that ambiguity from active APIs without rewriting history.

The later [one-lifecycle baseline](../archive/reviews/conversation-input-unification.md) moves
Conversation execution into a stable Task claim and settlement path. Keep the
typed state operations established here; compose them under that common fence.
The inbox execution claim described in this implementation record is current
source, not a requirement to retain two execution owners in the target.

## Goal and recommendation

Make shared-state changes easy to use correctly and cheaper to maintain. Give
core storage a small Host-internal interface with meaningful operations such as
claiming an attempt, attaching a request, accepting a result and cancelling work.
Keep SQLite as the authority underneath those operations.

Apps define what we want; controllers move work forward; the state service keeps
recorded truth consistent. This proposal owns the storage boundary, operation
contracts, code organization and extraction evidence. The
[controller proposal](../archive/reviews/task-controller-pattern.md) owns reconciliation, bounded
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
store code. The first slice covers Tasks and inbox inputs; the Conversation
slice extends their shared state boundary where coordination is demonstrated.
It does not absorb every SQL-backed feature.

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

This historical inventory comes from Host `350552a4`; it identifies mechanisms and
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

At the original `350552a4` baseline, the `app-inbox-host.ts` attachment path
created/found the Task, recorded the request wait, linked its Topic and then
checked whether the Task completed before the wait existed. Child-request
delegation had a similar final check.
Those checks handled real ordering concerns; their presence alone was not a bug.
The combined operation below has since merged in #108; see
[implementation evidence](#first-slice-implementation-evidence). This comparison
explains the extraction, not remaining work.

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

The first slice used `core/state/requests.ts` (renamed `inbox.ts` in #129) and
`lib/db/transaction.ts`, a shared synchronous transaction helper;
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
    inbox.ts           # input claims, Task attachment and completion
    conversations.ts   # Conversation, accepted Request and Topic state API
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

## Conversation state and handler extraction

### Why this slice

The [Conversation state contract](../2a-design/storage.md#conversation-state-api)
needs no new persistence system. At `99bc1a31`, the guarantees are already spread
across `app-inbox-host.ts`, `app-inbox-store.ts`, `conversations/store.ts`,
`conversations/requests.ts` and `core/state/requests.ts`. The context tool in
`app-request-agent.ts` also queries `conversation_requests` directly.

The demonstrated maintenance problem is that a reader must follow frontend
handling, SQL and cross-resource commits through the same large orchestration
files. Success means fewer places coordinating those writes and one obvious
read path. Moving files without removing that coordination is not enough.

### Boundary and small API

Keep storage operations in core; keep conversational context selection, prompt
construction and handler invocation in a replaceable Host frontend. May's
Request judgment and supervision policy stay in `projects/may.app`.
[Architecture](../2a-design/architecture.md#conversation-core-and-capability-boundary)
owns the removal contract. Optional conversation links never become required
for generic Task work.

Start with existing helpers and short operations, using names such as
`readConversation`, `listRequests`, `readRequest`, `findTopics` and `readTopic`.
The writes accept a Turn decision, admit linked Task work, complete a Turn, or
record a supervised outcome. Their transaction requirements belong in
[Storage](../2a-design/storage.md#conversation-state-api); these illustrative
names are not a new SDK or HTTP API.

Keep exact resource reads available beyond the initial context window. Move the
context tool's Request SQL behind a typed paged read. Request/Topic selection
and scope interpretation remain with the App/agent, not the query layer.

The selected destination is ordinary modules:

```text
src/app/core/
  state/
    inbox.ts           # admitted inputs, claims, completion, Task attachment
    conversations.ts   # message/Request/Topic reads and consistent writes
    tasks.ts           # existing Task state boundary, extracted when useful
  inbox/               # generic dispatch, capacity and recovery coordination
src/app/conversations/
  turn-handler.ts      # context -> selected executor -> state operations
  turn-agent.ts        # model context/tool integration for that frontend
src/app/composition/   # select handlers and connect committed changes to events
src/lib/db/            # existing canonical schema and transaction primitives
projects/may.app/      # conversational judgment and supervision policy
```

This is an ownership map, not a file-move checklist. The merged extraction names
input-to-Task attachment `core/state/inbox.ts` and keeps accepted asks in
`conversation-requests.ts`. Frontend code calls those state operations instead
of retaining a second SQL writer. Core state must not import the frontend.

### Implementation order and acceptance

**Plan status:** Source implementation merged. #130 and #131 were incorporated
into [#129](https://github.com/hao1939/may-agent/pull/129), which landed on Host
`main` as `0bedd93a` (confirmed September 11, 2026). Deployment is separate.
Scope is the agreed inbox, Conversation and shared-state cleanup.
Completed Stop, ownership and containment fixes remain the baseline. Broader
Task-controller rewrites and the paused metrics/App-merger proposals are outside
this sequence.

Start the series from current Host `main`, including #127, #126 and #128
(`0d8c7658`). Check affected
callers, public names and existing regression coverage before editing. Keep
`/app` on `main`; use an isolated checkout for each change. Keep each PR independently reviewable. Closely coupled read/write moves may
share a PR when that avoids temporary wrappers or a core-to-frontend dependency.
Finish a PR's local checks before preparing its dependent PR; a stacked PR may
be prepared while its predecessor awaits review. Land in dependency order and
recheck the integrated candidate against current `main`. Required review remains
a merge gate, not a reason to stop preparing the authorized work.

```text
1 Names -> 2 Reads -> 3 Turn writes -> 4 Linked work
        -> 5 Frontend boundary -> 6 Turn behavior -> 7 Final review
```

#### Candidate review and landing order

The seven acceptance steps were delivered as three dependent source PRs, with
state owners and their callers moved before frontend extraction. The two dependent
slices were incorporated into #129 and landed together on `main`.

| PR | Plan steps | Review focus |
| --- | --- | --- |
| [#129](https://github.com/hao1939/may-agent/pull/129) | 1, now containing 2–7 | Merged to main as `0bedd93a`: names plus the two slices below; compatibility semantics documented on retained event counters |
| [#130](https://github.com/hao1939/may-agent/pull/130) | 2–4 — shared state | Merged into #129: scoped reads, decision/completion transactions, linked Task admission and returned outcomes |
| [#131](https://github.com/hao1939/may-agent/pull/131) | 5–7 — frontend and verification | Merged into #129: optional handler/context composition, retained dependency path, scripted tool loop and capability absence |

The series is merged; it is no longer a landing dependency. Earlier per-slice
verification below records its tested revisions. The later import cleanup built
on `0bedd93a` also passed the full local Host gate (2,677 pass, three installation
checks skipped), including browser coverage. No deployed-state claim follows.

The merged code map is:

```text
app-inbox-host.ts               admission, claims, Stop, recovery, generic dispatch
core/inbox/input-context.ts    input identity and exact dependency observations
core/inbox/input-handler.ts    selected-handler contract
core/state/inbox.ts            Task attachment and input completion/Request closure
core/state/conversations.ts    Conversation/Topic projections and links
core/state/conversation-requests.ts  accepted asks, revisions and scoped paging
core/state/conversation-turns.ts     decision + Topic + Request acceptance
core/state/conversation-outcomes.ts Task outcome + explanation + Request updates
conversations/context.ts       bounded conversational context selection
conversations/turn-handler.ts  answer/effect handling; child-wait retirement is a later slice
conversations/turn-agent.ts    selected agent, tools and execution contract
composition/conversation-inbox.ts   default capability wiring
```

The existing inbox store retains its schema and claim primitives. Generic
inbox dispatch remains in its existing file; another directory move adds no
needed boundary. State operations own their implementations without compatibility
forwarders. The default composition enriches inputs with conversational context;
a Task-only Host can omit it and still read retained Conversation state.

Verification: the first two slices each pass `bun run ci` with 2,664
passing tests and three existing deployment-only skips. The state slice's
147 focused regressions cover rollback, reopen, competing processes, claim
loss, stale Request revisions and omitted-ask discovery. Its initial hosted Quality
and Container checks pass; ancestry updates are rechecked. The final candidate passes `bun run ci` with 2,667 tests and the same three
intentional skips. Documentation integrity, SDK examples and App-boundary checks
pass against that candidate. It also runs real scripted model/tool
steps through a failed check, repair, verification and finish; injected executor
failure/budget outcomes must leave the accepted ask open. This proves mechanics,
not live model judgment or production operation.

The first naming PR's hosted Quality run exposed a browser-fixture race: HTTP
chat readiness can precede the notification subscription. The fix now travels with the first PR and waits for the actual subscription
before emitting fixture events. The
initial failure and the same failure on manual rerun remain recorded in the PR. Request paging and
exact reads use the existing scoped primary-key index; no query, index, timeout,
finish-threshold or recovery-policy redesign is justified by this extraction.

#### 1. Name inputs, accepted asks and model steps consistently

Change Host/SDK input-context naming from `AppRequest` toward `AppInputContext`,
and internal runner counters from `turnCount` toward `modelStepCount`. Clarify
inbox/turn IDs versus accepted Request IDs in local APIs. Inventory SDK exports,
App consumers, control payloads and retained session fields before changing them.
Keep required old names only at explicit compatibility boundaries; preserve
stored IDs, SQL columns, event schemas and existing App declarations.

**Done when:** Host/SDK and affected App consumers compile; compatibility readers
still interpret retained data; an internal model step cannot be mistaken for a
human Turn. Defer the shared decision/result rename until step 5 separates the
conversational and retained dependency paths. No runtime behavior changes here.

#### 2. Consolidate Conversation, Request and Topic reads

Bring the existing typed reads/projections behind `core/state/conversations.ts`
or its private resource modules. Reuse `conversations/store.ts` and
`conversations/requests.ts`; replace the context tool's inline Request SQL in
`app-request-agent.ts` with the shared paged read. Migrate Host readers and
preserve the existing client response shapes. Move the owning implementation
and its callers together rather than adding permanent forwarding wrappers.

**Done when:** One API supplies bounded Conversation views, paged open Requests,
full exact asks and Topic discovery. Existing store/read tests preserve ordering,
message deduplication and App/Conversation scope. An ask omitted from initial
context remains discoverable and readable in full. No second chat store is added.

#### 3. Centralize Turn decision and completion writes

Extract decision acceptance and completion from `app-inbox-host.ts` into core
state operations. Acceptance saves the decision, Topic changes and accepted or
refined Requests together. Completion saves the input result and any Request
closure with its durable answer evidence. Keep inbox ownership checks and the
same SQLite transaction; model/tool execution stays outside it.

**Done when:** Existing ownership/failure/Request tests prove that expired or
stopped claims cannot commit, stale scope cannot close, and failed/stopped Turns
leave the ask unresolved. A repeated saved decision or lost notification does
not rerun model work or duplicate the answer. Remove the superseded caller-side
transaction code. Keep safe external-effect checks; SQLite does not undo tools.

#### 4. Consolidate linked Task admission and returned outcomes

Reuse the atomic admission in `core/state/requests.ts`, naming its inbox
responsibility clearly when moved. Switch the follow-up and supervision paths
in `app-inbox-runtime.ts` to meaningful state operations. Task admission retains
its exact Topic/Request links; a supervised outcome retains its message and
Request closure under the existing ownership/version fences. Preserve the
current Task settlement and durable wake/recovery responsibilities.

**Done when:** Attachment/runtime tests retain one Task identity on replay,
reject changed/stale admission, and roll back related writes together. A newer
human correction rejects a late closure; completed linked work with an open ask
remains discoverable after restart. Generic Task admission requires no chat links.
No new supervisor, operation journal or independent commit path is introduced.

#### 5. Separate the conversational frontend from generic inbox dispatch

Move context preparation, selected agent invocation and conversational result
application into `conversations/turn-handler.ts` and `turn-agent.ts` as useful.
Generic inbox code keeps admission, ordering, claims, capacity and recovery,
calling the selected handler through narrow functions supplied by composition.
Core state must not import the frontend or May policy. Keep retained App-to-App
dependency handling explicit and outside the normal human-turn path.

Now give the conversational result its `ConversationTurnResult` name; do not
rename the retained caller-wait protocol as conversational. Keep App-owned scope,
acceptance and supervision guidance in `projects/may.app`.

**Done when:** Existing admission, Stop, claim-loss, capacity-close and recovery
regressions still pass. A supported configuration without the frontend can run
unrelated Task work and read retained conversation state. Replacing the handler
does not require editing core state rules. Remove obsolete orchestration/imports;
no empty capability framework or duplicate execution loop remains.

#### 6. Verify useful continuation within one interactive Turn

Trace the current `app-request-agent.ts` entrypoint through shared execution and
the finish guardrails. Use existing executor tests and focused scripted model/tool
responses to exercise inspect -> act -> failed check -> repair -> verify -> answer.
Confirm useful progress is distinct from completion, a discussion can answer
without a Task, and budget exhaustion cannot fulfill an unresolved ask.

**Done when:** The mechanical path supports repeated work within the same Turn,
Stop remains prompt and exact, and a correction after Stop retains the accepted
ask without reviving the old execution. Review May guidance for premature handoff
or unsupported fulfillment; fix the responsible layer only for an observed gap.
Record model judgment as a separate evidence question: scripted results cannot
prove that a live agent reliably persists or judges acceptance. Any model-backed
trial uses an explicitly authorized test setup, not production App state.

#### 7. Review the complete path and remove remaining duplication

Review the integrated flow from input admission through answer or Task handoff,
then the later outcome and Request closure. Use the existing regression results
and add only missing boundary cases. Confirm supported capability absence,
reopen/restart behavior, scoped full-record reads and control responsiveness.
Inspect common query plans; measure representative retained data if an extraction
changes query cost. Optimize only a demonstrated problem.

**Done when:** Active callers use the new boundary, compatibility stays at named
edges, and each stored fact has one writer. Update code maps, SDK examples and
implementation-status notes to the merged revision. Record the removed caller
coordination and any remaining gaps. Close this sequence when the agreed
contracts hold; file count or a fully populated target tree is not the goal.

#### Checks and integration for every slice

Use existing tests near the changed contract: Conversation stores and Requests,
`app-inbox-host`, `app-inbox-ownership`, `app-inbox-failure`,
`app-inbox-containment`, `app-inbox-runtime`, `core/state/requests`, and shared
agent execution/finish tests. Extend production-path tests only where the change
introduces or exposes a missing assertion; use temporary SQLite and fixtures.

Run focused checks while editing and the Host's required `bun run ci` before
review. Validate changed SDK consumers/examples and run `bun run check:may-design`
for companion docs. Commit a coherent slice, report actual checks and remaining
limitations, and integrate through the repository's existing review requirements.
Track progress here and mark a slice complete only after its source is merged.
Source integration does not deploy, restart, or alter an installation's App state.

If a slice adds more coordination than it removes, stop expanding it and revise
the operation boundary. A simple existing helper is acceptable when extraction
does not earn its cost. Immediate steering, timeout/finish-threshold changes,
extra recovery machinery and a network API server require separate evidence;
they are not automatic steps after this plan.

The turn model is consistent with the [Codex turn definition](https://learn.chatgpt.com/docs/app-server)
(user input plus the agent work that follows) and [Claude Code's agent loop](https://code.claude.com/docs/en/how-claude-code-works#the-agentic-loop)
(gather context, act and verify repeatedly). Those comparisons support reusing
the existing loop; they do not require copying either product's APIs or controls.

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

Atomic request attachment merged in PR #108. `core/state/requests.ts` commits
Task input, request wait/claim release and Topic correlation together; execution
wakes happen after commit. Task settlement persists linked request readiness.
The old caller-side write sequence and completion-before-link callback are removed.
No new work lifecycle, timer or public event is introduced.

The [implementation review](../archive/implementation/storage-attachment-review-20260910.md#first-slice-implementation-evidence)
records competing connections, rollback and process-kill tests, plus a bounded
state-only timing comparison. Those tests establish the transition boundary;
they do not justify extracting every SQL operation or claim production latency.

## Retry-exhaustion follow-up

PR #109 made attachment and settlement share the same readiness predicate for
retry-exhausted attention. Linked callers become ready for an owner decision
without authorizing another execution; eligible new input still waits for fresh
work. Its [recorded proof](../archive/implementation/storage-attachment-review-20260910.md#retry-exhaustion-follow-up)
includes separate-process settlement without EventBus and rollback/reopen cases.
Broader owner follow-through remains in the
[controller proposal](../archive/reviews/task-controller-pattern.md#existing-parent-owner-proof).

## Sources and related contracts

- [Current storage contract](../2a-design/storage.md): canonical records, artifacts and bounded reads/writes.
- [Task resource contract](../2a-design/task-resource-engine.md#resource-authority): existing Task authority and versions.
- [Event contract](../2a-design/events.md): publication, admission and observation boundaries.
- [Core principles](../1-principles/core-principles.md) and [system boundary](../2a-design/system-boundary.md).
- [Controller proposal](../archive/reviews/task-controller-pattern.md) and [core organization proposal](task-runtime-organization.md).
- [Task transitions and claims at the reviewed revision](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-reconciler.ts).
- [Request attachment and delegation](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-inbox-host.ts#L1256), [request/Conversation claims](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-inbox-store.ts#L660).
- [Transactional Task store](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-resource-store.ts#L1207), [fenced event persistence](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/lib/db-writer.ts#L638), [Host capacity](https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/host-capacity.ts).
