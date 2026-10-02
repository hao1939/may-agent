# Task Handler Resolution Refinement

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted and incorporated; archived decision

**Implementation:** Implemented, deployed, and canary-verified

**Scope:** Change unavailable-workflow fallback and clarify owner handoff in the accepted Task Resource Engine

**Does not replace:** [Task Resource Engine](../../2a-design/task-resource-engine.md)

## Summary

Tasks need two different kinds of responsibility:

- an **owner** who is accountable for the outcome; and
- an optional **workflow** that defines the selected execution method.

The current design already contains both concepts. It does not need a new
`handler` field, handler registry, controller type, or task mode. The required
refinement is narrower: when a task names a workflow, that workflow should be
authoritative. The runtime should invoke the owner for the same task only when
the workflow explicitly returns `needs-owner`.

Missing, invalid, or failed workflows should be visible failures. They should
not automatically change the task's execution method to direct owner handling.
This is a deliberate change to the previously accepted unavailable-workflow
fallback rule, not merely a documentation clarification.

## Motivation

The generic reconciler and the task handler have different jobs:

```text
event / Condition / resync
  -> generic reconciler claims current canonical task state
  -> selected handler performs or evaluates the domain work
  -> generic reconciler validates and applies the result
```

The reconciler owns mechanics:

- canonical-state claims;
- concurrency and deduplication;
- dependency and Condition checks;
- stale-result rejection;
- result admission;
- atomic state transitions; and
- recovery.

It must not perform domain work or interpret task prose.

The selected handler owns execution and judgment. Today it is resolved from
the task's existing `owner` and optional `workflow` bindings. That is already
enough information.

## Previous behavior

Before this refinement, the resolution path was:

```text
task.workflow present -> run workflow
task.workflow absent  -> run resolved owner
workflow needs-owner  -> run resolved owner sequentially
workflow unavailable  -> run resolved owner sequentially
```

The first three cases are intentional and mostly clear. The fourth case is the
problem. A missing workflow was recorded as `HandlerUnavailable`, but the
runtime then invoked the owner and could converge the task successfully.

That behavior is observable through `HandlerUnavailable`, events, attempts, and
receipt fingerprints. It improves short-term availability but still weakens
desired-state integrity because the runtime automatically substitutes another
execution method:

- the task asked for one execution method and received another;
- workflow-specific checks or safety steps may be skipped;
- deployment/configuration errors can be hidden by a capable owner;
- the final acceptance basis changes from workflow contract to owner judgment;
  and
- the same task may behave differently depending on whether its workflow was
  installed correctly.

The workflow authoring manual also says that a blocked top-level task workflow
invokes owner fallback. The implementation does not do that for an ordinary
`ctx.blocked()` result; it records attention. The design and manual should use
one unambiguous rule.

## Proposed decision

### 1. Keep one generic reconciler

A dedicated workflow does not replace the generic reconciler. Every task still
passes through the same claim, admission, application, and recovery mechanics.

### 2. Keep the existing `owner + workflow` model

Do not add `handler` to task desired state.

- `owner` means accountable agent.
- `workflow` means optional delegated execution method owned by that agent.
- attempt `handler` remains observed runtime information such as
  `workflow:scout-explore` or `owner:scout`.

### 3. Make an explicit workflow binding authoritative

Handler resolution becomes:

```text
if task.workflow is absent:
  invoke resolved owner directly

if task.workflow is present:
  invoke that workflow
  if it converges or waits:
    apply its result
  if it explicitly returns needs-owner:
    invoke resolved owner once, sequentially
  if it is missing, invalid, blocked, throws, or times out:
    record attempt failure/attention; do not substitute the owner
```

This makes desired execution intent deterministic. The owner remains
accountable; the binding identifies the execution method that owner selected
for the current task generation.

### 4. Reserve `needs-owner` for deliberate handoff

`needs-owner` is a valid workflow decision, not an error alias. A workflow uses
it after completing the reusable part of the process and determining that the
remaining decision requires owner judgment.

The handoff must preserve enough provenance to explain the decision:

- configured workflow name;
- workflow summary and evidence;
- task ID and generation;
- the `needs-owner` reason; and
- final owner acceptance evidence.

Only one owner attempt may follow the workflow attempt for that handoff.
Existing task attempts, receipt `workflow` and final `handler`, acceptance
basis, and the `needs-owner` failure fingerprint are sufficient for the first
implementation. Workflow-run IDs remain available through workflow and event
traces; no new task-state lineage schema is required.

### 5. Treat `ctx.blocked()` as execution failure

For a task-bound workflow, `ctx.blocked()` means the workflow could not produce
an applicable task decision. The controller records the failed attempt and
moves the task to `attention` according to the existing failure mechanics.

It does not imply owner handoff. If the workflow has enough information to
request accountable judgment, it returns a valid task result with
`state: "needs-owner"` instead.

### 6. Preserve direct owner execution

Tasks without a workflow remain first-class. The owner receives the canonical
task intent and current trigger and returns `converged` or `waiting`.

This path is appropriate for novel, ambiguous, or one-off work that has not
yet become a reusable process.

### 7. Retry after the binding is repaired

`HandlerUnavailable` moves the task to `attention` and must not be retried on
every passive resync. That would create a failure loop while the binding is
still broken.

After a successful app installation or reload, the host checks attention tasks
whose latest failure is `HandlerUnavailable`. If the configured workflow now
resolves under the accountable owner, it enqueues that stable task ID once.
Blocked, thrown, timed-out, and invalid-result failures still require an
explicit task wake, desired-state change, or operator retry.

## When to bind a workflow

Bind a workflow when the work is:

- recurring or event-driven;
- expected to follow stable steps;
- source-, tool-, or environment-specific;
- safety-sensitive;
- suitable for bounded retries or deterministic verification; or
- important enough to regression-test as a learned process.

Use direct owner handling when the work is:

- novel or unusually ambiguous;
- primarily investigation or judgment;
- unlikely to repeat; or
- not yet understood well enough to encode safely.

The intended learning loop is:

```text
owner handles novel task
  -> repeated successful method emerges
  -> method is extracted into an agent-owned workflow
  -> tests and optional verifier are added
  -> future tasks bind that workflow
```

A dedicated workflow may still invoke the owner or other agents internally.
Dedicated means the process is explicit and reusable, not necessarily that the
process is deterministic or agent-free.

## Acceptance and receipts

The existing acceptance model remains:

- direct owner handling records `owner-judgment`;
- workflow completion records `workflow-contract`;
- an accepted verifier records `deterministic`; and
- explicit workflow-to-owner handoff records final `owner-judgment` while
  preserving workflow handoff lineage.

A missing or failed workflow produces no completion receipt. A receipt must not
imply that the configured workflow ran successfully when the owner actually
substituted for it.

## Implementation changes

### Runtime

- Stop converting `WorkflowHandlerUnavailable` into automatic owner handoff.
- Mark the attempt/task through the existing `HandlerUnavailable` attention
  path.
- Continue sequential owner handoff only for an admitted `needs-owner` result.
- Include local agent workflow files in the app-host reload fingerprint.
- After successful installation or reload, enqueue repaired
  `HandlerUnavailable` bindings once.
- Keep direct owner execution unchanged when `task.workflow` is absent.
- Preserve current stale-result, Condition, dependency, and recovery behavior.

### Design and manual

Update the Agent App Contract and Task Resource Engine handler-resolution
sections to state that an explicit workflow binding is authoritative.

Align the SDK, handler-authoring, workflow-authoring, event, and architecture
documentation so:

- `ctx.blocked()` means failure/attention for task-bound workflows;
- `needs-owner` is the only workflow decision that requests owner handoff; and
- missing workflows do not fall back automatically.

### Tests

The handler-resolution suite should prove:

1. **No workflow:** the resolved owner runs exactly once.
2. **Workflow success:** the workflow runs and the owner is not invoked.
3. **Workflow waiting:** the workflow's exact Conditions are persisted and the
   owner is not invoked.
4. **Explicit `needs-owner`:** the workflow runs first and the owner runs once
   with the workflow evidence.
5. **Missing workflow:** the task enters `attention`, emits
   `HandlerUnavailable`, creates no receipt, and does not invoke the owner.
6. **Blocked/thrown/timed-out workflow:** the task enters `attention`, creates
   no receipt, and does not invoke the owner.
7. **Handoff lineage:** the final receipt identifies the owner as final handler
   while retaining the workflow and `needs-owner` fingerprint.
8. **No duplicate claim:** repeated delivery cannot run workflow and owner
   concurrently or repeat the handoff.
9. **Repair wake:** installing the missing workflow and successfully reloading
   the app re-enqueues the attention task once and allows normal reconciliation.
10. **No failure loop:** passive resync does not repeatedly retry an unresolved
    workflow binding.

## Compatibility and migration

No task-state schema migration is required. Existing `owner` and `workflow`
fields retain their meanings.

Before deployment, validate that every live workflow binding resolves. A
missing binding that previously succeeded through owner fallback will now
surface as `attention`; that is intentional because it exposes invalid desired
state. A successful reload repairs such attention automatically after the
binding becomes resolvable.

No compatibility flag or per-task fallback policy is proposed. Adding such a
policy would make handler resolution harder to understand and test.

## Non-goals

This proposal does not:

- require every task to have a workflow;
- turn the reconciler into a domain handler;
- add a handler registry or new task field;
- change task states or Conditions;
- change how workflows are stored under agents;
- prevent workflows from calling agents;
- add infrastructure APIs to agent execution; or
- remove direct, infrastructure-independent agent execution.

## Acceptance criteria

The refinement is complete when:

- the design, manual, runtime, and tests express the same resolution rules;
- a configured workflow is never automatically replaced by direct owner
  execution;
- only an admitted `needs-owner` result causes sequential owner handoff;
- missing or failed workflows remain visible as attention requiring repair;
- a successfully repaired workflow binding is re-enqueued without owner
  substitution;
- tasks without workflows continue to run through their resolved owners;
- workflow and owner acceptance provenance remains honest; and
- shared handler-resolution tests, a live-binding audit, focused affected-app
  checks, and one deployed canary reconciliation pass.

## Implementation verification

Local verification completed on 2026-07-20:

- May and SDK type checks pass;
- focused task reconciler and app loader tests pass;
- the full May unit suite passes;
- 17 unique workflow bindings used by current live task resources resolve; and
- no task-state schema migration is required.

The deployment canary completed during the canonical Agent App rollout. The
live `runtime/platform-owner-review` task first surfaced
`HandlerUnavailable`; after the workflow was repaired and the App reloaded,
generation 149 resumed through workflow run `wr_1786890910520_awge` and reached
an admitted waiting result without owner substitution. See the
[Canonical Agent App migration record](../implementation/canonical-agent-app-migration.md#post-rollout-workflow-compatibility-repair).

## Decisions

1. A configured workflow is desired execution intent, not a best-effort
   preference.
2. `needs-owner` is the only automatic workflow-to-owner handoff path.
3. Missing and failed workflows surface as attention even when the owner could
   probably perform the work directly.
4. Existing attempts, receipt provenance, and event traces are sufficient. The
   default read model does not need a new execution-chain abstraction.
5. A repaired missing binding is retried after successful app reload, not on
   every passive resync.

## Recommended decision

Accept the refinement without introducing a new handler abstraction:

> The owner is accountable. An explicit workflow binding is the selected
> execution method. The reconciler enforces mechanics. Only an explicit
> `needs-owner` decision changes execution from workflow to owner.
