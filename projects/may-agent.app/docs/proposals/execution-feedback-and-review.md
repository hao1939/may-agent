# Execution feedback and agent review

**Design status:** Proposed refinement, September 13, 2026. The user direction
is automatic feedback by convention, agent judgment, periodic checks and simple
fallback. The execution choices and acceptance gates below still need proof.
**Implementation status:** Design and source review only. No runtime change,
model experiment or deployment is claimed by this document.

The source baseline is Host v3.0.1, `6935b325`, and release-derived candidate
`db5e548c`; the affected execution/routing files agree. App source is `3ca8696a90`.
Current working design drafts were also read; their uncommitted revisions are
context, not a released contract. A read-only installation check confirmed the
candidate container was running and healthy; that does not prove work completion.

## Decision and value

Use the existing execution, observation, Event and Task boundaries for one
feedback loop. Code observes, preserves and delivers evidence. The owning
agent judges the next action. Code executes it and returns evidence.

The important new capability is review while a helper is still running. A new
daemon or generic notification service would not supply that capability by
itself. Reuse the existing Host and add the smallest execution capability that
passes the trial below. Keep native helpers owned by their caller attempt.

| Problem | What this direction can resolve | Limit |
| --- | --- | --- |
| Useful Codex work is repeatedly cancelled as silent | Forward real progress; replace the silence cancellation with a due review on the reviewed path | Observation alone cannot decide whether work is useful; enclosing execution limits still apply |
| Status says no agents while Task workers run | Read shared execution authority for status and maintenance | This is an independent read bug; it does not need an LLM or observer framework |
| A notification disappears and work remains waiting | Revisit current source state and unfinished handling through existing recovery | Cannot reconstruct unrecorded intermediate changes no longer available at the source |
| Feedback is saved but the caller is awaiting a long tool | Run a bounded owner review within that attempt | Current Task wake/steering does not guarantee a model step during the pending tool |
| Events name a missing owner | Deliver a narrowly defined delivery problem to the installation reviewer | No automatic reassignment, App enablement or revival of cancelled work |

This does not repair a bad goal, missing credentials, an incorrect patch or a
refinement that was never saved into the durable assignment. Better feedback
can expose those problems to judgment; their owning contracts still need fixes.

## One feedback contract

Starting an operation attaches its trusted App, Task, attempt, session and
operation identities where applicable. Existing identities stay authoritative;
the CLI result's historical `taskId` is a call correlation key, not an App Task.
External providers use documented resource ownership conventions. Executors
should write/read that metadata as part of their ordinary operation support.
The agent does not separately subscribe, choose a recipient or manage polling.
An uninstrumented external action cannot promise automatic discovery.

Reuse the existing Event envelope, target and trace. An observation carries
source identity/revision, observation time, bounded facts and evidence references.
Reported activity, observer freshness, execution ownership and goal progress are
different facts. A successful probe or lease renewal must not become invented
worker progress. Source data and worker prose cannot grant routing authority.

```text
execution signal or periodic source check
  -> record current facts and evidence
  -> refresh status
  -> if reconsideration is due, admit feedback to its owner
  -> agent reads current goal and evidence, then decides
  -> validate and execute the action against current ownership
  -> record its result through the same feedback path
```

Ordinary output updates evidence without a model call per line. Completion,
failure, need for input, relevant provider changes and due reviews warrant
reconsideration. An immediate tool result already delivered to the caller needs
no second self-wake. A provider adapter defines relevant fields; the agent judges
their meaning. Periodic review of unfinished work must remain possible even
when a noisy worker keeps emitting activity.

Recording, accepting responsibility, reviewing and executing are distinct
facts exposed through existing event/input/session/operation records. Do not
add a four-stage notification lifecycle or treat a passive listener as work
acceptance. Accepted human input and distinct results retain their identity;
only redundant review hints may coalesce.

## Routing and unavailable owners

There are two semantic destinations: the owning App, and the installation
reviewer for undeliverable feedback. May fills the latter role in the default
installation. The Host owns mechanics; the installation composition owns this
explicit route. Do not hardcode a privileged May agent into generic EventBus code.

Within the owning App, keep the exact existing Task target and its ordinary
agent selection. A missing session is an execution recovery case. A busy Task
retains its input; it is not an unavailable owner. A missing Task can be
reported to the same App through a delivery-problem input without inventing a
replacement Task. Finished/cancelled Tasks retain late facts as evidence.

If the App is absent, disabled, or its declared route cannot accept the feedback,
publish a Host-authored delivery-problem observation for May. Preserve the
original owner, event and failure reason. The original frozen admission is not
rewritten or replayed as May input. This exception is only for recognized,
trusted execution feedback; malformed public input, unknown event types and
arbitrary caller targets retain their existing rejection behavior.

The problem input asks for judgment about delivery; it is not authority to
repeat the external action, enable an App, transfer ownership or reopen work.
May uses its normal input/Task mechanisms if investigation is needed. Repeated
checks reuse one outstanding issue in existing input handling, rather than
creating a Task per scan. If May is unavailable, retain visible operator
attention and retry ordinary delivery when possible. Never recursively report
failure to deliver a delivery problem. Handler completion also does not prove
the original work was repaired; its current state remains checkable.

This is an explicit extension to the current no-generic-fallback rule in
[Events](../2a-design/events.md) and the exact-caller rule in
[Caller feedback](caller-feedback-and-waiting.md). Caller results still go to
their exact caller. May only reviews a delivery problem; it does not become a
substitute recipient for the owed answer. Existing authority is preserved.

## Periodic checks and affordable recovery

Use the existing scheduler, observer scans, pending admission recovery and
Task/Condition review checkpoints. Extend the scan that owns each fact; do not
make one observer scan every historical session, log file or App on each tick.
Page through unfinished work and known relevant resources without starving
later pages. Poll providers only where push signals cannot establish current
state. Quiet scans produce no model turn unless a review is due.

There are two gaps to catch: current reality changed without a recorded event,
or feedback was recorded but has not reached a completed review. The first
requires rereading the source; replaying the journal alone cannot fix it. The
second uses existing durable pending input and execution recovery. Merely marking
a source revision observed must not suppress an unfinished review forever.

At most one review of an operation runs at once. An observation arriving during
review remains available for the next decision; completing the older review
must not consume newer evidence. Before a control executes, reread the exact
attempt/operation and reject stale identity. Where resource revision matters,
the action also checks that revision. Provider-side ambiguous effects require
source inspection or provider idempotency before retrying.

After restart, an extra observation or review is acceptable. A process that
crashed uses the caller's existing cleanup and same-Task recovery; seamless
continuation of a detached native process is not promised. A periodic reread
can recover current provider state within its discovery scope, not every lost
transition. Notification recovery cannot work while storage, source access and
every reviewer are unavailable; expose that condition honestly.

## The difficult boundary: review during execution

Today `managed-agent.ts` forwards live Task events through `manager.send()`.
That queues agent steering. The managed agent is awaiting `run_cli_agent`,
and the native process has ignored stdin. Neither that steering hint nor
another ordinary Task wake guarantees a review before the CLI call returns.
Starting a second full attempt would violate the existing ownership guarantee.

The recommended trial is a bounded decision call owned by the current attempt,
using its selected agent's goal, scope and trusted guidance. It runs only while
the main agent is awaiting the helper. Use the existing managed model runner
and session evidence; it is a nested review, not another Task or permanent
supervisor. Adapters still only report facts; execution composition admits the
review. No third public App-handler category is proposed.

Give the reviewer current Task/input context, the helper's assignment, compact
recent evidence, the previous review and any pending human correction. It may
inspect more scoped evidence, then propose an authorized control or return an
explanation. It cannot finish the parent Task, rewrite its goal, run a competing
patch worker or recursively delegate another review. Record the decision and
action result with the attempt and deliver them back to its ordinary agent.

| Judgment | Initial execution behavior |
| --- | --- |
| Continue | Keep the same helper; code schedules the next review within admitted execution limits |
| Steer | Cleanly stop and drain the helper, then explicitly resume its known native thread with revised instructions; if no native ID exists, report that a fresh context is required |
| Stop this operation | Drain that exact helper and return partial evidence; do not close the Task |
| Investigate or request help | Use scoped reads or return the question to the normal owner/caller path; explicitly state whether the helper should keep running or stop |

Live steering is not supported by the current wrapper. Stop/resume can waste
an in-flight command and must inspect uncertain effects before repeating it.
Keep native resume identity exact and persist it when observed, not only at
terminal return. If this cost dominates, evaluate a native interactive adapter
separately rather than pretending queued parent steering reaches the helper.

Only one review/control decision for that operation may commit at a time.
Human Stop, supersession and ownership loss invalidate pending decisions.
A human correction invalidates an outdated review decision but does not itself
close the Task. Bind the review to the accepted input/resource version and
operation identity so code can detect that change before applying a control.
CLI completion during review makes a later control stale and
returns the completion normally. Review execution must not wait behind a model
capacity slot held by its own awaiting caller. Bound and cancel the review
itself; it cannot recursively review a stalled reviewer.

Review failure means no decision was obtained. Preserve its diagnostic and
schedule another opportunity through the existing cadence, without inventing
an instruction to stop or renewing a hard deadline. If the enclosing budget
expires first, stop mechanically and retain the same Task for normal recovery.

## Review intervals and hard limits

These limits are different in the reviewed source:

| Mechanism | v3.0.1 behavior | Proposed handling |
| --- | --- | --- |
| Parent observation deadline | Five minutes without observed agent activity cancels the parent | On the reviewed helper path, make this a review trigger; progress remains evidence |
| Native helper timeout | Ten minutes by default, or explicit `timeoutMs` | Keep an explicitly supplied hard limit; for the trial replace the implicit cutoff with reviews bounded by the caller's remaining budget |
| Managed App-agent attempt | Fifteen-minute execution budget passed by `attempt-execution.ts` | Retain for the first trial; a continuation decision cannot override it |
| Attempt ownership lease | Fifteen-minute lease, renewed by the attempt runner | Preserve existing mechanical renewal and fencing; this is not an agent progress judgment |

The agent never needs to poll a clock or calculate a timeout. Code owns those
mechanics. Explain a hard-budget stop distinctly from an agent decision to quit.
Simply forwarding progress fixes false silence but cannot supply semantic
judgment, remove the other limits or permit indefinitely long helpers.

The first trial therefore proves intervention within a bounded attempt, not
unlimited process lifetime. If useful operations routinely exceed the enclosing
budget, revisit that policy with evidence or use the existing durable Task/native
executor for continuation. Removing the five-minute timer alone is insufficient.
Unreviewed tools and model/network/cleanup operations keep their existing bounds.

## Source gaps and integration impact

All Host paths below are relative to the reviewed Host repository.

| Boundary | Evidence at v3.0.1 | Required change and impact |
| --- | --- | --- |
| Native progress | `src/lib/cli-agent.ts` captures JSONL; `src/lib/tools/run-cli-agent.ts` omits `onUpdate` | Connect meaningful bounded progress to the existing tool callback; no new event service |
| Durable activity | `src/lib/manager.ts:bridgeEvents` omits `tool_execution_update` | Persist activity without increasing tool-call counts; do not confuse review/probe activity with helper output |
| Public status | `src/app/app-runtime.ts` uses the parent `manager.status()`; Task workers create separate managers | Add one shared current-execution read, including workflows without agent sessions; reuse in `src/app/modes/maintenance.ts`; unavailable reads must not appear idle |
| Review while running | `src/app/adapters/executors/managed-agent.ts` sends live hints; `src/app/core/tasks/attempt-runner.ts` skips a busy claim | Add bounded nested review and exact controls at the execution boundary; highest concurrency and model-cost risk |
| Deadlines/recovery | `manager.ts`, `cli-agent.ts`, `core/tasks/attempt-execution.ts` enforce different limits | Change only the reviewed path together; preserve hard budgets, cancellation and process drain |
| Observation memory | `src/app/adapters/producers/app-observer-runtime.ts` already supports publication-aware snapshots | Reuse implemented support; do not reimplement the older proposal's Host half |
| Source adoption | Reviewed Scout credential adapter still uses its own file cache; generic PR discovery is not supplied by the Host runner | Keep App adoption/provider work in the existing observer proposal; shared scheduling alone is not provider coverage |
| Owner fallback | `src/app/composition/app-inbox-runtime.ts` rejects missing exact targets and freezes admitted routes | Add a typed delivery-problem path and normal May input mapping; no mutation of original routing or blanket fallback |
| Human notifications | Existing Conversation/interface projections already observe accepted facts | Reuse them for useful results, decisions and attention; avoid a second status truth or raw-event conversation spam |

No bulk Task/history migration, new work lifecycle, subscription registry or
notification store is proposed. Nested review needs a compact last-decision/
next-review marker if existing execution receipts cannot express it safely.
Prefer an additive optional execution detail with conservative re-review for
older records; this is a design need to prove, not a claim of zero state cost.
Any public SDK control or Event schema changes need matching Host/App revisions.
Old pending inputs, exact caller returns and disabled-App state must remain intact.

## Value, cost and alternatives

Retained September 13 investigation evidence contains 19 post-upgrade
interruptions of one Task with `No agent observation for 300000ms`. Three sampled
CLI calls recorded 41, 34 and 60 completed commands and output roughly five
seconds before cancellation. A prior isolated subprocess reproduction recorded
39 child-command events and zero parent updates before a shortened silence
deadline. These are historical observations, not new trials or 19 independent
Tasks. They establish the progress defect, not the effectiveness of this design.
Saved status observations also showed active worker sessions omitted from the
public read. No maintenance-caused restart was demonstrated.

| Option | Value | Cost / decision |
| --- | --- | --- |
| Repair progress and shared status only | Directly addresses two demonstrated defects | Low relative implementation cost and no review model calls; necessary first slice, incomplete supervision |
| Add bounded review through the existing execution/feedback path | Agent can distinguish useful quiet work from a loop and intervene | Medium-to-high behavioral risk: context, capacity, cancellation races, timeouts and model cost; prove before expansion |
| Make helpers detached jobs or separate Tasks by default | Frees the caller to review through ordinary turns | Reintroduces ownership, join, cancellation and restart costs deliberately removed from bounded CLI calls; use durable Tasks only for independent outcomes |
| Add `eventwatchd` plus a new notification registry | Separate deployment and isolation might help another installation | No demonstrated need here; duplicates scheduling, delivery and recovery without resolving pending-tool review |

Costs have not been benchmarked. At a five-minute review interval, N continuously
review-due operations can produce 12N model reviews per hour: 20 operations mean
240 reviews/hour. This is an illustrative workload, not a recommended cadence.
Bound context, coalesce hints, stagger checks and measure model tokens, latency,
provider requests, database work and useful interventions. Activity should not
hide endless looping; reducing model calls must retain a finite next review.

Prefer a simple extra review after restart over perfect suppression. Stop
expanding if reviews mostly repeat known facts, status reads become slow, or
stop/resume wastes more work than the intervention saves. A common contract is
valuable; maximizing the amount of shared runtime code is not a success metric.

## Implementation order and acceptance

1. Fix native progress and shared status independently, with real subprocess/
   worker integration checks. Keep the existing timeout behavior until the
   reviewed replacement is exercised; describe this slice as partial repair.
2. Trial nested review for one Codex helper with temporary state and scripted
   decisions. Prove the existing Task identity and exact execution controls.
   Then use a bounded model trial to assess whether the context supports useful
   continue/steer/stop judgment; scripted decisions cannot establish that.
3. Prove lost/repeated feedback, restart and unavailable-owner reporting through
   actual admission. Reuse this contract for one external resource adapter only
   after the running-helper path and its cost are understood.
4. Update owning Events, Sessions, Native Coding Workers and App guidance with
   the proven contract; integrate Host/App revisions together. Existing draft
   edits are not overwritten. Source verification precedes any live rollout.

Acceptance must check outcomes, not just emitted events:

- An active helper reports progress into stored status; a quiet helper survives
  the review threshold after Continue, and the same native process finishes.
- A busy-loop fixture reaches periodic review despite noisy output. Steering
  changes subsequent behavior on the exact native thread; the old process is
  drained first. Stop preserves partial work and does not close the Task.
- Human cancellation, correction, helper completion and supersession during
  review cannot apply stale controls. Saturated model capacity cannot deadlock
  the review behind its own caller. A failed review causes no false decision.
- Explicit helper and enclosing hard limits still stop the execution with an
  honest reason. Observe ownership renewal separately from semantic progress.
- Drop a real notification, restart admission, and repeat an observation:
  current facts reach the original work, newer evidence survives an older
  review, and no duplicate worker or blind external mutation appears.
- Missing Task reports go to its App; missing/disabled App reports go to May.
  Busy owners retain feedback. Missing May stays visible without recursion.
  Unknown public input still fails and cancelled work remains cancelled.
- Real worker and workflow activity appears in status and maintenance, then
  disappears on completion/crash recovery without stale rows appearing live.
  Measure command latency under concurrent work against the same baseline.

Do not call the system unified until both internal execution and one external
source demonstrate this loop. Long-running goal completion, cheap review and
all-provider coverage remain claims requiring their own evidence.

## Validation of this revision

The documentation gate passed: design integrity, SDK/control example types,
seeded Task admission/replay, Condition/dependency result admission, and canonical
App integrity. The baseline example used retired result `evidence` fields;
the companion documentation correction uses v3 `facts` and omits retired Task
`mode`. Domain request data named `evidence` remains domain data.
Changed proposal links/headings and patch whitespace were also checked.
No new execution behavior or model judgment was tested. The historical
reproduction above was reviewed as evidence, not rerun for this document.
