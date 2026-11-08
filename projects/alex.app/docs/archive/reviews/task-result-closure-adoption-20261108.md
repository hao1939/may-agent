# Task result closure: post-merge adoption check

This is dated verification evidence for the [Task lifecycle](../../2a-design/task-resource-engine.md)
and [workload proposal](../../proposals/agent-task-workload-model.md), not a new lifecycle rule.

## Source and installation

- [Host #398](https://github.com/hao1939/may-agent/pull/398) merged as
  `88a98be236baf07bfcf100208cfb0dc1589dfa06` at `2026-11-08T13:07:32Z`.
  The existing validation checkout at `036f4a4f757eea9f8a4492231e5541f365a8fcf6`
  and that merge have the identical Git tree
  `02781aa1cdbc6d052cba4727f2173122a7040c07`.
- The companion App policy, instructions and current workload design were
  reconciled and integrated into Apps main at
  `9ed31e767f71fe5314b3b5b109350b4e01ed667e`. Integration does not activate definitions.
- Fresh hashes of all three long-lived Host processes match the #392 receipt
  and installed provenance: source `4f8d0188ff11c19ada8c56d0a5a4ef373eb7e1eb`,
  artifact `0bb1969fbf12e6ad3138d7d15a49ec33e2d474aaea641a0404dd0223fed1d0eb`.
  The readiness endpoint returned ready. This is fresh process evidence, not
  merely an inference from the old receipt.
- Live App definitions still select source
  `6a7e49843c5d2c8cccd7615b991472856d43f8d4`; the public Alex contract has no
  `taskPolicy.closeOnResult`. No Host deployment, definition activation,
  live Task mutation or model-backed trial was performed in this check.

## Demonstrated behavior

An isolated fixture used the production Host runtime, inbox, event bus and
SQLite store with the actual companion Alex input mapper and closure callback.
The executor returned a scripted result; no external model was invoked.

| Accepted work | Observed outcome |
| --- | --- |
| Finite message with facts and explicit `result.taskDisposition: {kind: "close", reason}` | Its mapped `input/ask` Task closed against the accepted attempt; its exact answer was retained and published. |
| Same finite result after reopening storage/runtime | Closure and answer remained; there was one execution and one closure notification in total. |
| Standing goal, despite an explicit ending in the scripted result | The cycle answered its caller and remained idle, retaining its assignment. |
| Finite result without an explicit ending decision | Its answer was accepted; the Task remained idle. |
| Same finite result without the App hook | Its answer was accepted; the Task remained idle. |
| New input racing completion | New input remained pending; the old result did not close over it. |
| An outstanding exact Condition | The Task retained its wait and Condition. |
| Task-created, foreign or unattributed work | The App hook did not acquire creator authority or close it. |

The ordinary App-request fixture observed the accepted answer, published reply
and closure when the closure notification arrived. Inbox handling status was
still `handling` at that point and became `done` through the existing result
refresh. Do not equate that projection with another Task completion policy.
The owning Conversation regressions separately verify that both Conversation
execution adapters publish closure effects after their reply transaction commits.

Validation:

- 43 focused Host tests passed: result closure, Task/Conversation communication,
  and database connection ownership.
- 22 App mapper/policy tests passed, with 101 assertions.
- 13 isolated checks using the actual companion policy passed, with 53 assertions;
  four exercised the full runtime and inbox. These reuse the existing Host fixture
  setup rather than substitute a Task state machine.
- Strict companion policy/test type checking against the candidate SDK passed.
  This is not a claim that the entire Apps repository typechecks.
- Design integrity passed: zero errors/warnings in the prepared worktree; the
  primary checkout retains five existing root-layout warnings. Unchanged
  executable design examples passed. The Task contract remains within its
  900-line limit.
- Initial fixture runs used the Conversation-only `executionTaskId` for ordinary
  App work, then expected Inbox `done` at the closure notification. Those fixture
  assumptions were corrected to the ordinary dependency ID and existing result
  refresh. They were not product fixes or reasons to add another completion path.

Private reproduction and observations are retained under
`.state/task-result-closure-adoption-20261108/`: `verify.py` generates temporary
tests from the existing Host fixtures, invokes the actual companion definition,
and removes its temporary files; `app-host-validation.log` and
`live-snapshot.jsonl` retain the results. Reproduction requires those two exact
source checkouts and is installation evidence, not a portable Host test entrypoint.

## Hosted CI limitation

The PR's Quality and Container checks passed. On the merge commit,
[Container passed but Quality failed](https://github.com/hao1939/may-agent/actions/runs/42483447666).
The sole failed test was `database connection ownership > lets concurrent Host
openers bootstrap once and keep each other's writes`:
`test/fixtures/database-opener.ts:6` issued a direct `INSERT` that hit
`SQLITE_BUSY` after `getDb()` returned. This is outside the result-closure path.
The same connection suite passed in the focused local run; that does not erase
the hosted failure or establish its cause is fixed. No hosted retry or database
runtime change was made to turn it green.

## Live baseline and remaining adoption

| App | Open | Idle | Waiting | Attention | Running / queued |
| --- | ---: | ---: | ---: | ---: | ---: |
| Alex | 40 | 34 | 6 | 0 | 0 / 0 |
| May | 32 | 17 | 12 | 3 | 0 / 0 |
| Scout | 19 | 10 | 1 | 8 | 0 / 0 |
| Total | 91 | 61 | 19 | 11 | 0 / 0 |

The live status reported no active agents/work. Open responsibility is not
concurrent execution load. This snapshot supplies no evidence of capacity pressure.

The demonstrated value is preventing recurrence for future accepted finite
Alex message/goal assignments under the explicit policy. It requires no extra
LLM call merely to close a Task. The hook does not retroactively inspect old
idle results, sweep the backlog, cover other Apps, or close Task-created reviews.
The selector's own result consumption and guarded child closure remain a gap.

Before claiming live adoption: resolve the merge-CI failure, separately authorize
and deploy the exact Host revision, activate the integrated companion definitions,
verify the public capability, then observe one scoped finite accepted result and
its closure/caller evidence. Preserve standing work, real waits and current
creator authority. Source checks alone do not prove changed live behavior.
