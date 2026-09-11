# Recovery against the continuing-Task design

**Status:** Source investigation, September 11, 2026. The common-lifecycle PoC
remains incomplete and unmerged. This review applies the
[accepted proposal](conversation-input-unification.md#recovery-keeps-the-same-task)
to PRs #153, #154 and #155; it does not merge or deploy them.

The worker decides **how to do the assigned work**. The assigning App, parent
agent or human decides **whether to keep assigning it**, revise its scope or
close it. The controller retains that assignment and evidence, releases each
attempt, and schedules the next eligible reconciliation with backoff. Neither
a worker's honest failure report nor a core retry counter may abandon the work.

This corrects the earlier review's suggestion that accepting a give-up judgment
could leave unfinished work quiet until an explicit owner unblock. That would
preserve the Task record while still letting the worker end the effort.

## PR assessment

| PR and reviewed revision | What it fixes | Fit with the revised baseline |
| --- | --- | --- |
| [#153](https://github.com/hao1939/may-agent/pull/153), `edd368ac` | Preserves a validated non-success result despite outer `finish(status: "failure")`. | Keep this execution-boundary distinction. Accept the failure as an attempt report, notify the owner, retain unfinished work and reconcile again after backoff. It neither closes the Task nor satisfies the assignment. The PR alone does not implement this continuation. |
| [#154](https://github.com/hao1939/may-agent/pull/154), `5943a292` | Replaces a 16-action ceiling with 256 actions and a 64 KiB UTF-8 budget, checked before graph reads. | A fix for the old action-batch admission failure, not the target recovery mechanism. Remove the need for routine unblock batches by keeping failed work eligible with backoff. A larger arbitrary count does not establish that behavior. Storage payload limits are a separate admission concern; backoff does not bound one oversized transaction. |
| [#155](https://github.com/hao1939/may-agent/pull/155), `f691ff08` | Replaces harmful "finish now" guidance after an empty/interrupted response with permission to continue the original bounded work. | Directionally correct. Core supplies execution facts and continuation mechanics; App instructions supply diagnosis and approach. The assigning owner retains value/cost, scope and closure decisions. Avoid growing a Host recovery-prompt framework. |

These are fixes on the old lifecycle. Keep their verified local benefits
separate from claims about the continuing-Task proposal. None alone provides
owner-controlled abandonment, persisted pacing and continued work after an
accepted failure report.

For #154's shared-prerequisite example, each Task can retain its assignment,
report failure and release execution. Failure backoff schedules a later check;
a declared repair event also reaches the same reconciliation path. The next
attempt reads the current prerequisite and existing effects before acting.
An agent need not enumerate Tasks or prepare a batch of `unblock-task` actions.
There is no fixed attempt count after which the controller silently retires
that work. Explicit owner controls remain separate.

Keep attempts bounded and concurrent execution controlled. Backoff lowers
retry frequency; it cannot cap lifetime cost if a failure lasts forever. The
accepted tradeoff is paced ongoing effort with visible failure evidence and
owner intervention. It does not authorize new scope, missing permissions or
blindly repeating uncertain effects. Already satisfied work can rest while
awaiting owner closure; unfinished failure must retain a continuation path.

For #155, keep worker guidance in the App's existing task/role instructions:
"Use the current assignment and retained evidence to make the next useful
step. Report failure honestly, but do not abandon the assignment or decide its
lifetime." The owner may judge that more work is not worth its cost. This is
an authority distinction, not a requirement for another model or service.

## Recovery evidence and remaining gap

Source [checkpoint `c1c9f72b`](https://github.com/hao1939/may-agent/commit/c1c9f72b)
adds two tests using real Task storage and the controller:

- **24 independent Tasks** each encounter one supplied retry-safe execution
  failure, then complete on their second attempt. No model generates an action
  batch or unblock command. They remain open with their results after SQLite
  reopen. This proves mechanics for the fixture, not retry safety for every
  failure in #154's reported incident.
- **Exhausted execution retries** leave the Task open and failure evidence
  intact across reopen. The intended ordinary-wake assertion had an incorrect
  call signature in this checkpoint; its uncommitted correction needs a rerun.
  This records the old failure-count gate, which now conflicts with the target.
  It does not prove continued recovery or fresh human input isolation.

The portable [backoff probe](https://github.com/hao1939/may-agent/blob/c1c9f72b/scripts/poc/controller-judgment/backoff.ts)
found a separate defect. With a configured 200 ms retry delay, the final run
waited **202 ms** without another wake, but retried after **1 ms** when a wake
arrived from the failure callback. It exits nonzero to keep that acceptance
gap visible. The existing timer schedules a future retry but does not prevent
earlier queue input. It is a controller/timer probe, not a model or SQLite
restart test; restart-safe cooldown remains to implement and verify.

The next mechanism is a persisted retry-eligibility deadline checked before
claiming and indexed by the existing recovery scan. Its initial uncommitted
source patch passes TypeScript checking but has not passed behavioral checks;
it still retains the four-failure stop and handles execution errors only.
Neither that patch nor this checkpoint implements the revised baseline.

The next acceptance checks must cover an accepted failure report followed by
useful continuation on the same assignment, more than four failed attempts
followed by recovery without unblock, duplicate wakes/restart during cooldown,
and owner revision or closure. Include a real model that learns from its prior
failure without deciding whether to keep the assignment. Verify that failure
reports reach the parent without falsely completing its Request, and that
later progress remains discoverable. Never manufacture success or closure to
make the retry machinery settle.

PR #153's earlier live Host-contract trials already showed that a model can
return an honest give-up and have it accepted after the execution fix. The
[follow-through trial](controller-poc-input-continuation.md#can-a-model-use-it)
also passed with fresh models and controller-owned return links. Neither is
a real-model test of #155's interrupted continuation. That test remains:
inject an empty response before useful work, and a provider failure after a
committed effect; then verify useful continuation without duplicate effects
or unsupported blockers using the actual App context.

## Conversation checkpoint

Source [checkpoint `5ac0f6cf`](https://github.com/hao1939/may-agent/commit/5ac0f6cf)
starts actual Conversation storage settlement under one stable Task. It uses
real input rows, context construction, Topics, Requests and reply projection.
The composition entry receives an existing Task claim; it does not claim an
inbox item or create a second scheduler. A real managed Conversation resolver
can now receive that Task binding and its recovery owner.

The exercised direct-turn path commits Task acceptance, Topic, Request updates
and reply together. A failed reply write rolls them all back. Late output after
owner closure is rejected. New unreviewed input cannot publish the old proposed
closure. A second human input uses the same Task after storage reopen while
the earlier answer remains readable.

The input's execution-Task link also excludes the Conversation from old inbox
claims, including later unconverted input. Cutover refuses unhandled legacy
input even with an expired lease. This prevents dual execution; it does not
yet convert a production ingress path. Unconverted input remains visible and
pending rather than being processed by an obsolete executor.

This is deliberately an incomplete source slice: one fresh human input per
attempt, direct answers only. Batched input, child/Condition returns, follow-up,
Task controls and normal runtime wiring are not enabled here. The old inbox
pump and follow-up owner have not been removed. Task capacity lanes, scoped
Stop, failure pacing, active-Turn projection and live Conversation-model
execution still need integration. Do not describe it as a completed cutover.

## Verification and cost

The latest direct Conversation, common-lifecycle and Conversation-agent checks
passed **42 tests**. Host/SDK types, App-boundary checks and lint passed. The
backoff acceptance probe deliberately remains failing as described above.

A broader Conversation/inbox/schema run had **86 passes and 3 failures**.
Running the affected old Request suite on unmodified `a66f0073` reproduced
the same three failures: two require completed-task receipts, and one expects
an App-stopped Task to disappear from stale follow-up discovery. These remain
migration work; they were not waived or hidden. The previous broader Task
[audit](controller-poc-input-continuation.md#evidence) is also not green.
No full-CI, production cutover or overall simplification claim is made.

The Conversation slice adds an execution link on retained inputs, a state
operation composing existing transactions, and a composition entry. There is
no new table, scheduler, model role or inbox execution lease. It adds code
without yet deleting the old runtime path, so net simplification is unproven.
The source is committed on `poc/task-outcomes-and-closure`; Host main and the
installation remain unchanged. Human review is still required for Host PRs.
