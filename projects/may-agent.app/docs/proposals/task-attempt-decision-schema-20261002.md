# Proposal: make the attempt decision explicit

**Supports:** [Task attempts and results](../2a-design/task-attempts.md). Tests whether a clearer result discriminant reduces agent confusion without changing responsibility or scheduling semantics.

**Choice basis:** [Simple first](../1-principles/core-principles.md#simple-first) and [convention over configuration](../1-principles/core-principles.md#convention-over-configuration).

**Design status:** Draft; schema migration deferred.
**Implementation status:** Unimplemented. Host #285 retains `state` and `continue` and the existing schema IDs. Its merged routing and live/final admission behavior belongs in the current contract. Paired App mapping changes remain separately unmerged in the recorded review.

## The decision still to make

Should `decision: "continue" | "wait" | "converged" | "incomplete"` replace the
current `state`/`continue` expression? The expected benefit is clearer agent
choice. The cost is changing schemas, adapters, guidance and independently
released App producers. Retaining the existing fields with clearer guidance is
the simpler baseline; a proposed spelling should demonstrate useful improvement.

Use [Working on a Task](../2b-manual/task-execution-guide/SKILL.md) and the
[attempt contract](../2a-design/task-attempts.md) for current behavior. The
[App contract](../2a-design/agent-app.md#admission-and-clarification) owns free-form
and structured input admission. [The #285 review record](../archive/reviews/task-attempt-decision-review-20261002.md)
retains the full earlier discussion, trust-rule refinement and candidate evidence.
The separate [capability proposal](task-execution-capabilities-20261002.md) owns
the proposed caller reply convenience.

Everything below describes the deferred interface. Its examples are not current
copyable SDK examples. This change adds no completion gate, Condition veto,
caller verification round or guaranteed correctness of agent judgment.

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

If this proposal is accepted, update the owning attempt contract with an explicit
implementation gap until the new interface is supported. Teach the new fields as
callable only when that support is available. Keep this record as the rationale.
Deploy Host support for both result spellings before switching independently
released App producers to the new one; #285's separate receiver-mapping
integration order still applies. Source review does not authorize deployment.


## Evidence needed to choose this change

Compare current and proposed guidance on continuing independent work with a
pending review, yielding on a saved wait, addressing several corrected inputs,
and returning incomplete work. Inspect actual agent decisions and retained state;
valid JSON alone does not show improved understanding. Check migration cost
against any reduction in incorrect decisions or repeated explanation.

Before implementation is ready, verify SDK/schema/admission agreement, live and
final actions, replay, fast results, restart and mixed-version producers. The
[historical review cases](../archive/reviews/task-attempt-decision-review-20261002.md#validation-required-before-calling-the-implementation-ready)
provide concrete scenarios, but earlier candidate passes do not validate this
deferred schema or establish deployment.
