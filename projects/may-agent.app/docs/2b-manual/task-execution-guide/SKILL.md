---
name: task-execution-guide
description: Start, continue or recover a May Task using its assignment, scoped capabilities, Conditions and attempt result schema. Use for agent or workflow work under the May Task contract.
---

# Working on a Task

**Supports:** [Enable useful action within authority](../../2a-design/system-model.md#enable-useful-action-within-authority). Helps agents use the shared execution contract with less bookkeeping and unnecessary context.

**Choice basis:** [Apps own meaning; the Host owns mechanics](../../1-principles/core-principles.md#apps-own-meaning-the-host-owns-mechanics) and [context discovery](../../1-principles/core-principles.md#context-is-discovered-not-dumped).

Use this skill when receiving a Task assignment; it is also the canonical human
manual. Keep it updated with the owning execution contracts. Linked references
resolve from this directory and require the May documentation tree. It explains
the current source contract, including Host #285. Use the tools and result schema
actually supplied to the attempt: App adoption and installed versions can differ.
The proposed unified capability catalog and `decision` spelling
are not available merely because they appear in a proposal.

**You decide what useful work to do. Infra executes admitted actions, retains
requirements and results, delivers feedback, and schedules later work.** The App
defines the assignment, authority and any required acceptance checks.

## A complete example

You are asked to implement a change and obtain a review.

1. Read the current assignment and relevant evidence. Check whether a previous
   attempt already made the change or requested the review.
2. Make and check the change. Request the review from its accountable App using
   the available Task capability. If its answer is needed, declare the caller
   Condition referring to that request. Infra saves and connects both.
3. Continue independent work, such as running tests, within this attempt's
   allowance. A pending review does not force the whole Task to wait.
4. If only the review remains, return `waiting` with its saved return route.
   If useful work needs another attempt, return `waiting` with `continue: true`
   and progress facts. Returning the final result ends this attempt.
5. When the answer arrives, inspect the findings and decide the next action.
   Converge the addressed work when it satisfies the assignment under App policy.

The review requirement in this example comes from the assignment. It is not a
universal infra completion gate. Infra trusts an admitted worker decision;
unresolved Conditions retain their actual state. Acceptance does not guarantee
that the worker judged correctly, and later evidence may warrant reconsideration.

## Understand the work before repeating it

The supplied context identifies the Task, this attempt, assigned inputs, current
requirements, retained results and relevant outstanding facts. One attempt can
contain many model calls, tools and work/check/repair iterations.

Use the existing `tasks` read capability for current Task detail and exact inputs
when the brief is insufficient. Start from a known identity; list only when
discovering work. Large evidence should remain referenced until needed. See
[Task reads](../../2a-design/task-resource-read-interface.md) for exact operations,
pagination, input keys and coverage limits.

Treat free-form input as requirements to understand, not text to silently
discard after a structured request arrives. Several inputs can refine one ask.
Preserve material constraints and uncertainty. Decide which inputs your result
addresses; reading or receiving them alone does not settle them.

On recovery, inspect accepted work, previous failure evidence and the actual
target state before repeating an effect. A proposed but unaccepted result can
be useful evidence; it is not authorization to replay its actions.

Start from what remains unanswered, then compare it with the saved work. A
previous summary saying "done" does not establish which inputs it covered.
When coverage is missing from the brief, use the existing accepted-evidence
read; treat missing scope as unknown, not as zero or all inputs. Read originals
using the Task read's `inputKeys` option, up to eight keys per call when needed.
An earlier implementation may satisfy several requests without another edit,
while an added test or review requirement can still need real work.
The [Task context contract](../../2a-design/task-attempts.md#result-contract)
defines the previous-result scope and unfinished-work view. Use the context
actually supplied by the installed Host; a source merge does not update it.

## Find the capability by its purpose

The following groups organize guidance; they are not new runtime APIs.

| I need to… | Use the supplied capability | Read more when needed |
| --- | --- | --- |
| Understand current work and evidence | Task brief, scoped reads and linked artifacts | [Task reads](../../2a-design/task-resource-read-interface.md), [context assembly](../../2a-design/agents.md#context-passing) |
| Perform an operation or ask for a contribution | Available tools, agent/workflow catalogs, or typed App requests | [Contribution contract](../../2a-design/execution-contributions.md), [Task changes](../handler-authoring.md#task-changes-and-safety) |
| Receive a later result or changed external fact | Caller Condition or a supported resource-observation Condition | [Conditions](../../2a-design/task-resource-engine.md#conditions), [observers](../../2a-design/agent-app.md#task-driven-resource-observation) |
| Report progress and decide the next step | Scoped progress capabilities and the supplied final result schema | [Attempt results](../../2a-design/task-attempts.md#result-contract) |

Use the description and schema of the capability exposed in this attempt. Check
what it returns: a completed result, accepted work with a reference, or failure.
Do not infer that acceptance means the requested work is finished. Use logical
recipients and the communication surface supplied by the App; transport details
belong to adapters. A missing capability is a limitation to report or resolve
through an authorized existing path, not a reason to edit infra state directly.

## Act now or retain a dependency

A bounded tool or helper can return within this attempt. Its completion is a
contribution to your assignment, not automatic settlement of the whole Task.
Work that must survive the attempt uses the supported durable request path.

A Task request describes the receiver's work. A separate caller Condition records
an interest in its result. Declare `{ "requestId": "review" }` for the request
named `review`; infra supplies the correlation. Without that Condition, receiver
work, accepted results and failure evidence remain retained and inspectable.
Request admission and pending Conditions allow independent work to continue;
the attempt decision determines whether to continue, yield or finish.

Live `tasks({ action: "apply", changes })`, executor `attempt.apply(changes)`
and workflow `ctx.applyTaskChanges(changes)` share admission with final result
declarations. Use the entrypoint actually supplied to your executor. Infra binds
identity and correlates results; keep the same admitted identity when retrying
the same operation. Do not resubmit accepted work under a fresh ID to check on it.

A Condition observes a fact; declaring one does not launch the operation being
observed. Select an installed observation capability and a meaningful expectation.
Infra handles observation scheduling, matching and delivery. Omission preserves
existing waits. Retire an obsolete wait explicitly through the supported action.

## Decide how this attempt ends

**Report useful progress, mark only fulfilled requirements complete, and
continue the remaining work.** A patch can be accepted while its required
verification is still pending. Use `waiting` with `continue: true` when another
pass can advance that work; use a saved return route when only an external result
remains. When some inputs are fully fulfilled, use `converged` with their exact
`inputKeys`; other requirements remain outstanding. Several related inputs can
be fulfilled together. These use the supplied schema, not a new partial state.

The [acceptance rule](../../2a-design/task-attempts.md#accept-work-and-continue-what-remains)
separates contribution, fulfillment and execution and states source availability.
Pending messages alone do not invalidate your considered work under that rule.
Check the admitted result and reuse retained evidence; do not assume a proposal
was accepted or repeat an already applied effect. Treat later ordinary messages
as requirements to interpret at the next available decision boundary. Explicit
Stop interrupts the current execution. A result must never claim to address
input you have not considered.

| Your judgment | Current result expression | Infra consequence |
| --- | --- | --- |
| Useful work remains for another bounded pass | `state: "waiting", continue: true`, with progress facts | Retain input and independent waits; schedule another attempt |
| A later fact is needed and nothing useful can proceed now | `state: "waiting"`, with a saved Condition or future review route | Release capacity and retain the wait |
| The addressed work is sufficient under App policy | `state: "converged"` | Record accepted completion for that input scope and return the result |
| This attempt could not complete the work | `state: "incomplete"`, with summary and failure facts | Retain unfinished work and report/retry through existing policy |

Use the full supplied schema for required fields and permitted combinations.
`inputKeys` selects the complete input scope of your result. Omission uses the
saved assignment plus accepted live inputs; `[]` covers none. One result has one
disposition for that selected set. Unselected requirements remain outstanding.

`events.continuedInputs` contains earlier unanswered requests assigned to this
attempt. Empty new-event lists do not make those requests history-only. Read
their exact content and compare it with the delivered result: fulfill remaining
work, settle requests already covered by verified work, or retain the actual
wait. Explain when a later authorized correction supersedes an earlier request.
Settling a covered request preserves its history; it does not require repeating
the work. Use explicit keys for a partial result. Returning `converged` with
`inputKeys: []` leaves pending requests runnable, so repeating that unchanged
decision can immediately schedule another attempt.

Completion of an input, ending an attempt and owner closure of a Task are
different actions. A pending Condition is context for judgment; it does not
give infra authority to invent a semantic veto or to fabricate satisfaction.
An explicit App acceptance requirement still applies.

Read the exact accepted result when checking completion. The Task can still
display `waiting` because another Condition remains open, even after accepting
`converged` for the addressed input. Use the Task's `acceptedAttempt` reference
and opt-in `acceptedEvidence` read; its overall status alone cannot answer this.

A Condition says what fact you need. Infra checks for missed results without
asking you to repeat the same judgment. When only a result or human decision
remains, wait on its exact Condition. Return `reviewAt` only when you intend to
reconsider useful work or escalation at that time. It is a one-time deadline;
waiting again does not automatically renew it. That review runs the owner again
and costs tokens when the owner uses an LLM. Choose timing for urgency and cost:
a low-urgency escalation check might be 30–60 minutes away. This is an example,
not a default or a recurring schedule.

The Host separately chooses the missed-result recovery cadence; the Task result
does not customize it. Normal result events wake work as they arrive, without
waiting for that periodic check. Legacy Condition `reviewAfterMs` controls
neither clock. Check the installed schema and the
[Host availability note](../../2a-design/task-resource-engine.md#conditions)
before relying on omitted legacy fields.

Read the whole supplied input batch and handle related updates together. One
wake can bring several messages, results or requirements; it does not require
one attempt per update. Judge each Request's fulfillment separately. Infra keeps
unseen input and bounded overflow pending, so you do not arrange another wake
for each event. The [Task attempt contract](../../2a-design/task-attempts.md)
describes the limits and how accepted live input joins current work.

Use one timer for a recurring cycle. If the App already schedules it, do not
also return `reviewAt` for that same cycle. For Task-owned recurring work, return
the next deliberate deadline after judging the current result.

A Conversation may receive one Task outcome with several `topicIds`. Read the
relevant asks and judge each separately; shared evidence does not mean that all
Requests are fulfilled. You do not need to arrange the return deliveries.

For a Conversation result, select an existing Topic from current context or
read it with `conversation_context` first. Use an assigned open Request for
`followUp.requestId`, or save its current scope and input associations through
`conversation_request` before linking it. Historical IDs and a rejected previous
proposal are not proof that a Topic is available or a Request is open. Only omit
the optional Request link when that follow-up does not serve an accepted ask.
The [Conversation contract](../../2a-design/conversation-execution.md) records
the prompt's selection aid and its limits.

If `finish` returns a validation error, correct the named fields within the
current invocation. Do not repeat already completed actions just to repair the
result object. App-specific preflight requires the Host revision described in
[execution contributions](../../2a-design/execution-contributions.md); final
settlement still checks whether the result remains current.

The [Conversation feedback change](../../2a-design/conversation-execution.md#correct-a-proposed-result-before-ending-the-turn)
extends this to Topic and Request checks when its Host revision is installed.
An unavailable Topic needs a valid selection or scoped lookup. A stale Request
revision needs a current read; a Request already saved during the turn needs its
returned revision. Preserve the accepted ask while correcting its link or
disposition. A successful finish check is still a proposal: wait for the Host's
accepted result before treating follow-up work or Request closure as committed.

## Recover and return problems to the owner

Repair within this attempt when authorized work can progress and allowance
remains. Infra owns routine retry and delivery recovery under existing policy.
An agent can choose a different repair, retry or failover when judgment is needed.
Explain the evidence and concrete next action when repeating the same attempt
would not help. Scope changes, unavailable authority and abandonment belong to
the responsible owner through normal feedback and control paths.

Read `previousAttempt` before repeating a failed proposal. A handed-off plan is
context for your assignment; choose your own current work, wait or completion
from its requirements and evidence. Workflow authors must return rejected
decisions and their errors to the responsible agent instead of mechanically
replaying the same saved result. Check accepted effects before repeating actions.

Repeated failure and growing cost should be observable through existing
[metrics](../../2a-design/metrics.md) and [failure feedback](../../2a-design/execution-feedback.md).
An alert or delivered report does not prove that an evaluator or human acted.
Do not claim escalation succeeded merely because a record was written.

Retries use bounded attempts and backoff; there is no universal failure-count
stop. Where an operation cannot make repeat delivery safe, its contract must
expose that exception. Follow its reconciliation path and preserve uncertainty
until acceptance is known. See [retry ownership](../../2a-design/system-boundary.md#retry-and-recovery-ownership).

## For workflow and executor authors

Use the same Task, input, result and Condition meanings. Workflow code runs its
declared procedure and asks an agent where judgment is needed; executor adapters
provide equivalent context and return through the same admission boundary.
Do not implement another scheduler, delivery loop or completion authority.

Use [Task reconciler authoring](../handler-authoring.md), [Workflow authoring](../workflow-authoring.md)
and [Task attempts](../../2a-design/task-attempts.md) for exact interfaces. The checked
[App example](../../examples/app.ts) demonstrates admission and waiting. It validates
mechanics, not whether a real agent makes the right decision in every case.
