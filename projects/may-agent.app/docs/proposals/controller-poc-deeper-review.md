# Does the common Task loop pay for itself?

**Status:** Source follow-up to [Host #158](https://github.com/hao1939/may-agent/pull/158),
September 12, 2026. Unmerged and undeployed. The [proposal](conversation-input-unification.md)
owns the lifecycle contract; the [earlier audit](controller-poc-recovery-review.md)
retains nested delegation, failure and cutover evidence.

## Recommendation

Keep one Task lifecycle. The new trials support its practical value: an agent
can choose delegation from an ordinary ask, keep discussion available, accept
owner withdrawal and reconsider evidence when the human changes the question.
The source should also become smaller. The first follow-up did not go far enough:
it shared execution while retaining old admission, return and recovery contracts.
The [source investigation below](#why-the-source-stayed-large) identifies those
costs and records the contract reductions below. Model execution cost remains a separate
measurement from source size.

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

## Why the source stayed large

The unification moved execution authority, but kept too many old protocols around
it. Preserving every old contract made adapters and compatibility checks replace
much of the deleted code. That was an incremental implementation choice, not a
necessary cost of one Task lifecycle.

The source at `f2683274` shows three concrete causes:

| Retained mechanism | Cost and source evidence | Smallest useful change |
| --- | --- | --- |
| Ordinary App input still has a handling lifecycle | `AppInboxHost.reconcileOnce()` claims input, renews a lease, attaches a Task, waits, claims again and copies the outcome. Composition retains a pump and dependency recovery. The SDK already declares `app.task` as a pure synchronous mapping. | Resolve and commit Task admission directly. Keep input identity and caller correlation; retire execution claims on inbox rows. |
| Delegation has several return protocols | Direct children use `project.task.child-transitioned`; `admitTaskAppDependencies()` translates input publication into inbox waits and Conditions; human follow-up uses Topic links and `admitConversationTaskChange()`. Each has its own discovery and correlation checks. | Extend the existing admission link with the caller Task and use one exact result-return route. Human Requests and Topics remain context and product records. |
| Session completion can substitute for Task settlement | `consumePersistedTerminalAgentResult()` reconstructs a claim and applies actions/results from a session artifact during startup or a busy claim. Normal execution separately handles dependency admission, verification and settlement. | Accept only at the normal Task settlement boundary. Retry uncommitted execution using retained evidence. |

At that revision, ordinary delegation travelled through:

```text
A proposes typed input for B
  -> input event -> B inbox row -> inbox claim -> B Task admission
  -> B attempt -> accepted result -> inbox claim -> copied input result
  -> dependency event -> A Condition -> A attempt
```

The target is shorter:

```text
A proposes typed input for B
  -> Task admission and saved return link -> B attempt -> accepted result
  -> event admits the exact result to A -> A attempt
```

Events still connect components. A timer rediscovers missing notifications from
accepted state. An event is not a reason to split one local SQLite transaction
into several separately recoverable steps. Admission publication can retain its
existing durable receipt. Direct input routes do not all have automatic journal
redelivery: the implementation below retains the input row for admission recovery.

This also requires dropping an expensive promise: after input is attached,
rerunning the App mapper must not silently replace its responsible Task.
The former `#replacementTaskAttachment()` supported that behavior and recovery
kept looking for it. The assigning owner can revise or close work explicitly.
Changing admission and result reads together is necessary before deleting the
inbox pump; removing the pump alone would strand ordinary inputs.

The mutable `TaskTree` projection and `ResourceMutationScope` add another layer
between lifecycle operations and row writes. They deserve a later review, but
are not a second database authority. Exact multi-row changes still need atomicity
and fences. Do not replace them with a generic repository framework before
reducing the operations and relationships they support.

## First removal: retry uncommitted execution

Host `2d837d20` removes the session-result acceptance path, its reconstructed
claim and its result-reading adapter port. It removes **261 net production lines**
against `f2683274`; no schema, recovery service or configuration option replaces it.

The contract is explicit:

- A result committed to the Task remains accepted across restart.
- A finished session without Task settlement remains execution evidence.
  Recovery preserves the assignment, generation and pending input, releases the
  orphaned attempt, and retries through normal execution and validation.
- A live caller keeps its claim. Recovery checks exact ownership and confirms
  process cleanup before replacement; a terminal session marker alone is not
  proof that its shell descendants exited.
- Worker failure remains evidence; only the assigning owner closes the Task.

The cost is an additional bounded attempt, possibly another paid agent call,
when execution finishes just before settlement is lost. The App must inspect
retained evidence before repeating an external effect whose duplication matters.
No exactly-once external execution guarantee is added. Workflows already paid
this redo cost because their lost verifier/continuation could not safely be
reconstructed; direct agent execution now follows the same rule.

The new regression fails against the preceding source: it consumes the saved
proposal and mutates another Task, including while the caller's lease is fresh.
The candidate instead leaves that proposal unapplied, preserves the original
input, and accepts the replacement judgment. This is a deliberate contract
change, not a claim that the old test's expected salvage behavior never worked.
Focused tests also cover accepted results after reopen, early external evidence,
failed process cleanup and workflow verification. Recovery-only settlement
matrices are retired; normal settlement keeps the outcome/action checks.

The focused recovery/failure-report run passes 25 cases. Full `bun run ci` at
`2d837d20` passes: **2,883 passed, 3 installation-dependent skips, 0 failures**;
2,886 tests across 291 files in 152 seconds. Types, architecture and lint pass.
Design checks and 66 changed-document links pass. Later candidate verification
is recorded below. The earlier live trials retain their original revisions;
this source experiment makes no new model-cost or deployment claim.

## Direct admission cleanup

The next source slice removes the ordinary inbox worker as well. Its flow is:

```text
input event -> saved input -> synchronous App mapping
            -> Task admission + exact input link (one SQLite commit)
Task attempt -> accepted outcome
             -> event or recovery scan -> exact input-result projection
             -> existing caller dependency event
```

There is no inbox execution claim, lease renewal, capacity reservation or pump.
`AppInboxHost` validates and maps input. `admitTaskRequest()` commits the Task,
its exact input admission and applicable Topic/Request links. The Task runtime
starts execution after that commit and owns all attempt pacing and recovery.
An attached input is immutable: App reload cannot remap it to another Task.
Owner revision, distinct follow-up input and closure remain explicit actions.
Ordinary admission carries typed input, caller identity and trusted human origin.
Human Conversation context is assembled by the declared Task capability, rather
than enriching every ordinary input through a conversational inbox wrapper.

Mapping or Task-admission failure leaves the saved input pending and reports a
normal `handler.failed` fact. The existing recovery timer retries one page of
64 unadmitted inputs and checks up to 256 exact result links, yielding between
items. A partial index keeps the admission scan off completed history. No input
retry counter, new queue or model call is needed. Disabled App rows do not starve
later pages. Startup/reload and normal Task execution retain their existing roles.
A receipt acknowledges saved input; it does not claim successful Task admission.

The result copy is a read projection. Task acceptance no longer writes an inbox
ready flag, and an unavailable projection cannot roll back the Task result.
Failure reports keep input unfinished while the same Task retries. An accepted
answer uses that input's saved admission key, never the Task's latest cycle.
Explicit owner closure can be reported without inventing an answer. Neither an
input result nor that report fulfills a human Request automatically.

Historical split admissions reuse their exact stored identity. A missing input
key is backfilled only when one historical admission matches; ambiguity remains
visible for repair. Old rows remain readable. Expired ordinary result-projection claims are fenced
and cleared without remapping; a fresh old claim is left alone. Historical
Conversation execution requires
the existing stopped-Host cutover; removing their runtime APIs does not authorize
running old and new Hosts together. Test-only helpers construct old row shapes
for read/control and cutover checks; they are absent from production imports.

The accepted costs are synchronous mapping and a short SQLite admission on the
publication path, plus up to the existing recovery interval before a failed
mapping or missed result projection is retried. App mapping must stay pure and
quick. Large event fan-out still uses the existing frozen admission worker.
Input addressed to a closed or missing Task stays pending with a diagnostic;
there is no automatic remapping or successful response for unapplied input.
Owner repair is needed if the target can never accept that input.

Source checks cover atomic admission/link rollback, competing processes,
crash-before/after commit, lost-notification recovery, later-cycle identity,
continuing failure/backoff, mixed inputs and restart. Against the preceding `2d837d20`, this cleanup removes **988 net production
TypeScript lines** (300 added, 1,288 removed under `src/` and `packages/`, excluding
tests). A 254-line test-only helper retains historical row construction for
upgrade/read coverage; it is not another runtime. Full `bun run ci` at
**`84cb6364`** passes: **2,852 passed, 3 installation-dependent skips, 0 failures**
(2,855 tests across 290 files, 133 seconds). Types, architecture and lint pass.
Design checks and 51 changed-document links pass. Hosted Quality and Container
also passed on that exact revision (run `34677906080`).
This is a mechanical source experiment; it adds no live model or deployment claim.

## Saved answers and remaining scaffolding

The next source check found a real gap between result projection and return.
If an input's accepted answer was saved but its completion notification failed
before Event publication, the caller's Condition stayed open. Journal replay
had nothing to deliver. A periodic review could see the receipt's `done` status,
but its prompt did not carry the answer. The caller should not have to discover
that result through its own polling.

`recoverTaskConditions()` now reads the exact completed input receipt for each
retained App dependency and applies it through the existing Condition transition.
`core/inbox/input-result.ts` constructs the same answer for live notification and
recovery. No new queue, delivery flag or retry worker is added. Saved input identity
selects the result; the destination Task's latest outcome cannot replace it.
The cost is an exact receipt lookup for each open App-dependency route during
existing recovery, and recovery-interval latency when the notification is lost.

The regression first failed against `84cb6364`, both with and without restart:
recovery did not wake the caller. The revised test saves the first answer,
fails its publication, lets the worker produce a different answer, then recovers
the caller. It receives the first answer once, including its structured result
and evidence. Repeated recovery does not rerun either Task. A saved result for
an unrelated system input cannot satisfy an App return link.

This follow-up also removes three remnants of the earlier model:

- The controller no longer counts wait reviews or labels the third one `final`.
  Checkpoint timing remains; the assigning owner decides whether to continue.
- Input context preparation no longer follows historical inbox waits. Human
  origin uses one shared read, while results arrive as Task input. The old
  Conversation execution cutover requirement still applies.
- Fixtures no longer pass removed inbox capacity/frontend-selection options.
  Admission checks assert synchronous exact attachment; real Task-capacity tests
  retain their coverage.

The execution and admission model is now clearer, but the system is not yet
uniform at every boundary. Child transitions, App input receipts and Topic-linked
follow-up still express result return differently. Keep the next change focused
on that contract; simply moving these functions or adding a universal event
adapter would preserve their maintenance cost. The saved-answer regression is a
prerequisite for that change, not proof that the return protocols are unified.

Host commits `3203fedd` (saved-answer recovery) and `6319aa55` (scaffolding
cleanup) remove **61 net production TypeScript lines** against `84cb6364`
(62 added, 123 removed under `src/` and `packages/`, excluding tests).
Full `bun run ci` at **`6319aa55`** passes: **2,852 passed, 3 installation-dependent
skips, 0 failures** (2,855 tests across 290 files, 137 seconds). Types,
architecture and lint pass. Canonical design checks and 43 changed-document
links pass. Hosted Quality and Container checks also passed at that revision. Earlier live trials keep
their actual revisions; this check adds no live-model or deployment claim.

## One Task notification; no automatic retry relay

The next audit found a smaller deletion before combining return links. Every
Task outcome already publishes `project.task.reconciled`, and owner closure
publishes `app.task.cancelled`. The runtime also published a second Task-level
`app.dependency.completed` or `app.dependency.updated` notification. Composition
translated the latter into another App-dependency update, with special Condition
matching to wake the caller even when no answer had been accepted. A recorded
wait could therefore start a caller review, contrary to the shared-loop baseline.

The candidate now uses the existing Task outcome and closure events to refresh
both saved input answers and Topic-linked observations. Only an exact saved App
answer emits `app.dependency.completed`. It removes the second Task notification,
the retry/progress relay, its special Condition route and the legacy unscoped
Task/session notification contract. Events without an exact App and Task no longer
cause a broadcast result scan. Existing bounded result and Condition recovery
repair missed notifications from saved state.

The accepted cost is fewer automatic reviews: a typed caller does not run another
attempt for every worker retry or saved wait. Failed-attempt evidence, retry times
and status remain readable; its existing review deadline or an explicit App event
route can request judgment. This does not remove human input, owner controls or
Topic-linked failure reporting. In this candidate, a typed input's failure remains
unfinished while the worker retries; an accepted answer or owner closure resolves
its receipt. Automatically returning failure evidence through one shared caller
link remains part of the larger proposed unification, not a claim of this cleanup.

Two different needs remain visible: an input wants its **exact answer once**;
a Conversation's Topic link can observe **several outcomes and eventual closure**.
A common caller link must preserve that distinction or explicitly retire ongoing
observation. Merely forcing both into a generic adapter would add cost without
removing a contract. The current change shares their Task notification source
while retaining their existing saved evidence and admission rules.

The wait regression failed before the change because it emitted an extra
dependency update. Focused checks now prove that repeated wait notifications and
legacy progress hints leave the caller quiet; exact answers still return after a
later worker result, and outcome/closure projection stays scoped to the App and
Task. The existing saved-answer/lost-notification and restart regressions remain.
Host commit `d220d4d7` removes **106 net production TypeScript lines** compared
with `6319aa55` (16 added, 122 removed, excluding tests). Full local `bun run ci`
passes: **2,853 passed, 3 installation-dependent skips, 0 failures** (2,856 tests
across 290 files, 139 seconds). The source change adds no live-model or installation
claim.

## Dead helpers removed; active convergence remains

A reference audit across Host source, portable tests, scripts and App consumers
also found five unused Host exports. Removing them needs no replacement path:

| Removed helper | Why it can go |
| --- | --- |
| `listUnlinkedAppDelegations()` | Its old `delegate:` inbox-link recovery has no caller after direct Task admission. |
| `isTaskAttentionReadyForReview()` | No runtime uses this separate attention-review classifier; current input/result and retry rules own the behavior. |
| `saveProjectRuntimeState()` | The JSON write path has no caller. The project read model and historical evidence reader remain. Its private directory/write helpers are removed too. |
| `listConversationTopics()` | The unused wrapper discards pagination; current callers use the Topic page or exact read. |
| `normalizeStringArray()` | An unused Task-store normalization helper. |

These are dead entry points, not five running subsystems. No new fallback,
compatibility switch or abstraction replaces them. The live return paths below
still have consumers and require contract/consumer changes before deletion.

Host commit `9d34e90b` removes another **55 net production TypeScript lines**
(2 added, 57 removed). Together with `d220d4d7`, this is **161 net production
TypeScript lines removed** from `6319aa55`. Final full `bun run ci` at
**`9d34e90b`** passes: **2,853 passed, 3 installation-dependent skips, 0 failures**
(2,856 tests across 290 files, 142 seconds). Types, architecture and lint pass;
canonical design checks and 56 changed-document links pass. Hosted checks for
this revision are pending. No new model trial or production operation ran.

## Retire raw worker creation

The user accepts breaking contracts when the design and useful scenarios remain
sound. That makes the next small deletion worthwhile now: workers request new
work through typed App input, instead of authoring raw child Task specifications.
The destination App validates the input and chooses the specification, identity
and executor. The Host keeps the input and exact return link. The worker judges
the desired work and returned evidence without managing the return process.

The source candidate removes `create-task` from `TaskAction`, the model schema,
result admission and reconciliation. It also removes creation-only defaults,
root aliases, replay-spec matching and missing-resource mutation bookkeeping.
Existing `update-task` and `unblock-task` actions still require exact target
identity/generation; a worker cannot rewrite its own assignment. Authorized
owner closure remains separate. There is no compatibility adapter.

A worker returns `state: "waiting"` and a stable dependency
`{ id, appId, input: { kind, data } }`; it chooses a supported input from the App
catalog. Optional `taskId` continues exact existing work. The App can reject an
unsupported request or map it to existing work. Independent work must actually
map to a distinct Task, not recursively delegate to the caller itself. Accepted
outcomes still leave Tasks open; waiting for a reply does not reserve execution.

This slice removes **273 net production TypeScript lines** from Host `9d34e90b`
(20 added, 293 removed under `src/` and `packages/`, excluding tests). It also
retires the 302-line early `follow-through.ts` harness. Its revision-bound live
results remain historical evidence; the broader `shared-loop.ts` trial is the
current execution harness. `run.ts` measures delegate/ask/wait judgment only;
it no longer translates a delegate decision into raw child creation.

The retained hierarchy is an explicit limit. App-declared and previously stored
children still use implicit parent waits, `TaskAttempt.children` and
`project.task.child-transitioned`. Tests declare those fixtures through App
intent; they do not introduce a replacement creation adapter or claim the
hierarchy proves typed delegation. In particular, waiting on all pending children
can include unrelated work; the exact-target action test verifies separate caller
answers when work returns out of order. New assignment uses typed input and its
saved correlation instead.

The paired Host Operations workflow now preserves typed dependencies and no
longer rewrites raw creation into waiting. Its prompt explains independent App
input and existing-Task actions. Its disclosure schema composes with the SDK
result union, preserving failure/result validation rather than reading nonexistent
union properties. The local validator and review artifact also accept `stopped`,
preserving an honest failure report for core retry instead of rejecting the
SDK-valid output. Focused workflow, schema and App-routing checks pass.

A wider source audit found more consumers in Evaluation's owner-review guards
and Scout's knowledge planner. They still contain raw-creation rules and removed
normalization options. **They must be migrated and scenario-tested before those
Apps are adopted with this Host.** Do not install this SDK beneath unchanged App
consumers or silently route them through a compatibility shim. Their optional
capability can be omitted only after dealing with its retained work. This source
slice is not installation readiness.

### Scenario evidence for this deletion

- Real worker tests exercise typed A → B → C → B → A, human input while work
  continues, original answers across reopen, process loss and affordable redo.
- Reconciler/runtime tests retain failure backoff, owner prerequisite repair,
  revised generation fencing, owner closure, and rejected late effects.
- Saved-answer tests retain exact correlation after newer worker outcomes and
  a lost completion notification. Repeated recovery cannot create another answer.
- Raw creation is rejected by both the SDK schema and admission. Atomic-effect
  tests use supported updates and assert the existing target remains unchanged
  after rejection. The paired App accepts typed dependencies and rejects raw creation.

These automated checks add no new model, deployed-App or transport trial. Earlier
live adoption/withdrawal/correction evidence below keeps its original revisions.
Host **`94864da1`** passes the complete `bun run ci`: **2,849 passed,
3 installation-dependent skips, 0 failures** (2,852 tests across 290 files,
140 seconds), with types, architecture and lint passing. The four fewer tests
than `9d34e90b` reflect retired creation-specific expectations; supported atomic,
stale-effect and input-return scenarios remain. Paired App **`c3d23a56b6`**
passes **22 focused workflow/schema/routing tests** against the candidate SDK.
Canonical design checks and **45 changed-document links** pass. Hosted checks
on the new Host revision are pending; optional App migration is still a gate.

## Next deletion, in order

The review objective is convergence on one understandable input, reconciliation
and return path. Remaining child-transition, typed-answer and Topic-return
mechanisms are unfinished convergence work. Before adding another local fix,
check whether moving its scenario onto the common path removes the need for it.

Raw worker creation is now removed before combining return links: the breaking
source contract has a proven typed-input replacement, so it need not wait for a
larger state migration. This changes the earlier proposed order without claiming
that every retained child return path has disappeared.

Next evaluate one saved caller link for human follow-up and nested delegation,
including exact input answers versus ongoing Topic observation. Prove
**A → B → C → B → A**, concurrent human input and owner withdrawal through that
common link; retain the saved-answer/lost-notification regression. Typed failures
currently remain unfinished while their worker retries; Topic links can report
accepted failure evidence. Decide that difference explicitly before retiring
implicit parent failure/progress wakes. Convert or drain retained links during
the planned offline cutover. Do not make agents reproduce old request identifiers
or introduce another runtime switch.

Only then reconsider remaining tree scheduling and mutable snapshot writes.
Measure deleted transitions and branches, not moved lines. Each slice names its
retired contract, remaining scenarios and accepted cost. The current candidate
removes session-result recovery, the ordinary inbox worker, automatic dependency
progress relays and raw worker creation; shared return-link storage is still pending.

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
source. These counts describe `f2683274`, before the recovery removal above.
The earlier conclusion that further savings mostly required weakening identity
checks was too narrow. Retiring the alternate acceptance path keeps those checks
and reduces ongoing source to **229 net lines fewer** than that main baseline.
Including the 517 offline-converter lines, production source is still **288 net
lines larger**. The larger admission/return-path reduction remains to be proved.

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
