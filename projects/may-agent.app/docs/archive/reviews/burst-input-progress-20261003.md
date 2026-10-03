# Burst-input progress experiment — October 3, 2026

**Supports:** [Make progress while input keeps arriving](../../proposals/progress-under-burst-input.md). Tests whether inbox growth prevents accepted work and what a narrower admission rule risks.

**Status:** Completed isolated contract experiment, rechecked on current Host
source during the context-fix merge. No burst-admission production change or
model trial.

## Question and revisions

Does continuous new input prevent otherwise valid Conversation work from being
accepted? Can the current input-scope bookkeeping make progress if completion's
blanket pending-input check is removed? Which safety distinction would that lose?

Host baseline: `438ad1e38` (merged #297). Local experiment branch:
`poc/burst-progress-20261003`. Harness commit:
`095f60616dd2e0b5cbbf6ad148481fd8a8ab11cc`; experimental change:
`e9a9dfcc00629316304455230845689a5864fcdf`.
These commits are retained locally, not published PRs.

The candidate removes only `completeAppTask`'s broad unseen-input rejection.
Request revision checks, active-attempt checks and transactional Conversation
effects remain. Other immediate-action and dependency-admission gates remain
unchanged. This is deliberately incomplete and is not ready to merge.

## Results

The harness invokes production admission, Task claiming, Conversation settlement
and SQLite restart behavior. It uses temporary stores and scripted decisions;
no running May process, external service or model is needed.

| Case | Baseline | Experimental rule |
| --- | --- | --- |
| One human update before each of 8 finishes | Accepted counts: 0,0,0,0,0,0,0,0 | 1,2,3,4,5,6,7,8 |
| Same with system updates | Same zero-progress result | Same incremental progress |
| 70 inputs present initially | Considered sets: 32,64,70; accepted counts: 0,0,70 | Considered sets: 32,32,6; accepted counts: 32,64,70 |
| Unrelated update before a facts handoff | Handoff not admitted | Handoff admitted; later input retained |
| Affected Request revision actually changes | Old handoff rejected atomically | Still rejected atomically |
| Explicit Turn Stop | Old attempt cannot complete | Still cannot complete |
| Unread human “wait, change the comparison” | Old handoff withheld | Old handoff admitted; correction remains pending |

The last case is a counterexample to simply deleting the check. Preservation of
the correction is insufficient if the product promises it should prevent the
old action. An explicit interpretation/control boundary is necessary.

Both versions passed their seven characterization tests, 32 assertions each.
On the experimental version, seven additional existing tests passed with 53
assertions: reply persistence rollback for both Topic cases, atomic human
cancellation and reply, changed target generation/resource version, foreign
input preflight and changed Request after successful preflight. The full Host
CI suite was not run; existing tests intentionally asserting blanket rejection
would need contract review, not automatic expectation changes.

## Interpretation and limits

The source already has the bookkeeping to settle a considered subset while
leaving newer input queued. The broad barrier prevents that behavior. Its
historical protection against unread corrections is also real. This is a
contract tradeoff, not only a missing index, retry delay or batching timer.

For the finite burst, the baseline presents 166 input appearances across three
passes versus 70 in the experiment. That measures repeated supplied context,
not model reasoning, token cost or semantic fulfillment. Continuous input
experiments preserve every later input, including across store reopen, and
drain when arrivals stop. They do not establish every action's liveness, a safe
arbitrary-input classifier, fairness under overload or provider compatibility.

## Follow-up: locate the rule across execution paths

The same seven baseline characterizations passed on Host `ae781f932` (through
#301), with 32 assertions, in the isolated review branch
`review/burst-input-admission-20261003`, harness commit `8db05f740`. Continuous
human and system arrivals still yielded eight attempts with zero accepted
answers; seventy inputs still produced accepted counts `0,0,70`. This is
separate from the unfinished-input context fix: an agent can reach a correct
judgment and still have admission defer it.

The seventy-input case adds no input during execution. The check also treats
overflow left by the bounded claim as unaccepted input, so even a quiet large
backlog requires repeated consideration before the first result is accepted.
This is not solely a wake-frequency or concurrent-arrival problem.

Rebasing the same harness onto the final context-fix PR revision `3a2e8d2d9`
(including #302) produced the same results: seven tests and 32 assertions passed
at review commit `1227b2496`. Thus the context fix does not remove this separate
admission barrier. Two existing focused checks also passed: native steering
does not acknowledge incorporation (10 assertions), and the registered executor
can admit a request after explicitly incorporating live input (4 assertions).
These checks use scripted decisions and a fake native client, not model calls.

Source review identified one admission convention in several places:

| Path | Current behavior |
| --- | --- |
| Ordinary Task completion | `completeAppTask` saves a proposed result without accepting its covered inputs when unacknowledged events remain. Existing work is retained. |
| Immediate Task actions | `applyRunningTaskChanges` checks `assertAppTaskEffectFresh`; pending input can prevent the action. |
| Cross-App requests | `admitTaskAppRequests` uses the same freshness check before admission and again at the write boundary. |
| Final result with actions/requests | Final declarations share `applyTaskChanges` and settlement; result and effects remain atomic. |
| Workspace finalization | The attempt runner retains the workspace as waiting while newer Task facts are pending. |

Registered executors can call the existing `TaskAttempt.onEvent` acceptance
callback after deciding they incorporated an event; consumption still waits for
accepted settlement. Managed-agent hints and native executor steering deliberately
do not call it. Sending a message or reading a refreshed brief does not establish
incorporation. Auto-acknowledging delivery would erase that distinction; this is
not a missing callback to connect blindly.

The smallest design question is therefore the decision boundary: which inputs
does this judgment cover, and when does newer input invalidate its effects?
The Host should record a bounded scope around the agent's decision, preserve
later input for the next decision, and retain explicit cancellation, accepted
requirement revisions and action-specific authorization checks. Do not ask the
agent to maintain delivery cursors. A subsequent candidate must apply the same
rule to immediate and final actions and preserve the unread-correction
counterexample. No broad fence deletion is being merged with the context fix.

## Review after separating acceptance from completion

Source review on Host `287263522` confirmed that the existing result paths
already distinguish accepted progress, input fulfillment and Task continuation.
`deferAppTask` saves an accepted waiting result while retaining input.
`completeAppTask` uses `inputOutcomeAdmissions` for its selected inputs, then
derives pending/waiting/converged state from remaining work. Its earlier
queue-wide check prevents this path from recording scoped completion.

Two additional paths use the same assumption: `updateConversationTaskRequest`
calls `assertAppTaskEffectFresh`, and `reviseAppTask` checks
`hasPendingAppTaskFacts` independently. Thus caller backlog can also block
interpreted requirement changes. The latter path retains separate checks for
creator authority, caller validity, input shape and the target's generation/spec;
these must survive the admission change.

Five existing targeted revision tests passed with 32 assertions: caller/input
validation including the current backlog rejection, changed-generation fencing
with and without a session, status changes during mapping, and explicit Stop.
This characterizes current behavior; it does not validate a replacement.

Workspace cleanup needs coverage too. The runner currently selects waiting
finalization from pending trigger events, while the Git adapter can remove an
integrated clean workspace on accepted finalization. A scoped result may still
leave retained requirements or Conditions. Review cleanup against that remaining
work rather than equating contribution acceptance with completion of the Task.
This is a source-review finding, not a new workspace reproduction.

The [implementation plan](../../proposals/progress-under-burst-input.md#smallest-implementation-change)
keeps existing result and input records. There is no new runtime change, model
trial or deployment in this review. The unread-correction counterexample remains
part of the required contract decision and coverage.

## Implementation candidate and PoC

Candidate Host [#305](https://github.com/hao1939/may-agent/pull/305) at
`6358142bb`, based on merged #304 (`e2486a6c7`), implements
scoped acceptance across completion, waiting results, immediate actions, new
App requests, Conversation Request updates and creator Task revisions. It removes
the shared queue-wide veto and its separate revision-path copy. Existing
current-attempt checks, creator authority, target revisions, input validation,
result/action transactions and idempotent receipts remain in place.

The regression harness was promoted to
`src/app/core/state/conversation-task-progress.test.ts`. It invokes production
admission and SQLite reopen with scripted worker decisions. Additional runtime
tests exercise live apply and actual Git workspace retention.

| Case | Candidate observation |
| --- | --- |
| One new human/system input before every finish | Each of eight attempts accepts its considered work; cumulative counts are 1 through 8, with later input retained across reopen. |
| 70 inputs queued before execution | Three batches of 32, 32 and 6; cumulative accepted counts 32, 64 and 70. |
| Partial patch with verification still needed | Accepted waiting result survives reopen; both earlier and later requirements remain answerable. |
| Ordinary correction arrives before handoff | Earlier scoped handoff is accepted; the next turn updates the same Request without replaying the handoff. Another later input stays queued. |
| Explicit Stop or actual Request revision change | Stale completion/handoff remains rejected. |
| Live apply before/after explicit incorporation | Work is admitted in both cases; input is consumed only if incorporated, and replay returns the saved request receipt. |
| Scoped completion leaves input or a Condition | The clean Git workspace and its ignored local evidence survive for reuse in the next attempt. |
| Invalid result input selection, local and Git workspace | Reject completion before cleanup, retain output/facts/artifact as unaccepted evidence, and leave the actual input unanswered. |

The focused PoC/runtime group passed 13 tests with 74 assertions. A second
13-test group passed with 128 assertions covering concurrent persistence,
self-publication, event storms, requirement updates and omitted-Request recovery.
The earlier four-file core group passed 260 tests. The first full CI run on
`adf1fb315` passed 3,522 tests and failed 13 tests that still depended on the
removed queue-wide rejection. Those cases now assert acceptance of earlier work
or use genuine waits and invalid results to test retained obligations.

Final `bun run ci` passed on a clean checkout of `6358142bb`: 3,537 tests passed,
three existing installation-dependent tests skipped, zero failures, and 18,929
assertions across 323 files. Host/SDK type checks, App-boundary checks and lint
passed; the browser test executed. `bun run check:may-design` passed integrity,
examples and canonical App checks, with two pre-existing layout warnings
(`features` and `reports`). These checks use synthetic decisions, not model calls.

Polishing corrected assumptions exposed by the trial. Workspace cleanup
must consider retained requirements and Conditions, not only queued events.
An event-storm observer must wait for remaining work to drain, not merely for
the first accepted result to appear. Recovery coverage now induces a real
omitted-Request rejection rather than relying on unrelated arrivals to reject
an otherwise valid first answer.

Independent review found that the candidate's workspace-retention query validates
result scope and could throw outside the existing rejected-result handler. That
lost useful returned evidence. Both local and Git regression cases failed on
`adf1fb315` and passed after moving retention planning inside that same handler,
still before cleanup. In-execution proposal preflight from #297 and commit-time
validation remain intact; no new recovery mechanism was added. The focused
workspace/rejection group passed 10 tests with 104 assertions. Review independently
rechecked both evidence-preservation cases and all seven burst/Stop/revision cases.
Continuation/reopen coverage passed seven tests with 84 assertions.

The previously observed unread-correction case is an explicit contract limit:
ordinary text has no instantaneous semantic effect before interpretation. It
remains queued; explicit Stop retains immediate control. This does not promise
completion under contradictory revisions or prove model comprehension, fairness
under overload, token savings or production behavior. May was not deployed or
started for this trial.

## Reproduction

Use an isolated Host checkout with normal dependencies. At candidate `6358142bb`:

```sh
bun test src/app/core/state/conversation-task-progress.test.ts
bun test src/app/core/tasks/app-task-runtime.test.ts --test-name-pattern 'result-scope rejection|partial acceptance preserves'
bun run ci
```

The following commands reproduce the historical experiment at its recorded
revisions. At the original harness commit:

```sh
bun test src/app/core/state/burst-progress.poc.test.ts
```

At the experimental commit:

```sh
POC_SCOPED=1 bun test src/app/core/state/burst-progress.poc.test.ts
bun test src/app/core/state/conversation-task-turns.test.ts -t 'changed target|settlement rechecks|failed reply persistence|human cancellation, reply|idempotent|foreign'
```

`POC_SCOPED` changes only the harness's expected characterization, not production
behavior. Source revision selects the behavior. Keep the counterexample when
building the next candidate; a green experiment is not acceptance of its policy.
