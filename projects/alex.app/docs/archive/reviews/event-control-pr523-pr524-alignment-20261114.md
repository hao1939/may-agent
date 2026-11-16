# Event/control proposal and PR alignment review — November 14, 2026

**Supports:** [Event and control socket simplification](../../proposals/control-socket-simplification.md)
and [Events and Task admission](../../2a-design/events.md). This review checks
whether the smaller implementation preserves admission and observation, and
which claims the design can now make.

## Scope and conclusion

Reviewed [Host #524](https://github.com/hao1939/may-agent/pull/524), including
its prerequisite [#523](https://github.com/hao1939/may-agent/pull/523). The
latest Host PR overall is #526, which concerns SDK runtime extraction; #524
is the latest PR for this control-plane proposal. Its merged source is
`741825729446fec88b1ff8d2f163b212d691f65e`; #523 merged as
`ec27872f2bb2276d82d9797df651423031c45ea0`. The relevant event, DbWriter,
control and HTTP source has no subsequent differences at Host
`0d48466befd580dde0ff403549dc24d2bb93937b`.

The implementation follows the revised, smaller proposal: keep the bus and
JSON-line socket, remove duplicate entry points, and stop journaling a
replaceable Conversation wake. It does not implement the earlier EventHub or
HTTP/SSE replacement, and those mechanisms are no longer needed to complete
this slice. Two observation/publication boundaries still need attention.

This is source and disposable-fixture evidence. It does not establish the
installed revision or live delivery. The release hold remains in effect.

## What aligns

- `conversation.updated` no longer gets an Event row. DbWriter still defers
  delivery until the enclosing state transaction commits, and discards the
  wake on rollback. The added transaction regression checks both cases.
- Durable Conversation messages remain journaled. A worker relays
  `conversation.message.created` with its saved Event ID; the parent's
  AppInbox route then emits the Conversation wake. Normal replies do not
  depend on relaying an ephemeral worker Event. Reconcile facts also cause
  parent-side wakes for linked Inbox items.
- HTTP Task feedback and project comments now publish `app.input.requested`.
  Publication and exact-receipt confirmation share source canonicalization.
  Task feedback distinguishes a recorded Event from accepted input, and the
  project-comment recovery fixture checks unsupported input and a receipt
  collision after an unknown transport outcome.
- Pair tracking and non-Task callers remain in scope for a separate decision.
  The PRs preserve them rather than assuming Tasks have replaced every use.

Relevant source: [DbWriter wake handling](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/lib/db-writer.ts#L607),
[worker relay](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/composition/workers/task-attempt-process.ts#L505),
[parent message route](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/composition/app-inbox-runtime.ts#L956),
and [accepted-input confirmation](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/http/server.ts#L445).

## Findings and smallest corrections

### P1 — R3 remains open: retaining state does not trigger a missed refresh

The [listener queue](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/core/events/bus.ts#L1187)
discards old notifications when its 256-item backlog fills. Draining logs a
warning and clears the dropped count, without notifying the consumer of a
gap. [Telegram's mixed listener](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/transport/telegram.ts#L641)
queues its Conversation read only for the relevant Conversation wake. Later
unrelated Task notifications cannot necessarily repair a missed reply wake.
Its provider polling loop reads Telegram updates, not current Conversation
state; startup and later human interaction can refresh, but continued idle
operation has no guaranteed repair.

A disposable probe used the actual EventBus, DbWriter and Conversation reader:
save one agent answer, emit its final Conversation wake, and emit 257 unrelated
Task notifications before listener draining. The mixed listener received 256
Task notifications and **zero Conversation refreshes**. The saved answer
remained readable and there were zero `conversation.updated` rows. This proves
the notification boundary failure, not an actual Telegram-provider incident.

**Correction:** keep the bounded queue. Expose a coalesced subscriber gap/dirty
callback outside the dropping payload queue, and have affected consumers queue
their existing resource refresh. Local consumers need this too; any remote
reset/disconnect must cause a reread after subscription is active. Check the
case where the final relevant wake is lost and no later relevant change occurs.
This is a preexisting open issue, not evidence that #523 caused durable loss.
Put the recovery rule and current gap beside passive-listener behavior in
`events.md`; retaining R3 only as historical commentary is insufficient.

### P2 — durable publication can emit an ephemeral wake and then report failure

The [trusted raw operator route](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/interface-startup.ts#L59)
permits unregistered facts. It consequently accepts `conversation.updated`
into [EventInterface publication](https://github.com/hao1939/may-agent/blob/741825729446fec88b1ff8d2f163b212d691f65e/src/app/core/events/interface.ts#L810).
The bus broadcasts the wake, DbWriter supplies no row ID, and the publisher
then throws `Event conversation.updated was not durably persisted`.

A second disposable probe used the production publisher with the operator
context and a real EventInterface subscriber. Publication threw that error,
the subscriber observed one wake, and SQLite contained zero Event rows.
The ordinary public `publish` command rejects this unregistered type earlier;
the demonstrated gap is the retained trusted raw-event route.

**Correction:** make the durable/ephemeral classification shared by DbWriter
and publication validation. Reject known ephemeral wakes before `bus.emit`
on the durable publication path. Keep internal wake emission on the existing
bus; no additional hub or persistence API is needed. Add a regression through
the raw operator adapter proving rejection emits nothing. Record that
ephemeral wakes do not return durable receipts in the owning event contract.

### P2 — compatibility and completion claims exceed the delivered scope

The proposal says "100% compatible", "without changing a single wire frame"
and "Completed & shipped ... incorporating R1–R6". The JSON-line framing is
preserved, but the supported command set and legacy behavior changed:
`app.input.admit`, `app.task.retry`, `task.close` and `task.reopen` were removed;
the special `chat` subscription and message-body `/reload`/`/restart` rewriting
were removed too. These may be useful retirements, but they are not full
behavioral compatibility. Source merge does not prove deployment, and R3
remains open.

**Correction:** describe "merged source; deployment unverified", name the
retired operations and their canonical event replacements, and state that
bundled Host/web clients must adopt the cut together. Existing ordinary text
now stays text rather than acquiring a hidden control meaning. Update the
proposal index's "Shipped" row accordingly. The cleanup table must also retain
the deliberate `task.cancel` friendly-reference helper and
`project.action.invoke` schema translator, as its PR2 description already does.
They translate onto the shared mutation authority rather than duplicating it.

### Evidence correction — use final source counts, not projected savings

GitHub's final PR metadata and the merge diffs give #523 **466 additions / 847
deletions, net −381**, and #524 **292 / 470, net −178**: **−559 lines combined**,
including tests. The proposal's #523 −441 figure is stale. Its "80%+" savings
claim has no measured baseline. The three named event files still total 3,501
lines at this revision; the main source reduction is in the control server,
not a collapse of all event responsibilities.

**Correction:** use the final counts if counts help, and describe the concrete
effect: zero journal rows for a Conversation wake, with commit ordering retained.
Do not infer a system performance improvement from LOC reduction. A future
performance claim needs a representative workload measurement.

## Validation and synchronization

At the merged #524 revision, with workspace SDK/control packages resolving to
that same checkout, **160 targeted tests across 11 files passed**. They cover
DbWriter transactions, EventBus, EventInterface, control protocol/client/server,
HTTP input/retry helpers, Task-feedback integration, and worker relay. The
real local-daemon project-comment recovery suite passed **4 scenarios**. Both
PRs also have successful final-head Quality and Container checks. The two
additional probes above exercise boundaries not asserted by those green suites.
No live Host, provider or model was used.

Synchronize in one small follow-up: fix the two boundaries, add the contrasting
regressions, and update `events.md` plus the proposal's status, compatibility,
helper exceptions and evidence. `http-boundary.md` already names the canonical
project-comment publication and should remain the owner of HTTP behavior.
Move completed rationale into a dated decision record once enduring rules and
open recovery obligations have current homes. Do not expand this into a bus,
wire-protocol or pair-schema rewrite.
