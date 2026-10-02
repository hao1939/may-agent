# Returning an answer after a wait

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Tests returning an answer after a durable wait through the same Task.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

**Status:** Active, unmerged source experiment. The delayed-input failure in the
[previous checkpoint](controller-poc-outcomes-and-closure.md#the-follow-through-gap)
is fixed for the exercised Task paths. Actual Conversation execution and Request
settlement have not migrated. The [one-lifecycle proposal](conversation-input-unification.md)
remains the target; this is another acceptance slice, not the completed change.

Source: [input continuation](https://github.com/hao1939/may-agent/commit/4f21f0b6)
and [model follow-through trial](https://github.com/hao1939/may-agent/commit/a66f0073).
Both are on `poc/task-outcomes-and-closure`. No installation or production state
changed, and Host changes remain unmerged pending review and migration checks.

## What code now carries

When an admitted input needs child work or a Condition, the Task records that
return relationship with the existing wait. It includes exact child/Condition
generations. The original input remains available in its admission record.
When matching evidence arrives, code supplies both that evidence and the earlier
ask through `continuedInputs`. Acceptance binds the answer to that input and
removes its pending return link in the same transaction.

An intervening answer cannot satisfy a different wait. Two callers can await
different children; their results can return out of order. Further delegated
work carries the original ask forward. An older child generation cannot answer
a newer assignment. Giving up on new input preserves another input's wait.
These are Task input correlations; they do not declare a human Request fulfilled.
That decision still belongs to Conversation's typed Request updates.

A claim no longer consumes a satisfied Condition. Its evidence remains until
an outcome is accepted, so failed execution can retry after restart. Live
feedback supplies the same original ask as a later attempt. If newer input
prevents acceptance, unresolved asks remain in context while the event queue
advances. Replaying the entire old event batch was rejected because it could
starve later events in a bounded queue. The agent manages none of these steps.

## Evidence

The final focused lifecycle, Condition and batching checks passed **36 tests**.
The surrounding inbox/state/read checks passed **141 tests** before the last
generation-reuse regression was added; that regression passed in the final
focused and broader audits. The production registered-executor live-input test
also passes against retained Task outcomes rather than deleted-task receipts.
Host/SDK type checks, App-boundary checks and lint passed.

The source cases cover:

- An original ask, child wait, intervening answer, storage reopen and exact
  delayed answer returned to the original caller.
- Two callers, out-of-order child results, and another measurement attempt
  without repeating the original input identity.
- A satisfied wait surviving execution failure and reopen; a failed admission
  write rolls back both the accepted result and removal of the wait.
- Live evidence accepted by the active executor or retained for its next attempt.
- A separate give-up decision, an old child generation, and continued progress
  through a bounded event backlog.

The broader migration audit is still **not green**: **333 passed, 80 failed and
2 asynchronous errors across 413 tests**. The failing test names introduce no
new failures compared with the preceding 81-failure audit. This does not make
the failures harmless: old receipt/deletion and lifetime assumptions still need
migration. The two asynchronous errors came from receipt-polling fixtures
reading their databases after timeout and teardown. No full-CI or cutover
readiness claim is made.

## Can a model use it?

The committed opt-in trial uses the real direct-agent executor and Task
controller with an experimental App judgment schema. Code runs a deterministic
measurement child, persists its wait, accepts an intervening question, then
reopens SQLite and replaces the controller before returning the measurement.
Each model execution starts fresh; its last decision depends on the original
ask supplied by code, not remembered conversation history.

The development case supplies `0.92` against a `0.90` minimum. The transfer case
supplies `0.78` with the same criterion, schema and instructions. Both must
delegate once, answer the conceptual question with no measurement claim, then
return the correct assessment to the original caller. The intervening answer
must remain unchanged, and no ready recovery work may remain. Reports include
the source revision, dirty-worktree flag, calls, usage and source settlement.

Both final runs passed with `gpt-5.6-sol` on clean revision `a66f0073`:

| Measurement | Final judgment | Model decisions | Summed agent execution time | Reported tokens |
| --- | --- | --- | --- | --- |
| `0.92` | Meets the minimum | 3 | 12.2 seconds | 5,018 |
| `0.78` | Below the minimum | 3 | 11.5 seconds | 4,988 |

Each execution made one `finish` call and no other tool calls. The middle
answers explained the threshold with a null assessment; only the final
contexts included the original measurement ask. Both final answers preserved
the independently accepted explanation. These are small fixture measurements,
not a latency guarantee or a bill. Raw transcripts and provider details remain
outside the repository.

Earlier harness runs were excluded after fixture-metadata and shutdown-drain
errors. A complete development run also exposed an inadequate gate: its prose
was correct, but a loose optional-field schema allowed unsupported placeholder
scores. The revised schema permits only fields appropriate to each decision
and requires a null assessment for a conceptual answer. The gate now checks
intermediate answers as well as the final value. That is a contract correction,
not evidence that a prompt alone makes arbitrary model output trustworthy.

This trial uses a supplied deterministic measurement, not a second model or a
real measurement service. It does not exercise the installed App, full managed
Task adapter, Conversation/Topic/Request records, transport delivery, human Stop,
background pause or an inbox cutover. Passing it proves the exercised Task
follow-through and model judgment, not the complete common lifecycle.

## Value, cost and next work

This source slice adds **174 net implementation lines**, excluding tests and
the opt-in trial. It adds return references to Task state, original input in the
admission record, and continuation context on attempts. There is no new table,
scheduler, polling worker or independent execution claim. The added state fixes
a demonstrated lost-answer problem; it is not an overall code reduction.

Reads are scoped to the current Task and its linked admissions. Large numbers
of unresolved inputs can still enlarge retained state and prompts; this small
trial is not a scale or retention benchmark. Historical admissions without the
new context, scope revisions, per-input recovery query cost and legacy readers
remain migration work.

The next major step is the actual Conversation handler under one stable Task,
using real message and Request operations in fenced settlement. Remove the old
executing inbox and follow-up owner, preserve scoped Stop and background pause,
and prove one execution owner at cutover. Continue the mode/receipt/read/cleanup
migration and full CI. Only then compare total deleted versus added paths and
judge whether unification earns its long-term cost.
