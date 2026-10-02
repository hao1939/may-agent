# Controller PoC: evidence and next gate

**Supports:** [Task Resource Engine](../2a-design/task-resource-engine.md). Retains the first bounded evidence for the common lifecycle migration.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Active source experiment, September 11, 2026. The
[one-lifecycle baseline](conversation-input-unification.md) is accepted; its
implementation and simplification are not yet proved. No production state or
deployment changed. This work runs in the current development session, without
Herdr goals or delegated development workers. Models below are test subjects.

This page records the first slice. The
[common-outcome source experiment](controller-poc-outcomes-and-closure.md) now
exercises retained Tasks, explicit closure, unchanged waits and exact executor
context. Its broader migration is not yet passing; #150 remains independent.

## What has been exercised

Host base: `3037c4b9` (including #149). Candidate branch:
`poc/unified-task-lifecycle` in [draft Host PR #150](https://github.com/hao1939/may-agent/pull/150).
Evidence retention is `c757b950`, the opt-in agent experiment is `5da7b4af`, and
durable parent result references are `072901fc`. Human review remains required.

The first source slice retains an accepted result in its exact attempt's
existing SQLite JSON record. It captures the admitted disposition, structured
result, response, evidence and any incorporated live input IDs. It adds no
table, model prompt or agent-managed reference. Rejected, stale and cancelled
outputs do not become accepted results. Current parent downgrades to waiting
are retained as waiting, not misreported as completed work.

Ten focused tests use the production reconciler and temporary SQLite. They
cover later cycles beyond the 16-attempt context window, reopen, atomic rollback
on an injected storage failure, correction, duplicate/stale output, waiting,
live input correlation, finite receipts, cancellation and the parent wait rule.
The added regression reproduced two distinct results with identical summaries
collapsing into one parent wake. The existing durable event now carries the
producing attempt reference, so code can read both exact outcomes after reopen.
The focused reconciler/runtime suite passed 320 tests. Full Host CI also runs for
the review candidate; its PR owns the exact revision/check status.

The new evidence currently has an experimental reader only. It is a prerequisite
for exact result return, not a shipped caller-readiness fix. The existing 16 KiB
result admission limit bounds individual runtime results; retaining one per
attempt increases history size. No automatic attempt-history pruning was found
in the reviewed paths. Define retention around outstanding result references
before allowing cleanup to remove them; do not promise indefinite free storage.

## Real agent judgment trials

The [opt-in experiment](https://github.com/hao1939/may-agent/blob/072901fc/scripts/poc/controller-judgment/README.md)
uses the actual direct-agent executor, production Task controller and temporary
SQLite. It supplies synthetic asks/evidence to a fresh fixture agent. Code owns
identity, claims, result persistence and child admission. The fixture agent is
not the installed May agent with its full instructions and tools.

Initial trials exposed an unnecessary obligation in the experiment: the model
had to repeat exact evidence IDs. Two otherwise useful answers added explanatory
text and failed that equality check. The revised boundary retains considered
evidence references in code and asks the model for a decision and explanation.
That change removes bookkeeping instead of adding procedural coaching.

With that boundary, four development and four held-back transfer cases produced
the expected action category. Each used one `finish` call, without model calls
to poll, subscribe or manage versions. Manual response inspection found correct
threshold comparisons, useful discussion, explicit uncertainty and cost-aware
stopping. Action-category checks alone do not score answer quality.

| Case | Agent judgment | Source evidence / limitation |
| --- | --- | --- |
| Returned passing measurement | Answer that the batch passes | Exact child evidence survives reopen; parent is still forced to waiting |
| Missing measurement | Delegate verification with acceptance | Code admits a child; this harness does not execute it |
| Discussion while other work continues | Discuss benefits and costs | Tests judgment, not concurrent Conversation availability |
| Expensive disposable recovery | Give up within existing authority | Judgment only; common non-success settlement is pending |
| Returned failing measurement | Explain why it fails | Same parent-liveness obstacle with different facts |
| Cheap safe redo | Choose a bounded fresh check | Confirms the value choice, but a known safe retry should ordinarily run in code without this model call |
| Missing human preference | Ask the human | Judgment only; no interface delivery or durable human-wait proof |
| Changed ask asks for discussion | Discuss, without starting work | Tests interpretation; no Request-revision cutover proof |

Observed model: `gpt-5.6-sol` on all eight successful runs. Total recorded model
run duration was 72.872 seconds, with 12,844 provider-reported tokens including
cache accounting. These are small single-run observations, not latency/cost
guarantees or a verified bill. Raw transcripts, usage and SQLite remain outside
the checkout. The runner documents how to reproduce the cases.

No per-case prompt correction was used after freezing the revised boundary for
transfer. There is no current-contract model comparison yet. The agent executor
keeps its normal bounded finish/provider handling; the controller experiment
does not automatically retry failed model judgments.

After adding the durable return reference, both returned-result cases were run
again with unchanged judgment context. Code resolved the saved event reference
after SQLite reopen; both agents answered correctly in one `finish` call.
Both parents remained waiting under the current liveness rule. These two extra
runs verify the new evidence path, not the missing lifecycle transition.

## What this changes in the proposal

Agent usability is now an explicit acceptance gate. A controller that works
only when an agent remembers a coordination procedure has missed the goal.
Tool use for domain work is still useful; the boundary removes runtime
bookkeeping, not the agent's ability to inspect, write or test useful work.

The source obstacle is concrete: `completeAppTask` treats every retained child
as live, so a maintained parent with adequate returned evidence is still waiting.
Both measurement trials hit it. Finite completion also requires no live children
and deletes the live resource. Changing prompts or asking agents to close
children merely to unlock their parents would preserve the wrong contract.

The current wait prompt also tells agents to preserve waits by `requestId` and
distinguish the original target from a later resolved Task ID. This is a concrete
comparison point for the next slice: retained waits should survive by default;
the agent judges an intentional change, while code resolves its correlation.
Prove that behavior before removing the current instructions.

**Gate taken into the second experiment:** separate accepted assignment outcome from resource closure and
make one real caller consume that exact outcome while the child stays open.
Then execute Conversation -> A -> B with human input during the wait, using
one authority for execution and settlement. Required result checks must follow
the exact assignment; unrelated open children must not block an answer.

Follow with scoped Stop/background pause, bounded non-success handling,
restart/missed-notification discovery, quiet timers, and single-owner migration.
Run real agents on the resulting return loop and compare the current contract
on the same work. Do not claim this first-step harness proves those gates.

The evidence slice adds state and tests; **no old lifecycle path has been
removed yet**. Its value must be demonstrated by that consumer and by deleting
the separate execution, follow-through and mode-dependent paths. Keep this a
PoC pending that proof and human review, rather than shipping unused machinery
as an accomplished simplification.
