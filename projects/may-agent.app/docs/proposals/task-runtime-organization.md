# Core review: simple, robust, replaceable

**Status:** Active review plan. Core separation, shared settlement, durable retry
limits and atomic request attachment are implemented at the
[documented source baseline](../README.md). Remaining decisions are below.
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

## Remaining work and its owner

| Question | Next useful step | Owning document |
| --- | --- | --- |
| Can an App resolve work it cannot finish? | Review the finite-Task stop candidate, then prove the existing owner route can make and communicate an authorized decision | [Controller proposal](task-controller-pattern.md#candidate-stop-without-claiming-success) |
| Does an accepted human ask survive turns and get closed? | Persist accepted Request identity and closure using existing Conversation and Task references; verify restart and changed scope | [Message Lifecycle gaps](../2a-design/message-lifecycle.md#current-implementation-and-gaps) |
| Can a human stop or steer the current turn? | Provide durable turn control without cancelling independent Tasks or restarting the stopped turn | [Human controls](../2a-design/human-control-surfaces.md#current-turn-control) |
| Would another state operation simplify coordination? | Extract one proven atomic operation and remove its old coordination; request attachment already supplies the first example | [Storage proposal](storage-state-service.md) |
| Are recovery queries too expensive at realistic load? | Measure scan cost and control responsiveness with representative retained state before adding indexes or changing queries | [Source review](../archive/reviews/core-simplicity-review-20260910.md) |

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
