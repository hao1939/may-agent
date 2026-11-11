# Learning from `dsh-superagent-prototype`

**Supports:** [Purpose and value](../1-principles/purpose.md) through the [Host/App boundary](../2a-design/system-boundary.md). Reduce mechanisms that cost more to maintain than the useful work they enable, then trial improvements to initiative and human attention.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first), [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource), and [value and cost tradeoffs](../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).

**Status:** The approved Host simplification is merged in [#449](https://github.com/hao1939/may-agent/pull/449). Its enduring rules are in the current contracts, and exact revisions/checks are in the [implementation record](../archive/implementation/task-owned-host-simplification-20261111.md). The adoption ideas below remain proposals. No source merge or document edit establishes live activation.

## What the comparison teaches

The later [Task authoring cleanup](../archive/reviews/task-api-cleanup-20261112.md)
is also merged in [Host #454](https://github.com/hao1939/may-agent/pull/454), with
companion App callers committed. It removes duplicate authoring forms while
preserving accepted work and stored identities. That source cleanup is complete;
the approval-verifier alignment remains a separate follow-up, and the App trials
below remain proposals.

The useful lesson is focus: one representation of work, one authority for each
fact, and recovery whose complexity is justified by its cost. DeepSeek's
prototype is a coding teammate built on DeepSeek Harness; May is a generic Host
with Apps and its own execution stack. Whole-repository line counts cannot
measure the avoidable complexity or runtime efficiency of those different scopes.

The comparison baseline is DeepSeek
[`8c32a9dc5d72c033816c6a8110b37f40cf94fba4`](https://github.com/deepseek-ai/dsh-superagent-prototype/tree/8c32a9dc5d72c033816c6a8110b37f40cf94fba4),
as inspected in the initial review, and May's merged simplification at
[`7d32fa337890e2ec04e0d7de8a026637952c0b2b`](https://github.com/hao1939/may-agent/commit/7d32fa337890e2ec04e0d7de8a026637952c0b2b).
This is source evidence, not a fresh upstream audit, model-quality comparison,
performance benchmark or live-installation census.

| Question | DeepSeek reference | May's choice |
| --- | --- | --- |
| Who owns work across sessions? | Ticket and bounded Assignment | Keep Task and attempt; sessions are execution evidence |
| What does the front door do? | Repo-oriented router and coding workers | Keep May's interactive discussion and useful direct work |
| When is work finished? | Coding report/PR-oriented completion | Preserve accepted human Requests and creator/App-controlled Task closure |
| How does execution continue after failure? | Inspect saved state and start useful work again | Fresh Task attempt after confirmed cleanup; inspect external effects before repeating writes |
| Where does initiative policy live? | Repo-specific admission policy | Trial in an owning App, using existing input and Task authority |
| How are definitions chosen? | Prototype prompt reload behavior | Keep pinned attempt definitions; optional inspection can expose effective instructions and drift |

## Approved simplification: now the baseline

The user selected four cuts; they are implemented, not an open approval list:

| Removed | Current contract and deliberate cost |
| --- | --- |
| Configurable Host maintenance and cron editing | [Fixed Host upkeep; App schedules/observers](../2a-design/cron.md). Needed old duties must be explicitly migrated or retired. |
| Workflow crash replay and `resume` | [Fresh Task attempts](../2a-design/workflows.md#crash-recovery). Previously performed work may repeat; the method checks receipts/destination state before external writes. |
| Parallel App admission and Conversation execution contracts | [One App input contract](../2a-design/agent-app.md), [common Task communication](../2a-design/conversation-execution.md). Old execution-bearing state requires explicit stopped conversion. |
| Cold Host session resurrection and obsolete lease bookkeeping | [Live steering and retained evidence](../2a-design/sessions.md). Ended standalone sessions cannot resume; Tasks retain durable obligations. Native CLI thread continuity remains separate. |

Normal workflow guards and bounded automatic repair remain. Workload credits,
sponsorship, execution reservations and protected capacity remain. A global
Pause redesign, a new Task stage helper, event-graph replacement and model-step
context refresh were not part of this approval or implementation. The initial
proposal's broader cuts must not be read as accepted design.

The shared recovery rule deliberately accepts repeated work and delay in place
of a second replay engine. It still preserves accepted inputs/results, human
Requests, return links, exact ownership, descendant cleanup and stale-result
fences. Stop ends considered chat input while ordinary inputs in the batch
remain pending with their return links. See the [Conversation contract](../2a-design/conversation-execution.md#ordering-and-stop).

## Remaining adoption candidates

Evaluate one demonstrated need at a time. Each candidate must reuse current
ownership, have a bounded trial and justify its ongoing cost. None requires
another Host resource, queue or work lifecycle.

### App initiative in observe mode

DeepSeek's [`policy.ts`](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/8c32a9dc5d72c033816c6a8110b37f40cf94fba4/src/policy.ts)
separates inferred initiative from explicit work. A narrow App trial could use
`off`, `observe` and `auto` policy modes. In `observe`, record the proposed action,
matched rule and intent evidence without admitting an action Task or sending an
unsolicited message. The assessment itself still consumes resources and must be
bounded and measured.

Before automatic admission, determine whether implementation was requested,
the target is sufficiently settled, and an unresolved design choice remains.
An observation or complaint alone grants no implementation authority. Explicit
human input follows ordinary admission and its actual authority; it does not
need to pass an inferred-initiative policy gate.

Start inside one App input schema/helper. Add SDK support only after multiple
real consumers demonstrate a shared contract. Choose the pilot stream and judge
false-positive proposals, missed useful work, attention cost and assessment
cost before enabling `auto`.

### Inspectable initiative provenance

If the pilot needs to explain why it started work, retain compact policy
identity, explicit/inferred origin, matched rules and evidence in the owning
App's typed input. Existing creator and input admission remain authority.
A policy hash describes the decision's source; it cannot grant permission or
replace generation/revision fences.

On policy change, give existing work useful ordinary feedback. Do not silently
cancel running effects, reinterpret accepted results or reopen ended Tasks.
The owning agent judges the next permitted action under current policy and the
original human/creator authority. Trial provenance only if it answers an actual
review question that existing admission evidence cannot answer clearly.

### Human attention and instruction inspection

DeepSeek's attention-oriented panel and prompt-drift inspection suggest two
separate usability questions:

- Can the existing overview first show actionable human decisions and failed
  follow-through, with every badge linking to the exact represented list?
- Can an author inspect the effective instructions and meaningful drift without
  changing the pinned definition used by a running attempt?

Use existing Conditions, accepted Requests, Task results and health evidence.
A Condition row alone does not establish that the human was notified. Avoid a
second status ledger, universal failure threshold or mandatory model review of
healthy work. Measure whether a small view change saves attention before adding
new runtime machinery.

### Connector retry safety and thread ownership

DeepSeek's [`outbox.ts`](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/8c32a9dc5d72c033816c6a8110b37f40cf94fba4/src/app/outbox.ts)
and [`effects.ts`](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/8c32a9dc5d72c033816c6a8110b37f40cf94fba4/src/app/effects.ts)
are useful references for the remote-success/local-receipt crash window.
Audit one actual connector: use a provider idempotency key or a verifiable
remote marker where available, and distinguish transient errors from a terminal
unavailable destination. Where remote deduplication is unavailable, state the
remaining duplicate-delivery risk; local receipts do not provide exactly-once
external effects.

When a thread connector is needed, distinguish context observation from an
owned follow-up. Observed text grants no scope-revision authority and cannot
reopen closed work. Route a genuinely different obligation through ordinary
App input rather than inventing a second thread-work lifecycle.

## Next decision

The simplification is complete in source. Activate only through the separate
[stopped upgrade procedure](../2b-manual/app-operations-recovery.md#upgrade-retired-task-contracts).
For the next feature, choose a concrete recurring problem and the smallest
candidate above that can improve it. Trial evidence should compare useful
outcomes, supervision and total cost against the existing path. No additional
adoption is approved by this document.
