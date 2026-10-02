# Explicit Task result scope

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Preserves exact requirements when a result addresses only part of an input batch.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Merged in [Host PR #269](https://github.com/hao1939/may-agent/pull/269)
on 2026-09-30 as `de59c8dae911c8a4e39c925d619164128610301a`; deployment remains separate.
The simpler process was tested at `ef017d1700f1daba7d31b87960df93a4f6104399`. The earlier additive
baseline is `f47bcd7e5314ed4738fb3bf09f8195bbd565b7fc`.
The owning contracts are the [Task engine](../../2a-design/task-resource-engine.md)
and [Task reader](../../2a-design/task-resource-read-interface.md).

## Problem

After a correction, May answered the newest withdrawal and retired an obsolete
approval, but three related older requests remained waiting for future timers.
Recovery retained their deadlines correctly. The missing capability was resolving
particular earlier requests before the timer woke them again.

The original prototype added exact reads and `consideredInputKeys`, an extra set
added to the assignment. It still inferred additional answer scope from Condition
changes and accepted live feedback, and inferred continuation from prior attempts.
Those inferences mixed scheduling, context selection and fulfillment. A mixed
assignment could not answer just one request without answering its peers.

## Refined process

1. Events update the existing Task. Current records retain requests, useful work,
   waits, deadlines and result links; history explains them.
2. Scheduling decides when to run. The claim saves the bounded assignment.
   Context supplies that assignment and a compact current-state overview; tools
   expose original input bodies when the worker needs them.
3. The worker returns a normal result with its complete `inputKeys` scope.
   Omission is shorthand for the saved assignment plus accepted live requests.
   An explicit list replaces this default; `[]` covers no requests.
4. The Host checks identity and acceptance fences, saves the result and exact
   request/result links atomically, and schedules remaining work.

`converged` answers only that scope. Waiting/incomplete outcomes can report on it
without answering it. Unselected assigned input remains outstanding for another
pass. Independent Conditions and deadlines survive. One result still has one
common disposition; differently answered groups need separate results/attempts.

The default is deliberate: ordinary workers can answer their assignment without
copying identifiers. It is a fixed assignment shorthand, not semantic inference.
The accepted result saves its actual keys for review. A worker handling only part
of its assignment must choose the exact list. Model judgment remains necessary.

## Current state instead of historical inference

`inputWaits[key].pending` means useful work remains on that request. It can
coexist with a Condition and future review deadline. Waiting with `continue`
and incomplete results save this flag. An accepted deferral clears the flag only
for its selected scope while retaining the declared wait. Answering removes only
that exact unanswered obligation. Stop removes the stopped input through its
existing control. A retry reads this current state; it does not infer liveness
from a missing historical result or the previous attempt's disposition.

This is one field on the existing record, not another queue or lifecycle. Its
cost is explicit durable state; its benefit is deleting the previous-attempt
reconstruction and making continuing work visible to both readers and scheduling.

## Responsibility and implementation boundary

The worker owns understanding: what the request means, which requests its result
covers, whether the outcome is complete, and what further work or evidence is
needed. `inputKeys` expresses that judgment using Host-provided identities.
The Host owns bookkeeping: assigning identities, saving the assignment, checking
references and acceptance fences, linking results, preserving omitted requests
and independent waits, and scheduling continuation through failure and restart.
Workers do not maintain `inputWaits`, copy retained deadlines into each result,
or reconstruct the outstanding-work ledger. Structural acceptance records the
worker's judgment; it does not certify that the judgment is correct.

- The existing eligibility selector remains for choosing useful startup context
  and exposing relevant live facts. After a result it schedules any still-open
  ready request for another pass. Timers and Conditions never expand the saved
  answer. Waiting and converged results use this same readiness rule.
- The canonical result resolver chooses one complete scope. Exact admissions
  validate same-Task identity, generation and outstanding status. Existing SQL
  transactions and stale/new-input fences remain authoritative.
- The original-input reader is shared by tools, SDK, socket and HTTP. Reading
  bodies or marking live information observed does not itself fulfill requests.
- Agents, workflows and executors use the same result schema. App policy judges
  whether a correction withdraws work; the Host records that decision.

The original `consideredInputKeys` contract was not released. Replace it in this
prototype rather than accepting both spellings. No storage migration, new event
registry, recovery service or App-specific exception is proposed.

## Trials and acceptance

Compare the published PR baseline with this candidate, not merely with the older
live version. Keep these questions separate: exact mechanical settlement,
continuation durability, and whether a model actually chooses the right scope.

Required mechanical trials cover correction before timers; timer or Condition
changes during execution; explicit subset and empty scope; unrelated timed work
and approval; continuation, failure and SQLite reopen; stale results, Stop and
invalid references; and registered-executor normalization through settlement.

The first candidate removed settlement inference and historical continuation.
The initial regression trial then exposed why useful work needs current identity:
continuing an older request with an independent wait still requires a next-pass
assignment. Saving `pending` on that existing input restored continuation without
reconstructing the previous attempt. A live-Condition test previously relied on
implicit settlement; it now explicitly identifies the original request reviewed.

Model trials run May's installed identity and configured model through the real
Task reader, managed-agent execution, finish contract and settlement, using a
synthetic App and temporary SQLite database. They do not modify live Tasks or
prove production rollout. Inputs use opaque keys so original reads matter.
Evidence is retained at `/app/.state/review-pilots/task-result-scope-20260930`.

A second review found a missing connection: after a Condition was retired, its
unanswered input could remain behind an unrelated future timer. The new regression
failed with an empty recovery candidate list. Both converged and waiting settlement
now reuse the current eligibility check to schedule the next pass, without adding
the request to the current answer. Both regression variants pass. This corrects the
prototype's scheduling connection rather than reinstating inferred completion.

| Isolated May trial | Published additive PR | Complete-scope candidate |
| --- | --- | --- |
| Earlier Alpha refresh requests, then withdrawal | Not repeated in this comparison | Related requests answered; Beta and Gamma approval retained (two trials) |
| Withdrawal and independent Delta request assigned together | May said Delta remained open, but Host marked it answered | Related requests answered; Delta remained open (repeated trials) |

The original bodies were retrieved through the production Task tool in these
trials. Baseline and candidate used the installed May role and its configured
`gpt-5.6-sol` model. Candidate evidence came from successive isolated iterations;
the `candidate-correction-race` receipts name the final source. This is a small
behavioral sample, not an estimate of model reliability.

A final race regression also failed: rejection for newer input replaced a retained
input record, dropping its deadline and useful-work flag. That path now reuses the
same retain operation with an empty answer scope, preserving existing attributes.
The changed-Condition test now exercises immediate reconsideration and an explicit
accepted re-wait; an unrelated external event is no longer needed to notice the
changed requirement.

The real-model correction-race trial on the final source injected a clarification
during the first Task read. Its first result was not accepted. On the second pass,
May answered only the clarification while saying the whole chain was closed. The
Host retained and scheduled the omitted input. Reopening the same temporary Task
and following the returned continuation produced a third ordinary pass that read
the originals and answered the full related chain. No extra human input, repair
message or direct Task-state change was used. This demonstrates recovery in the
isolated harness, not fully autonomous production scheduling or perfect judgment.
The extra pass and premature wording remain behavioral improvement opportunities;
the prototype does not certify semantic claims from the worker's prose.

Final source `ef017d1700f1daba7d31b87960df93a4f6104399` passed `bun run ci`:
**3,305 passed, 0 failed, three installation-only checks skipped**, with 16,405
assertions. GitHub **Quality** and **Container** both passed on this revision.
Common design integrity, examples and App-boundary checks passed. Nothing was
merged to Host main, deployed or written to live Tasks during these trials.

Reproduce the mechanical contract from the candidate source:

```sh
bun install --frozen-lockfile
bun test src/app/core/tasks/app-task-common-lifecycle.test.ts \
  src/app/core/tasks/task-continuation.test.ts \
  src/app/core/state/conversation-task-turns.test.ts \
  packages/sdk/src/task-contract.test.ts
bun run ci
```

The isolated model harness and per-trial source revisions, input/output traces,
read calls and outcomes are retained beside `comparison.json` in the evidence
directory above. The race continuation reopens its recorded temporary database;
it does not seed another Task or send a repair instruction.

## Value, cost and rollout limits

The simpler rule handles old and new requests uniformly and supports a selected
subset of one assignment. The accepted answer has inspectable scope; the clock
cannot silently change it. Current continuation can coexist with waits.

The cost is a complete-scope option, one useful-work flag, and updating consumers
that relied on automatic settlement after live Condition changes. Ordinary replies
keep their fixed-assignment default. The change does not remove all branching:
scheduling, ownership and concurrency still require explicit checks. The deleted
complexity is inference about which requests an answer covers and whether past
attempts imply current work.

Default obligation discovery remains capped at 100 with explicit truncation;
original-body reads take up to eight exact keys. No new inventory pagination is
included. The Host validates references, not semantic understanding. Large-task
coverage and real App adoption remain separate from these bounded trials.
