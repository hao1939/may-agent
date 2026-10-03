# Task attempts and results

**Supports:** [Task Resource Engine](task-resource-engine.md). Lets agents, workflows and native workers make progress through one execution and result boundary.

**Choice basis:** [Apps own meaning; the Host owns mechanics](../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics).

**Design status:** Accepted.
**Implementation status:** The shared attempt interface, result admission and live/final change admission are implemented in Host source, including #285. Scoped acceptance while input remains is implemented in candidate Host `f2b4e47f9`; see [accept work and continue what remains](#accept-work-and-continue-what-remains) and its validation record. It is not deployed. The proposed `decision` spelling remains deferred. App adoption and deployment remain separate.

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

Validate result scope and proposed actions before workspace cleanup, inside
the existing result-rejection path. If admission rejects the result, preserve
useful output, facts and artifacts as unaccepted recovery evidence, while keeping
its input unfinished. A returned result with invalid scope is not
the same as an executor that produced no result. In-execution preflight lets the
worker correct a proposal; settlement still validates current state.

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

**Source availability:** Candidate Host `f2b4e47f9` applies this rule to final
completion, partial results, live actions, cross-App requests, Conversation
Request changes and creator Task revisions. Existing attempt, authority,
affected-revision and transaction checks remain. Workspace finalization also
retains clean workspaces when scoped completion leaves input or unresolved
Conditions. Cleanup uses the same satisfaction rule as settlement: a satisfied
Condition that settlement removes must not retain an otherwise clean, integrated
worktree. Plan retention after admitting final-result actions too: retiring the
last wait in the final result must allow the same cleanup as retiring it during
execution. The Host previews shared admission in a rollback transaction before
filesystem cleanup, retaining its authority, revision and receipt-replay rules.
Planning saves no changes and dispatches no requests; actual settlement admits
the changes again against current state. Missing or unrecognized Condition state
remains unresolved unless an exact retirement is admitted.
The schema is unchanged: `waiting` with `continue: true` accepts progress;
`converged` fulfills its selected inputs. One result has one disposition for
its selected set. The [PoC record](../archive/reviews/burst-input-progress-20261003.md#implementation-candidate-and-poc)
records portable checks and limits; source validation does not establish live
adoption, agent judgment or token savings.

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

If the Task names a workflow, that exact workflow is the selected handler.
An unavailable agent, workflow or executor preserves visible failure and retries
the same Task with backoff. It does not silently select another executor.
Rejected handler output, explicit workflow blockers, thrown errors and timeouts
also retain unfinished input and pace another attempt. A function or notification
still named `attention` does not imply a permanent stop: inspect stored phase
and retry eligibility. Only explicit workflow `needs-agent` requests a handoff.

Workspace preparation failure is a failed prerequisite, not a handler
execution failure. Preserve it as `WorkspacePreparationFailed` and do not invoke
the handler in that attempt. The same retry policy rechecks the prerequisite;
it does not prove an unchanged failure is transient. An owner can repair or
revise the assignment, pause it, or close it. Exact, generation-fenced retry can
recheck sooner without replacing the Task or erasing earlier attempt evidence.

These distinctions are implemented in current source. Deployment evidence must
identify its release separately. Retry policy does not establish that every
repeated provider failure is transient.

Human/control Task detail, list, and App counts must select the current Task
generation. A historical completion receipt is evidence about that generation,
not authority to hide a newer live generation or prevent its fenced retry.
Same-generation completion still supersedes a stale live row. Cancellation
keeps its own durable authority and fence.

A workflow may explicitly return `needs-agent` after exhausting its bounded,
safe moves. That creates at most one sequential agent attempt for the same
task. Work for another App is a typed Runtime-managed task dependency, not
`needs-agent`.


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
| Workflow `needs-agent`                                                                  | At most one sequential selected-agent judgment for the same Task; no ownership transfer                                                                                            |
| Unavailable agent/workflow/executor or failed workspace prerequisite                    | Visible failure and same-Task paced retry; no silent executor substitution                                                                                                         |
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
The Host validates references and saves result links; structural acceptance does not certify the worker's judgment.
`converged` answers this set; waiting/incomplete retain it; unselected inputs survive.

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
workflow can hand off with `needs-agent`, its hard verifier still applies to a
later agent claim of convergence.

Ordinary checks and repairs can run inside the workflow before it returns.
The Host's final verifier runs after that invocation has ended; rejection records
a failed attempt rather than re-entering that invocation. Unfinished input retries
on the same Task with current evidence and backoff; verification failure cannot
be used as an accepted answer.
