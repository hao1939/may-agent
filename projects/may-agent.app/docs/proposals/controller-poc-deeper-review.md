# Does the common Task loop pay for itself?

**Status:** Source follow-up to [Host #158](https://github.com/hao1939/may-agent/pull/158),
September 12, 2026. Unmerged and undeployed. The [proposal](conversation-input-unification.md)
owns the lifecycle contract; the [earlier audit](controller-poc-recovery-review.md)
retains nested delegation, failure and cutover evidence.

## Recommendation

Keep one Task lifecycle. The new trials support its practical value: an agent
can choose delegation from an ordinary ask, keep discussion available, accept
owner withdrawal and reconsider evidence when the human changes the question.
Do not equate that result with cheaper model execution or dramatically fewer
lines. The controller saves coordination work, while model judgment and repeated
context still have a cost.

Three small changes improve the candidate:

- New dependency declarations add work; existing waits survive omission. Remove
  the requirement to repeat earlier requests before asking the same App for
  distinct work. The agent expresses the new need; code keeps the old links.
- Unfinished work retries until an owner intervenes. Remove the private
  controller's unused retry-count stop option and slow prolonged Task failures
  using the existing persisted backoff.
- Make SDK result types distinguish answer, wait, failure report and agent
  handoff. Invalid combinations should fail in a typed App before admission.

These remove an obsolete procedure and a policy switch. They do not introduce
another queue, controller, recovery role, per-input retry counter or config layer.

## What the live trials established

All three trials use the real May declaration and role instructions from paired
App `b73886ab05`, the common controller, worker processes, temporary SQLite and
live `gpt-5.6-sol` judgment. The tool catalog is limited to coding and finish;
the HTTP measurement source is synthetic. None alters an installed App or
production state. Each trial permits at most eight dispatches and six minutes.

| Trial | Clean Host revision | Result | Attempts / model responses | Elapsed |
| --- | --- | --- | --- | --- |
| Ordinary ask with a slow source and further human questions | `8984964d` | May chooses delegation without a background-Task instruction; discusses while the worker waits; returns 0.92 versus 0.90 and recalls it after reopen | 5 / 6 | 48.5 s |
| Human withdraws while the delegated worker is running | `311a73ea` | Exact child closes; accepted ask is withdrawn, not fulfilled; late output is rejected; reopen retains closure and human interaction | 4 / 5 | 33.8 s |
| Human changes the minimum from 0.90 to 0.95 while collection runs | `f2683274` | Same accepted ask is revised; final answer correctly reports 0.92 below 0.95 by 0.03; reopen recalls the new threshold | 6 / 11 | 85.4 s |

Every trial made one measurement read and recorded zero tool errors. Success
and correction leave both Tasks open. Withdrawal closes only the assigned child.
The natural ask says the source may be slow and that further questions will
follow; it does not name Tasks or request delegation. This is one relevant
adoption sample, not proof of arbitrary unprompted recursive decomposition.

The correction trial is especially useful: the worker first finishes its old
comparison, then receives the correction in another attempt and reuses the
observed value. The owner answers against the revised Request, not the old
successful comparison. No second measurement or replacement Task is needed.
This supports affordable reconsideration at attempt boundaries without live
preemption or precise execution resumption. It also exposes their cost: one
extra worker attempt and additional model/tool steps.

Provider-reported aggregate token totals were approximately 55k, 36k and 105k,
respectively, including cache accounting. These are not verified bills, unique
context sizes or a controlled comparison with the old implementation. The
sample is too small to establish latency, reliability rates or cost savings.
Two Task reads occurred in the correction trial; they were inspections, not
a polling controller. Reducing repeated context is a possible next experiment,
but this evidence does not justify removing the assignment or current Request
from the prompt.

## Retry cost

Owner-controlled closure makes retry frequency an ongoing operating cost.
The previous 30-second ceiling would allow a quickly failing Task to start
about 120 attempts per hour indefinitely. Backoff alone does not bound total
lifetime spending.

The candidate retains the same 250 ms exponential start, extends the Task
failure ceiling to 15 minutes, and persists its deadline as before. The first
thirteen failed attempts reach that ceiling; sustained failure then permits
four attempts per hour. Fresh human admission, owner retry and scope revision
retain their existing controls. Ordinary duplicate wakes and reopen do not
waive the saved cooldown.

| Assumed duration of each failed attempt | Previous starts in first 24 hours | Candidate starts in first 24 hours |
| --- | --- | --- |
| Immediate failure | 2,886 | 107 |
| One minute | 962 | 101 |

This calculation starts at time zero with one continuously failing Task,
unlimited available capacity, no owner intervention and no successful progress.
It evaluates the previous formula and current `taskExecutionRetryDelay()`;
it is not a day-long load test or a billing prediction. Model calls inside one
bounded attempt may differ.

The accepted cost is slower unattended recovery after a prolonged outage:
restoration without an owner action may wait up to 15 minutes. The early fast
retries remain, and a long-lived Task still needs owner attention if spending
is no longer worthwhile. The private dispatch timer remains faster because a
storage failure may prevent any durable Task transition; it cannot be replaced
by writing another retry record to that unavailable storage.

## Source checks and deliberate limits

`app-task-runtime.test.ts` reproduced a second distinct same-App request being
rejected after restart because an earlier wait was omitted. With additive
delegation, the full runtime retains both Conditions across later attempts
without another admission. The existing exact-return, stale-effect, request
reuse and duplicate checks continue to pass. A differently worded new request
can still create distinct work: the Host does not infer semantic equivalence
or silently replace an accepted assignment. App judgment must avoid that mistake.

The retry test runs sixteen failures through actual claims and SQLite writes,
advancing test time between attempts. It checks the long cooldown across reopen
and early wake, then accepts success against the original input. Existing real
timer tests retain capacity/restart evidence. A controller test passes seven
dispatch failures without the old count stop. Model experiments explicitly
close their fixture controller on error; a test allowance is not Task policy.

The SDK compiler fixture reproduces six previously accepted invalid type
combinations, including a non-literal mixed failure result. The discriminated
union rejects them; admission still validates values and evidence. The runtime
normalizer constructs the corresponding result branch without a broad cast.

Focused verification: 26 SDK tests, 45 controller/retry tests and 125 runtime
tests pass. Full local `bun run ci` at `f2683274` passes: **2,902 passed,
3 installation-dependent skips, 0 failures**, 2,905 tests across 291 files in
136 seconds. Types, architecture and lint pass. Design checks and all 96 checked
local document links pass. Hosted **Quality and Container both pass** on
[the exact candidate run](https://github.com/hao1939/may-agent/actions/runs/34653774312).

Against main `49272b5a`, production source under `src/` and `packages/`, excluding
tests, compile fixtures, JSON and Markdown, is 2,988 lines added and 2,439 removed:
**549 net added**, of which **517** are offline converters and **32** ongoing
source. This remains a reduction in competing execution paths, not a large
source-size reduction. The SDK type correction adds explicit branches; deleting
the actual identity and persistence checks would save lines by weakening the
proven guarantees.

Keep exact admitted-input/result links, claim fences and typed Request closure.
The correction and withdrawal cases show their value. Keep planned upgrade
downtime and one execution owner instead of building a dual-runtime migration.
Retain the compatibility labels for now: renaming `achieve`/`maintain` or
`stopped` would add migration work without deleting another execution path.

The next useful evidence is owner intervention after repeated paid failures,
prompt-cost comparison with equivalent asks, and broader natural use with the
installed tool catalog. Real service repair, long-running retention/scale and
installation rollout/rollback remain unproved. Those questions do not require
another core framework before they can be tested.

See the [PoC runner instructions](../../../may-agent/scripts/poc/controller-judgment/README.md)
for the three repeatable trial commands and their bounds. Raw reports, transcripts
and provider usage stay local; only synthetic findings are published here.
