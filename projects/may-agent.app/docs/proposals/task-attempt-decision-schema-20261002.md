# Agent input and output: understanding requests, deciding next steps

**Supports:** [Task Resource Engine](../2a-design/task-resource-engine.md). Clarifies agent decisions and infra bookkeeping; its deferred schema remains separate from the current contract.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

**Design status:** Draft for review, 2026-10-02.
**Implementation status:** [Host PR #285](https://github.com/hao1939/may-agent/pull/285)
keeps request routing, separate requests/Conditions and shared live/final admission.
**The `decision` schema migration is deferred (2026-10-03).** Candidate source
retains `state`, `continue` and the existing schema IDs. The proposed output schema,
its examples and migration plan below are future design, not the PR contract.
This is source work for review, not a deployment claim.
The rules below clarify how decisions are trusted and recorded. They add no
new agent output fields, completion gate, or result lifecycle.

The companion [Task execution capabilities proposal](task-execution-capabilities-20261002.md)
organizes agent access around understanding, acting, observing and reporting.
It proposes an explicit caller reply choice and automatic bookkeeping for that
choice. Those additions are follow-up design, not fields implemented by #285;
the candidate schemas and examples below retain their current meaning.

## Governing rules: agent decides, infra executes, trust by default

1. **The agent decides.** Within the App's assignment and authority, the agent
   judges what to do, whether a result is sufficient, and when the work is done.
   This is the general rule for every decision. Conditions and observations
   provide context for that judgment; they do not create an infra-owned policy
   for deciding whether the work is good enough.
2. **Infra executes the decision and keeps the records.** It validates the
   contract, authority and current execution, then applies the decision to the
   exact inputs, schedules work, delivers results and maintains Conditions.
   On accepted convergence, it marks the addressed request done and returns the
   result through the normal path. Completion is operationally meaningful.
3. **Trust by default; do not promise certainty.** An accepted decision is the
   system's working conclusion. Callers may use the result and move on without
   a mandatory second judgment or independent verification. Agents can be
   mistaken; new evidence can lead the responsible owner to reconsider through
   the existing work and control paths. The system does not guarantee that an
   accepted conclusion is objectively correct.

`converged` therefore means “the responsible worker has decided this work is
done,” and the normal request state becomes **done**. It is not necessary to
add a separate “claimed done” stage or make the caller approve every answer.
An App can require a particular check through its explicit acceptance policy;
infra executes that policy rather than inventing a universal proof requirement.

### Recording decisions and facts

Keep the existing attempt identity, result, summary, facts and acceptance basis
available for explanation and review. `agent-judgment`, `workflow-contract` and
`deterministic` describe how a decision was accepted. They are useful evidence,
not confidence grades, extra completion states or guarantees of correctness.
Only record a verifier check when that check actually ran.

The ordinary view can say **Done**. Its details can show the responsible agent,
reason and available evidence, including relevant outstanding Conditions.
Avoid requiring a qualification or audit step for every routine success.
An unresolved observation remains unresolved until its own observation or
authorized control changes it; accepting a work decision does not fabricate
other facts. Those records can coexist naturally without a whitelist of
permitted combinations.

The request's completion, the Task's current execution and the Task's lifetime
retain their existing scopes. Completing the addressed request need not close
an ongoing Task or erase its other inputs and Conditions.

### Normal flow

```text
agent receives work and available facts
  -> agent decides what is sufficient and returns a result
  -> infra validates and records that decision
  -> accepted convergence marks the addressed request done
  -> caller receives the result and continues its work
  -> new evidence, when relevant, is considered through the existing owner
```

For example, a worker asks for review, completes its tests and decides that its
work is done. Infra applies that decision through the same path as any other
convergence. The review's current state stays accurate. Whether that review
should change the decision is an App/agent judgment under the assignment.
This example follows the rules above; it introduces no special exception.

### Scope of this refinement

Keep the existing agent schema and result records; defer the proposed spelling. No new `judgment`
envelope, mandatory Condition-at-decision snapshot, or caller verification
round is required to establish trust by default. Expose existing evidence where
it helps a reader understand a result; extend a projection only for a concrete
consumer need. Such presentation work must not become a completion prerequisite.

The candidate already stores `acceptanceBasis` on accepted attempts. Ordinary
App feedback does not carry all of that detail today. This is a presentation
limitation, not a reason to withhold completion. The earlier synthetic review
exercise established that infra follows the supplied convergence decision;
it did not establish an incorrect real-agent judgment. The automatic rejection
rule and subsequent expanded bookkeeping proposal are superseded by these
general rules. No retry, escalation or evaluator policy is added here.

## Recommendation

Accept free-form requests as well as structured App input. Prefer a structured
request when the caller already knows its meaning. During ordinary handling,
the App/agent interprets text into the same outcome, acceptance and constraints
used for structured work. Preserve the original inputs and their exact links.

The agent returns one **attempt decision**. Infra applies it to the existing
Task, together with current inputs, Conditions, accepted results and owner
controls. Execution status remains part of Task state.

For #285, retain `state: "waiting" | "converged" | "incomplete"` and
`continue: true` on a waiting result when useful independent work remains.
Keep requests and Conditions independent: a request describes the receiver's
work; a Condition describes a result or fact the caller needs. Renaming these
choices to `decision` adds migration cost without being necessary for this fix.

The common choices read naturally:

- **Continue:** I have useful work to do now.
- **Wait:** I need a result or fact before I can make more progress on the
  work addressed by this attempt.
- **Converged:** I judge the addressed work done; mark its request complete
  and return the result.
- **Incomplete:** This attempt was unsuccessful; retain the unfinished work
  and failure evidence for ordinary recovery.

An attempt decision is recorded with its result. It is not a second mutable
Task status, a new controller, or an agent-written copy of the Task record.

The input contract below explains what the agent receives and understands;
the output contract explains which decisions infra can execute. Free-form
content is valid input, while executable decisions have a strict schema.

## Attempt boundary and actions during execution

An attempt starts when the Host claims a Task and ends when its executor returns
one final result, fails, or is interrupted. It can contain many model turns,
tool calls and actions. Requesting review does not end it. A final
`state: "waiting", continue: true` ends it and asks the Host to schedule the
next attempt.

Expose the same typed changes in two places:

```ts
type TaskChanges = {
  requests?: TaskAppRequest[];
  conditions?: TaskCondition[];
  actions?: TaskAction[];
  inputKeys?: string[];
  facts?: string[];
};

type TaskChangeReceipt = {
  requests: Array<{ id: string; requestId: string }>;
  conditionIds: string[];
  actionsApplied: string[];
};
```

The agent tool is `tasks({action: "apply", changes})`. Registered executors use
`await attempt.apply(changes)`; Task-owned workflows use
`await ctx.applyTaskChanges(changes)`. Final results carry the same change fields
alongside the existing result `state`. All enter one Host admission implementation. The tool
returns durable receipts and leaves the current attempt running. Only final
settlement releases it. Neither path accepts a model-supplied caller identity.

The Host checks authority, validates all changes, saves the receiver request and
caller Condition, and then dispatches delivery. Invalid batches roll back. The
same declarations after a lost tool response reuse saved receipts; an already
applied exact action is not performed again during final settlement. Receipts
live in existing attempt records; requests and Conditions remain their own
authorities. Interruption does not undo admitted work. Reading or applying
changes does not fulfill the original input.

`inputKeys` binds a change to the exact inputs being handled when it is admitted.
A final result cannot silently transfer that wait to unrelated input. A caller
can submit review, run tests, read feedback, and finish in one attempt. If the
worker judges that it needs the pending review before answering and has no
independent work, return `state: "waiting"` and omit the saved wait. Otherwise its final
decision retains its own meaning; an open review does not select that decision.

The native Codex executor accepts the same final schema. Its CLI does not yet
expose May's live `tasks` tool; this change does not claim a new native tool bridge.
It can declare requests in its final result, and the next attempt continues work.

## How a saved request reaches the receiving agent

```text
caller chooses request and optional caller Condition
  -> Host validates and saves them before delivery
  -> Host emits app.input.requested (delivery hint)
  -> receiving App's input mapper selects existing/new Task
  -> Host attaches exact input and queues that Task
  -> normal Task controller starts its configured agent/workflow
  -> receiving App accepts an answer for that exact input
  -> Host retains the result and delivers correlated caller feedback
```

With an explicit `taskId`, admission addresses that existing Task directly.
Otherwise the receiving App's mapper selects the Task. An agent name is not a
second address or queue; the selected Task's configuration chooses its executor.
The saved request is delivery authority, so inbox recovery repairs interruption
before dispatch or a lost delivery notification. Saving a Condition alone never
starts the receiving agent. The Condition expresses why the caller needs feedback.

The refined [capability-facing contract](task-execution-capabilities-20261002.md#calling-convention-intent-and-an-answer-choice)
lets the agent supply recipient/content and choose whether it needs an answer.
For a required reply, infra establishes the trusted return path and any needed
caller bookkeeping, then delivers the answer whether the caller continues or
yields. The agent does not separately register a watch merely to receive it.
For no reply, infra confirms acceptance and the receiving owner keeps the work;
no caller result dependency or completion notification is requested.

The same ownership rule applies to human communication: channel selection,
presentation, correlation and delivery recovery belong to the capability.
Conversation context and Telegram are internal parts of that implementation,
not routing choices or bookkeeping required from the agent. The caller's reply
choice does not decide whether the whole Task should pause.

**Remaining gap:** PR #285 preserves every submitted request and its result, but
automatic caller feedback currently follows a saved request Condition. Without
that Condition the result remains readable; it does not automatically wake the
caller. The proposed caller reply choice is not part of #285. Its automatic
return path and no-reply behavior need a paired capability/SDK change; this
candidate does not implement that interface.

## Input: flexible content, one admission contract

Keep the existing Host envelope:

```ts
type AppInput<TData = unknown> = {
  kind: string;
  data: TData;
};
```

The receiving App publishes the schema for its `kind` and `data`. The Host
checks that shape and trusted routing/authority, then preserves the original
input. It does not use an LLM to guess what the requester meant during
mechanical admission. A human can type plain text; the interface supplies the
envelope without making the human write JSON.

For May, the common accepted subset can be described as follows. This reuses
its existing `message` and `goal` shapes, including `data.message` for text;
existing revision and assignment fields remain part of the full App schema.

```ts
// App-owned work content, not another Host resource or lifecycle.
type GoalContent = {
  outcome: string;
  acceptance: string[];
  constraints?: string[];
};

type MayRequestInput =
  | {
      kind: "message";
      data: {
        message: string;
        context?: Record<string, unknown>;
      };
    }
  | {
      kind: "goal";
      data: GoalContent;
    };
```

`message` accepts non-empty free-form text without demanding fully specified
acceptance criteria. A supplied `goal` requires its existing non-empty outcome
and acceptance list. Other Apps can expose domain schemas through the same
envelope; a machine-oriented App need not accept arbitrary prose. Its caller
can inspect the advertised contract and interpret a request into that schema.

These are two input representations, with one request/admission mechanism.
Neither `message` nor `goal` determines whether the caller waits, whether a
Condition exists, or whether the work is complete. Human Conversation identity
still selects its existing handling path; changing the payload's kind must
not fabricate Conversation identity or create a second lifecycle.

### Understanding free-form input

```text
free-form text or structured App input
  -> preserve original input and trusted source
  -> App/agent understands the request in its current context
  -> work against the existing Request scope / Task assignment
  -> return a structured attempt decision
  -> infra retains results, waits and the next eligible work
```

Interpretation is part of normal work. It does not require a mandatory
preprocessing agent, a separate model call, or a new intention table. Simple
text can be understood and fulfilled in the same attempt. Existing App code
can map already structured inputs directly; an agent handles meaning when
judgment is needed. Do not put semantic inference into the pure Task mapper.

The useful normalized content is:

| Content | Question answered | Existing home |
| --- | --- | --- |
| Outcome | What does the requester want achieved? | Accepted Request scope and the corresponding Task's `outcome` |
| Acceptance | What evidence would show this work is fulfilled? | Task `acceptance`, under App policy |
| Constraints and context | What bounds or references govern the work? | Request scope and App-owned Task `input` |
| Original input links | Which messages or requests does this work address? | Existing Request/input and Task admission links |

Those records have distinct scopes: a conversational Request owns the human
promise, and its Task owns the assigned executable outcome. Reuse them; do
not create a third canonical interpretation record or copy all raw input into
each output. The Host's trusted input keys preserve provenance and correlation.

The current #285 companion mapper starts a text Task with the original message
as `outcome` and a general fulfillment rule. It does not yet extract structured
acceptance or constraints using a model. The proposed interpretation happens
inside the ordinary agent handling that follows this admission.

A worker's interpretation is not permission to rewrite its assignment. Apply
an actual scope/acceptance revision through the existing authorized creator
path and generation checks. Preserve tentative understanding in ordinary
attempt evidence/structured `result` if it is useful across attempts; it is
not a replacement assignment. A worker cannot weaken acceptance to declare
itself finished.

### Uncertainty, corrections and multiple inputs

Do not turn missing information into fabricated requirements. If the request
is clear enough, proceed with supported interpretation and the existing
authority. If a missing fact materially changes the outcome, scope or
authority, ask the smallest useful question through the normal caller route.
Independent useful work can continue. If only the answer remains, yield with
a real Condition/return path; a sentence saying “waiting for clarification”
does not create a notification or a durable wait by itself.

There is no mandatory confirmation round after every conversion. Explicit
constraints remain binding; an inferred working assumption stays distinguishable
from a requester-supplied requirement. If a later message corrects that
assumption, update the same Request and applicable Task assignment through
their existing authority boundaries.

The App/agent judges whether a later input updates the same requirement,
introduces an independent ask, or only contributes evidence. Several inputs
can belong to one evolving requirement. Infra preserves those links and the
original text; understanding or normalizing input does not fulfill it.
Late evidence on a closed Task remains history unless an authorized new
requirement explicitly reopens it.

For example, “Investigate the repeated retries; don't change code yet” can
be understood as this App-owned content:

```json
{
  "outcome": "Explain the cause of repeated retries and propose a correction.",
  "acceptance": [
    "Support the diagnosis with relevant execution evidence.",
    "Provide a proposed correction for review."
  ],
  "constraints": ["Do not change code."]
}
```

“Focus on the last three hours” refines that same requirement. Retain both
inputs and incorporate the time range without losing the no-code-change
constraint. One final result can address both inputs. A later “implement the
correction” is new authority/scope to interpret, not something the first
normalization was allowed to assume.

### Input supplied to an agent attempt

The agent needs more than the latest message. Reuse the existing Task attempt
context and bounded reads to provide:

- the current Task outcome, acceptance, App input and authority context;
- the assigned inputs and their exact keys, with original bodies retrievable;
- outstanding input obligations and Conditions, independent of execution status;
- relevant new feedback, prior attempt failure/progress and accepted evidence.

Existing `TaskDetail`, `currentObligations`, `pendingEvents` and exact
`tasks.get({ inputKeys })` reads already carry these meanings. Do not expand
all history into every prompt or introduce another writable agent-input state.
An interpretation summary helps comprehension, while original requirements
remain available for verification. If context is truncated or unavailable,
the worker must not infer that omitted obligations were completed.

## Deferred spelling refinement: why the current expression is confusing

Today, continuing useful work with an outstanding review requires:

```json
{
  "state": "waiting",
  "continue": true,
  "summary": "Review is outstanding; I can run the tests now.",
  "facts": ["The review request has been prepared."]
}
```

Here `state` is an attempt judgment, not the Task's current execution status.
The extra `continue` field changes its scheduling meaning. Also, new
Conditions are accepted only in the `waiting` branch, even when execution
should continue.

The proposal expresses the same judgment with `decision: "continue"` and
permits Conditions with either `continue` or `wait`. Pending Conditions alone
never decide that the whole Task should sleep.

This follows the existing [execution and outstanding results model](../2a-design/system-model.md#execution-and-outstanding-results)
and [Host/App boundary](../2a-design/system-boundary.md). It changes the output
expression and its wiring, not who owns the work.

## Ownership and vocabulary

| Concept | Meaning | Authority |
| --- | --- | --- |
| Attempt decision | What the worker judges after this bounded run | App/agent, within the assignment |
| Task execution status | What is actually running or eligible to run now | Host, using claims, accepted decisions, current inputs and controls |
| Condition | An exact needed fact with a supported observation or return path | App/agent chooses the fact; Host retains, observes and delivers it |
| Accepted result | Trusted App/worker conclusion for the addressed requirements, with retained evidence | App defines acceptance; Host validates, records completion and delivers the result |
| Task lifetime | Whether this responsibility remains open | Authorized assigning owner; Host enforces the control |

The latest decision and current status can differ. After an agent returns
`wait`, new input can make the Task pending before another agent runs. A
`continue` decision makes work eligible; capacity, backoff, owner controls and
execution limits still govern when it starts. A `converged` decision completes
the addressed request while retained Conditions or other inputs can still
affect Task execution. Infra derives that execution state from existing records;
it does not use it to invent a new completion judgment.

The combined Task view uses existing records: lifetime, execution phase/current
attempt, outstanding Conditions, pending inputs and accepted results. Do not
add combined phases such as `running-and-waiting`, duplicate booleans, or a new
agent-wide state. A human view can say “Running tests; review still outstanding.”

## Proposed agent output schema — deferred

This section and its output examples describe a possible later interface.
PR #285 retains the existing `state`/`continue` schema. Use the checked
[current authoring examples](../examples/app.ts) for candidate-compatible code.

The following is the proposed TypeScript contract. `AppInput`, `Condition` and
`TaskAction` retain their existing SDK meanings. JSON Schema, TypeScript and
semantic admission must expose the same field combinations.

```ts
type TaskAppRequest = {
  id: string;
  appId: string;
  taskId?: string;
  input: AppInput;
};

type TaskCondition = Condition | { requestId: string };

type AttemptEvidence = {
  summary: string;
  facts: string[];
  inputKeys?: string[];
  result?: Record<string, unknown>;
};

type WorkDeclarations = {
  requests?: TaskAppRequest[];
  conditions?: TaskCondition[];
  actions?: TaskAction[];
  reviewAt?: number;
};

type TaskAgentResult =
  | (AttemptEvidence & WorkDeclarations & {
      decision: "continue";
      facts: [string, ...string[]];
      report?: true;
      response?: never;
    })
  | (AttemptEvidence & WorkDeclarations & {
      decision: "wait";
      response?: never;
    } & (
      | { report?: never }
      | { report: true; facts: [string, ...string[]] }
    ))
  | (AttemptEvidence & {
      decision: "converged";
      response?: string;
      requests?: TaskAppRequest[];
      actions?: TaskAction[];
      conditions?: never;
      reviewAt?: never;
      report?: never;
    })
  | (AttemptEvidence & {
      decision: "incomplete";
      facts: [string, ...string[]];
      response?: string;
      report?: true;
      requests?: never;
      conditions?: never;
      actions?: never;
      reviewAt?: never;
    });

// Workflow-only handoff; never exposed as an agent choice.
type TaskReconcileResult = TaskAgentResult | {
  decision: "needs-agent";
  summary: string;
  facts: string[];
  inputKeys?: never;
  result?: never;
  response?: never;
  report?: never;
  requests?: never;
  conditions?: never;
  actions?: never;
  reviewAt?: never;
};
```

Every JSON branch rejects unknown fields. Branch-only fields are forbidden in
other branches, even if their value is an empty array. Numeric bounds,
non-empty values and current-state checks are enforced at admission/settlement,
not implied by a TypeScript `string` or `number`.
`error` is Host execution evidence, never an agent decision. A resolved agent
cannot return `needs-agent` or choose another execution owner this way.

### Field meanings and allowed combinations

| Field | Allowed decisions | Contract |
| --- | --- | --- |
| `decision` | All | Exactly one attempt judgment; required |
| `summary` | All | Non-empty explanation of the judgment; required |
| `facts` | All | Evidence supporting the judgment; required, possibly empty only where current acceptance permits |
| `inputKeys` | Agent decisions | Exact set addressed by this result; omission uses the saved assignment and admitted live input; `[]` addresses no input |
| `result` | Agent decisions | Bounded structured output; partial on continue/wait/incomplete, candidate accepted output on convergence |
| `requests` | continue, wait, converged | Submit receiver-owned work; carries no caller scheduling decision |
| `conditions` | continue, wait | Add or update caller waits; existing omitted waits remain |
| `actions` | continue, wait, converged | Existing exact Task actions, including explicit Condition retirement; keep authority and freshness checks |
| `reviewAt` | continue, wait | Optional absolute reconsideration time in Unix milliseconds; time wakes the Task, never fulfills a Condition |
| `report` | continue, wait, incomplete | `true` selects a caller-relevant progress/blocker update; requires facts and does not fulfill an input |
| `response` | converged, incomplete | Caller answer on accepted convergence, or a factual failure response on incomplete; only convergence can fulfill input |

`facts` must contain at least one observation for `continue`, `incomplete`, a
selected report, or an action. A continued attempt describes actual progress
and explains remaining useful work in `summary`; there is no new mandatory
plan/checklist field. Facts make the decision reviewable, not mechanically
proven to be useful.

Preserve current bounds: at most 64 unique input keys, 32 facts, 8 requests,
24 Condition declarations, 16 actions and 16 KiB of structured `result`.
Preserve existing non-empty string, identity and timestamp validation.
This proposal does not loosen App acceptance checks.

### Requests and Conditions

This section describes #285's candidate request representation. The later
[capability proposal](task-execution-capabilities-20261002.md#calling-convention-intent-and-an-answer-choice)
moves the answer choice into the caller's request and has infra fill the
necessary existing records. It does not require changing the receiver's input
or adding a second Condition lifecycle.

`requests[].id` is stable within the caller Task generation. Repeating the
same request reuses its durable admission; reusing that identity with changed
content is rejected. Omit `taskId` to let the receiver App select its work;
supply it to address exact existing work. Input kind does not select whether
the caller waits.

A short Condition `{ "requestId": "review" }` refers to a request named
`review` in this call/result or already admitted in the same caller generation. Infra resolves the exact request/result identity
and installs the existing durable completion Condition. The agent does not
manufacture event IDs, inbox IDs or a second tracking registration.

An external Condition retains this shape:

```ts
type Condition = {
  id: string;
  type: string;
  subject: string;
  expected: unknown;
  owner: string;
  reviewAfterMs: number;
  requestedAction?: string;
};
```

Use a supported namespaced event type, typed subject and canonical owner.
New Conditions require `reviewAfterMs` of at least 60 seconds under the current
contract. A named type does not create an observer. `owner` and
`requestedAction` identify responsibility and the needed action; they do not
send a notification. Sending a request or contacting a human uses the existing
delivery capability.

Omitting `conditions`, or returning `conditions: []`, preserves saved waits.
Omitting `requests` preserves admitted receiver work. Retire a wait explicitly
with the existing action and its observed generation; this does not cancel
the receiver's work or assert that its result occurred. The next attempt can
reuse a saved wait without repeating the request or Condition declaration.

### Addressing and fulfilling input

`inputKeys` is the scope of this result, not a Task-wide completion flag.
On convergence, the worker judges all selected requirements fulfilled under
the App's acceptance policy. Infra trusts the accepted decision, records the
selected inputs as done and returns their result. Callers can rely on it in
normal work. That convention is not a guarantee of correctness. Other recorded
facts keep their own meaning. On continue/wait/incomplete, the selected inputs
remain unanswered. Unselected inputs, retained Conditions and accepted results
survive under their existing contracts.

Several inputs can express one evolving requirement. The agent considers the
original request and its updates together and returns one accepted result
covering their exact keys. Nothing requires one attempt per input. A handoff,
acknowledgment or accepted helper request does not fulfill the original ask.

For a requirement created directly through Task intent, existing generation
and acceptance rules still apply without inventing an input key.
`inputKeys: []` cannot be used to claim that unrelated outstanding requests
were answered. Infra preserves correlation; the App/agent judges whether
the evidence satisfies the requirement.

## How infra applies a decision

| Accepted decision | Addressed inputs | What can happen next |
| --- | --- | --- |
| continue | Remain open; useful progress is retained | Same Task becomes pending for another bounded attempt, even with unresolved Conditions |
| wait | Remain open with their exact return routes | Sleep if no other eligible work exists; newer input or feedback can keep the Task pending |
| converged | Mark the selected requests done and return their accepted result | Callers can proceed; run other eligible inputs, retain outstanding waits, or become up to date; Task stays open |
| incomplete | Remain open with failure evidence | Existing same-Task retry with backoff and existing caller reporting |

Reuse the current admission and fenced settlement boundaries:

1. Validate the complete output and its references before admitting declared
   effects. Return correctable errors through the existing finish contract.
2. Check current attempt, generation, authority and input freshness. A closed
   Task or stale attempt cannot be revived by its late decision.
3. Apply permitted requests, Condition changes, actions and result selection
   through existing durable, replay-safe mechanisms. Keep the accepted result
   and its existing evidence. Partial admission or a process crash must retain
   exact identity for recovery, not duplicate work.
4. Determine eligibility from the updated canonical Task. Preserve new input
   and feedback that the attempt did not consider. Respect explicit Stop,
   closure, cancellation, backoff and capacity controls.
5. Release the current attempt and let the existing controller schedule the
   next one when eligible. One Task retains at most one active attempt.

Request reservation and caller bookkeeping commit together in the existing Host
SQLite transaction. Only then is delivery dispatched. Final declarations also
settle the attempt in that transaction. Receiver execution and acceptance remain
separate; there is no transaction spanning two running agents.

A `wait` needs a real return route: an unresolved new/saved Condition or a
future new/saved review deadline. A request without a caller Condition is not
such a route. Check this against retained state, not just this JSON object.
If a matching result or other relevant input has already arrived, retain it
and schedule consideration instead of rejecting the wait or losing the wake.
If neither a route nor pending work exists, return a correctable invalid-wait
error; do not silently abandon unfinished work.

Condition satisfaction supplies evidence for another decision. It never
accepts the caller's outcome. A failed helper report also reaches the caller
through existing feedback; it must not masquerade as fulfillment. A review
deadline prompts reconsideration, not success or automatic human notification.

`wait` is an ordinary worker yield, not an owner-issued pause. New eligible
input can wake it. Owner Stop/pause/closure controls retain their own semantics
and are not encoded as another agent decision.

## Examples

### Request review now, then continue testing in the same attempt

Assume the receiver exposes a `message` input with `data.message`, as May does,
and the current assignment is
`input-original` plus its requirement update `input-update`.

Call the existing Task tool:

```json
{
  "action": "apply",
  "changes": {
    "inputKeys": ["input-original", "input-update"],
    "requests": [{
      "id": "review",
      "appId": "reviewer",
      "input": {
        "kind": "message",
        "data": { "message": "Review the patch against the original and updated requirements." }
      }
    }],
    "conditions": [{ "requestId": "review" }]
  }
}
```

Infra saves the caller Condition and sends the request. The caller receives its
receipt and runs tests in the same attempt. Neither input is fulfilled yet.
The reviewer's work is identical if the caller omits the Condition. Returning
these changes in a final `continue` result instead uses the same admission,
then schedules a new attempt for testing.

### Yield after tests, keeping the existing review wait

```json
{
  "decision": "wait",
  "summary": "Tests passed. The review is the remaining requirement before I can finish.",
  "facts": ["The relevant test suite passed; the review result is still outstanding."],
  "inputKeys": ["input-original", "input-update"]
}
```

Infra finds the saved Condition. The agent repeats neither the request nor
the wait. If review feedback or another input arrived during testing, infra
keeps that work eligible rather than sleeping over it.

### Accept the original request and its update together

After reviewing the returned evidence and making any necessary corrections:

```json
{
  "decision": "converged",
  "summary": "The implementation satisfies the original and updated requirements.",
  "facts": ["The relevant tests passed.", "The review findings were addressed and checked."],
  "inputKeys": ["input-original", "input-update"],
  "response": "The requested change is complete, including your updated requirement."
}
```

Subject to App acceptance and current-input fences, infra accepts exactly
those inputs. Other work survives and the Task stays open.

### Record an unsuccessful attempt

```json
{
  "decision": "incomplete",
  "summary": "The test process could not start, so I cannot establish acceptance.",
  "facts": ["The execution capability returned a startup error before tests ran."],
  "inputKeys": ["input-original", "input-update"]
}
```

Infra retains the failure and existing retry/reporting behavior. This decision
neither closes the Task nor claims that a human has been contacted. If the
agent instead knows an exact external fact is needed, it can deliberately
request help and return `wait` with that Condition.

## Deliberate limits and alternatives for review

The recommended field is an **attempt decision**, not a pure scheduling
command. `converged` claims fulfillment; `incomplete` reports failure. Those
meanings are already part of the result contract and determine the appropriate
infra behavior without a second agent-written scheduling field.

One result applies one disposition to its selected input set. If A is complete
and B is already runnable, convergence for A leaves B runnable. If B already
has a saved wait, convergence for A preserves it. A single result cannot both
accept A and introduce a new wait scoped to B. That requires separate scoped handling
under this minimal proposal. This limitation does not force an evolving
requirement's multiple inputs to be handled separately.

| Alternative | Benefit | Cost / recommendation |
| --- | --- | --- |
| Keep `state: waiting` plus `continue: true` | Smallest code change | Chosen for #285: resolves the demonstrated failures without migrating every consumer |
| One `decision` union, as proposed | Clear common choices; reuses existing result scope and settlement | Deferred: requires schema IDs, compatibility handling and changes across producers and readers |
| Separate scheduling and per-input outcome fields | Can accept A and independently continue/wait on B in one result | Requires separately scoped outcomes, declarations and compatibility rules; consider if that mixed case justifies the larger contract |
| Agent supplies the full Task state | Appears to combine everything in one object | Makes the agent copy bookkeeping and race current facts; keep Task state Host-owned |

If mixed acceptance and new waits in one result are required now, revise this
schema before implementation. Do not add a second scheduling flag later as
an exception to `converged`. That would recreate the ambiguity being removed.

## Compatibility and implementation scope — deferred schema migration

The migration below is a possible later change, excluded from #285. Current
source keeps one existing result schema and its IDs; only legacy `dependencies`
normalize to requests plus caller Conditions. No decision-to-state adapter or
new result type is needed. The request route and shared admission are useful
independently of renaming the result.

If the output migration is taken later, keep one canonical internal result after admission. Expose the new shape to
agents through versioned schema IDs; keep old schema IDs recognized for saved
sessions. Normalize supported old outputs once at SDK admission:

| Existing output | Canonical decision |
| --- | --- |
| `state: waiting`, `continue: true` | continue |
| `state: waiting`, no continuation | wait |
| `state: converged` | converged |
| `state: incomplete` | incomplete |
| Workflow `state: needs-agent` / supported legacy alias | needs-agent, workflow only |

Validate the old contract before converting it. Preserve reports, facts,
scope, deadlines, Conditions and actions. Keep #285's legacy dependency
normalization into requests plus caller Conditions. Reject mixed `state` and
`decision` output and reject the old `continue` flag in a new-style result,
even if the fields appear consistent. Do not guess a decision from Conditions.

New JSON schemas teach only the new shape. Old workflow source types can use
a clearly deprecated legacy type during migration; both enter the same
normalizer. Existing accepted attempt records, exact result references and
Task phases need no bulk rewrite. Read historical result fields where needed,
but never replay their effects merely because their spelling changed.

Implementation must cover the SDK types/schema/semantic admission, managed
executor finish validation and serialization, workflow handoff, result
normalization, attempt settlement, controller recovery and all current
`continue: true` producers. Update App compositions, prompts and examples that
inspect the result discriminant or Conditions. #285's receiver input routing
and request identity guarantees remain intact.

The input portion primarily clarifies existing App admission and normal agent
interpretation. It does not add a mandatory `understanding` field to every
output, a universal business schema to the Host, or a new interpretation
service. Review App guidance and retained source-input context alongside the
output change so typed and free-form paths reach the same fulfillment rules.

The canonical App contract and Task engine design should change only when the
proposal is accepted and implemented. Keep this record as the review rationale.
Deploy Host support for both result spellings before switching independently
released App producers to the new one; #285's separate receiver-mapping
integration order still applies. Source review does not authorize deployment.

## Validation required before calling the implementation ready

Use the existing `state`/`continue` form for #285. New result spellings and their
compatibility checks belong to the deferred migration, not its merge criteria.

| Scenario | Required observation |
| --- | --- |
| Equivalent text and structured requests | Same intended work/acceptance, preserved source input, and no payload-kind scheduling difference |
| Missing material detail in free-form input | Uncertainty stays explicit; clarification uses an actual return route without fabricated requirements |
| Later correction to a free-form request | Same requirement is revised when appropriate; earlier constraints and exact input links remain |
| Invalid structured App input | Useful schema feedback; no silent semantic rewrite at Host admission |
| Interpretation followed by interruption | Original inputs and unresolved obligations remain discoverable; understanding alone does not settle them |
| Continue with an unresolved Condition | Another bounded attempt runs; wait and original requirements remain |
| Continue without any Condition | Accepted with progress facts; no invented wait or failure retry |
| Wait without repeating an existing Condition | Saved wait and correlation survive, including restart |
| Wait with no return route and no pending work | Correctable rejection; unfinished input is preserved |
| Result arrives before, during or just after wait settlement | No lost wake, false invalid-wait rejection or duplicate parent attempt |
| New input arrives during wait/convergence | Exact scope and freshness fences preserve it; old decision does not suppress it |
| Several inputs update one requirement | One accepted result can fulfill the entire selected set with evidence |
| One input accepted while an independent wait remains | Accepted result is retained and the other requirement stays open |
| Accepted convergence | Addressed request becomes done and its caller can proceed without an added confirmation or verification round |
| Conditions coexist with a completion decision | Normal decision admission applies; infra does not invent a semantic veto or fabricate changes to Condition state |
| Agent, workflow and configured-verifier results | Existing evidence records the actual acceptance path without presenting it as a guarantee |
| Later evidence challenges an accepted result | Existing owner/input/control paths carry reconsideration; late observations do not invent reopening authority |
| Helper acknowledgment/progress/failure | Caller receives appropriate evidence; original input is not falsely fulfilled |
| Retire one wait or omit all declarations | Exact retirement only; omission never clears unrelated waits |
| Restart or lost feedback | Same request, result and Condition recovered without duplicate receiver work |
| Invalid schema or stale result | Useful correction/error evidence; proposed effects are not accepted as success |
| Existing output / saved schema | Existing state/continue contract and schema IDs remain; legacy dependencies normalize once |
| Closed or stopped Task | Late decision cannot override the explicit control |

Run focused SDK/runtime and affected App checks, then the Host's full CI and
both PR checks on a fixed revision. Include an explicitly authorized model
trial if claiming that real agents choose the new outputs reliably; scripted
tests establish mechanics, not that behavioral claim.

Checks completed for the earlier candidate against Host `075d0d4a`: six JSON examples parse;
all five TypeScript excerpts and the final/action examples type-check together;
four final/action examples pass SDK admission. The canonical documentation
examples also pass their SDK/control type checks and seeded Task replay checks.
Focused runtime tests cover live submission, final replay, fast results,
interruption, saved local references, rollback, and repeated retirement.
May's input/metric checks and Evaluation's affected owner checks pass.
Full Host CI and GitHub check results are recorded in PR #285.
The clarified trust rule requires no new result envelope or historical snapshot.
These checks establish execution mechanics; they do not guarantee the correctness
of agent judgments or establish live resolution of the original incident.

Those earlier checks covered the wider candidate, not the narrowed revision.
Current verification is recorded with exact revisions in PR #285. Scripted
trials establish mechanics; there is no deployment or model-behavior claim.

Review the governing rules, exact input/output boundary, shared action admission,
one disposition per selected input set, and compatibility limits. The narrowed
candidate fixes routing and shares admission while retaining the existing result
format. The spelling proposal is deferred; source review does not authorize rollout.
