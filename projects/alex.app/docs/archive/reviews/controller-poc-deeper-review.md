# Does the common Task loop pay for itself?

> Historical record. Status, revisions and deployment observations below belong
> to the recorded review or trial, not the current installation. Follow the
> linked owning contracts for current behavior. Open limitations remain evidence;
> archiving this record does not establish that they were resolved.


**Supports:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Tests whether the common lifecycle reduces complexity while preserving natural delegation and recovery.

**Choice basis:** [Applicable philosophy and convention](../../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../../1-principles/core-principles.md#resolve-conflicting-designs).

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

This section records the baseline before `860f3a2e`. The later
[nested caller-feedback slice](#nested-caller-feedback-poc) adds one accepted
blocker report per input; it does not restore per-retry or passive-wait relays.

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

## Capability and cost assessment

The comparison is with the supported behavior before each change, over the
same workload and useful lifetime. Capability lost is a cost even when the
new implementation passes every remaining test. Preserving a scenario through
more App code, model attempts or human intervention also has a cost.

| Choice | Value gained | Capability reduced or cost added | Current judgment |
| --- | --- | --- | --- |
| Typed App input replaces raw worker creation | One assignment route; the App owns specification and executor selection; fewer creation and replay rules | Workers cannot directly invent arbitrary child specifications or select executors. Work outside the App's input mapping may need an App change. Evaluation and Scout still need migration. | Nested delegation and an unfamiliar manifest audit use the existing general goal input. Broad ad hoc delegation coverage and migration cost remain unproved. |
| Remove automatic retry/progress relays | Fewer redundant owner attempts and notification rules | Owners can learn about failure later through a scheduled review, explicit input or inspection. Backoff reduces retry frequency but does not bound lifetime spending. | Quiet routine waits are useful. Measure intervention delay and extra retry spending before treating failure-feedback convergence as complete. |
| Redo an unaccepted attempt instead of accepting a saved session result | One acceptance authority and less recovery state | Extra compute, delay and possible repeated external effects | Suitable where redo or checking the existing effect is affordable. Process tests prove exercised cases; they do not make arbitrary external actions safe to repeat. |
| Combine exact input answers and ongoing Topic/child observations | Potentially one correlation and return mechanism | A once-only answer cannot by itself replace later outcomes, failure reports or closure updates that matter to an owner | Keep useful follow-through in the common path. Retire ongoing observation only when its scenario's value does not justify the cost; no such blanket retirement is justified yet. |

Use the existing philosophy's rough comparison, without invented scores:

```text
expected improvement = useful value gained + costs avoided
                     - useful capability lost - additional costs
```

Count each consequence once. Additional costs include migration, expected uses
times extra execution/delay, upkeep, human workarounds, and expected failure loss.
Keep unlike units visible rather than forcing them into one monetary number.
For this frequently used core, recurring effects deserve more weight over its
expected lifetime. For an uncertain experiment, immediate usefulness and learning
can justify affordable temporary inefficiency. High-consequence failures still
need protection even when their average expected cost looks small.

The automated scenarios and live trials support retained abilities; there is
no controlled before/after measurement of total maintenance effort, model cost
or human supervision. The 273-line reduction is a concrete deletion, not an
estimate of those savings. The [capability probes](#capability-and-owner-help-probes)
exercise unfamiliar work and owner help, including a failed run and the fix it
motivated. Reject or revise a simplification if displaced work and lost
capability outweigh its recurring benefit.

## Capability and owner-help probes

These trials use the same generic May `goal` input, real worker processes,
temporary SQLite, and `gpt-5.6-sol`. The source supplies synthetic measurements
or a release manifest. The App declaration and role text are copied unchanged;
the experiment selects the model and restricts tools to coding and finish.
The human asks a separate discussion question while the source is held, then
checks the result again after reopening the runtime and database.

| Trial | Host / App revision | Outcome | Attempts / model responses | Elapsed | Reported tokens |
| --- | --- | --- | --- | --- | --- |
| Fresh natural measurement ask | `94864da1` / `c3d23a56b6` | Delegated without an explicit background-work instruction; correct 0.92 versus 0.90 result, discussion and recall | 5 / 6 | 41.7 s | 54,930 |
| Unfamiliar manifest audit | `91b7e210` / `c3d23a56b6` | Existing App input handled 3,200 total compressed bytes and the missing `parser` license; discussion and recall preserved | 5 / 7 | 49.2 s | 64,845 |
| Source requires human repair, before polish | `91b7e210` / `c3d23a56b6` | Failed: help remained in a wait; exhausted the experiment allowance without notifying the human | 12 / 28 | 236.3 s | 245,125 |
| Same repair scenario, after polish | `3f6c79d6` / `1ec74e3760` | Human informed; original Request and worker retained; recovered 0.92 result and recall | 8 / 11 | 88.0 s | 109,363 |
| Repair with a below-threshold sample | `3f6c79d6` / `1ec74e3760` | Same path; correctly judged 0.78 below 0.90 after repair, and recalled the limitation | 8 / 12 | 80.9 s | 118,228 |

The first two trials each read the source once. The failed repair trial made
12 failed HTTP reads. Its thirteenth dispatch request was rejected by the
experiment limit before another worker started. Those three recorded zero tool
execution errors: a command can complete successfully while the HTTP source
reports failure. Provider token totals include reported cache reads; they are
observations, not verified charges or estimates of production spending.

After polish, owner feedback arrived **25.6 seconds** after the first failed
response, following one failed read; the worker then made one successful read.
The below-threshold run used unchanged source/guidance, reported the need after
**23.6 seconds**, and made three failed reads before one successful read. It
also attempted to read an absent optional feedback file, recorded one tool error,
and continued correctly. This is a small recoverable cost of the reduced App
fixture, not a failed result or evidence of faultless tool use.

Both repaired runs required one simulated human restoration plus its ordinary
message. Their eight attempts include failure feedback, the repair discussion,
the worker retry, final return and restart recall. The fixture restored the source
as soon as useful feedback arrived; it does not measure real human response time
or prolonged-outage spending. These are single trials, not a reliability rate or
a controlled estimate of savings from the overall refactor.

The failed run exposed two different problems:

- **Meaning:** the worker correctly diagnosed the unavailable source but put
  the human's needed action in a new Condition. That records a wait; it does
  not notify its owner. Waiting outcomes deliberately do not trigger ordinary
  caller attempts. May's guidance now uses an honest failure report when a
  missing prerequisite prevents assigned work. The Host protocol explains
  what a Condition and its review timer actually do.
- **Mechanics:** after the first timed review, the agent followed the rule to
  omit unchanged waits. That preserved the Condition but left its review date
  overdue, causing immediate further attempts. Settlement now resolves retained
  or supplied waits into one list and uses the existing scheduling path for both.
  It renews due reviews, preserves future deadlines and never asserts that the
  awaited fact became true. No new queue, state field or retry mechanism is added.

The regression first failed against the old implementation. Both forms of wait
now pass repeated review and restart checks; independent future waits retain
their dates and satisfied waits are removed. The focused reconciler, checkpoint
and protocol run passes **191 tests**. This fixes a real recurring execution
cost while removing a separate settlement branch.

Full Host `bun run ci` at **`3f6c79d6`** passes: **2,851 passed,
3 installation-dependent skips, 0 failures**, across 290 files in 138 seconds.
Paired App **`29dc9e2b94`** passes 28 May/Host Operations routing, schema and
workflow checks against that SDK. It adds the guidance used in the live trials
and removes a stale assertion for exact Conversation-specific wording; the
role text and App mapping match the live **`1ec74e3760`** revision.

The owner-repair gate restores the source only after the human-facing Task
handles failure evidence and explains the needed help. The fixture then sends
ordinary human input and requires the original Request, same worker, exact
result and restart recall. Those trials prove Topic-linked feedback only. At
`3f6c79d6`, a nested typed caller receives an exact answer or closure, but no
automatic failure evidence. The next slice below tests that gap directly.

## Nested caller-feedback PoC

The first implementation is Host **`860f3a2e`**. It saves the first accepted
failure attempt against the exact admitted input, separately from its eventual
answer. The acceptance transaction writes both the failure evidence and input
reference. `app.dependency.updated` returns either `blocked` evidence or `done`
(answer/owner closure) through the existing Condition route. These are feedback
values, not additional Task phases. A blocker leaves the wait false and the
input unfinished. Its observation remains in the caller's Open Waits.

Live notification and saved-state recovery use the same event builder and
Condition transition. A caller in retry backoff can still receive the eventual
answer. Repeated worker failures do not create more caller input after the
first report, although a caller that reports its own failure still retries its
own unfinished work. Input-backed Topic follow-up uses the same first-report
selection, including recovery; the admission target index bounds that lookup.
Seeded Tasks without admitted input retain existing per-attempt Topic reports.
This shares feedback mechanics without claiming all relationship storage is unified.

The deterministic cases cover live delivery, lost publication and restart,
original input retention, report deduplication with changing failure prose,
eventual answer while the caller is pending, and unchanged Task lifetime.
The Topic case makes three failed attempts and verifies one returned failure
input before success. Offline-cutover cases preserve wait identity when renaming
the event and restore only an accepted report tied to its original input;
replay is idempotent. Existing closure and exact-answer regressions remain.

The first live nested trial exposed an App judgment gap. The collector accepted
source unavailability as a completed diagnostic; the reviewer then put the
needed human action into a passive Condition. No first `stopped` report existed
to return. The agent also made an invalid Condition-owner proposal, which the
Host rejected before accepting its later wait. A successful diagnostic does
not establish success of the containing assignment, and recording a wait does
not contact the human.

Paired App **`86bcf3d8ef`** now tells May to carry the required outcome into its
delegation and to report a blocker when its own assignment cannot progress,
even when a diagnostic child legitimately returned an answer. This is guidance
owned by the App; core does not interpret HTTP errors, task prose or diagnoses.

| Nested trial | Host / App | Outcome | Worker dispatches / model responses | Elapsed | Reported tokens |
| --- | --- | --- | --- | --- | --- |
| Initial guidance | `860f3a2e` / `29dc9e2b94` | Failed: a completed diagnostic followed by a passive help wait never notified the human; hit the six-minute experiment limit | 6 / 7 | 376.0 s including cleanup | 63,798 |
| Clarified delegation and blocker guidance | `860f3a2e` / `86bcf3d8ef` | Passed: C → B → A blocker, human repair, same C → B → A answer, original Request and restart recall | 13 / 18 | 113.4 s | 181,653 |
| Below-threshold diagnostic repair | `ba4bae9e` / `86bcf3d8ef` | Passed: same collector accepts fresh input after repair, original diagnostic answer stays intact, correct 0.78 conclusion and restart recall | 15 / 20 | 163.8 s | 201,755 |

The successful trial returned useful human feedback **30.4 seconds** after the
first failed HTTP response. The source was read twice: one 503 and one successful
measurement after simulated human repair. Its 13 attempts comprise six
human-facing turns, five reviewer attempts and two collector attempts. The
reviewer reported its own failure twice before the owner responded, then waited
for the same collector after repair. Only its first failure became Topic input.
The final response correctly judged **0.92 above 0.90 by 0.02**, and restart
recall retained both the result and the one-sample limitation. One tool call
failed because `python` was absent; the agent continued using an available tool.

The below-threshold trial used the diagnostic-answer path. Useful human feedback
arrived after **43.1 seconds**. It made one failed HTTP read and one successful
read, then correctly judged **0.78 below 0.90 by 0.12**. The earlier diagnostic
answer remained unchanged; new input on the same collector carried the later
measurement. All three Task identities remained open. Its 15 worker dispatches
produced 14 started attempts (six human-facing, six reviewer, two collector),
20 model responses and zero tool errors. One reviewer result conflicted with
newly admitted evidence and was fenced; retry used current state.

These numbers show capability and its cost, not a reliability rate or measured
savings. Nested interpretation and forwarding add model calls, and first-report
suppression does not stop the reviewer's own retries. One simulated human repair
was still required. Provider token totals include cache reads; they are not
verified charges. The initial failure matters: mechanics cannot compensate for
an App accepting the wrong outcome or recording help in an unreturned wait.

A below-threshold transfer at **`3e9b980c` / `86bcf3d8ef`** reached the human
with a useful blocker, then stopped after 52.8 seconds at the PoC's assertion
that the collector input must remain unfinished. Its reviewer had explicitly
allowed the collector to return either a measurement or precise failure evidence;
that diagnostic input was legitimately answered. The larger Request remained
open. This result is **incomplete**, not evidence of end-to-end repair and not a
lost runtime notification.

The PoC now accepts either declared contract. For continuing acquisition, it
requires the original input to receive its report and later measurement. For a
completed diagnostic, it requires fresh input on the same collector after repair
and proves the earlier answer remains unchanged. Both use ordinary typed input;
there is no new runtime mode or synthetic feedback translator. App guidance
should favor continuing acquisition when the actual responsibility is to obtain
a measurement; a one-shot diagnostic is useful when that narrower answer has value.

The follow-up Host **`3e9b980c`** shortens its protocol to keep the existing 4 KiB
prompt limit and strengthens assertions outside the executor boundary, where
runtime failure containment cannot swallow them. The test verifies both accepted
caller results and original input in `continuedInputs`, then admits a different
input to the same worker and proves it cannot inherit the earlier report.

Validation: at **`3e9b980c`**, the complete Host gate passes **2,856 tests,
3 installation-dependent skips, 0 failures**, across 290 files in 150.4 seconds.
The later `ba4bae9e` change is PoC-only: its type check and live diagnostic-repair
trial pass. `d3e41b39` only updates experiment usage. Paired App `86bcf3d8ef`
passes **28** routing/schema/workflow checks. Canonical design checks and local
links pass; hosted checks on the final source are tracked in PR #158. Host/App
changes still await human review and separate adoption; no deployment was made.

This slice deliberately returns one initial blocker and the eventual answer or
closure. Later different blockers and useful intermediate progress need a
separate value/cost decision; they remain readable in attempt history. First-report
suppression is not a general progress subscription and does not prove low cost
during a long outage. Do not retire ongoing Topic or retained child observations
on the strength of this narrow trial.

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
common link; retain the saved-answer/lost-notification regression. The first
caller-feedback slice returns one accepted blocker without settling the input,
and uses the same selection for input-backed Topic work. General progress,
changed blockers and seeded work still need an explicit cost/benefit decision
before retiring implicit parent failure/progress wakes. Convert or drain retained links during
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

See the [PoC runner instructions](https://github.com/hao1939/may-agent/blob/38a048da5c105bea91dc7163010d94483a60b747/scripts/poc/controller-judgment/README.md)
for the three repeatable trial commands and their bounds. Raw reports, transcripts
and provider usage stay local; only synthetic findings are published here.
