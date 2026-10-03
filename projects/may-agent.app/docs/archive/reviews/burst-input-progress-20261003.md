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

## Reproduction

Use an isolated Host checkout with normal dependencies. At the harness commit:

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
