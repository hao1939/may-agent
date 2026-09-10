# Core review: simple, robust, replaceable

**Status:** Active review plan. Core separation, shared settlement, durable retry
limits and atomic request attachment are implemented at the
[documented source baseline](../README.md). The latest
[implementation review](../archive/reviews/core-implementation-alignment-20260910.md)
found two input-handling failures and confirmed the remaining human-control gaps.
The sequence below is proposed for review; runtime changes are not implemented.
This is not a deployment record.

## Current focus: simple and robust core

> Removal should degrade capability, while preserving the remaining system's correctness.

The [Architecture](../2a-design/architecture.md#core-responsibilities) owns the
four core responsibilities, dependency rules, code map and absence behavior.
The [System Model](../2a-design/system-model.md) explains the whole flow.
These are ordinary modules using existing contracts, not a new service framework.

Judge a change by its contribution to May's goal and its total cost. Prefer
safe, affordable redo over elaborate recovery. Start from a reproduced failure
or a demonstrated maintenance cost; stop when the required outcome is met.
The [decision guide](../1-principles/core-principles.md#review-rule) supplies the
tradeoff rules.

## Design against implementation

The four core responsibilities already have working boundaries. Retain them.

| Core responsibility | Source assessment | Useful next change |
| --- | --- | --- |
| App registration and input admission | Validated registration and atomic Task attachment exist | Preserve conventional discovery and the current admission boundary |
| Events | Existing routes, durable admissions and change hints connect components | Reuse them for exact turn control and correlated failure evidence |
| State and storage | SQLite fences, transactions and request readiness are implemented | Persist only the missing turn disposition and accepted-ask state |
| Work runtime | Task controller, shared settlement, durable retries and parent-owned repair are present; conversational handling has weaker containment | Fix input renewal/retries and durable turn control; finish the existing finite-Task stop review |

The largest gaps are at the Conversation boundary. Internal `AppRequest` input
rows are not the accepted human Request defined by the design. Completing an
input, fulfilling an ask and completing a Task remain separate facts.

## Proposed implementation order

### 1. Contain input ownership failures

**Value:** One failed renewal must not terminate unrelated work. The production
renewal callback currently lets a SQLite exception reach the fatal process
handler and ignores a false renewal result.

Catch renewal errors locally and handle lost or uncertain ownership explicitly.
Stop/fence the exact execution, reject late Host replies/admissions, and clean up even when
reporting or the next database write also fails. Reuse existing ownership and
execution controls; make the input resolver expose the cancellation binding it
currently lacks. Capacity remains occupied until execution actually stops.
Failure evidence should identify App, input, claim and execution using existing
events/reads, with a local diagnostic fallback when storage is unavailable.

**Accept when:** Injected renewal error or lost claim leaves the Host and another
Conversation usable; stale replies/admissions are rejected; reporting failure
does not skip cleanup. Recheck authority after database recovery. This does not
promise to undo external effects or keep accepting writes during a DB outage.

### 2. Finish failed conversational handling truthfully

**Value:** Repeated model execution costs money and holds up the Conversation.
The current failed resolver returned to pending after all 12 probe attempts,
including six after reopening SQLite; Task retry limits do not cover this path.

**Proposed default:** After unsuccessful or invalid completed conversational
execution, retain a failed handling outcome and a truthful response, release
the Conversation, and wait for a new human turn or explicit retry. The accepted
ask remains unresolved. Cheap coordination failures before execution can retain
their safe retry behavior. A small durable automatic execution allowance is an
alternative only if its demonstrated value warrants the extra policy/state.

Apply this first to direct conversational handling. Do not turn Task callers or
retained child waits into successful results on error. Keep existing row status
meaning compatible and make failure distinguishable from fulfillment. Reuse
input result/claim storage; add only the outcome information needed by readers.

**Accept when:** Persistent resolver failure stops spending after the chosen
allowance, remains stopped after reopen, exposes the reason, and permits the
next message. Failure to publish a response or a lost change hint must not rerun the model.
This default is a decision for review, not a change to the accepted contract yet.

### 3. Make Stop this turn durable, then add steering

Use the exact input/claim execution binding from step 1. Persist Stop before
aborting the executor; late callbacks cannot reply or admit follow-up work.
Recovery must not restart that turn. Independent Tasks continue. Adapters send
the observed target through existing event control; delayed commands cannot
affect a newer turn. Start with one end-to-end Stop path before adding surfaces.

Steering can save the correction, interrupt and start the next bounded
execution from current evidence. Seamless resumption is optional. Verify Stop
racing with completion, restart, duplicate control, and a delayed old command.
The [Human controls](../2a-design/human-control-surfaces.md#current-turn-control)
page owns the full contract, including Request withdrawal and external effects.

### 4. Close the loop on accepted Requests

Reuse Conversation storage and the existing May supervision Task. The minimum
record needs accepted-ask identity, current scope/revision, Conversation
references, exact linked Tasks when applicable, and open/closed with the closure
message/reason. This is a data requirement, not a selected table or new lifecycle.
The App recognizes/refines asks and judges closure; the Host checks versions
and persists closure consistently with its explanation.

Add bounded reads of open asks to existing context and supervision recovery.
A Request does not run or retry execution itself. Test discussion-only closure,
handoff remaining open, results after restart, withdrawal, and a delayed closure
rejected after scope changes. Keep stopped turns stopped even while their ask is
open. [Message Lifecycle](../2a-design/message-lifecycle.md#current-implementation-and-gaps)
owns these requirements.

## Code homes and boundaries

| Change | Start in existing code | Boundary to preserve |
| --- | --- | --- |
| Input failure and exact execution control | `app-inbox-host.ts`, `app-request-agent.ts`, manager/session cancellation adapter | Input Host owns handling; executor adapter owns its live execution handle |
| Durable turn outcomes and fenced controls | `app-inbox-store.ts`, `core/state/requests.ts` where a combined operation is justified; schema in `lib/db/` | One transaction owner; no executor or App policy inside a transaction |
| Public Stop and failure visibility | Existing event routes/composition, control protocol and one human adapter | Events address exact work; local state changes remain typed calls |
| Accepted ask recognition and closure | Host `conversations/store.ts` and existing request protocol; `projects/may.app/app.ts` and May guidance | Host stores/fences; App judges meaning; supervision reuses the existing Task |

Extract a coherent function only when it removes duplicated decisions. Large
runtime files warrant attention, but moving them wholesale or creating empty
destination modules supplies no demonstrated benefit.

## Other work and deliberate deferrals

- Parent-owned repair now has merged proof in #110. Review the existing
  [finite-Task stop candidate](task-controller-pattern.md#candidate-stop-without-claiming-success)
  separately; it does not implement conversational Stop or Request closure.
- [Atomic attachment](storage-state-service.md#first-slice-implementation-evidence)
  is already implemented. Extract another state operation only for a demonstrated
  consistency or maintenance problem.
- Recovery-query work grows with eligible backlog even with a fixed return limit.
  The latest synthetic measurement is about 24 ms at 20,000 eligible Tasks.
  Measure representative load and control responsiveness before optimizing.

A bounded result count does not prove bounded query cost. Likewise, moving
files does not prove simpler behavior, and a passing synthetic fixture does
not prove arbitrary external effects are safe to repeat.

## Review a change

Follow one exact Task or input across admission, execution, result acceptance,
and a failure or restart. Verify only the boundaries the change affects:

- Accepted work and evidence survive; a stale attempt cannot overwrite current state.
- Work and retries are bounded; waits release capacity; cleanup still runs if reporting fails.
- Normal and recovered results use the same acceptance rules.
- Missing optional capabilities leave unrelated work and canonical reads correct.
- The owner receives enough evidence to act; inability to finish is visible and never success.

Then compare the removed decisions and ongoing cost with the complexity added.
Keep App judgment with the App. Events carry meaningful inputs, changes and
wakes; local reads, executor calls and atomic transitions remain typed calls.

## Deferred choices

Error-hook/metric placement and App consolidation remain in the
[archived discussion](../archive/reviews/error-handling-and-conversation-discussion-20260910.md).
Existing failure containment is required; an additional core metric service is
not. Capacity events and a separate API server require a demonstrated consumer
or consistency problem; they are options in the storage proposal, not prerequisites.

## Completed work and evidence

The latest [design/source comparison and portable probes](../archive/reviews/core-implementation-alignment-20260910.md)
record 111 passing focused tests, two reproduced input failures, and scope limits.
The [dated core snapshot](../archive/implementation/core-separation-review-20260910.md)
preserves the separation steps, source findings and PR-specific validation.
The [controller review snapshot](../archive/implementation/controller-review-20260910.md)
preserves settlement/retry candidates and their proof. Current behavior belongs
in the owning design pages; do not restart completed extraction steps from
these historical records.

### First stop slice: the current finite Task only

The active specification moved to the
[controller proposal](task-controller-pattern.md#candidate-stop-without-claiming-success).
This link remains for earlier reviews; the stop candidate is not part of the
merged source baseline.

## Earlier review links

The Host source guide still links these entrypoints. Their current owners are:

<a id="step-2-separate-app-source-discovery-from-core-registration"></a>

- App discovery and registration: [Architecture](../2a-design/architecture.md#code-organization);
  [original Step 2](../archive/implementation/core-separation-review-20260910.md#step-2-separate-app-source-discovery-from-core-registration).

<a id="step-3-finish-the-taskexecutor-boundary"></a>

- Task/executor boundary: [Task engine](../2a-design/task-resource-engine.md#one-attempt-interface);
  [original Step 3](../archive/implementation/core-separation-review-20260910.md#step-3-finish-the-taskexecutor-boundary).

<a id="shared-timing-intentional-events"></a>

- Shared timing: [Scheduling and Observation](../2a-design/cron.md#shared-timing-separate-responsibilities);
  [original review](../archive/implementation/core-separation-review-20260910.md#shared-timing-intentional-events).
