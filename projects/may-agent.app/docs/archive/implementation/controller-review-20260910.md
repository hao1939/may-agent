# Controller implementation review — September 10, 2026

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Historical snapshot of the proposal and its slice-specific proof.
Test counts describe the named revisions, not a current release.
Use the [active controller proposal](../reviews/task-controller-pattern.md)
for remaining work and the [Task engine](../../2a-design/task-resource-engine.md)
for accepted behavior.

# Task controller pattern: one commitment, one lifecycle

**Design status:** Controller/lifecycle direction approved; this proposal defines
the implementation slices and their acceptance evidence.
**Implementation status:** May already uses SQLite Task resources, App input
mapping and level-based reconciliation. PR #105 hardened the controller's
failure boundary and clarified core/adapter ownership. Shared settlement merged
as `edf9112d` in PR #106; durable retries merged as `dd876fc3` in PR #107.
Atomic request attachment followed in PR #108; exhausted-Task request readiness
merged in PR #109. Historical candidate evidence below is not the validation
result for combined main. The existing parent-owner route has the bounded proof
below; the narrow non-success stop has a candidate described below. App policy
and live follow-through remain open. No deployment is claimed.
Authoring examples use the existing SDK, not a new schema.
**Date:** 2026-09-10.
**Source baseline:** Host `4afaaafb` (through PR #109).
The [September 10 core review](../reviews/core-simplicity-review-20260910.md)
used the earlier `d9e7597e` baseline. Neither identifies a deployed release.

## Recommendation and expected value

Use the existing controller to bring each Task toward its declared outcome by
repeatedly inspecting current state and performing useful bounded work.
Recovery restores the conditions for that ordinary path to run. Apps judge
whether to repair their approach, revise scope, wait, or stop. Minimal authoring
and reconciliation are one solution: the same admitted commitment must remain
understandable and actionable from the initial request to its actual outcome.

> Persist intent and useful evidence. Wake by Task identity. Observe current
> facts. Perform bounded useful work. Record the result. Repeat when justified.

This should simplify reasoning about interruption and reduce the chance that
recovery applies different acceptance rules. A large reduction in total code
is not yet demonstrated: the basic controller, queue, store and timers already
exist. The opportunity is to remove repeated decisions and unnecessary recovery
shortcuts, rather than introduce a controller framework.

| Expected benefit | Assessment |
| --- | --- |
| More reliable cleanup and retry when reporting also fails | Implemented in merged PR #105; retain regression coverage |
| Fewer differences between normal and recovered completion | Merged PR #106 shares settlement and publication decisions; retain normal/startup/busy-recovery coverage |
| Less recovery reconstruction | Likely where affordable redo can replace special handling; assess each case |
| Major reduction in runtime size or maintenance cost | Unproven until a candidate removes actual paths without relocating the same complexity |
| Lower execution cost | Not guaranteed; simpler restart may repeat computation, while bounded retries can prevent waste |

Apply the [value/cost rules](../../1-principles/design-philosophy.md#how-to-decide-a-tradeoff).
For this frequently used core, compare long-term maintenance and failure cost
with recurring redo cost. Do not pay for precise resumption of cheap work.

## Start with the common Task spec

Use the [20/80 rule](../../1-principles/core-principles.md#solidify-the-common-20-teach-the-remaining-80):
make the common contract dependable and let Apps and agents handle varied work.
Start by specifying the outcome and what counts as enough. The minimal
authoring view can be this small:

```yaml
outcome: Fix the login failure
acceptance:
  - Login succeeds and the regression test passes
```

This illustrates the meaning an App supplies, not a new file format or a complete
current SDK `TaskIntent`. The caller can express it in ordinary language; the
App's existing input mapping produces the Task. For a repeatable task type, its
acceptance criteria can come from the App convention rather than being written
again for every request. Resolve and persist those criteria at admission, so a
later convention change cannot silently redefine an existing commitment.
Keep applicable acceptance visible with the Task. Material ambiguity about the
outcome or authorized scope belongs in the App's conversation, not invented
Host defaults.

| Information | Where it comes from |
| --- | --- |
| `outcome`, `acceptance` | The request and responsible App; these explain the commitment |
| `input`, when needed | Existing validated App data or references; add structured fields only when a consumer needs them |
| Stable Task identity, App binding and parent | Host retains the admitted input identity; the responsible App mapping selects the fitting existing Task or a stable new identity and existing parent/group |
| Mode and selected agent | Ordinary finite outcome: `achieve`; agent selection follows Task, ancestor/group, then App fallback |
| Status, versions, attempts, leases and waits | Runtime-owned state and admitted results; not caller-authored Task configuration |

Keep workflow/executor selection, dependencies, priority and maintenance mode as
supported options for work that needs them. They do not belong in the smallest
example and do not need new defaults machinery. Retry graphs, checkpoint policy,
error taxonomies, per-Task tuning knobs and a general extension bag are not
additions to this basic spec. Do not encode every unusual incident as a field.
Existing output or capability constraints still apply when the operation needs
them; omitting them from this example does not broaden authorization.
Keep necessary permissions, constraints and evidence references in existing
App input/context. Do not require a generic constraints bag. `achieve` describes
a finite outcome, not a single attempt. Both finite and maintained Tasks use
bounded attempts; neither requires an always-running session.

The core validates shape, identity and state transitions. The App's checks or
agent judge whether the outcome satisfies its acceptance criteria. Natural
language acceptance does not require a new core rules engine. A small repair
can stay inside an attempt; a changed commitment must be recorded through the
normal authorized Task update.

At the reviewed SDK revision, `TaskIntent` still requires `id`, `parentId`,
`outcome`, `acceptance` and `mode`. Existing App mappings can supply these today.
Keep that stored contract for the initial controller work; this example does
not make its fields optional or introduce another Task schema. Reducing actual
SDK requirements would be a separately reviewed change with its callers.
Shorter authoring alone does not prove the runtime became simpler.

## The whole lifecycle and its boundaries

The user needs one clear answer to: what did we commit to, what changed, and
what will happen next? The Task owns that answer; admission, execution and
recovery must not create competing work records or completion policies.

| Stage | Stable Host responsibility | App or replaceable capability responsibility |
| --- | --- | --- |
| Understand and admit | Validate and persist the input and mapped Task before acknowledging durable work; preserve caller correlation | Clarify material ambiguity, choose the outcome/acceptance and resolve the exact Task through existing mapping |
| Observe and choose work | Coalesce identity wakes; read current spec, pending inputs, Conditions and attempt authority | Supply policy and context for one useful attempt |
| Execute | Claim, bound and isolate an attempt; contain failure and release capacity | Agent, workflow or executor performs authorized work; provider adapter observes external effects |
| Accept and continue | Fence stale results and atomically apply normal completion, progress, revision or wait transitions | Judge acceptance using the declared checks; report truthful results and any necessary next action |
| Wait and recover | Keep exact Conditions and due/event coverage; restore eligibility for the same Task | Decide whether a changed prerequisite enables progress or calls for a different approach |
| Require a decision | Preserve a concrete reason and expose it through existing Task reads and declared owner/parent routes | Repair, deliberately retry, revise the commitment, or obtain authority to stop |
| Finish | Preserve the accepted result and caller/dependency correlation; keep passive wakes quiet | Explain what was delivered, any limitation, and whether the promised outcome was actually met |

These stages are responsibilities, not new states or public events. SQLite Task
state is authoritative. The controller owns scheduling, the existing reconciler
implements transitions, and executors own bounded work. The proposed
[state service](../../proposals/storage-state-service.md) consolidates transition enforcement;
it does not add a second authority
alongside the reconciler. Composition wires capabilities; replacing an executor
must not change Task settlement rules.

A completion report from an attempt is not necessarily completion of the Task.
New admitted input or an authorized self-revision can leave it runnable after
the result is recorded. Normal and recovered paths must report the disposition
returned by the same committed transition, and wake dependents consistently.
Never announce dependency completion just because a saved session says done.

No proxy Task, controller per phase, new defaulting service, generic event
router or public controller API is needed. Separate bounded startup preparation
and ordinary dispatch may remain; they share rules, not necessarily one entry
point or an identical execution stack.

## Storage boundary

SQLite remains the authority for spec, status and related work records. The
separate [storage proposal](../../proposals/storage-state-service.md) owns the state-service
interface, transaction boundaries, code layout and extraction plan. Controllers
use those operations to read, claim and settle work; they continue to own
scheduling and execution coordination. A storage extraction is not a prerequisite
for the controller fixes below.

Keep `generation`, `resourceVersion` and `observedGeneration` as internal
coordination metadata with their existing meanings. Observing a generation does
not prove it completed, and newer input may require work without a spec change.
The controller also inspects execution and dependency evidence.

The [Task resource contract](../../2a-design/task-resource-engine.md#resource-authority)
and [storage contract](../../2a-design/storage.md) remain authoritative. An editable
JSON/YAML state copy, file watcher, new generic write endpoint, or export/import
feature is unnecessary for the first version. Existing seed files remain
bootstrap input. Apps can supply a small spec through the paths already present.

## What we take from Kubernetes

Kubernetes controllers compare desired state with current facts. Notifications
enqueue resource identities; reconciliation rereads state. This lets the same
logic respond to new intent, missed notifications and interrupted earlier work.

For finite May Tasks, Kubernetes Jobs are the closer analogy: work has a
completion condition and can exhaust its retry or time allowance. Maintaining
a service indefinitely is a different App purpose, not the default for every
Task. Controller retries and expensive workload retries need different bounds.

Borrow the pattern using May's existing components. A Kubernetes dependency,
resource-generic controller base class, new work queue, or public recovery API
is not part of this proposal. Existing exact Conditions remain the wait model.

## One ordinary path

```text
Durable input / relevant event ----+
Startup / due recovery scan -------+--> Queue App + Task identity
                                            |
                                  Read current state/evidence
                                            |
                                  Settle interrupted execution
                                  through state operations
                                            |
                         +------------------+------------------+
                         |                                     |
                   Nothing eligible                      Eligible work
                         |                                     |
                Retain completion,                  Claim and run one
                wait or attention                   bounded attempt
                                                               |
                                                    Work -> check -> repair
                                                    within that attempt
                                                               |
                                                    Return result; run
                                                    declared App verifier
                                                               |
                                                    State service checks
                                                    and commits outcome
                                                               |
                                                    Done / progress /
                                                    wait / attention

Relevant change or permitted retry -> enqueue the same identity again
```

This is a responsibility flow, not a new process arrangement. Preserve the
existing worker isolation, capacity limits and startup ordering. Startup may
need bounded preparation before dispatch opens; it can call the same internal
transition logic without waiting on the gate it is responsible for opening.

Reconciliation is safe repetition with convergence, not a promise that an LLM
returns identical text. A pass may make several useful local steps within its
bound. It need not create another Task or wake for every tool call.

### Two loops, one Task

The **inner loop** belongs to the workflow or agent: do work, check evidence,
repair when useful, and check again within the same bounded attempt. The
**outer loop** belongs to the Task runtime: commit the disposition, release
execution resources, and start a later attempt when justified by current state.
An attempt can contain multiple repair iterations; each iteration is not another
Task, claim or controller retry.

Prefer local repair while scope, prerequisites, time and cost permit useful
progress. End the attempt when it needs an external wait or owner decision,
exhausts its bound, or loses authority. Code performs deterministic checks; the
App/LLM judges uncertain repair choices and whether further effort is worthwhile.

The [workflow contract](../../2a-design/execution-contributions.md#repair-within-an-attempt)
owns this convention. Current workflows can loop inside `execute()`. The Host's
optional final verifier runs after that function returns and records rejection
as blocked; it does not resume the finished workflow automatically. Reuse App
check helpers for local repair and final verification where appropriate, while
retaining Host authority and atomic acceptance checks. No new loop protocol is
introduced by this clarification.

### Conventions

1. **Wake by identity; preserve input separately.** Coalesce queue hints, but
   retain distinct admitted requests, feedback and unaccepted events. A missed
   hint is recoverable from durable state. A missing user message is not.
2. **Reread before deciding.** Preserve accepted progress, still-valid waits,
   current scope and newer input. Recheck authority at commit; a prior read or
   an old attempt's success is insufficient authority to accept a result.
3. **Keep satisfied work quiet.** Passive wakes do not rerun completed work,
   revive cancelled work, or invoke an LLM for an unchanged blocker. Relevant
   new input and authorized revisions retain their existing behavior.
4. **Repair only owned mechanics in core.** Retire a demonstrably interrupted
   attempt and repair lost scheduling. Keep the existing generation, attempt,
   lease and live-worker checks; a timestamp alone does not authorize replacing
   an execution or repeating its external effects.
5. **Use the existing acceptance path.** Preserve the App's declared verifier,
   structured result, actions, workspace handling and pending-input checks.
   Reuse saved output only when those checks can still be applied simply.
   Otherwise redo safe, affordable work or expose why it cannot proceed.
6. **Always contain execution failure.** Synchronous throws and rejected
   Promises reach the same cleanup. Reporting failure cannot skip that cleanup
   or the selected retry. Required durable input admission remains required;
   this rule does not make all event persistence optional.

## Retry, repair, wait, or stop

Idempotency answers whether repeating is safe. It does not establish that
another attempt is useful or affordable. These are responses to different
conditions, not a ladder every failure must climb.

| Current facts | Core response | App responsibility |
| --- | --- | --- |
| Previous execution is interrupted | Retain evidence, release only that execution's ownership, and make the same Task eligible | Continue from current facts when repetition is safe |
| Known temporary mechanical failure | Delayed retry within its allowance; release execution capacity while waiting | Reconsider when the allowance is exhausted |
| Expected external progress is pending | Retain exact wait and its event/deadline coverage | Decide whether the wait remains relevant when facts change |
| Executor unavailable, invalid result, or unchanged prerequisite failure | Preserve the reason in existing `attention`; avoid unchanged execution loops | Repair configuration, approach or prerequisite, then request reconsideration |
| Requirement cannot be met at acceptable cost | Keep truthful status and enforce authorized transitions | Revise scope, choose another approach, or stop honestly |
| External action may have happened but its result is unknown | Preserve the uncertainty and prevent blind repetition where harmful | Inspect the provider or obtain a decision through existing capabilities |

Stopping automatic retry does not abandon the outcome. `attention` retains the
obligation for its owning App or parent; it need not always require a human.
Persistence alone is not proof of follow-through. For the failure being handled,
trace the existing declared owner/parent route: who receives the reason, which
current facts they can read, and how an authorized action wakes this same Task.
Reuse that route; do not invent a fallback recipient for arbitrary diagnostics.
If it is missing or no authorized decision maker is available, report the gap
with a concrete next action instead of claiming automatic resolution. Do not
rerun unchanged failing work merely to obtain an owner decision.
Dropping work is an explicit owner decision. It must not be recorded as having
achieved the original outcome. No new outcome type or owner-decision API is
introduced by this proposal; broader owner-decision work stays in the
[core proposal](core-separation-review-20260910.md#next-review-simpler-completion-after-interruption).

An App can make a small understood repair during its current bounded attempt
and continue. Longer repairs can use existing Tasks and dependencies where they
represent separate owned work. Every exception does not deserve a repair Task.

### Bound expensive repetition across recovery

The controller currently has an in-memory failure counter and a three-retry
default in runtime composition. That limits a local error chain; it does not
by itself establish a durable execution budget across process restarts and
other wake sources. A [component probe](../reviews/core-simplicity-review-20260910.md#4-the-controller-retry-limit-does-not-stop-recovery-from-starting-more-attempts)
reproduced a fifth attempt after exhaustion and another four in a new process
against the same SQLite Task. It uses real claim/release transitions with a
synthetic failure; the full daemon/executor regression remains necessary.

Proposed rule: unchanged failed work must not obtain another expensive attempt
merely because the process restarted or a safety scan ran. Check the allowance
against the same Task and applicable generation using existing durable attempt
evidence where sufficient. A deliberate retry or meaningful accepted change can
authorize more work; duplicate ticks and diagnostic messages cannot.

Implementation rule for the retry-fix slice:

- Allow the initial execution and three automatic retries for consecutive
  execution failures. This is not a limit on successful attempts toward a
  long-running outcome.
- Record a failed execution and increment one Host-private counter on the
  existing Task in the same fenced transaction. At four failures, retain the
  Task in attention with its input and failure evidence; notify its existing
  parent/dependency path. Do not create another Task or claim completion.
- Check this counter at shared attempt admission, irrespective of wake source.
  Recovery/restart, stale-result release, no-op checks and new event IDs neither
  clear it nor authorize extra execution. Preserve pending input while stopped.
- Accepted completion/progress/wait resets the consecutive-failure count. A new
  execution generation or the existing explicit retry/unblock operation also
  reopens execution. The Host does not infer a repair from arbitrary event text;
  the App/operator uses those existing controls after judging new evidence.
- Missing handlers, invalid contracts and actual stale-result fencing keep their
  existing handling; they are not automatically retried execution failures.

The current Task-context read contains only the latest 16 attempts, and an
explicit retry does not always have a stored control receipt. Neither supplies
a reliable long-running reset boundary without another query/index or history
protocol. One optional counter in existing Task status is the smaller durable
addition; no new table, SDK setting, retry service or budget lifecycle is needed.
Existing attempt history remains diagnostic evidence. This bounds recorded
execution failures, not unrecorded external effects or arbitrary process crashes.
Existing rows without the counter begin at zero; do not reinterpret ambiguous
historical stale-result interruptions as execution failures. No data rewrite.
Keep existing controller backoff. Cheap checks of Host availability may continue
while expensive App execution remains stopped.

## Interruption and external effects

Safe Task transactions do not guarantee exactly-once actions in external systems.
An attempt can create a PR and crash before recording its identity. The next
attempt should find the existing PR through the App's operation correlation or
provider idempotency support before creating another.

Prefer observations and existing identifiers. If the effect cannot be identified
and repetition could be costly, retain attention rather than guess. Safe,
cheap computation can be repeated. The core cannot make an arbitrary executor
idempotent by wrapping it in a reconcile function.

For a workflow interrupted before verification, keep PR #104's straightforward
behavior: re-enter normal execution and verification. Preserve valid work already
available to that path. Do not reconstruct a missing execution stack merely to
avoid affordable redo. Keep the existing direct-agent result reuse until a
specific simplification proves its value; blanket deletion could increase cost.

## How the code should be organized

Keep current files for the first slices. Make responsibilities clear through
local functions and imports; move a module only when its responsibility is
already coherent. There is one controller policy even if startup and ordinary
dispatch have separate entry points.

| Existing code | Responsibility and proposed action |
| --- | --- |
| `core/tasks/controller.ts`, `core/tasks/queue.ts` and Host capacity | Deduplicate, dispatch, delay retry and release capacity. PR #105 fixed the demonstrated exception boundary. No App diagnosis or acceptance policy here. |
| `app-task-recovery.ts` | Find eligible Task identities and enqueue them through existing timing. Keep the small scheduler; its row limit is not a constant-time query guarantee. |
| `app-task-runtime.ts`: `reconcileTask` and `recoverInterruptedAppTasks` | Coordinate observation, execution and outcome publication. Consolidate repeated recovered-result handling and interruption decisions where the inputs and rules match. |
| `app-task-runtime.ts`: `consumePersistedTerminalAgentResult` | Already shares supported recovered-result normalization and admission. Preserve that reuse; do not claim two entirely independent validators exist. |
| `app-task-reconciler.ts` and `app-task-resource-store.ts` | Own Task transitions and transactional authority checks. Share eligible transitions without weakening distinct lease, generation or cancellation conditions. |
| `core/tasks/startup-recovery.ts`, `core/tasks/handler-recovery.ts` | Preserve Task ownership of sessions and bounded checks for restored capabilities. These small helpers are not automatically redundant. |
| Executor adapters and App workflows | Observe provider results, perform bounded work and apply domain judgment. They do not gain their own Task queue or recovery lifecycle. |

The [normal reconciliation path][normal] and [startup recovery path][startup]
both inspect terminal sessions, invoke the [shared consumer][consumer], publish
the recovered disposition and arrange dependent wakes. This is a concrete
consolidation candidate. Start with the repeated post-acceptance handling or an
internal per-Task settlement function; retain distinct startup ownership checks.
Do not add a generic callback pipeline just to share a few statements.

Other repairs cover missing attempts, dependency admission and historical
recovery states. Remove one only after showing its behavior is covered by the
ordinary path and accounting for retained data. A list of recovery helpers is
not evidence that all of them can be deleted.

## Apply in small slices; judge the whole solution

1. **Refine the proposal first.** Record the minimal authoring view, full
   lifecycle, owner boundaries and proof below before modifying source. Keep
   implemented behavior separate from target guarantees.
2. **Controller containment — merged in PR #105.** Synchronous throws and
   failed reporting no longer bypass cleanup or the selected bounded retry.
   Reuse those tests instead of implementing another controller.
3. **One settlement policy — merged in PR #106.** Reproduce any normal
   versus recovered disposition mismatch, then consolidate terminal-result
   settlement shared by startup and ordinary dispatch. Preserve supported
   direct-agent reuse, workflow verification, pending input and live-claim
   fences. Remove duplicate publication decisions, not the necessary separate
   eligibility and startup checks. No process or SDK redesign is needed.
4. **Exercise the complete commitment.** Use existing App mapping for a short
   request and extend runtime tests through wait, interruption, revision and
   checked completion. Trace a failure to its actual decision route. Reuse
   existing boundary tests when they already supply the evidence; a single huge
   test is not required. State any remaining gap rather than declaring the
   whole solution implemented from a settlement-only PR.
5. **Durable execution bound — merged in PR #107.** Extend the component
   reproduction to the full runtime, including current durable handler-failure
   accounting. Only add a fix for an actual bypass. Distinguish controller
   exceptions, executed handler failures and unavailable prerequisites. Keep
   any new allowance or owner-decision behavior independently reviewable.
6. **Reassess before broadening.** Measure removed decision paths, redo/provider
   cost and repeated-failure behavior. Stop if further work mostly moves code or
   adds abstraction. Treat recovery query optimization as a separate measured
   concern, not a prerequisite for this pattern.

The authoring and settlement slices need no new state schema. Any later schema
change must justify its cost and explain retained-state behavior. On implementation,
update the relevant paragraphs in
[Task Resource Engine](../../2a-design/task-resource-engine.md),
[Runtime](../../2a-design/runtime.md) and
[Operations and Recovery](../../2b-manual/app-operations-recovery.md), including the
ambiguous "recovery ladder" wording. Clarifying the responsibility is not proof
that every retry or owner-decision path already satisfies it.
Archive completed slice evidence rather than retaining another permanent backlog.

### Settlement candidate and remaining work

Historical candidate evidence follows. Review fixes subsequently merged in
PR #106; this section's test counts apply only to the named candidate.

Host [PR #106](https://github.com/hao1939/may-agent/pull/106), candidate
`4a9f5807` on `refactor/task-controller-lifecycle`, applies slice 3. Before the
fix, six runtime cases failed: both startup and busy-dispatch recovery reported
continued/revised Tasks as converged and omitted dependency updates for waits.
Normal execution passed those same cases.

The candidate shares completion disposition and dependency publication with
normal execution, and shares recovered-result settlement between startup and
busy dispatch. It also carries through superseded-session cleanup and replays
already-persisted facts for a recovered wait. Eligibility, generation/attempt
fences, workflow verification and ordinary scheduling remain unchanged. No
schema, SDK, dependency, service or event family is added. Runtime source grows
by four lines; the benefit is fewer independent decisions, not a large size cut.

Fifteen new cases cover disposition, revised acceptance, early-fact continuation
and exact superseded-session cleanup. The 23-case recovery group passes. Full
Host `bun run ci` passes: 2,513 tests, three existing deployment-dependent skips,
zero failures. These temporary SQLite/session/provider fixtures are not live
deployment or arbitrary external-side-effect proof.

Existing App-mapping/design examples retain the stored `TaskIntent` contract;
shorter authoring adds no new runtime path. End-to-end owner-decision follow-through
and expensive retry bounds across every wake/restart path remain open. In
particular, the controller's local exception counter and durable
`HandlerExecutionFailed` accounting cover different routes; this patch does not
claim a unified execution budget. Do not mark the whole proposal complete from
this settlement slice.

## Proof that it is simpler and more robust

Use production boundaries with temporary state. Add or extend only the tests
needed by each slice; reuse existing coverage for unaffected behavior.

| Case | Required evidence |
| --- | --- |
| Short request admitted through an App mapping | Complete visible commitment, persisted acceptance and stable Task/caller identity; no new authoring schema |
| Useful work waits for an external fact | Exact Condition and wake/review reason survive; waiting releases attempt capacity |
| Execution and its reporter both fail | Intended retry still occurs, resources release, unrelated queued work runs |
| Callback throws before returning a Promise | Same cleanup and error policy as an asynchronous rejection |
| Duplicate wake or crash after accepted completion | Same accepted result; no additional executor invocation |
| Interruption before result acceptance | Same Task identity and pending input; affordable safe redo reaches normal acceptance |
| Workflow output survives but verification did not | Completion remains unaccepted until the declared checks pass |
| PR created before local result was recorded | Existing provider identity is reused, or ambiguity stays visible |
| New input, cancellation or replacement arrives during recovery | No stale completion, stolen live claim, lost input or lost still-valid wait |
| Attempt result is accepted but the Task continues | Normal and recovered publication say progress/revised, not completed; dependent wakes match the committed state |
| Dependency changes after restart | Same Task resumes under the current acceptance and passes required checks before completion |
| Persistent failure followed by scans and restart | No renewed expensive retry allowance without a permitted reason |
| Prerequisite repaired or meaningful new input admitted | The same Task can resume; an old blocker is not permanent refusal |
| Work needs an App decision | Existing authorized owner/parent receives enough evidence and can steer the same Task, or the missing route is explicitly reported |

For each candidate, report which special branches disappeared, which state and
dependencies were added, and whether restart behavior or execution cost changed.
Compare with the same scenarios on the baseline. A claim of major simplification
needs actual deletion and fewer independent decisions; passing tests alone
cannot establish it. File-backed restart tests prove persistence properties;
synthetic provider fixtures do not prove arbitrary external actions are safe.

The earlier review ran 172 focused tests on the earlier `d9e7597e` baseline and reproduced
the controller gaps separately. Those results motivate this proposal; they are
not validation of its unimplemented changes. No live PoC, deployment, new metric
service, or App merger is included. Their discussion remains
[paused](../reviews/error-handling-and-conversation-discussion-20260910.md).

### Durable retry candidate

Historical candidate evidence follows. Review fixes subsequently merged in
PR #107; the branches no longer need integration with one another. The combined
main review found a missing test import and a retry-exhaustion/request-readiness
interaction; the focused correction is tracked in the
[storage proposal](../../proposals/storage-state-service.md#retry-exhaustion-follow-up).

Host [PR #107](https://github.com/hao1939/may-agent/pull/107), candidate
`ba119385` on `fix/durable-task-retry`, based on merged PR #105,
applies slice 5 without bundling the unmerged settlement candidate. A regression
through `reconcileLoadedAppTaskOnce` reproduced eight executor invocations from
eight independent wakes. The intended allowance is four.

The candidate uses one optional `executionFailures` field on existing Task
status, shared admission, and the existing retry/unblock operations. It records
real execution failures separately from stale-result releases, suppresses
exhausted recovery hints without deleting input, and uses the existing
attention/parent/dependency path. No SDK fields, new table, timer or service.

Regression coverage includes controller backoff and recovery scans, independent
wakes, a separate process reopening the same SQLite database after exhaustion,
explicit retry with retained input, repeated stale releases beyond the 16-attempt
context window, late failures after revision/cancellation, parent unblock,
new input during failure, accepted waits, and 20 useful maintained checkpoints.
Final local `bun run ci`: 2,506 passed, three existing deployment-dependent
skips, zero failures; the test phase took 83.9 seconds. The design check also
passed with zero errors and six existing workspace-layout warnings. This is
source-fixture proof, not a live deployment or universal crash-budget guarantee.
PRs #106 and #107 are independently reviewable against the current baseline,
but overlap in source edits: whichever merges second needs a rebase and renewed
validation. No merge or deployment has been performed.

## Existing parent-owner proof

The next slice uses existing capability, trigger and context rather than adding
a recovery supervisor. Host [PR #110](https://github.com/hao1939/may-agent/pull/110),
candidate `f830901d` on `test/parent-owner-decision`, is based on merged Host
`4afaaafb` and adds runtime coverage and navigation guidance only. No production
behavior change was needed for this route.

Two temporary SQLite/runtime cases exercise a human request mapped to an
aggregate parent, a parent-created child that fails four times, and the parent's
decision using its delivered child facts and failure Event. The App fixture
repairs its prerequisite and returns the existing `unblock-task` action. The
same child and generation finish; the parent separately accepts the aggregate
result before the caller receives success. One shared execution slot suffices
because the waiting parent releases it.

The restart case drops in-memory wake hints, closes and reopens SQLite, and
installs a new runtime/EventBus before owner review. Repeated attempts to run
the exhausted child neither execute it nor add duplicate parent triggers.
This is not a process-kill test, model judgment proof, or live deployment.

At `f830901d`, local `bun run ci` passed: 2,562 tests, three existing
installation-dependent skips, zero failures, including the browser fixture.
The two focused cases passed 52 assertions. The workspace design check passed
with zero errors and six pre-existing layout warnings. GitHub Quality and
Container also [passed on that revision](https://github.com/hao1939/may-agent/actions/runs/34438290694).
Independent review and deployment remain separate; neither is claimed here.

Authoring is part of the contract: use a real executable parent for aggregate
review and `waiting` for its live children. A structural group is display only;
`dependsOn` is an execution prerequisite, not a supervision relationship. Do
not put the children the parent must review in its own `dependsOn` list.
No default reviewer is invented when none was declared. App policy and a
truthful non-success stop remain separate from this verified retry route.

## Candidate: stop without claiming success

Host [PR #111](https://github.com/hao1939/may-agent/pull/111), candidate `fc74eb46`
on `feat/app-task-stop`, includes #110's reviewed proof atop `4afaaafb` and implements the
[finite-leaf stop slice](../../proposals/task-runtime-organization.md#first-stop-slice-the-current-finite-task-only).
An App-authorized handler may return `stopped` with a reason and evidence.
The existing cancellation transaction retains partial findings, ends execution
and readies the caller and executable parent without a success receipt. Normal
execution and recovered direct-agent output share the operation; workflow
recovery retains its normal continuation boundary.

No new persisted phase, lifecycle table, queue, owner agent or permission
framework is added. Maintained obligations, parents with live children and
reopening remain unsupported. A parent whose children are all terminal may
judge its own outcome or stop; cancelled children never count as successes.
App policy still decides whether stopping is authorized. This is candidate
source and isolated fixture evidence, not a
claim that current main or any deployed App already uses it.

## Review decision

Apply authoring and the controller pattern as one lifecycle, not competing
proposals. Keep the authored view to outcome, acceptance and necessary context;
use existing App mappings to form the stored Task. The failure-boundary slice
and shared settlement/retry slices are merged.
Continue the complete commitment proof. Leave unproven owner-decision guarantees
open until their runtime evidence exists. Expect clearer responsibilities and
fewer inconsistent decisions; do not promise a smaller runtime from file moves
or a generic controller framework.

## Sources

- [Kubernetes controller pattern](https://kubernetes.io/docs/concepts/architecture/controller/).
- [controller-runtime reconciliation contract](https://github.com/kubernetes-sigs/controller-runtime/blob/main/pkg/reconcile/reconcile.go): identity-based requests, level-based reads and error backoff.
- [Kubernetes Job failure policy](https://kubernetes.io/docs/concepts/workloads/controllers/job/#pod-backoff-failure-policy): finite work, retry limits and duplicate-execution caveat.
- [Core review and reproducible evidence](../reviews/core-simplicity-review-20260910.md).
- [Existing core boundary proposal](../../proposals/task-runtime-organization.md).

[normal]: https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-runtime.ts#L1290
[startup]: https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-runtime.ts#L2962
[consumer]: https://github.com/hao1939/may-agent/blob/350552a4ba9a4278fe30897430619667bb7bb7f3/src/app/app-task-runtime.ts#L409
