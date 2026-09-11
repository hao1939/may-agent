# Recovery against the continuing-Task design

**Status:** Source investigation, September 11, 2026. The common-lifecycle PoC
remains incomplete and unmerged. This review applies the
[accepted proposal](conversation-input-unification.md#recovery-keeps-the-same-task)
to PRs #153, #154 and #155; it does not merge or deploy them.

The default should be: retain the Task and its input, retry eligible mechanical
failures with backoff, and bring evidence back to the App for decisions. Only
the authorized App/parent/human closes the Task. Staying open does not require
a live worker, repeated model judgment about waiting, or an unlimited spending
commitment. Execution budgets and retry rate are separate from lifetime.

## PR assessment

| PR and reviewed revision | Fit with the proposal | Recommendation |
| --- | --- | --- |
| [#153](https://github.com/hao1939/may-agent/pull/153), `edd368ac` | Correctly separates completed execution from a non-success App judgment. A validated `stopped` result must not be discarded because its outer finish status says `failure`. | Keep the fix. Under the new lifecycle, accept and return the judgment while leaving the Task open. Do not retry the same give-up as a provider error. |
| [#154](https://github.com/hao1939/may-agent/pull/154), `5943a292` | Replaces a 16-action ceiling with 256 actions and a 64 KiB UTF-8 budget, checked before graph reads. This fixes a real atomic admission failure; it does not change Task recovery or closure. | Reasonable small fix for useful semantic action batches. Routine transient recovery should use controller eligibility, not require an agent to produce an unblock list. A larger list is not the recovery architecture. |
| [#155](https://github.com/hao1939/may-agent/pull/155), `f691ff08` | Removes an instruction to immediately finish after an empty/interrupted response. That instruction could produce a blocker before work began. The replacement permits original work within retained scope and budget. | Reasonable containment fix. Keep generic continuation guidance small; put domain repair and value/cost judgment in App instructions. Prefer the common Task retry path over expanding model-driven rescue paths in Host. |

These PRs are local fixes on the old lifecycle. None alone establishes the
continuing-Task contract. In particular, #153 preserves a judgment at the
execution boundary; the lifecycle experiment separately changes acceptance
and closure. Do not infer that a saved `stopped` judgment must close its Task,
or that keeping the Task open means repeating a concluded decision forever.

For #154's shared-prerequisite example, distinguish a known safe retry from
a decision about whether the prerequisite is actually repaired. Code can
react to a declared fact or recheck a deterministic prerequisite. An uncertain
repair decision belongs to the App. Once that decision is established, code
should carry eligible work forward. Keep ordinary atomic action validation;
do not add a batch-splitting subsystem merely to support routine retries.

For #155, a Host message explaining that execution was interrupted is not an
App repair plan. Universal scope and effect-preservation rules may stay with
the executor. Questions such as whether to retry an approach, change scope,
seek permission or give up belong to the App's existing instructions. An
extra configurable `recoveryPrompt` hook has not yet earned its cost.

## Recovery evidence and remaining gap

Source [checkpoint `c1c9f72b`](https://github.com/hao1939/may-agent/commit/c1c9f72b)
adds two tests using real Task storage and the controller:

- **24 independent Tasks** each encounter one supplied retry-safe execution
  failure, then complete on their second attempt. No model generates an action
  batch or unblock command. They remain open with their results after SQLite
  reopen. This proves mechanics for the fixture, not retry safety for every
  failure in #154's reported incident.
- **Exhausted execution retries** leave the Task open and failure evidence
  intact across reopen. An ordinary timer wake does not reset the budget.
  This records current behavior; it does not establish four failures as the
  desired retry policy or prove that fresh human input is correctly isolated.

The portable [backoff probe](https://github.com/hao1939/may-agent/blob/c1c9f72b/scripts/poc/controller-judgment/backoff.ts)
found a separate defect. With a configured 200 ms retry delay, the final run
waited **202 ms** without another wake, but retried after **1 ms** when a wake
arrived from the failure callback. It exits nonzero to keep that acceptance
gap visible. The existing timer schedules a future retry but does not prevent
earlier queue input. It is a controller/timer probe, not a model or SQLite
restart test; restart-safe cooldown remains to implement and verify.

The best next mechanism is a persisted retry-eligibility deadline checked
before claiming the Task and indexed by the existing recovery scan. It needs
no domain recovery controller. Verify duplicate wakes, restart, scoped Stop,
authorized budget exhaustion and explicit closure against it. A persistent
known-safe failure may justify longer backoff; an unchanged semantic failure
needs new evidence or judgment. Never manufacture success or closure to make
the retry machinery settle.

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
