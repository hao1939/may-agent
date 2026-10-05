# Task attempts and results

**Supports:** [Task Resource Engine](task-resource-engine.md). Lets agents, workflows and native workers make progress through one execution and result boundary.

**Choice basis:** [Apps own meaning; the Host owns mechanics](../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics).

**Design status:** Accepted.
**Implementation status:** The shared attempt interface, result admission and live/final change admission are implemented in Host source, including #285. Scoped acceptance while input remains is implemented in candidate Host `d44c56ff6`; see [accept work and continue what remains](#accept-work-and-continue-what-remains) and its validation record. It is not deployed. The proposed `decision` spelling remains deferred. App adoption and deployment remain separate.

An attempt is one bounded execution of a Task. It can read, act, request help,
check results and repair several times before returning. Infra supplies current
scope and context, executes admitted changes and maintains the Task between
attempts. The worker judges what its result means under App acceptance policy.

Read the [agent guide](../2b-manual/task-execution-guide/SKILL.md) for ordinary use.
[Task lifecycle and Conditions](task-resource-engine.md) own durable state;
[agent and workflow contributions](execution-contributions.md) own bounded helper calls.
The sections below are the reference for executor and App implementers.

## Agent judgment and infra admission

The worker judges actions, sufficiency and completion within its assignment and
App policy. Infra validates identity, authority, freshness, schema and any
declared acceptance checks, then records and executes the admitted decision.
Accepted convergence marks the addressed input done and returns its result;
callers can use it without a mandatory second judgment.

This is trust by default, not guaranteed correctness. Existing attempt identity,
facts, results and acceptance evidence explain the decision. An outstanding
Condition keeps its actual observation state; it does not grant infra a new
semantic veto or become satisfied merely because work converged. New evidence
can be reconsidered through the responsible owner's existing input/control path.
Completing addressed input does not close the Task or erase its other work.

## Accept work and continue what remains

**Accept useful work, record what it fulfills, and continue what remains.**
A result can be accepted before the whole assignment is finished. This lets May
build on useful work while requirements arrive, reducing repeated work and
human reminders in support of [its purpose](../1-principles/purpose.md).

Keep three meanings separate:

| Meaning | Agent judgment and infra responsibility |
| --- | --- |
| Contribution accepted | The agent reports progress and evidence. Infra validates and records the contribution within its considered scope; a request may still be unfinished. |
| Requirement fulfilled | The agent judges which requested outcomes have been delivered. Infra records fulfillment for exactly that input scope and retains the rest. |
| Execution continues, waits or ends | The agent chooses the useful next step under App policy. Infra runs or schedules admitted work and preserves outstanding input and Conditions. |

For example, a request asks for a bug fix and verification. The patch can be
accepted as progress while tests run; the request remains unfinished. After
tests pass, the agent can judge that request fulfilled. If another requirement
remains, continue it using the accepted work. Several messages may belong to
one intention and be fulfilled together; no per-message attempt is required.

Ending an attempt releases that execution; it does not erase the Task's work.
Infra derives Task state from the accepted decisions, remaining input and waits.
Owner closure is a separate control. An outstanding Condition retains its actual
state while useful independent work proceeds. These distinctions use existing
results and input records, without a new `partially-complete` Task phase.

Pending input alone must not invalidate an otherwise admissible contribution.
It remains accountable for a later decision. A later correction may require
revising accepted work; acceptance records the scoped judgment, not guaranteed
correctness against requirements the agent has not considered. Infra still
checks current authority, attempt identity and affected revisions. Result and
proposed effects remain atomic where required: a saved draft is progress, but
a rejected review request cannot be recorded as delivered.

[Workspace ownership and cleanup](#workspace-ownership-and-cleanup) follow the
settled Task state. Accepting one contribution does not make all artifacts
disposable.

This follows [agent judgment and explicit infra rules](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge):
neither a new message nor a successful contribution establishes the semantic
state of all remaining work. The agent makes that judgment; infra keeps the
records and executes it.

Ordinary messages change the understood requirement when the agent interprets
and records that change. The next decision considers queued corrections and
reuses still-valid work. Explicit Stop/cancellation immediately fences its
execution identity; it is a control, not another ordinary message. An action
prepared under the previous understood requirement can therefore be admitted
before a queued correction is read. The Host must not claim that unread input
was incorporated, or infer meaning from whether its source is human or system.
Live steering, where supported, lets the agent reconsider at useful boundaries;
it does not require waiting for all possible later messages before acting.

**Source availability:** Candidate Host `d44c56ff6` applies this rule to final
completion, partial results, live actions, cross-App requests, Conversation
Request changes and creator Task revisions. Existing attempt, authority,
affected-revision and transaction checks remain. Workspace release derives from
actual settlement; a separate prediction of Task completion is unnecessary.
The agent result schema is unchanged: `waiting` with `continue: true` accepts progress;
`converged` fulfills its selected inputs. One result has one disposition for
its selected set. The [PoC record](../archive/reviews/burst-input-progress-20261003.md#implementation-candidate-and-poc)
records portable checks and limits; source validation does not establish live
adoption, agent judgment or token savings.

## Workspace ownership and cleanup

Keep accepted work usable, and remove disposable execution artifacts without
repeating an agent's work. This supports scoped progress and follows the
[independent-facts rule](../1-principles/core-principles.md#code-executes-and-brings-back-evidence-agents-judge)
and [safe retry](../1-principles/core-principles.md#safe-retry-by-default-explicit-exceptions).
The agent judges its contribution. Infra owns workspace identity, retention and
cleanup; none requires another agent decision or result field.

Inspect workspace acceptance prerequisites without removing artifacts, then
admit the result and proposed actions against current authority and revisions.
A Stop or Condition change during awaited Git checks must leave the workspace
available when admission rejects the result. Preserve useful returned evidence
inside the existing result-rejection path; a rejected result is not an executor
that produced no output. In-execution preflight still lets the worker correct a
proposal before final settlement.

Release a clean, integrated workspace only in the transaction that accepts the
result and records that no work remains. Until then, pending input and Conditions
retain the exact checkout. Final actions use normal admission, so retiring the
last Condition and satisfying it naturally lead to the same release decision.
A released workspace is no longer reusable, even while physical removal is
pending: newer work receives a distinct checkout, branch and private refs.
Retries of unfinished work reuse their retained checkout.

Remove released artifacts after settlement. A cleanup failure cannot undo
accepted work or rerun its agent; retain the workspace identity and cleanup error
as operational evidence. This separates acceptance from cleanup without holding
a database transaction across Git I/O.

Ownership, observed filesystem state and successful cleanup are different facts.
`released` records that the Task relinquished a workspace. Its physical
`disposition` is an observation: `removed` can mean the checkout and branch are
gone while private Git refs still remain. Every released workspace passes through
the same idempotent finalizer, even when inspection reports `removed`. The adapter
rechecks the workspace and removes only that lineage's disposable checkout,
branch and private refs. A late dirty edit or failed Git operation is retained
and reported; it cannot reverse accepted work.

The Task keeps `workspaceAttemptId`, an exact reference to the attempt holding
its latest workspace record. Recording workspace metadata advances that reference
under the current claim's existing transaction and revision fence. Attempts that
use no Git workspace leave it alone. Old cleanup writes only its own attempt;
it cannot move the Task's reference back. Recovery uses this reference, not a
bounded recent-history list or wall-clock sorting. No workspace record is copied
to a second owner.

For historical Tasks without that reference, discovery uses their prior timestamp
ordering over stored workspace records, without the context-window limit; the
next successful preparation records the exact reference. This compatibility path
cannot reconstruct ordering that old records never captured. Historical
`removed` metadata without an explicit release flag still follows ordinary branch
recovery. An existing but invalid reference is reported as a preparation failure,
not permission to choose a fresh checkout.

| Situation | Infra behavior |
| --- | --- |
| Rejected or stale result | Preserve artifacts as recovery evidence; do not release ownership. |
| Accepted contribution with input or Conditions left | Retain the workspace for continued work. |
| Accepted local work not yet integrated | Retain its checkout/branch; acceptance does not imply integration. |
| Converged Task with disposable Git work | Record release with settlement, then run idempotent cleanup. |
| New work while old cleanup runs | Use a distinct lineage; old cleanup keeps its original identity. |
| Cleanup or cleanup-recording failure | Keep acceptance, report the failure, and retain the released identity for operational inspection. Do not rerun the agent. |

Filesystem operations and SQLite are not one atomic transaction. If cleanup
bookkeeping fails, the durable release still identifies work that may need
inspection; it does not prove physical removal. Automatic collection after a
process exit remains outside this change.

## One attempt interface

Executor choice does not change Task semantics:

```ts
type TaskExecutor = (attempt: TaskAttempt) => Promise<TaskReconcileResult>;
```

The SDK-owned `TaskAttempt` supplies exact App/attempt identities, cancellation,
resolved role, current `TaskDetail`, working/output paths, direct child/wait views,
ordered unaccepted Events, result schema and fenced `apply`/`publish`/`onEvent`.
Transport adapters preserve this contract when projecting it to JSON.

An executor reads current Task state and its bounded unobserved event batch,
keeps working while safe progress is available, optionally publishes retry-safe
progress or findings, and returns a proposed result, an exact external wait or
a truthful blocker. The Host admits the returned result. Internal model turns
and bounded work/check/repair iterations are not new Task attempts. `onEvent` is
an optional low-latency view of new durable Task input such as feedback,
approval, steering, or cancellation.
The listener's attempt-local `accept` consumes the exact input only with an
admitted result; the next attempt still receives it if the executor cannot
incorporate it live. New input does not invalidate facts or completed work.
The Runtime accepts an admissible result for its considered scope while leaving
other input pending. Results proposing Task actions remain atomic with those
actions. Cross-App requests and immediate actions use the same current-attempt
and authority checks. A genuine rejected result remains recovery evidence;
a queued message alone is not a rejection. Clean workspaces remain reusable
when input or unresolved Conditions remain.
The Runtime owns fencing, leases, event persistence, result admission and
recovery, so an executor implements no scheduler, queue, retry loop across Task
attempts, or Task storage. Bounded repair inside one execution follows the
[workflow repair convention](execution-contributions.md#repair-within-an-attempt).

A wake asks the Host to check a Task's pending work. One attempt receives the
pending input batch; there is no one-event/one-agent-call rule and no collection
delay. The queue holds one pending entry per Task. Signals received during
execution request one later state check, which starts agent work only if the
Task remains eligible. Every distinct update keeps its durable identity even
when its scheduling signals coalesce.

The current claim includes up to 32 ordered events, with human input admitted
before a system backlog fills the batch. Overflow stays pending for subsequent
bounded work. Input accepted live can join the current attempt; unseen input
remains for the next one. At settlement, a plain `project.task.tick` received
while work was running is covered by the current review and is cleared. New
facts, messages and requirements are retained until considered. A later tick
received after settlement can request a new scheduled review. Failure recovery,
explicit continuation and due review deadlines retain their existing rules.
Clock-wake settlement is implemented in [Host `7b416af40`](https://github.com/hao1939/may-agent/commit/7b416af40),
under review in [#295](https://github.com/hao1939/may-agent/pull/295); source
validation does not establish deployment.

`signal` cancels current managed, workflow or native execution, including on
fenced Turn Stop or owner closure. It complements durable controls and result
fences; aborting an attempt alone does not close its Task.

An event addressed to `{ appId, taskId }` is durable Task input. Managed
sessions can receive it live; a headless CLI that cannot accept a live message
receives it on the next attempt. Both return through the same result fence.
Executor selection follows [the selection contract](#selecting-the-attempt-mechanism):
Host registrations take precedence over built-in adapters, and a missing name
records visible failure and paced retry. Native process records, session IDs,
prompts and outputs are attempt evidence, never another work authority.


## Selecting the attempt mechanism

Agent selection is:

```text
task.agent ?? nearest explicit ancestor agent ?? app.agent
```

The declared workflow or executor is the initial procedure. If that procedure
fails and the responsible agent is available, the next eligible attempt uses
ordinary agent execution on the same Task. An explicit `needs-agent` result
uses the same handoff. A tool failure already returned to a running agent can
be handled in place; it does not create another Task or execution loop.

The Host persists the failed attempt before handoff. Its summary, failure reason,
original inputs, effects and evidence remain readable after recovery. The agent
receives current Task context and the previous attempt, investigates with ordinary
tools, repairs or works around the problem, and records the outcome and any
remaining defect for later evaluation. Recovery of the work does not establish
that its underlying defect is fixed.

The first agent claim after an unexpected procedure failure saves
`failoverFromAttemptId` on the ordinary attempt, atomically with that claim.
It links the exact failed attempt in the same Task and generation. This is
observation metadata, not another execution state or handler-selection input.
It survives a crash before agent startup and remains after accepted recovery.
Agent continuations, failed claim writes and intentional `needs-agent` or
legacy `needs-owner` handoffs are not additional failovers. The optional metric
sampler [counts the retained switches](metrics.md#procedure-to-agent-failovers);
recording them does not itself request work.

Apps choose the method; the Host durably executes the choice. This supports
[useful work with less supervision](../1-principles/purpose.md) by allowing an
agent to repair a procedure and return routine work to it, while keeping
recovery policy outside the stable Host. Result acceptance, input fulfillment,
waiting and execution selection remain independent facts.

**Execution-selection status:** implemented in the candidate Host branch
`fix/task-execution-selection-20261005`, not yet merged or deployed. The current
installed default still retains agent execution until a specification revision.
Only use the action after its schema is available at the execution boundary.
See the [contrasting trial and limits](../archive/reviews/task-execution-selection-20261005.md).

A `select-execution` action, admitted through the same live/final change path,
chooses `declared` (this Task's configured workflow or executor) or `agent`
(its responsible agent), with a reason. It applies to the next **eligible**
attempt of this Task and generation. It does not change requirements, answer
input, retire a Condition, wake work or bypass backoff and Stop. Selecting
`declared` requires a configured procedure. This is a method choice within the
assignment, not reassignment authority.

The decision and reason are saved on the ordinary attempt and passed to the
next attempt as `previousAttempt.executionSelection`. The next claim records
the chosen handler. Its later failure can enter agent recovery again. A
specification revision selects afresh; stale attempts cannot redirect it.
There is no recovery-mode record or secondary Task lifecycle.
An admitted live choice survives later execution failure or interruption.
A choice proposed only in a rejected final result has not been admitted.

Omission retains the existing selection rule: a failed procedure hands off to
an available responsible agent, and subsequent attempts remain with that agent
across failures, partial progress, waits, convergence and restart. A successful
result alone never says which method should run next. An App may keep agent
recovery, return to its procedure, or implement a known retry policy through
ordinary workflow actions. It must not require infra to classify its errors.
The agent may also invoke an available workflow through normal tools.

Identical selection actions are idempotent within their originating attempt;
the same choice in a later recovery is a new decision. Live and final replays
share the receipt. Distinct decisions may replace the next method before
settlement; replaying an old decision cannot overwrite a newer admitted one.
Use a fresh reason for a reconsidered decision. Each submission must contain
at most one choice, including replayed actions. Selection and its receipt commit
atomically. A rejected final settlement admits no new choice and leaves earlier
live admissions intact. An intentional choice of agent execution
is not counted as an unexpected procedure failover. The existing workflow
`needs-agent` result is a final agent choice with immediate continuation and
supersedes an earlier live execution selection.

Ordinary failure backoff, exact input settlement, cancellation, workspace and
Condition checks still apply. Handler selection does not create permission to
run: an owner Stop remains stopped until eligible new work arrives. Explicit
handoff remains an immediate continuation; an execution failure retains its
existing retry deadline and caller failure
report. After an ordinary procedure failure, a missing fallback agent leaves the
configured procedure's paced retry available. An explicit agent handoff still
selects the agent; unavailability becomes a visible, paced execution failure.
If an already selected fallback agent becomes unavailable, retain that selection
and its visible failure instead of replaying the old procedure.

Retry repeats a procedure and can resolve a transient failure. Failover returns
the same assignment to the responsible agent for diagnosis and choice of method.
This rule does not classify errors or add a fixed number of procedure retries
before switching: even a transient failure can cost an agent invocation. The
agent may retry the operation with its ordinary tools. Retained failover evidence
lets Apps assess that cost without assuming that every switch required repair.

Diagnosis does not require a working workflow. When the fallback agent proposes
completion, the Host rereads the authored workflow contract and runs its verifier
if configured. An unavailable contract or a rejected verifier prevents completion,
not diagnosis. A readable contract without a verifier uses ordinary agent
judgment; infrastructure does not invent an additional acceptance requirement.
Permissions and the original Task acceptance criteria remain unchanged.

This fallback bypasses a failing procedure, not the common execution infrastructure.
A failure in shared Task reads, storage, agent availability or required workspace
preparation can still prevent ordinary agent execution. The existing independent
operational route and external operator remain necessary at those boundaries.
There is no promise that an agent can repair an unavailable Host from inside it.

Human/control Task detail, list, and App counts must select the current Task
generation. Historical completion receipts remain evidence, not authority to hide
newer work. Cancellation keeps its own durable authority and fence.

**Implementation status:** Merged in Host [PR #325](https://github.com/hao1939/may-agent/pull/325)
at `d8c877577` and deployed locally on October 4. The real Conversation switched
to agent execution and made accepted progress; complete backlog settlement is
not yet established. One operator Retry advanced its existing backoff for the
trial. Connected trials, live evidence and their limits are recorded in
[the failover review](../archive/reviews/task-agent-failover-20261004.md).


## Result contract

The source [Task types](../../../may-agent/packages/sdk/src/task.ts) and
[result admission](../../../may-agent/packages/sdk/src/task-contract.ts) define
the executable contract. A result supplies `state`, `summary`, `facts`, and
optional bounded `result`, caller `response`, Task `actions`, Conditions, and
`TaskAppRequest` entries. Legacy `dependencies` normalize to requests and caller
Conditions at admission; the existing result schema and IDs remain unchanged.

The result union selects how this attempt settles; it does not make stored
facts mutually exclusive. A waiting result may request `continue: true` while
old Conditions, accepted results and other pending inputs
remain. Omitted waits are preserved; an exact accepted action retires one.

When a file materially supports a completion or recovery claim, the result should
retain a structured verified Artifact reference such as
`artifacts: [{ path, sha256 }]`. A prose path is not discoverable by bounded
public evidence read-back. Use the shared `EvidenceStore` when writing new
evidence, or ordinary hash tooling for an existing authoritative file; the hash
binds bytes, not source authority or semantic truth. See the
[checked wait example](../examples/app.ts).

| Outcome                                                                                 | Runtime disposition                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid `converged` result                                                                | Accept the exact input's outcome when current-attempt checks, evidence, actions and verification permit; keep the Task open                                                          |
| Valid `waiting` result                                                     | Retain independent Conditions and input; yield on a return route or schedule useful work; structural children alone do not establish a wait |
| Valid `incomplete` result                                                               | Retain unsuccessful attempt facts, report the input's first accepted blocker to its linked caller, and retry unfinished work with backoff; no cancellation or implicit parent wake |
| Workflow `needs-agent`                                                                  | Sequential ordinary agent execution on the same Task; subsequent attempts retain that selection; no ownership transfer                                                                                            |
| Unavailable agent/workflow/executor or failed workspace prerequisite                    | Visible failure and same-Task paced recovery; a failed procedure can fall back to the available responsible agent; shared prerequisites still apply                                                                                                         |
| Invalid/rejected handler result (including self-unblock) or explicitly blocked workflow | Preserve diagnostic evidence and unfinished input, reject proposed effects and retry with pacing; not an accepted answer                                                           |
| Thrown execution error or timeout                                                       | Same-Task execution-failure recovery, subject to its retry policy                                                                                                                  |
| Stale generation, resource version or cancelled attempt                                | Reject stale effects; reread current state without replacing accepted state or releasing another attempt                                                                           |
| Durable cancellation                                                                    | Retain cancellation, interrupt the exact attempt and reject its later stale result                                                                                                 |

Unknown result fields are rejected. `needs-agent` is workflow-only. A waiting
result may retain a bounded typed judgment in `result`; later attempts read it
without reconstructing state from prose. A result may explicitly
`retire-condition` only for one Condition currently linked to its own Task and
must cite that Condition's observed generation plus non-empty result facts. This
removes the Task's obsolete link; it does not assert that the external event
occurred, mutate a shared Condition for another Task, or clear unrelated waits.
Omission preserves waits. A stale generation, cancelled attempt or invalid
action rejects the result and its proposed effects together. A waiting result's
absolute `reviewAt` is saved with the exact input and scheduled across restart. Early input does not consume it; an omitted future
deadline survives re-wait. Due timers permit reconsideration, not satisfaction,
answers, or bypassing failure backoff. Sleeping again needs a Condition or new
future deadline; `continue: true` requests useful work. Failed verification cannot establish completion.

The worker judges which requests its result covers; `inputKeys` names that complete set (up to 64).
Omission uses the saved assignment and accepted live requests; `[]` covers none. Scheduling never expands that result.
For an explicit scope, the Host checks the canonical admissions: each input must
belong to this Task, be admitted at or before the executing generation, and
remain unanswered. Membership in the starting batch or a derived wait record
is not another requirement. This includes a live correction the worker chose
to incorporate and an older unanswered request discovered through exact reads.
Accepted settlement advances notifications for the selected requests and saves
their result links; structural acceptance does not certify the worker's judgment.
`converged` answers this set; waiting/incomplete retain it; unselected inputs survive.
Reading or receiving a notification alone changes neither coverage nor settlement.
Implemented in Host [#313](https://github.com/hao1939/may-agent/pull/313);
deployment and owner settlement of historical requests remain separate.

Earlier unanswered inputs are supplied as `events.continuedInputs`, separately
from newly considered events. Their age does not change their obligation. The
worker may use verified earlier work to answer them without repeating its effects,
or explain how a later authorized requirement superseded them. Settlement keeps
the input and result history. Empty new-event lists do not establish that the
assignment is empty; an empty result scope preserves runnable pending inputs.
The Host maintains `inputWaits[key].pending`, waits/deadlines and continuation; workers read this current state without maintaining the ledger.

**Unfinished-work context:** `previousAttempt.acceptedResult` carries the saved
input scope, continuation decision and review deadline. Missing scope is unknown;
`[]` explicitly covers none. The Task entry and refreshed decision brief show
the starting assignment, currently observed retained inputs and previous result
coverage together. Detailed decision JSON is readable through ordinary file
reads; exact original-input reads remain the source for individual requirements.

These are disposable views of existing records, not another obligation ledger
or progress score. Counts preserve read failures and truncation; retained-input
counts do not include unclaimed events. A helper's call still defines its narrow
contribution even when it sees the owning Task's unfinished work. Empty-scope
partial results and genuine waits remain valid.

This follows [simple first](../1-principles/core-principles.md#simple-first): fix
the existing context path before adding repetition policy, while leaving
fulfillment judgment with the agent. Host [#303](https://github.com/hao1939/may-agent/pull/303)
merged the source fix at `287263522`. The
[trial record](../archive/reviews/unfinished-input-context-20261003.md) documents
portable checks and a small real-model comparison. Both versions completed that
assignment; the original large-backlog behavior and deployment remain unverified.

`incomplete` requires a summary and non-empty facts; it cannot include actions, Conditions
or child App requests. The Host checks eligibility inside the fenced transaction.
It ends only the attempt, without fulfilling the input or a linked Request.
The same Task remains pending. During settlement the Host selects a caller report
if that input has no earlier selected report or the result says `report: true`.
The stored `reportRevision` identifies that selection for delivery and deduplication.
Report selection and caller delivery are existing bookkeeping; neither fulfills
the input or proves a person saw the report.

**Candidate correction:** Accepted incomplete settlement advances the notifications
that the attempt considered and retains unanswered requirements in `inputWaits`.
This advancement occurs at settlement, independently of caller delivery. Automatic
and explicit owner retries preserve it; execution failures without an accepted
report restore their unconsidered batch. Generation and action fences still apply.
Source tests do not establish live adoption. Turn Stop and owner closure remain
separate controls: closure fences automatic work. An authorized new requirement
may explicitly reopen the same Task; late observations alone retain history.

Creating follow-up work does not complete the current task. Live `tasks apply`
and final declarations share admission; only final settlement ends the attempt.
Requests deliver work through the receiving App and normal Task scheduling.

**Source contract (Host PR #285, merged):** `state: "waiting"` with `continue: true` requests one more bounded
pass on the same Task while retaining unanswered input and every independent
wait. It requires non-empty progress facts, but not a newly submitted dependency:
continuation is an immediate scheduling request, not a claim that an external
fact is outstanding. It may coexist with `report: true`, which selects a new
caller-relevant update without changing scheduling or wait state. Omitting
`continue` yields the attempt, so a saved Condition or
future `reviewAt` must provide a real return route. Facts make the request
auditable; they do not prove progress or replace the existing attempt/resource
bounds and owner review.

The SDK's `admitTaskReconcileResult` is the single pure semantic validator for
agent and workflow results. Executor finish paths call it before terminating so
an invalid proposal returns correctable feedback; fenced settlement calls it
again before applying effects. The pure validator knows only the proposed result.
Settlement remains the authority for current generation, attempt, scoped-input,
creator, Condition and persistence checks. A schema, executor adapter, or recovery
path must not define a narrower competing interpretation.

Task changes and the final result apply in one transaction. Events emitted
while an attempt runs are separate durable commit points: a resource-backed
workflow supplies a stable local key, and the Host verifies the attempt fence,
deduplicates, persists exact wakes, then publishes. Races against a newer
generation or already-advanced target are treated as stale and retried from
current state, not converted into partial mutation or misleading attention.
Cross-App result work uses a typed request and optional caller Condition. Its App
request row is the correlation record; generic event emission cannot create a
second request lifecycle.


## Acceptance

Mechanical validation proves that a result is safe to apply, not that its
domain claim is true. Every completed receipt records:

```ts
type TaskAcceptanceBasis = {
  method: "deterministic" | "workflow-contract" | "agent-judgment";
  verifier?: string;
  facts: string[];
};
```

A workflow verifier runs after result validation and before commit. It proves a
positive postcondition. Missing or unknown evidence is not success. When a
workflow has a configured verifier, it still applies to a later fallback agent
claim of convergence. An unavailable workflow contract prevents acceptance,
not diagnosis; a readable contract without a verifier allows agent judgment.

Ordinary checks and repairs can run inside the workflow before it returns.
The Host's final verifier runs after that invocation has ended; rejection records
a failed attempt rather than re-entering that invocation. Unfinished input retries
on the same Task with current evidence and backoff; verification failure cannot
be used as an accepted answer.
