# Workload control: architecture review and implementation approach

**Supports:** [Agents, Tasks and workload feedback](agent-task-workload-model.md).
Keep its business rules and implement them through existing Host boundaries.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first)
and [one authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Proposed implementation approach.
**Implementation status:** Incremental source implementation underway. Creator
consumption of published finite assessments is implemented and verified locally.
Scoped feedback, dispatch observations and bounded coordination are in Host
review. Shared credit accounting foundations merged in Host #405. Creation,
claims, authored seeds, managed starts, caller deferrals and authorized root/sponsor
funding changes have isolated integration increments under verification and review.
Protected coordination funding now has a separate integration draft. Shared
execution reservations and complete constraint feedback remain; no production
activation is exposed. No agent
activation or rollout is established by these source checks.

Source reviewed: Host #398 merge `88a98be236baf07bfcf100208cfb0dc1589dfa06`.
The inspected checkout `036f4a4f757eea9f8a4492231e5541f365a8fcf6` has its identical
Git tree `02781aa1cdbc6d052cba4727f2173122a7040c07`. Apps source was
`61f21dd3ba` before this refinement. This is a source review, not another live
audit. The [post-merge adoption check](../archive/reviews/task-result-closure-adoption-20261108.md)
owns the preceding installation evidence and unresolved merge-CI failure.

## Architecture fit

The direction fits the current architecture: agents judge useful commitments,
App definitions supply trusted mapping/policy, and the Host persists and executes
one Task lifecycle. A budget is resource accounting beside that lifecycle.
It is neither a distributed lock nor another work controller.

| Participant | Decision or responsibility | Limit of authority |
| --- | --- | --- |
| Assigned agent | Advance an outcome; judge methods, useful cooperation and workload tradeoffs. | Assignment does not confer creator or funding authority. |
| Recorded creator / trusted App policy | Accept, revise or end the assignment under existing controls. | Closure does not refund spending or prove a running helper exited. |
| Sponsoring agent and authorized funding policy | Fund an independent root and approve its cap within the declared grant. | Funding does not own the result or another agent's execution permissions. |
| Host | Validate provenance, store decisions, enforce limits and return scoped facts. | Load does not establish business need or fulfillment. |
| Installation | Configure grants, trusted coordination eligibility and operational scope. | Ordinary Task input cannot grant itself those privileges. |

Keep App admission for the first implementation. In an App-created root, trusted
installed policy selects the sponsor, normally the App's owner agent; selecting
Bob as executor does not implicitly give the root Bob's grant. A new contribution
inherits its creating Task's account. Executor limits apply to Bob, while spending
uses the original sponsor. Future standalone admission resolves the same binding
from an authorized agent address; it does not need a different ledger.

## Findings that change the implementation

| Current source fact | Consequence for the design |
| --- | --- |
| `app-runtime.ts` constructs a process-local `HostCapacity`; attempt workers construct their own `HostCapacity(1)` in manual runtime mode. | An in-memory object cannot be the shared root/sponsor balance. Use the existing installation SQLite authority across runtimes. Worker-local capacity is not proof of global helper capacity. |
| `controller.ts` can dispatch checks that return busy, waiting or completed without a claim. `claimObservedAppTask()` commits an attempt before workspace preparation. | Charge a Task attempt with the successful durable claim, not queue selection, worker spawn or every reconciliation call. |
| `admitTaskInput()` wraps links and observation in `stateTransaction()`; `observeAppTaskIntent()` is also used directly. | Put creation attribution/accounting in the shared new-resource mutation and join the caller's transaction. Charging only the inbox adapter misses other admissions. |
| `dependency-admission.ts` can create a destination assignment or address an existing Task. | Inherit the caller account only for a new contribution. Existing service Tasks retain their own account; caller links do not transfer sponsorship. |
| Workflow `agents.call`, model agent tools and the primary Task agent reach manager execution through different adapters. Workflow helpers need not have a parent session. | Task binding alone, or the presence of `parentSessionId`, cannot distinguish a primary execution from a chargeable helper. Carry a trusted operation identity into the common execution admission. |
| `HostCapacity`, `AppTaskQueue` and runtime scheduling recognize pending human Conversation work for reserve access. | Coordination needs explicit Host and App eligibility, fairness and pause rules. Setting P0 or naming a Task coordinator is insufficient. |
| Queue timing is in-memory; current Task summaries count execution states, including idle, waiting and attention. | Expose observed ready-wait timing with its scope/restart limits. `updatedAt` is not a ready-since timestamp; open or active Task count is not execution utilization. |
| A result can be read and deliberately retained without a generic persisted consumed marker. | Report bounded disposition-review candidates, not an exact count of unread or unreviewed results. Do not invent a second result-consumption ledger. |

## Existing source boundaries to extend

Paths below are relative to the Host's `src/`, except SDK contracts. They identify
owners, not a requirement to create a module for each row.

| Boundary | Source owners | Proposed change |
| --- | --- | --- |
| Input and new Task persistence | `app/core/state/inbox.ts`, `app/core/tasks/app-task-reconciler.ts`, `app/core/state/app-task-resource-store.ts` | Establish immutable account binding and debit actual creation once in the fenced resource transaction. Preserve replay and input links. |
| Start admission | `app/core/tasks/app-task-reconciler.ts: claimObservedAppTask()`, `attempt-runner.ts`, `app/composition/workers/task-attempt-process.ts` | Atomically claim and charge; return a normal admission constraint when resources are unavailable. |
| Primary and helper execution | `app/adapters/executors/managed-agent.ts`, `lib/workflow-tool.ts`, `lib/manager-agents-tool.ts`, `lib/manager.ts` | Pass trusted operation provenance; exempt only the primary covered by its charged attempt, account separately for each newly started managed helper. |
| Selection and capacity | `app/core/tasks/controller.ts`, `queue.ts`, `app/core/scheduling/host-capacity.ts` | Skip known-ineligible roots/agents, recheck atomically at start, and extend reserve eligibility explicitly. Keep the existing queue and controller. |
| Resource prerequisites | `app/core/tasks/attempt-runner.ts`, `workspace.ts`, `app/adapters/workspaces/git.ts` | Check the operation's own prerequisite and retain shared blocker evidence; do not convert physical shortage into a new business assignment. |
| Settlement and cleanup | `app/core/tasks/attempt-runner.ts`, `attempt-execution.ts`, `startup-recovery.ts`, `lib/session-cleanup.ts` | Keep accepted effects; release execution reservations on confirmed exit/drain, not closure or lease expiry alone. |
| Feedback read and context | `app/core/reads/app-read.ts`, `app/core/tasks/attempt-execution.ts`, `app/adapters/executors/managed-agent.ts`, `packages/sdk/src/workflow.ts` | One scoped projection for programmatic reads, agent tools and prompt context. Workers cannot obtain fresh global in-memory state from their own capacity object. |

Normal Task mutations already use fenced store commits. `lib/db/transaction.ts`
supports joining synchronous SQL work through savepoints and after-commit delivery.
Use those transactions for resource writes and accounting together. Do not perform
model, filesystem or provider operations while holding the SQLite transaction.
Wake writers need a targeted consistency audit where affected; a broad transition
framework or lifecycle rewrite is not a prerequisite.

## Deliver in small stages

### 0. Complete the result-to-disposition adoption

Keep the existing milestone: install/verify the paired result path and complete
creator consumption of delegated review results. #398 alone does not close old
idle results or implement the selector creator's follow-through. Design work can
continue now; do not activate workload mechanisms or claim reduced idle buildup
from source checks alone. Installation remains a separate authorized operation.

The selector now discovers admission-scoped `review/` Tasks as well as historical
IDs, preserving each reviewer's separate allowance. On an ordinary pass it reads
at most four candidates, rotating through its bounded snapshot using the existing
accepted selector state. It consumes only its own finite `task-outcome-review`
assignment's current idle result with no remaining Conditions, input waits,
pending corrections or review deadline. The immutable publication must validate
and match the exact subject, reviewer, evidence and accepted result facts; closure
uses the current generation, resource version and accepted-attempt guard. A race
retains the assignment. No model is called, and a successful disposition pass
commissions no new review. Disabling routine sampling does not abandon returned
work. Older Hosts without creator closure retain the backlog.

Reusable metric-review services remain open for their next transition. Results
without a validated publication (including exclusions and acquisition failures)
remain for explicit owner judgment. This bounded consumer does not establish
complete fleet coverage or authorize closing unrelated historical idle records.

The semantic backlog guard separately excludes canonical idle metric-review
services under their App-mapped metric/reviewer identity. It prioritizes owed
assessment work, not the count of open standing responsibilities. A new transition
or deferred/failed assessment remains pending, waiting or attention and retains
priority. This scheduling observation closes no service and needs no report read
or consumed marker. Finite idle assessments still require the creator consumer
above. Using a bounded subset of exact reads to exclude settled services would
leave a larger all-idle service population blocking sampling forever.

### 1. Supply useful feedback without adding enforcement

Source progress: Host [PR #402](https://github.com/hao1939/may-agent/pull/402)
adds the optional versioned SDK read, current-App tool/control adapters and one
opt-in App's starting decision context. Its page counts use canonical readiness,
skip history and cap related-item expansion at 512; exceeding that cap makes the
observation unavailable, rather than silently classifying a partial graph. Agent
filtering reuses that same bounded context. Managed agents, workflow helpers and
native Task execution share the same starting observation and interpretation.
Task refresh does not relabel an old workload observation as current.

This is a partial stage: workers initially report parent Host capacity unavailable,
and queue timing, physical resources, credits and agent/root limits remain
unavailable. The following iteration carries the controller's capacity snapshot
and timestamp through existing dispatch transport. Existing queue timing measures
notification to dispatch and can include pause/prerequisite time; expose that
scope explicitly instead of calling it a durable ready-since observation. Neither
observation is execution utilization or proof that another operation fits.
Feedback source review does not satisfy the live adoption or behavioral gates.

Add one bounded workload projection to the existing read/context path. The first
pilot covers one declared App/agent scope, not an unrestricted fleet query.
The first Host PR should add a proposed workload read to the existing SDK read
contract, one shared implementation, tool/control adapters and attempt context.
Advertise its installed availability through the contract; old Hosts must not
appear to supply it. No accounting or scheduler behavior changes belong in that PR.
Return observed time, scope, coverage/truncation and unavailable facts alongside:

- Running and runnable work, pending input and actual Host/App limits.
- Bounded examples of genuine blockers and finite disposition-review candidates.
- Observed ready waiting time and relevant operation-specific resource evidence.
- Credit and agent/root-limit availability only once implemented; otherwise unknown.

Reuse canonical readiness semantics and loaded scope; do not rebuild them from
raw phase counts. Use indexed counts and bounded references instead of loading
every Task JSON, child and attempt. Current storage has no dedicated assigned-agent
index: qualify App-level counts honestly, and add an indexed projection only if
the pilot needs exact agent-level counts. Bound query effort as well as output;
mark partial/unavailable observations rather than treating a page as a total.

The parent daemon can supply observed Host scheduling facts to a worker using the
existing attempt transport. Durable Task facts come from scoped canonical reads.
Disclose their different observation times instead of claiming an atomic fleet
snapshot. A missing physical-resource observation does not mean spare capacity.

Pass the same view to the deciding agent, including workflow-created calls that
make an admission or cooperation decision. Reuse fresh context; no extra model
call before each operation. Apply guidance through normal versioned App/agent
source activation. Do not introduce a pressure score, Task-count rejection rule,
automatic closure quota or claims of enforced credits in this stage.

### 2. Make one bounded coordination path reachable

Configure a pilot coordination workflow through installed definitions. Reuse an
accountable existing route where it serves this purpose; otherwise its ordinary
standing Task must be explicitly admitted. Do not assume one already exists for
every agent or make the Host create decision-makers from metrics.

Use the existing workflow `workspace: "shared"` convention so read/review and
guarded decisions need no new Git worktree. The turn still needs storage, model
access and applicable permissions. Reserve access must be narrow, bounded and
fair at both Host and App selection. Autonomous coordination honors App pause;
only the existing human exception retains its current meaning.

Keep resource checks at the operation boundary: worktree preparation uses its
filesystem, repository and footprint evidence. Known shortfall can defer before
claim; a later preparation failure is still a charged attempt. Reuse relevant
Conditions/observations for shared blocker changes. Neither an unmeasured disk
threshold nor a free execution place proves an operation can start safely.

Use declared input, returned results and relevant resource changes for wakeups.
Coalesce them through durable input/event identities, bound each review and apply
a cooldown to an empty planning pass. Choose one justified existing schedule or
transition-triggered route for sustained spare-capacity review. Attaching feedback
to attempts alone cannot make an otherwise dormant agent reconsider opportunities.
An unchanged empty queue must not repeatedly invoke a model.

Expose only existing authorized controls. In particular, reserve eligibility is
not a portfolio reprioritization, closure or funding grant. A worker can propose
changes; the proper creator or trusted App policy applies them. Coordination uses
current per-call bounds until protected credits exist in the later ledger stage.
A first pilot can review and propose across roots while applying only controls
already available to its actor. Automated changes to App-created roots need an
explicitly scoped App-policy path with its own acceptance tests; neither the
result-closure callback nor a new coordination role supplies a general management
capability. Initial worker feedback can already change methods, discretionary
contributions and caller communication within that worker's assignment.

Source increment: Host [PR #404](https://github.com/hao1939/may-agent/pull/404)
selects one exact App-created Task/workflow/owner through installed policy, shares
the existing human reserve and additional App place, rechecks provenance before
claim/recovery writes, and requires shared workspace and a 1–120 second hard
workflow ceiling. An authored longer timeout cannot extend that ceiling. The
focused source checks passed 107 tests / 251 assertions, including a real worker,
Host size one, saturation, human precedence, pause and changed eligibility.
Hosted Quality and Container passed the stacked revision `fe7407e1ca`. Its
full local gate retained one Conversation ordering failure: 3,953 passed /
3 skipped / 1 failed. Both parameter cases passed the unchanged owning diagnostic
(2 tests / 39 assertions); the cause remains unproven. Independent approval
remains required.

The companion Alex pilot is disabled unless `ALEX_WORKLOAD_REVIEW_ENABLED=true`
is present in installed configuration. A latest-only 15-minute schedule admits
one standing `runtime/workload-review` Task through ordinary App mapping. Its
shared workflow reads a 20-Task page and at most three exact commitments, uses
one readonly Alex helper (60 seconds / eight operations) under a 90-second Host
ceiling, and retains cooldown/fingerprint state in its accepted result. Empty
and unchanged observations invoke no model. Old Hosts, scope mismatches, missing
current evidence and damaged retained state remain visible without model calls.

This first coordination pilot returns recommendations only. It applies no
portfolio edits, closure, funding or new work. Required business work remains
owed under both loads; pressure changes the recommended method and discretionary
fanout, while supported spare capacity can justify a grounded opportunity.
Limited pages and unknown resource health cannot establish fleet spare capacity.
The contract tests prove call bounds, read-only options, coalescing, scope and
no automatic effects; they do not prove model comprehension or improved delivery.
Activation and any business acceptance trial remain separate.

### 3. Add shared credit accounting

Retain the proposal's coarse units: new Task, committed attempt, separately
started managed helper. This is an upper bound on admitted work starts, not a
monetary or token-spending guarantee. Keep existing execution bounds and usage.

Use four logical records in the existing database; exact SQL names remain private:

| Record | Key / authoritative facts |
| --- | --- |
| Agent grant | Sponsor, purpose and UTC period; authorized grant and charged/reserved balance. Ordinary and protected coordination funds are distinct. |
| Root allowance | Full root Task reference, sponsor, finite cumulative cap or explicitly declared period policy; consumed/reserved credits. |
| Task account binding | Full Task reference to its root; immutable under reparenting, executor change, retry, closure and reopening. |
| Operation receipt | Unique trusted operation ID, kind, root, grant period, charge and exact Task/attempt/helper relationship; execution reservation facts when enabled. |

These records account for resources; they do not carry another business outcome,
queue or acceptance lifecycle. Keep balances/indexes transactional with receipts;
do not sum unbounded operation history on every start. Root, Task and attempt
references include App scope. A finite root's lifetime cap survives midnight;
standing renewal uses the declared period policy and never follows a model label.

For new Task creation, detect actual absence under the resource fence, establish
the binding and debit root/sponsor in the same commit as the Task and its links.
Use the durable Task identity for its single creation receipt, not every input ID.
Replay, attachment to existing work and revision incur no new creation charge.

For an attempt, validate root/sponsor funds and commit its debit/receipt with the
winning claim. A stale/busy/waiting/completed check has no new attempt and no
charge. Workspace failure after claim consumes that start. A worker that dies
before claiming spends nothing; uncertainty after a committed claim does not
justify a refund. This avoids a separate credit-reservation round trip for claims.

All managed helper entry paths must reach shared admission. The primary agent
uses its attempt's receipt rather than charging again; a workflow helper, nested
helper or separately started repair call gets its own trusted operation identity.
Reading/replaying a saved result is free; resuming actual execution must account
for the new start, without charging the same admitted invocation twice. Keep
existing workflow replay guards and external-effect idempotency.

Helper admission and external session/process creation cannot be one SQL commit.
Retain the receipt before dispatch and reconcile it with exact invocation evidence.
Release an unused reservation only with proof of non-start; uncertain execution
stays charged. Task Stop, closure, lease expiry and daily renewal are not refunds.

Renew grants idempotently by sponsor/purpose/period under trusted installation
policy. Root-cap changes require an authorized funding operation with an exact
receipt; neither the model result nor the Task creator implicitly owns that power.
An existing service Task keeps its sponsorship when accepting another root's input.
For caller-funded isolation, commission a separate contribution through ordinary
authorized admission. Defer per-input multi-sponsor settlement from this version.

On creation-budget denial, retain the input and its funding constraint in the
existing Inbox handling/recovery path, including exact caller identity. New holds
must be excluded from immediate admission retry until their funding event or due
time; otherwise a normal shortage becomes an admission loop. Required demand
remains visible even though no funded Task has yet been created.

### 4. Enforce additional execution limits using the same authority

Keep existing Host/App limits while adding per-agent and per-root checks. Store
active reservations by exact attempt/helper operation so all workers use the same
accounting authority. The parent controller's in-memory place remains dispatch
bookkeeping; it must not be charged again by the worker or advertised as proof
that nested work fits. Do not install a second independent Host permit pool.

At start, validate every applicable limit and grant atomically; obtain all needed
reservations or none. End the short transaction before dispatch. Include managed
helpers in the applicable Host, recipient-agent and root bounds. Configuration
must allow the pilot's methods; do not silently enable restrictive defaults for
workflows that currently depend on inline helpers.
Retain trusted scheduling eligibility in reservations so background helpers
cannot consume the protected place merely by bypassing the parent queue.

Size the shared reserve for the complete coordination method, not just its
outer Task. A workflow with an inline model helper requires two live places;
one reserved place can start it while still preventing any judgment. Trusted
initial Host policy may set an ordinary background sublimit in the same limits
authority. Four total places with two background places leave two for this
method; root/recipient limits and protected credits must also cover it. Retain
the existing one-place default when no sublimit is supplied. This is explicit
configuration, not automatic capacity inflation, lending or a helper exemption.
Admission and workload feedback use the same sublimit; policy replay cannot
silently amend it. App eligibility still uses the existing additional Task
dispatch place, independently of actual managed-execution accounting.

Trusted sponsor policy may supply an optional execution default for newly
commissioned roots. Apply it in the same canonical creation transaction as the
binding and creation charge, including authored seeds. A contribution uses its
existing root; an explicit exact-root limit takes precedence. Failed admission
leaves no limit behind. Defaults neither adopt historical Tasks nor amend
existing roots, and omission does not invent a limit or activate enforcement.

Use the executing definition's resolved installation-relative directory for the
recipient-agent identity. Aliases selecting the same owner share its limit, and
the claim and primary start must use the same pinned definition generation.
Programmatic definitions need an explicit stable Host identity; an alias or an
absolute source-release path cannot supply it. Resumed sessions retain their
recorded owner even when current instructions change.

The existing workload view reports shared Host execution separately from the
parent controller's dispatch observation. Report recipient occupancy by the
pinned resolved identity and root occupancy only for the trusted current Task's
canonical binding. Keep them in the same SQLite snapshot as readiness and credits;
count active reservations and helpers, including uncertain execution. Remaining
background capacity is bounded by both total Host occupancy and its background
sublimit. Missing policy or identity remains unavailable. These scoped
observations neither select another Task's root nor grant an execution permit.

Count live root usage through canonical Task account bindings. Explicitly
adopting a running historical Task includes its existing attempt and helpers
in the root's occupied capacity in the same commit, retaining their original
admission receipts. Adoption may leave usage above the installed limit; admit
no additional execution until cleanup brings it below the limit. Adoption does
not terminate existing work or rewrite its original spending.

The initial rule has no slot lending: an inline helper with no available place
gets a typed not-started admission result rather than waiting while its caller
holds the only place. Adapt the SDK and caller handling before enabling this
constraint. With `c = 1`, durable delegation works by settling the parent attempt
as waiting, releasing execution after cleanup, running the child, then waking
the parent from its exact returned result. The budget attribution is shared;
execution is not a reentrant lock. A later lending protocol needs independent
suspension, cancellation, parallel-call and restart proofs.

Retain the denied method's minimum simultaneous places per constrained scope,
including its caller and applicable live inline work. Releasing the caller must
not wake an identical method that still cannot fit. A due recheck only refreshes
that hold; it does not run or charge the caller. A revised Task method rechecks
admission. Expose this demand and scope to the deciding agent. App review
fingerprints omit mechanical capacity retry timestamps while retaining changed
method demand, scope and business facts.

Release reservations after joined execution actually ends, including descendants.
Reconcile after process loss through existing ownership/cleanup recovery. Expired
leases, stopped worker transport or a closed Task alone are insufficient evidence
that an external invocation ended. Retain uncertain reservations visibly until
confirmed cleanup; period rollover must not make live work disappear from capacity.
Workflow/executor attempts without a managed session still need the owning
process-instance evidence for recovery. A changed runtime ID or a shutdown
request cannot establish that the old execution ended.

Recover from indexed active reservations, including those for ended Tasks, through
the existing recovery scheduler and Task controller. Keep bounded paging progress
past live or unknown owners. Local joins and dead-worker recovery share exact
session/start evidence and transaction fences; all replacement paths wait for
confirmed execution cleanup. App pause permits mechanical cleanup through
ordinary dispatch capacity without enabling business execution. Reject App removal
while unconfirmed execution still depends on its runtime.

### Deferral is not failure

Extend the internal claim/admission result for funding, execution or prerequisite
constraints. This is a proposed result variant, not a new Task status. Preserve
pending work and expose its exact constraint; do not spend a start credit, consume
an executor retry or feed ordinary shortage into controller error-backoff loops.
A helper denied after its parent started spends no helper credit; the parent's
already admitted work remains charged.

Skip constrained roots/agents when choosing other ready work. A denied queue head
must not block eligible work in the same App or retain a Host place. Recheck at
atomic admission because a feedback or scheduling snapshot can race. Wake the
indexed affected work on relevant release, funding, recovery or a declared due
time through the existing scheduler. An unchanged constraint is not another model
decision, and recovery never silently resets retry exhaustion.

## Verification and adoption gates

| Delivery | Required evidence |
| --- | --- |
| Feedback | Counts match canonical scoped readiness; unknown/stale/partial facts remain explicit; bounded query effort; equivalent context reaches direct agents and deciding workflow helpers. |
| Coordination | Ordinary Host and App work saturated; one bounded authorized review runs from shared workspace without stealing pause authority. At Host size one, bounded work interleaves; no extra place is invented. |
| Admission accounting | Concurrent input, event, Conversation and delegation routes create/charge one Task; link or debit failure rolls everything back. Existing-target service requests retain their account. |
| Attempt/helper accounting | Concurrent workers cannot overspend; lost claims and checks charge nothing. Primary execution is charged once; real helper/repair starts are charged, replay is free. |
| Execution bounds | Cross-worker helpers count; parallel starts respect all limits. Root `c = 1` durable delegation resumes; denied inline calls return without deadlock and cannot block unrelated ready work. |
| Recovery and renewal | Non-start, uncertain start, midnight, restart and delayed cleanup preserve receipts, finite caps, live reservations and original caller obligations. |
| Business behavior | Same required incident remains owed under both loads. Heavy load reduces discretionary expansion and surfaces delivery conflicts; blocked idle is distinguished from usable spare capacity. |

Run focused portable tests for each changed contract and the required Host checks
on its exact PR revision. Keep Host fixtures generic. The App repository owns the
pilot policy, workflow/prompt changes and behavioral acceptance examples. Only a
separately authorized live trial can establish changed agent behavior; synthetic
fixtures prove mechanics and do not prove model comprehension or better outcomes.

Use one opt-in pilot with explicit attribution for retained/standing Tasks before
enforcement; do not treat absent history as free work or fabricate old spending.
Account bootstrap/imports through an explicit adoption policy. Disable new
enforcement without deleting receipts or obligations if the pilot must stop.
Stage labels, operation records and proposed read fields above are design terms,
not capabilities agents can call today.

## Implementation evidence

November 9 source iteration: the new selector-disposition regression reproduced
the missing modern-ID backlog handling (nine failing cases before the change).
After the fix, the evaluator workflows and App completion policy passed all 352
tests, with 1,867 assertions. Strict TypeScript checks against the paired Host SDK
passed. Coverage includes creator/result identity, outstanding obligations,
publication mismatch, closure races, old-Host fallback, bounded rotation and
preserving sampling cursors. The first broad invocation exposed four missing
modules in the sparse worktree; adding its existing May App dependencies made
those same tests executable without source changes.

The next source iteration reproduced two failures from idle reusable metric
services permanently occupying the requested-review backlog. The fix passed
all **359 tests and 1,892 assertions** across evaluator workflows and App
completion policy. It covers twelve idle services (more than the four finite
disposition reads), reentry when new work arrives, reviewer separation and
preservation of pending/running/waiting/attention or unknown demand. No model,
closure or additional report read is required to exclude a quiet standing
service. This establishes source behavior only; live adoption remains pending.

Host [PR #400](https://github.com/hao1939/may-agent/pull/400), now merged as
`c1b9bc8833df7788dcec7f8e779fdab3d7f7d9c5`, isolates synthetic
bootstrap fixture writes from the serving connection's short contention timeout.
Its hosted Quality check passed; Container correctly classified the fixture-only
change as requiring no image build. A local full run retained two unrelated
failures (Conversation ordering and a metric-alert assertion); the owning suites
passed their targeted diagnostic run. Those failures remain recorded for
investigation, not erased by a broad rerun. No new live closure, Host deployment,
App activation or workload-behavior claim follows from this iteration.

Host feedback source verification passed **156 focused tests and 973 assertions**,
including the SDK export contract, SQLite/read-only boundaries, graph expansion,
pagination, tools/control and shared native/managed context. Current-revision
Host/SDK type checks, canonical App boundary and lint passed. The first full run
recorded seven failures; one was the new export snapshot and was fixed, while the
six other failures passed their targeted diagnostic checks (seven cases).
Their causes remain unproven. A later full run overlapped source edits and is not
valid single-revision gate evidence. The initial frozen feedback revision passed 3,938 tests with 22,927 assertions
and hosted Quality/Container. Review then reproduced two eligibility gaps:
elapsed deadlines and fresh human recovery were misclassified before a claim.
The fix shares accepted-deadline logic with claim/recovery and extends shared
readiness at the observation time, preserving dependency/pause gates and stored
wake hints. The related lifecycle suites passed 146 tests / 1,725 assertions;
projection regressions passed 19 tests / 79 assertions. Hosted Quality/Container
passed review revision `414b83578e`. Its full local gate retained one
Conversation ordering failure: 3,940 passed / 3 skipped / 1 failed. The last
message was an earlier human ask instead of the accepted corrected-source reply.
Both parameter cases passed the unchanged owning diagnostic (2 tests /
27 assertions). That failure remains unexplained. A later controlled diagnostic
reproduced the coordination waiting-report failure as a premature presentation
wake. Host #408 also waits for the exact report input to settle, but its
subsequent full run still failed the message-order assertion. The premature wake
is real but does not fully explain the failures; the separate fresh-human-input
failure also remains unresolved.

Verification for this review: the existing Host capacity, controller and queue
suites passed, **46 tests and 138 assertions**. They verify current scheduling
foundations, not the proposed credits, helper limits or adaptive behavior.


The accounting foundation in Host [PR #405](https://github.com/hao1939/may-agent/pull/405),
revision `2c9fc4d0e3`, introduces
private root bindings, UTC sponsor grants, cumulative/declared-period root
balances and idempotent operation receipts in the existing SQLite database.
Ordinary and protected purposes are separate. It exposes no model-facing funding
or refund operation and does not yet enforce creation, claims or helper dispatch.
Nine focused tests / 43 assertions passed, including independent process races
against both sponsor and root limits, caller rollback, restart/replay, and midnight
renewal. An interleaved two-connection regression first reproduced a mixed budget
observation; a read snapshot now keeps its root and sponsor balances consistent.
The frozen full local gate passed 3,932 tests / 3 skipped / zero failures /
22,903 assertions across 344 files, including browser execution and Host/SDK
types, boundary and lint. Hosted Quality and Container passed the same revision;
it received independent automated approval and merged as
`c4b43127d06368fbc32f8486317cc97b08a64853`. No other maintainer was available.
The PR was based independently on main.
Admission integration is the next isolated increment; installed policy is not
exposed for production activation before creation, claim, helper and deferral
paths support the complete accounting contract.


The next source increment charges runtime Task creation and winning claims in
the existing fenced resource commit. Task-created contributions inherit their
creator account; existing services keep theirs. Funding denial persists a
constraint on the existing Task/Inbox record and returns a distinct deferred
claim, preserving pending input, obligations, retry costs and the one authorized
fresh-human claim. Separate ready/due Inbox indexes exclude sleeping funding
holds. Confirmed old-runtime cleanup can commit without charging a replacement
attempt. Explicit historical adoption wakes only matching source dependencies;
a recheck while recording the hold prevents a racing adoption from being lost.
Closed receipt restoration remains free rather than fabricating historical costs.

Owning lifecycle checks passed 218 tests / 1,338 assertions. The subsequent
funding, Inbox, receipt and metric checks passed 81 tests / 708 assertions,
including protected-account isolation and exact cross-App adoption wakes.
Host/SDK type checks, canonical App boundary and lint passed. Host
[PR #406](https://github.com/hao1939/may-agent/pull/406), revision `eed61dfee7`,
passed hosted Quality and Container. Its frozen local gate retained one
waiting-report Conversation assertion failure: 3,947 passed / 3 skipped /
1 failed / 22,972 assertions across 345 files. A controlled diagnostic holding
the second reply for 30 milliseconds reproduced both parameter failures:
an earlier asynchronous presentation wake can arrive after the next model call
starts but before its reply settles. Test-only
[PR #408](https://github.com/hao1939/may-agent/pull/408), `3299061244`, waits for
the exact report input's durable settlement and retains all message, Request
and restart assertions. Its owning file passed 53 tests / 745 assertions;
Host/SDK types, boundary and lint and hosted Quality/Container passed. Its full
local run retained two failures: 3,930 passed / 3 skipped / 2 failed / 22,881
assertions across 344 files. Waiting-report message ordering still failed, and a
metric collector-grace assertion observed five newly defined sources as stale.
A two-file diagnostic passed 86 tests / 883 assertions without reproducing
either failure. Frozen-clock and attempted gated-wake diagnostics did not
establish message sorting as a defect. The predicate change remains incomplete;
no automatic retry or weakened assertion establishes a fix.

Authored seed accounting is isolated in
[PR #407](https://github.com/hao1939/may-agent/pull/407), `93f1075c5d`, stacked on
#406. Production descriptor discovery explicitly identifies new authored seeds;
fresh funded Tasks require exact App-only provenance and use the same creation
admission inside bootstrap's transaction. Denial after the first seed Task
rolls back every Task, grant, debit, binding and resource authority. Offline
retained snapshots never invent historical creation costs and require explicit
adoption for funded execution. The seed/resource-store/runtime-definition owners
passed 44 tests / 286 assertions, and Host/SDK types, boundary and lint passed.
Hosted Quality/Container passed. Its frozen full local run retained an existing
Git-cleanup lifecycle failure: 3,951 passed / 3 skipped / 1 failed / 23,003
assertions across 346 files. The unchanged cleanup diagnostic passed one test /
20 assertions. A controlled frozen-clock diagnostic then reproduced the exact
history assertion: simultaneous later attempts had random-ID tie ordering, so
the original attempt was not guaranteed to leave bounded history. Test-only
[PR #411](https://github.com/hao1939/may-agent/pull/411), `6626583d7b`, gives later
fixture attempts increasing timestamps while preserving the reverse-clock
scenario and every cleanup assertion. Its owning 17 cases / 233 assertions and
Host/SDK types, boundary and lint passed. Its full run retained a separate
Conversation steering-order assertion failure: 3,931 passed / 3 skipped /
1 failed / 22,899 assertions across 344 files. These are distinct findings;
#407 and #411 remain draft pending their integration/review gates.

The next isolated managed-start increment is revision `719daf0760`, stacked on
#407. The manager's common start path accounts direct, workflow and nested
helpers and resumes before dispatch. An opaque Host adapter capability and
durable unique guard cover the primary once through its exact paid attempt.
Source labels cannot grant coverage; a saved-result read is free. Denied
resumes preserve retained transcript/session state. An owning test exposed a
previous invocation's cached result being returned during a resume; each newly
admitted start now invalidates that cache. The six-process primary/helper race
uses actual schema-only worker connections. Its initial Host-startup connection
variant retained SQLite contention and was corrected to exercise worker
admission, without retrying execution. Owning manager, adapter and accounting
checks passed 61 tests / 397 assertions before the final capability assertions;
the final focused file passed four tests / 33 assertions. Host/SDK types,
boundary and lint passed before that final test refinement. The frozen full
gate passed 3,956 tests / 3 skipped / zero failures / 23,047 assertions across
347 files, including its current types, boundary and lint checks. Hosted Quality
and Container also passed. This is [PR #409](https://github.com/hao1939/may-agent/pull/409);
independent review and the caller-deferral increment still remain. Admitted
starts stay charged if preparation later fails.

Caller deferrals and authorized cap/grant changes now have separate source
increments, with protected coordination integration following below. Shared
execution reservations remain. No production installation switch, live activation
or behavioral acceptance is established.


Independent review of #406 identified four admission/recovery gaps. Revision
`6c7343f993`, integrated with current Host main as `edb34aa0f7`, addresses them:

- First Conversation input retains its exact Inbox identity and funding constraint
  outside the Task-admission savepoint. Its trusted admission key distinguishes
  deferred, unstarted input from a legacy worker after recovery clears a hold.
- An atomic result blocked on follow-up creation retains its prepared decision,
  trusted mapping and acceptance facts in a Host-private checkpoint on its
  original attempt. The Task waits without an execution heartbeat. Recovery
  retries ordinary fenced settlement without another model/mapping call,
  attempt debit or execution failure. Cancellation and revised requirements
  fence the saved result. Ordinary delegation already retains demand through
  the Inbox and preserves its parent's accepted result independently.
- Installing a missing sponsor policy wakes only its exact matching Inbox
  holds in the installation transaction; installation rollback also rolls back
  those wakes.
- Restart Condition-index repair respects indefinite and future funding holds.
  A held claim also acknowledges any obsolete indexed wake, preventing repeated
  recovery enqueueing.

The initial owning lifecycle pass succeeded with 211 tests / 2,704 assertions.
Five additional settlement/delegation scenarios passed 62 assertions, including
restart without execution, cancellation, requirements revision and both ordinary
result dispositions. The Condition repair regression also passes across a real
database reopen. Host/SDK types, boundary and lint passed before the final test
refinements. An initial ordinary-delegation test incorrectly expected synchronous
child admission; it was corrected to exercise the existing durable Inbox path.
Its callback fixture also needed the owning state adapter rather than an
unconfigured runtime attachment. Those failed diagnostics were retained.
A full gate is running on the clean, frozen integrated revision `edb34aa0f7`;
current hosted checks and renewed independent review remain required. Production
activation remains unavailable.


The bounded-history fixture correction in Host
[PR #411](https://github.com/hao1939/may-agent/pull/411) advanced to `e2a051f173`.
Its clean full gate passed **3,967 tests / 3 skipped / zero failures / 23,070
assertions across 345 files**. Hosted Quality and Container passed the same head;
independent review remains required. This supersedes that draft's earlier gate
status without claiming the separate Conversation ordering issue was solved.

Managed-helper caller deferrals are isolated in Host
[PR #412](https://github.com/hao1939/may-agent/pull/412), `14928e1901`, stacked on
#409. A denied start returns structured not-started data without inventing a
helper identity; a denied resume cannot fall through to a fresh call. Unhandled
helper funding denial drains the enclosing execution and retains pending input,
workspace, paid attempt and workflow evidence in the normal funding hold. It
consumes no executor retry. Cancellation and revised requirements fence late
deferrals, and rollback restores claim/recovery facts together. Final SDK and
owning cases passed **13 tests / 104 assertions**; the workflow/model boundaries
passed **40 / 187**. The first full run retained a missing intentional SDK export
snapshot and a Conversation steering last-message failure. The export snapshot
is corrected. The frozen corrected gate passed **4,008 tests / 3 skipped / zero
failures / 23,380 assertions across 348 files**; hosted Quality and Container
passed. A controlled Conversation diagnostic did not reproduce its earlier
failure, so no Conversation fix is established by this passing run.

Root allowance amendments are Host
[PR #413](https://github.com/hao1939/may-agent/pull/413), `2ebc2aade1`, stacked
independently on #406. One private expected-account command and durable receipt
preserve spending and attribution, reject stale/reused commands and caps below
spending, and wake exact cross-App Task/Inbox root-credit holds. Replay cannot
undo a later amendment. Historical adoption receipt replay now preserves a
subsequently amended cap without applying funding or wakes again. The initial
full gate retained **3,999 passed / 3 skipped / 2 failed / 23,298 assertions across
347 files**. One failure demonstrated a new expression index parsing malformed
unrelated Task JSON; guarded index and query predicates fix that compatibility
defect. Affected funding and scoped diagnostics then passed **53 tests / 312
assertions**. The other Conversation last-message failure remains unexplained.
Hosted Quality and Container pass the guarded revision. Its new frozen full local gate retained **3,998 passed / 3 skipped / 3 failed /
23,246 assertions across 347 files**: a four-second mechanical-recovery fixture
timeout, a metric pass returning unknown after a sample, and restored-executor
retry eligibility. Those failures remain unexplained; targeted passes do not
erase them.

Sponsor daily amendments are Host
[PR #414](https://github.com/hao1939/may-agent/pull/414), `e499a6112d`, stacked on
#413. An exact installed-policy command changes the current UTC ordinary grant
and future daily default together, preserving charged credits, historical grants,
root caps and protected funds. It wakes only matching ordinary sponsor-credit
Task/Inbox holds; replay after restart or midnight changes no grants or wakes.
Accounting/funding owners passed **41 tests / 239 assertions**; funding plus
scoped diagnostics passed **58 / 344**. Types, boundary and lint passed. The root
index-guard merge retained the identical tested tree
`524a3ec7e89ec21c07fc0bd527bda8ec2e9b79a5`. Hosted Container passed, but Quality
retained **4,005 passed / 3 skipped / 1 failed / 23,337 assertions across 347
files**: the existing background-exec line-limit fixture read the no-output
placeholder after a fixed 200 ms startup sleep. A controlled 300 ms startup
reproduced that exact failure on main. Separate test-only Host [PR #416](https://github.com/hao1939/may-agent/pull/416),
`765a81b8e4`, now awaits the real child's output-drained close event. Its owning
**15 tests / 28 assertions** and static checks passed. This is not a green full gate for #414.

Protected coordination funding is Host
[PR #415](https://github.com/hao1939/may-agent/pull/415), `f5bf427c9e`, integrating
#414 with #412 and #404. One shared exact eligibility function serves reserve
dispatch and protected funding. The installed Task, workflow, owner and timeout
must agree with loaded App source before bootstrap or dispatch. The existing
transaction charges protected creation, workflow attempts and helpers even when
ordinary funds are exhausted. Business contributions cannot spend those funds or
occupy the installed protected Task identity. Claims verify the actual workflow
handler. A further regression reproduced a stale policy hold after correcting
requirements; the normal fenced mutation now clears only that exact hold after
rechecking eligibility, without renewing spending or dropping obligations.
Owning accounting, lifecycle and scheduling checks passed **282 tests / 1,743
assertions**. Two real worker scenarios also passed, covering ordinary and
protected completion and the installed timeout ceiling. Host/SDK types, boundary
and lint passed. The first regressions failed before integration; one invalid
workflow-plus-executor fixture was corrected to exercise valid alternate
selection. Hosted Quality and Container pass that revision. No full local gate has run on
that head; independent review remains.

The next implementation stage is shared Host/recipient-agent/root execution
reservations, including helpers and confirmed descendant cleanup. Complete
budget/constraint feedback, operation-specific resource blockers, explicit pilot
adoption and business-behavior evidence remain. Source publication alone does
not establish activation, automatic Task closure or improved model decisions.


Budget feedback is the next independent source increment, Host
[PR #417](https://github.com/hao1939/may-agent/pull/417), `924442d4e9`, stacked on
#415. Initial regressions reproduced funding-held work classified as unknown and
missing credit observations. The shared read now counts those assignments as
waiting demand and supplies exact constraint reasons/due times. Optional funding
facts separate the current App's ordinary sponsor from the Host-bound current
Task's shared root, including inherited cross-App sponsorship and protected
coordination. No workload query argument selects another root. Exact keyed reads
share the existing Task-read snapshot; observing renewal writes no grants and
never resets finite root spending. Missing policy/bindings remain unavailable.
Read/accounting/tool/context/SDK checks passed **95 tests / 644 assertions**; the
final owning projection file passed **20 / 84**. Host/SDK types, boundary and lint
passed. Hosted Quality and Container passed the same revision. No full local
gate has run on that head; independent review remains required.

The paired pilot includes changed ordinary funding and blocker facts in its
review fingerprint. A new regression reproduced the previous behavior of
ignoring changed ordinary funds. The fingerprint excludes the review's own
protected spending, so paying for a pass does not commission another judgment.
The ordinary allowance reaching zero or increasing warrants new advice after
cooldown; the same required incident remains owed, and the pass still applies
no portfolio edits or new work. Workload/disposition workflows passed **22 tests /
326 assertions**, and strict checks against the paired source SDK passed. This
is source contract evidence with scripted helper responses, not a model-backed
business acceptance trial. Install the paired Host before activating these
optional feedback facts; source work grants no rollout authority.

The sponsor amendment's frozen local gate subsequently retained **4,005 passed /
3 skipped / 1 failed / 23,343 assertions across 347 files**. The worker
recovery/handler-judgment scenario did not observe a converged accepted attempt;
its cause is unproven. Separately, all three root-funding gate failures passed an
unchanged targeted diagnostic (**3 tests / 142 assertions**), without proving a
fix. Those results do not replace either failed full gate. The isolated
background-output correction #416 passed hosted Quality and Container; Container
correctly treated the fixture-only diff as requiring no image build.

The private shared-execution foundation is Host
[PR #418](https://github.com/hao1939/may-agent/pull/418), `3c8df6de55`, stacked on
#417. SQLite admission atomically obtains the applicable Host, resolved
recipient-agent and root places, preserving the shared foreground place and
Host size-one behavior. Exact operation receipts fence ownership, replay and
confirmed release. Two new regressions first reproduced release rejecting a
valid composite identity and adoption omitting already-live execution. Live
root counts now follow canonical bindings through indexed active reservations
and keyed lookups, retaining immutable admission evidence and rollback.
Accounting, funding and schema owners passed **62 tests / 397 assertions**.
The frozen full gate passed **4,078 tests / 3 skipped / zero failures / 23,742
assertions across 353 files**, including Host/SDK types, boundary and lint.
Hosted Quality and Container passed that revision; independent review remains.
This foundation has no runtime consumer, fairness queue or production activation.
The caller still must integrate real claims, helpers, confirmed descendant
cleanup and indexed constraint wakes before it enforces execution bounds.

The recipient-identity boundary is isolated in Host
[PR #419](https://github.com/hao1939/may-agent/pull/419), `0b82725297`, stacked on
#418. One resolver supplies directory or explicit programmatic installation
identity to the pinned Task adapter and reservation keys. A regression reproduced
resuming a programmatic session under a replacement owner using the same name.
Sessions now retain the explicit owner; denial preserves metadata and transcript,
and the original owner can resume with updated instructions. Pinned-alias,
reservation, resume and cleanup checks passed **109 tests / 589 assertions**;
managed-budget and session-lifecycle boundaries passed **41 / 249**. Host/SDK
types, boundary and lint passed. The frozen full local gate passed **4,080 tests /
3 skipped / zero failures / 23,763 assertions across 354 files**; hosted Quality
and Container passed the same head. Independent review remains. These source tests
do not establish runtime execution enforcement or model-backed business behavior.

A separate actual-runtime cleanup fix is Host
[PR #420](https://github.com/hao1939/may-agent/pull/420), `367a145702`, independently
based on current main. A real-process regression reproduced the worker deadline
rejecting its promise and freeing the parent's dispatch place while the worker
was still alive. The fixture observes readiness before starting the deadline,
receives a termination acknowledgement over stdout and explicitly permits exit.
The production waiter now reports the timeout after child close and cancels its
remaining escalation timer. Worker protocol/controller owners passed **44 tests /
95 parent-process assertions**, with additional lifecycle assertions inside the
isolated probe; the final owning regression passed again after a small test
cleanup. Host/SDK types, boundary and lint passed. The frozen full local gate
passed **3,968 tests / 3 skipped / zero failures / 23,066 assertions across 345
files**; hosted Quality and Container passed the same head. Independent review
remains. This fixes the
existing dispatch boundary; it does not yet reconcile durable reservations or
confirm every retained descendant after process loss.


The canonical claim boundary is Host
[PR #421](https://github.com/hao1939/may-agent/pull/421), `c2461de052`, stacked on
#419 with #420's independent cleanup prerequisite. Initial regressions reproduced
claims ignoring execution limits. A broader run then exposed that an outer claim
transaction interfered with existing pause and late-funding race boundaries;
reservation admission now belongs inside the canonical resource commit, after
its exact fences and alongside credit admission. The corrected owners passed
**200 tests / 1,463 assertions**. The frozen full local gate passed **4,091 tests /
3 skipped / zero failures / 23,809 assertions across 355 files**, including static
checks; hosted Quality and Container passed the same head. Independent review
remains. Capacity holds reuse Task readiness, indexed recovery and fenced input
restoration; release/policy wakes use an indexed scope instead of another queue.
This head still has no actual runtime capacity consumer or activation switch.

Bounded Task runtime integration is Host
[PR #422](https://github.com/hao1939/may-agent/pull/422), `a8bae462a1`, stacked on
#421. The actual runner supplies pinned identity and dispatch provenance. A paid
primary reuses its claim place; helpers and resumes reserve separate places with
the existing invocation debit. Joined cleanup drains child promises and Bash
groups. Cancellation retains occupancy until actual cleanup; local release
rechecks starts and session attachments that race its cleanup callback. Historical
receipts without owner evidence are not treated as cleaned up.

Regressions first reproduced uncounted helpers, recipient substitution, lost
child-cleanup failures and caller spending repeated after due rechecks. A root
with `c = 1` now retains a two-place inline-method constraint, its unaccepted
input and its retry allowance without running another caller; a revised method
can proceed. Runtime, manager lifecycle, Bash groups, session recovery,
claim/store/retry and workload owners passed **462 tests / 4,732 assertions**.
After final release-race, cancellation, non-start and child-retention refinements,
changed owners passed **72 tests / 390 assertions**. Host/SDK types, boundary and
lint passed. Its frozen full local gate passed **4,099 tests / 3 skipped / zero
failures / 23,856 assertions across 355 files**; hosted Quality and Container
passed the same head. Independent review remains required.

The paired App review now excludes mechanical capacity recheck timestamps from
its decision fingerprint, but retains method demand and scope. Its new regression
failed first; paired workload/disposition workflows passed **23 tests / 333
assertions**, with strict types checked against this Host SDK. These are scripted
contract checks; they do not prove model behavior or live adoption. The workflow
continues to advise without portfolio, closure, funding or priority effects.

Activation remains unavailable. Required subsequent work includes crash recovery
of indexed active reservations even for closed Tasks, explicit historical adoption,
trusted execution policies for newly created roots, direct-session admission and
scoped capacity observations. Private limits currently fail direct-session starts
closed; bounded Task fixtures are not general installation activation proof.


### Active execution recovery source increment

Host [#423](https://github.com/hao1939/may-agent/pull/423), revision
`11684a2ba3`, stacks on #422. Two real-process regressions first demonstrated a
new runtime interrupting a still-live sessionless worker and an ended Task
stranding capacity after its worker exited. Recovery now follows indexed active
reservations regardless of business closure, requires dead process-instance
ownership, and confirms the unattached primary and every exact helper through the
existing session/Bash cleanup adapter. Local joins use the same confirmation and
transaction fences. Missing historical owner evidence remains occupied.

The existing scheduler retains a bounded active-reservation paging cursor; a
live first page does not hide later dead owners. Cleanup uses the existing Task
queue and worker. App pause permits this mechanical work through ordinary dispatch
capacity while business admission stays paused. Runtime removal cannot orphan
unconfirmed Task execution. No new business lifecycle, queue, model call or
activation switch is introduced.

Accounting, claim, retry and session recovery owners passed **369 tests / 2,506
assertions across nine files**; runtime and worker owners passed **279 tests /
3,360 assertions across two files**. Cleanup/controller owners passed **74 tests /
289 assertions across four files**. Final changed owners after refinements passed
**70 tests / 329 assertions across four files**. Host/SDK types, boundary and lint
passed. Its frozen full local gate **failed: 4,107 passed / three skipped / one
failed / 23,907 assertions across 356 files**, in 306.91 seconds. The real-worker
`recoveryLeavesHandlerJudgmentToAttempt` scenario did not reach a converged accepted
result. The same boundary failed in earlier sponsor-funding evidence. A subsequent
targeted run with additional failure-state diagnostics passed, without establishing
the cause or a fix; no full-gate retry is claimed. Hosted Quality (5m6s) and
Container (2m10s) passed this exact revision. Those passes do not erase the local
failure. Independent review and the local failure remain unresolved. Fixture-only
corrections included parsing
lease timestamps, selecting the existing installed reconciliation API and allowing
the inherited startup gate to settle during teardown. They are not additional
production bug fixes.

The workflow audit confirms that supported agent steps and nested workflows
retain the exact Task binding and use managed-start reservations; their Bash tools
persist process groups against those exact sessions. This evidence covers the
Host-managed execution contract, not arbitrary detached processes spawned by App
code outside that contract. No live adoption or model behavior has been tested.

Activation still requires explicit historical execution adoption, trusted policies
for new roots, direct/persistent-chat admission and cleanup, scoped capacity
observations, and a complete one-place durable-delegation proof. Private limits
continue to fail unsupported starts closed. Existing worktree-capacity work in
Host #399 remains separate.


The paired isolated Apps design check passed with the existing reports-layout
warning. An additional check in the shared installation checkout failed because
existing ignored `evaluation.app` and `gym.app` symlinks point into retired local
history without canonical `app.ts` files. Those installation artifacts were left
untouched. This is separate from the isolated source-design result; the integrated
installation checkout is not reported as passing.

### Root policy, cooperation and shared-capacity feedback source increments

Host [#424](https://github.com/hao1939/may-agent/pull/424), revision
`cda76e82d2`, extends the installed-runtime delegation/restart fixture with a
finite one-place root and three distinct recipients. A child attempted before
the parent yields is deferred without a debit; confirmed parent cleanup wakes
it. Saved results resume the chain after restart despite missed live feedback.
It spends three creation and five attempt credits, with no charge on repeated
recovery. Both configured and unconfigured scenarios passed **2 tests / 64
assertions**; runtime, admission and managed-start owners passed **297 / 3,603**.
Static checks and hosted Quality/Container passed. This is deterministic runtime
and storage evidence, not native-provider or model-behavior proof. No complete
local gate was run on this head; independent review remains.

Host [#425](https://github.com/hao1939/may-agent/pull/425), revision
`c585ed31f5`, adds the optional trusted new-root execution default described above.
Two production-creation regressions failed first. Creation and production seed
owners then passed **11 / 50**, and funding, coordination, managed-start,
admission, accounting and real-process recovery owners passed **89 / 557**.
Static checks, hosted Quality/Container and its frozen complete local gate passed:
**4,116 tests / 3 existing skips / 0 failures / 23,981 assertions across 357
files**. Independent review remains. No configuration is activated.

Host [#426](https://github.com/hao1939/may-agent/pull/426), revision
`b49218bba5`, supplies shared Host, pinned recipient and canonical current-root
execution observations through the existing workload read. Two regressions
failed first. Workload/admission/accounting owners passed **54 / 267**; expanded
runtime and real-worker owners passed **332 / 3,610**. Final changed owners passed
**13 / 48**, with additional lifecycle assertions inside the isolated worker.
The actual worker's starting context and live scoped read agree, and joined
cleanup returns occupancy to zero. Final Host/SDK types, boundary and lint passed.
Hosted Quality/Container and the frozen complete local gate passed:
**4,118 tests / 3 existing skips / 0 failures / 23,993 assertions across 358
files**. Independent review remains.

The paired App policy explains execution versus dispatch scope, the current-root
boundary, and method adaptation without count-based closure. Its workload and
disposition workflows passed **24 / 344**, with strict types against this SDK.
This verifies source contracts and supplied decision context, not improved model
choices or live adoption.

A diagnostic-only full local gate on `a624fd5575` passed **4,108 tests / 3 skipped
/ 23,905 assertions**. It retained missing-result Task/attempt diagnostics but
did not reproduce or explain the earlier #423 local failure. The passing run
does not establish a production fix. #426 carries those fixture diagnostics
forward. Historical adoption, unsupported direct/persistent-chat starts,
operation-specific resource constraints, independent reviews and separately
authorized activation/behavioral evidence remain outstanding.

Host [#427](https://github.com/hao1939/may-agent/pull/427), revision
`1c831e59be`, corrects pending-input counts after an attempt consumes its trigger.
Two actual admission/settlement regressions first showed zero demand while the
Task still owed an answer. The existing bounded workload page now counts retained
input obligations, whether runnable or waiting, and removes them after completion.
Workload, shared-execution feedback and retained-input decision-context owners
passed **28 / 135**; final Host/SDK types, boundary, lint and hosted Quality/Container
passed. No complete local gate on this exact head; #428's full gate includes this
change. No new lifecycle or accounting state is introduced.

Host [#428](https://github.com/hao1939/may-agent/pull/428), revision
`028371e3e5`, extends the actual worker/provider-protocol fixture with funded
one-place A → B → C → B → A delegation. Policy creates the root cap, child
admission inherits it, and parents yield before contributions execute. The exact
returned result fulfills the original Request. After storage/runtime reopen,
a fresh human turn uses retained evidence; duplicate dispatch and recovery add no
charge. Three creations and six actual attempts cost nine credits, and cleanup
leaves zero occupied places. All five neighboring/new interaction cases and
static checks passed. Hosted Quality/Container and the frozen complete local gate
passed: **4,121 tests / 3 existing skips / 0 failures / 24,002 assertions across
358 files**. Independent review remains.
This uses scripted provider replies, not model judgment. The one-place chain
serializes contributions; simultaneous parent discussion remains a separate
unconfigured-concurrency scenario. No production change was needed.

Host [#429](https://github.com/hao1939/may-agent/pull/429), revision
`c02aea08ae`, closes a demonstrated coordination saturation gap. With ordinary
execution full, the reserved outer workflow could start but its model helper
was deferred with Host demand of two places. The real-worker regression failed
before the change. Explicitly configuring two ordinary places within four total
places now lets the complete review run under saturation, retaining the same
overall, recipient, root, eligibility and funding bounds. It makes one scripted
model call, spends two protected credits with ordinary funding exhausted, reports
the configured sublimit and releases only coordination occupancy. Changed
coordination/feedback/admission owners passed **19 / 81** parent-process assertions,
with more inside the fixture. Complete reservation, claim, workload and controller
capacity owners passed **52 / 258**. Static and hosted Quality/Container checks
passed. The frozen complete local gate passed: **4,123 tests / 3 existing skips /
0 failures / 24,019 assertions across 358 files**. Independent review remains. No new ledger, queue or schema is introduced;
configuration and activation stay with trusted installation authority.
