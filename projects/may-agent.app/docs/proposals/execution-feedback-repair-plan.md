# Execution feedback: repair proposal

**Status:** Implemented candidate with isolated PoCs, September 13, 2026.
The four repairs, bounded-execution policy and explicit parent continuation
are implemented locally for the recorded scope. Entry-point consolidation is
still incomplete; the [follow-up proposal](execution-entrypoint-consolidation.md)
owns remaining caller migration, CLI result handling and heuristic retirement.
The [PoC record](../archive/reviews/execution-feedback-poc-20260913.md)
records exact revisions, failures, verification and remaining limits. They are
not merged or deployed. This is the implementation plan following
the [component review](../archive/reviews/ownership-boundary-review-20260913.md#component-family-review).
The [System Model](../2a-design/system-model.md#execution-and-outstanding-results)
and [core/external boundary](../2a-design/system-boundary.md#core-external-capabilities-and-composition)
remain the owning contracts. The earlier [feedback proposal](execution-feedback-and-review.md)
retains the preceding PoC and candidate implementation evidence.

Reviewed Host: `6fdc03d8ce8c538e315740b5d1e9fd64971e1762`, based on v3.0.1
`6935b325`. This candidate already includes native activity forwarding, shared
execution reads and public session-control guards. It is not evidence of what
is deployed or merged. Check the implementation base before preparing PRs;
reuse any landed prerequisites and keep unrelated candidate commits out of each PR.

## Goal and sufficient outcome

A user or assigning agent should understand what is running, what result is
outstanding, and what can happen next. Work should continue when something
useful is possible, survive ordinary missed notifications, and remain under
its exact owner's control.

For example, a worker starts a pipeline and prepares an independent review.
The status shows both activities. After the review, it releases execution while
the pipeline remains outstanding. A result, or a later source check after a
missed notification, reaches the same Task. The agent reads current facts and
decides whether to continue, change approach, ask its owner, or return an answer.
The user should not have to infer this from a session directory or start a new Task.

Success is a correct result with understandable progress and fewer reminders.
It does not require immediate delivery, perfect session resumption, a model
reviewing every event, or automatic repair of every unavailable owner.

## Design choices

Follow the [design philosophy](../1-principles/design-philosophy.md): fix a
demonstrated problem at its owning layer, compare with doing less, and keep
only machinery whose benefit justifies its total cost.

| Responsibility | Implementation choice |
| --- | --- |
| Running and waiting | Derive independent facts from existing execution and outstanding-result records; add no combined Task phases or agent availability registry. |
| Agent judgment | Choose useful work, interpret results, and recommend scope changes. Assigning owners retain acceptance and closure authority. |
| Core mechanics | Preserve exact identity, accepted input/results, waits, scheduling, execution fences and recovery. |
| External capabilities | Perform provider/tool I/O, supply trusted feedback references and observations, and clean up their execution. Local tools also sit outside core. |
| Composition | Connect those capabilities and supply trusted operational scope. |
| Notifications | Direct calls return directly. Async feedback and periodic rechecks use existing Event/Task routes. Repeated observations are acceptable. |
| Difficult cases | Preserve the problem and bring it to the existing owner. Use operator intervention where automatic handling has not earned its cost. |

Recommend four independent repairs first. Then run the small experiments below
before changing delegation or wait authoring. The watchdog change has a separate
acceptance gate because altering when execution stops changes cost and behavior.

The implementation keeps those boundaries. The continuation contract is
`waiting` with optional `continue: true`, new typed dependencies and progress
facts. It reuses the existing pending phase and queue. No new phase, timer,
notification service or operation registry was added. Scout's existing
`xhsWaitResult` already supplies its wait mechanics; the combined test used it
unchanged, so no new capability API was needed for that source.

## Fold corner cases into the existing process

The common fix is to reconnect paths that bypass their existing owner. Normalize
an adapter's result into the established input, observation or execution-outcome
contract, then let the existing Task process handle it. A new service called
notification, watchdog or recovery would leave those bypasses in place.

| Situation | Existing process to use | Consequence |
| --- | --- | --- |
| Result arrives while the owner is running | Durable exact Task input and the existing one-attempt claim | Preserve feedback for handling; a live hint is optional. Do not start a second parent or count hint delivery as accepted handling. |
| Result arrives before the parent saves its wait | Existing dependency/input correlation and Condition matching against already observed facts | The later wait must see the earlier answer. Do not add an early-result mailbox or depend on arrival order. Prove this when adding each supported source. |
| Notification was never saved | Observer rereads the source, or dependency recovery reads the accepted child result | Publish through the normal route. Replaying the journal cannot recover a fact it never recorded. |
| Notification was saved but not handled | Existing pending-admission/input recovery | Retry the same accepted identity. Do not ask the provider to redo the work or create a sibling Task. |
| Event repeats, arrives late, or is older than current facts | Existing receipt/input identity, Condition revision matching, current-state read and effect fences | Reconsider current state without replaying obsolete actions. Distinct human inputs remain distinct; text equality is not deduplication. |
| Owner has no current session | Normal Task eligibility and attempt creation | Waiting normally has no session to resume. Recover or start the same Task as needed. |
| Attempt was replaced, or the owner stopped/closed work | Existing generation, attempt and cancellation checks | Retain late evidence; reject stale effects and prevent cancelled work from reopening. A new authorized request is a separate decision. |
| App/Task is missing or unavailable | Existing admission failure and visible diagnostics; exact owning App input where available | Preserve original references and report inability to handle it. Do not guess a replacement owner, enable an App or claim automatic supervisor delivery. |
| Escalation is resolved | Ordinary exact Task feedback; validated standalone control for standalone work | The owner judges whether the old blocker still matters. Remove the independent Task-session revival path. |
| Cancellation is rejected or its owner cannot be reached | Existing validated control and its receipt/error | No alternate PID kill, optimistic registry edit or inferred success. Repeating an accepted control uses its existing identity. |
| Observer reloads while an old scan finishes | Host observer generation fence and publish-before-advance | Discard obsolete output; the new generation can run. Remove the App's duplicate probe marker. |
| Source/query fails | Existing observation/read failure contract | Unknown stays unknown. It is neither an empty result nor proof the operation failed; next normal check can retry a read. |
| Execution reaches its bound | Existing executor cleanup and Task failure/result settlement | Retain partial facts, release the exact claim, and return the problem through normal caller feedback. No timeout-specific Task or notification lifecycle. |
| External action may have succeeded before a crash | Source inspection or the provider's existing idempotency/ownership convention | Recover the known operation before repeating effects. If its outcome cannot be established, expose uncertainty to the owner. SQLite cannot promise exactly-once provider actions. |
| One result arrives while other waits remain | Existing input settlement and retained Conditions | Accept that result without erasing unrelated waits. The owner can continue useful work under the same Task. |

These are reuse targets, not a claim that all adapters already implement them.
The source already shares live/recovered caller feedback through
`src/app/core/inbox/input-result.ts`; dependency recovery and Condition matching
live in `src/app/core/tasks/dependency-admission.ts` and
`src/app/core/tasks/app-task-condition-tracker.ts`. Controls use `src/app/task-control-events.ts`
and the existing fenced Task functions. Repair callers of those contracts
before adding another abstraction.

The four repairs deliberately remove parallel mechanisms:

- controls reuse ownership validation and remove the raw-kill and Task-session
  revival alternatives;
- execution status reuses the canonical read and removes the tool's separate
  active-session calculation;
- wait presentation reads existing Conditions and eligibility without storing
  another status;
- Scout uses Host observation memory and removes its private cache/probe marker.

Common code should enforce a common invariant. Provider parsing, source-specific
meaning and permission policy stay in their owning capabilities; forcing those
into one generic handler would move complexity into core. Keep direct result
returns and process-liveness recovery in their existing paths too.

The two proposed work-coordination extensions are capability-supplied wait setup
where it is missing, and an explicit parent continuation after new delegation.
The PoC below must demonstrate those needs. Neither justifies a
second queue, operation registry, generic dispatcher or per-incident repair rule.

## Repair 1: keep execution controls with their owner

**Problem:** public session controls check Task ownership, but escalation
resolution and `agents.cancel` have alternate direct paths. An ownership
rejection can also fall through to a raw PID kill. These paths can contradict
the Task core even when the normal API is correct.

**Change:** reuse one small internal ownership check across entry points.
Move the reusable check out of `src/app/command-router.ts` into the execution
adapter boundary; composition supplies it to the command router, escalation
subscriber and agents tool through their existing dependency objects. Core
must not import the router or tool implementation. This is a shared function,
not a new control service or extensible handler registry.

- For a Task-bound escalation, read trusted session/Task identity and submit
  the resolution through the existing exact Task input route. Revalidate the
  target on handling. A replaced attempt cannot be resumed; closed work keeps
  the evidence without reopening. Missing ownership produces a visible failure.
  Treat this as normal feedback about a changed fact; do not add an
  escalation-specific Task state or automatic retry strategy.
- Preserve supported standalone session controls and cancellation of a caller's
  own bounded helper. Establish helper scope from trusted active ancestry and
  execution binding, never the target agent's name or model-written metadata.
  Parent cleanup remains part of the executor's responsibility.
- Remove the agents tool's raw PID fallback. An unreachable owner returns an
  honest error; normal recovery or an operator handles it. A rejected control
  is never converted into a process signal. Keep exact process cleanup inside
  the execution layer that actually owns the process.
- Report acceptance separately from observed termination. Do not write
  `interrupted` merely because a cancellation message was sent. A missing local
  execution is not proof that a remote execution was cancelled.

**Source:** `src/lib/escalation-lifecycle.ts`, `src/lib/manager-agents-tool.ts`,
`src/app/daemon-events.ts`, `src/app/loader/toolset-loader.ts`, and the existing
public guard. Leave low-level resume available to the actual Task executor.

**Why / cost:** one control contract prevents competing execution and false
success reports. Removing the fallback is simpler than maintaining another
cross-process control mechanism. The accepted cost is occasional operator
recovery for unreachable standalone work. Expected scope: small to medium.

**Proof:** test live/old Task bindings, closed/missing targets, allowed local
helpers, cold standalone resume, foreign-process ownership, rejected/unreachable
socket control, and replay. Rejected cases must perform no resume, signal or
registry mutation. Use recording methods and owned fixture processes.

## Repair 2: use one definition of current execution

**Problem:** `system_status` counts saved running/idle rows as live sessions,
while the canonical execution reader checks current ownership and process
evidence. A failed read can also appear as zero active sessions.

**Change:** inject `readExecutionStatus` into `createSystemStatusTool` through
the loader/composition boundary. Keep session history queries for history;
use the canonical read for current activity. Preserve its distinction between
an agent session and a workflow claim with no agent session. Show an unavailable
read as unavailable in the affected section and structured result. Do not
introduce another cache, heartbeat or polling loop.

**Source:** `src/lib/tools/system-status.ts`,
`src/app/core/reads/execution-status.ts`, `src/app/loader/toolset-loader.ts`.

**Why / cost:** the same work should not be running in one interface and absent
in another. This is a small projection change. Keep reads bounded; if a status
limit is needed, implement it in the owning read contract, with truncation
reported, rather than silently defining activity differently per consumer.

**Proof:** compare the tool and socket read for current sessions, stale rows,
replaced Task attempts, missing process markers, workflow-only claims and database
failure. Replace the test that currently expects an artifact-free saved row to
count as live execution. Historical evidence must remain available as history.

## Repair 3: show outstanding results while work is running

**Problem:** `HumanTaskService.getTask` builds `waitingOn` only for the waiting
phase. A Task eligible to run can still be labelled parked because its last
accepted phase was waiting.

**Change:** project retained outstanding results independently of the current
execution. Show a bounded `waitingOn` list for applicable open Tasks, including
running ones. Use existing eligibility facts consistently in exact reads,
lists and filters. Preserve static `dependsOn` gates, closure and cancellation;
an input or a Condition alone does not establish eligibility. Do not mutate
Task state to repair presentation.

Example: `Running: preparing review. Waiting for: pipeline 42.` After execution
ends, it can say `Waiting for pipeline 42`; if other work is eligible, say
`Queued to continue; pipeline 42 is still outstanding.` No global agent status
or combined lifecycle state is needed.

**Source:** `src/app/human-task-service.ts` and its existing interface consumers.

**Why / cost:** users can distinguish a useful wait from work that should be
moving. Small read/UI change using existing state; keep diagnostic detail
bounded rather than loading every historical dependency.

**Proof:** real Task transitions through running with two waits, queued
continuation, parked wait, static dependency gate, new input, result settlement,
closure and cancellation. Exact detail, list filtering and UI must agree.
Answering one input must not hide or fulfill another outstanding result.

## Repair 4: make Scout's periodic check recover missed publication

**Problem:** Scout writes its private credential observation before returning
the event to the Host. If publication fails, the next unchanged unavailable
observation is suppressed. The periodic safety net then has nothing to deliver.

**Change:** use the Host observer's existing `previousObservation` and
`{ events, nextObservation }` contract. Remove the duplicate file cache and
probe marker from `projects/scout-knowledge-lib.app/watchers/xhs-credential.ts`.
The Host already checks the observer generation and advances discovery memory
after publication. Keep the source's current bounded subprocess inspection.

Do not migrate the old cache into a new durable service. A fresh scan after
restart may publish the same state again; accept that small cost. Keep domain
facts, credentials and login state untouched. Preserve current ready-state
publication behavior unless a separate consumer-backed change justifies it.

**Why / cost:** restores delivery after a demonstrated failure while deleting
duplicate state. Small App change; no Host schema, new daemon or browser retry
framework. A repeated observation is cheaper than exact observation resumption.

**Proof:** fail publication, scan the same unavailable state again, and verify
the exact Task route can still receive it. Also test successful advancement,
fresh-runtime repetition, ready transitions and an old scan settling after reload.
An unresponsive inspector must remain bounded; do not start repeated replacement
scans while the same generation's previous scan is still alive.

## Watchdog follow-up: separate limits from judgment

This section records the staged policy used by the first candidate. The
[consolidation proposal](execution-entrypoint-consolidation.md) now owns completing
it across supported entries. The manager's retained category is not simply
“unbounded”: its exemption requires both a Task binding and a finite admitted
timeout, so some bounded standalone calls still receive the silence watchdog.

Silence and repeated tool errors are observations for judgment. Explicit provider
deadlines and daemon liveness have mechanical handling. Automatically cancelling
or nudging quiet work mixes those responsibilities; activity forwarding alone
does not remove that mismatch.

**Proposed policy:** an explicit finite execution budget remains enforceable.
Within that budget, silence or an error count is evidence for the owner; it is
not independently permission to kill, steer, or declare failure. The agent
does not manage timeout counters. When the attempt ends, the worker/assigning
owner uses the saved facts to decide the next action under existing authority.
Review during an awaited helper remains deferred.

Apply this first to the bounded Task execution paths. Before removing a
silence-triggered action, prove an effective end-to-end deadline and working
cancellation/cleanup at that entry point. Use existing trusted execution
configuration, including provider limits and inherited parent bounds; a tool
retry or activity event must not renew the whole attempt's allowance.

In those verified paths, retain bounded evidence but remove silence-only
cancellation/nudges. Inventory the daemon's error-only-turn detector separately:
current Task worker relay does not normally deliver its `turn_end` inputs.
Do not add that relay just to unify heuristics. Keep schema-valid finish recovery
and deterministic provider/protocol repair; they do not choose a new goal.

**Source:** `src/lib/manager.ts`, `src/lib/session-subscribers.ts`,
`src/app/adapters/executors/codex/codex-goal-executor.ts`,
`src/lib/workflow-finish-recovery.ts`. Installation liveness in
`src/app/modes/maintenance.ts` keeps its bounded process-recovery policy.

**Why / cost:** quiet valid work can finish; a dead or wasteful operation still
has a finite execution allowance. We accept that it may use more of that allowance
before the owner reviews it. No extra model loop, timer service or universal
watchdog is needed. Medium behavior-change cost; measure quiet-work completion,
deadline cleanup and wasted runtime before promotion.

**Proof / stop rule:** quiet useful work succeeds within its budget; a hung
process reaches the explicit deadline; active output cannot extend that deadline;
cancellation still stops the exact execution and retains partial evidence.
The owner receives an honest interruption through the existing Task result and
caller-feedback path, not a second watchdog inbox. If a legacy entry point lacks
a proven bound, leave its current protection in place and label the remaining
gap. Do not disable limits globally or claim full policy alignment prematurely.
Each retained entry must now have a named migration or retirement step in the
consolidation work; a permanent legacy exception is not the target contract.

## One small experiment for simpler async work

Two missing capabilities should be tested together only where one real workflow
benefits: the capability supplies wait mechanics, and the parent can continue
useful work after submitting a dependency. They do not require a universal
async tool API.

1. Use Scout's existing credential wait as the first supported-source example.
   Its App/tool adapter supplies the known credential identity, event mapping
   and review defaults. The agent chooses whether that result is needed and
   what other source work can proceed. Keep the internal Condition schema;
   the model should not invent or register its mechanics. Put the mapping in
   Scout's capability; add no credential-specific branch to core.
2. Use one exact typed Task dependency plus an independent parent preparation
   step to test continuation. Prefer the existing attempt boundary: accept the
   dependency once, retain progress and the unanswered input, release the attempt,
   and make the same parent Task eligible in its normal queue. The next attempt
   may run before the child completes. Ordinary waits remain asleep.
3. Keep this continuation distinct from success and failure. It must neither
   fulfill the input nor increase failure backoff. It is not a new Task phase
   and must not reset any applicable overall budget. Select the smallest result
   contract during the PoC; do not expose a mandatory operation taxonomy.
4. Prove early feedback, a missed notification, restart, repeated submission,
   child failure, new human input and owner Stop. One parent attempt owns
   execution at a time. Saved evidence allows affordable redo without duplicating
   external effects. Stop does not silently cancel independently owned children.
   For an operation that creates external work, include the crash window after
   provider acceptance but before saving its reference. Use the provider's
   supported recovery/idempotency convention or report an unresolved outcome;
   never treat that uncertainty as permission to launch a duplicate.

The candidate implementation belongs at the existing SDK/result admission,
`src/app/core/tasks/attempt-runner.ts`, dependency admission and App capability boundaries.
The [earlier continuation sketch](execution-feedback-and-review.md#delegation-and-useful-parent-work)
records the constraints. Use a fixture external source first; later run one
bounded model-backed example when implementation is ready.

**Value / cost / stop rule:** better useful concurrency and less agent bookkeeping,
at medium cost because acceptance and restart semantics change. Promote only if
the example becomes clearer and still uses existing records and scheduling.
If it requires a second job registry, fake self-events, short polling timers or
per-operation agent registration, reduce the requirement and reconsider the
approach. An extra bounded attempt or some repeated reads are acceptable costs.

After the example passes, inventory `agents.fork` callers. Move only durable
assignments whose replacement preserves useful concurrency, result return and
control. Remove legacy job/resume paths only after their last supported caller
moves. Keep useful direct calls and provider-owned operations. The agent need
not understand those internal implementation differences. The
[consolidation proposal](execution-entrypoint-consolidation.md#implementation-order-and-review-boundaries)
now specifies the consumer inventory, scoped-helper preservation and deletion gates.

## Remaining findings and explicit deferrals

| Finding | Treatment and reason |
| --- | --- |
| Name-based privileges | Follow the existing [App-policy cleanup](app-policy-and-host-boundary-cleanup.md). Replace actual privileges with narrow trusted installation/tool scope, one consumer at a time, with allow/deny tests. Keep protection until replacement works; no new permission framework. |
| Hung observers beyond Scout | Bound I/O in each affected adapter and expose failure. A generic promise timeout cannot stop abandoned work. Add a common cancellation primitive only when a real consumer requires it. |
| Missing owner/supervisor | Retain original identity and failure evidence; use existing operator handling. If unattended use proves the need, add one installation-selected problem-report route, then human attention. No recursive handler selection or automatic ownership transfer. |
| Legacy project mutation, provider Event catalogs and May labels | Inventory callers, move domain decisions into their owning App, and delete unused paths. Cosmetic renaming or folder moves are not prerequisites for the repairs. |
| Global deep review or concurrent helper review | Defer. These add model cost and execution coordination without being necessary to repair the demonstrated defects. |

Every component in the audit either keeps its existing responsibility, receives
a focused repair, or has an explicit deferred treatment here. A reviewed gap is
not an obligation to build every possible capability now.

## Delivery, validation and review decision

Prepare separate PRs for controls, shared execution status, Task wait presentation,
and Scout observation memory. These four repairs need no Host data migration. Scout
stops using its disposable cache and relearns from the source. Run the owning
regressions and the repository's required CI on each final revision; no repeated
full-suite runs are needed merely to edit this proposal.

Exercise the corner cases at their existing owners. Extend admission, dependency,
Condition, observer and control tests rather than copying recovery logic into a
new test harness per symptom. Each repair needs proof that its exceptional path
now reaches the same accepted process, and that the bypass is removed. One
representative integration scenario can combine normal and lost-event delivery;
do not build an exhaustive cross-product of providers and failure timings.

Then evaluate the bounded watchdog change and async-work PoC separately. Update
their owning guidance and remove superseded branches/tests with each promoted
change. Each PR should explain the concrete trigger, changed result, acceptance
evidence and any lost capability, with a focused diff.

For a subsequent local rollout, use a verified idle point and retain the prior
artifact/state backup. Exercise only the selected May/Scout paths and preserve
other Apps' disabled state. Verify actual useful results, no duplicate execution,
honest status and feedback recovery. Record command latency, write/model-call
overhead and intervention needs using existing evidence. A passing source test
is not a claim of live reliability. Roll back a faulty artifact; do not restore
an old database over newer accepted work as a routine rollback.

**Recommended review decision:** proceed with the four focused repairs. Keep
watchdog policy and async continuation as bounded follow-ups with the acceptance
gates above. Do not make automatic supervision, perfect recovery or broad
legacy cleanup prerequisites for these useful improvements.
