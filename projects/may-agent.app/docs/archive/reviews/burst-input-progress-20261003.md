# Burst-input progress experiment — October 3, 2026

**Supports:** [Make progress while input keeps arriving](../../proposals/progress-under-burst-input.md). Tests whether inbox growth prevents accepted work and what a narrower admission rule risks.

**Status:** Completed isolated contract experiment; no production change or model trial.

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
