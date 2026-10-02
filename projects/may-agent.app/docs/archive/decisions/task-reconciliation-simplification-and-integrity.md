# Task Reconciliation Integrity Cleanup

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted, delivered, and archived
**Scope:** Remove active compatibility vocabulary and make the existing task
model easier to explain without changing its capabilities
**Related:**
[Task Resource Engine](../../2a-design/task-resource-engine.md),
[Default Project UI](../../2a-design/default-project-ui.md), and the rejected
[Task Authorship Convention](task-authorship-and-workflow-governance.md)

## Decision

Keep the existing task-resource model. Simplify its active vocabulary and
enforce the boundaries already accepted by the design.

```text
event or admitted task action
  -> declare or wake one stable task ID
  -> reconciler claims the current generation once
  -> direct owner or explicit workflow handles bounded work
  -> converged, waiting on exact Conditions, or visible attention
  -> achieve writes a receipt and leaves the live graph
  -> maintain converges and sleeps until a real trigger
```

Do not add a phase, controller, scheduler, completion shortcut, or graph
restriction to perform this cleanup.

The compact rule is:

> Parents express containment. Dependencies express ordering. Watchers provide
> facts. Handlers and verifiers establish acceptance. Traces show progress. The
> reconciler enforces mechanics.

## What remains unchanged

The existing integrity kernel remains:

- stable task identity;
- execution-generation safety;
- at most one current attempt per task;
- atomic result and action application;
- exact typed Conditions for durable waits;
- explicit acceptance basis and optional deterministic verification;
- compact completion receipts for finite work;
- bounded crash, stale-result, and duplicate-delivery recovery; and
- one canonical task state with disposable read projections.

These mechanisms protect real correctness properties and are not accidental
complexity.

## Task graph

Keep current task and group relationships.

### Parent means containment

An executable task may contain executable child tasks when that relationship
helps explain decomposition.

Parenthood does not:

- schedule a child;
- make a child eligible;
- imply ordering;
- automatically complete the parent; or
- make child completion satisfy parent acceptance.

An achieve task cannot complete while it still has live children. This guard
prevents a decomposition carrier from disappearing while its represented work
remains open.

### Dependencies mean ordering

Dependencies are the only task-to-task execution-order edges.

- a receipt satisfies a completed achieve dependency;
- a current-generation converged maintain task satisfies a standing dependency;
- missing and cyclic dependencies fail admission; and
- dependency satisfaction wakes the dependent.

### Groups mean organization only

Use a structural group when a node has no independently reconcilable outcome.
Groups are not queued, claimed, completed, or counted as executable work.

Do not require all executable tasks to be leaves. Do not flatten existing
decomposition merely to satisfy a shape convention.

## Canonical lifecycle

Keep the existing phases:

- `pending`: current desired generation needs reconciliation;
- `running`: one attempt owns the generation;
- `waiting`: exact external Conditions remain open;
- `attention`: normal execution or recovery cannot safely continue; and
- `converged`: a maintain responsibility currently satisfies desired state.

No `progressing`, `review`, `handoff`, or live `done` phase is added.

### Achieve

```text
pending -> running -> receipt and removal
                   -> waiting -> pending after exact observation
                   -> attention
```

### Maintain

```text
pending -> running -> converged
                   -> waiting -> pending after exact observation
                   -> attention

converged -> pending only after a targeted trigger or generation change
```

## Progress is a read concern

Progress comes from current execution evidence:

- session state;
- workflow runs and steps;
- tool calls;
- external-run observations;
- emitted events; and
- produced artifacts.

The canonical task stores only the current attempt identity and bounded
summary/evidence required to explain its observed phase. Do not add generic
percent-complete or arbitrary progress mutation to task resources.

The WebUI may join task, session, workflow, and event read models. It must not
write inferred progress back into canonical task state.

## Watchers wake; handlers finish

A watcher observes an external provider level and emits a semantic fact. The
generic Condition tracker records an exact match and wakes linked task IDs.

A watcher does not generically complete a task because:

- the external process may have failed;
- the observation may belong to an older run or generation;
- process success may not satisfy domain acceptance;
- partial output may require owner judgment; and
- a maintain responsibility must remain live.

After a matching wake, the selected handler reads the exact observation and
returns a task result. When this second pass is mechanical, use a deterministic
workflow plus an optional verifier so it requires no agent call.

Do not add a generic watcher-to-completion adapter.

## Exact Conditions

A waiting result names one or more typed, externally observable Conditions.

Good subjects include:

```text
pipeline-run:<id>
session:<id>
workflow-run:<id>
repo:<name>
approval:<id>
credential:<name>
artifact:<stable-id>
```

Weak waits are invalid:

```text
something changes
review later
retry after time
evidence becomes available for this task
```

Time belongs to schedules. A scheduled recheck emits a semantic event; age
alone never satisfies a Condition.

Legacy or migrated waits must be replaced with an observable subject or moved
to owner attention. Parsing successfully is not enough to make a weak wait
truthful.

## Handler and plan boundaries

An ordinary handler performs or inspects its bounded work and returns:

- `converged` with evidence;
- `waiting` with exact Conditions; or
- a visible execution failure handled by runtime attention/recovery.

Only workflows may return `needs-owner`, using the existing single sequential
handoff contract.

A running handler cannot close or unblock its own task. It may return one
generation-changing `update-task` for that same task as the sole action when
current evidence proves the desired execution intent must change. The current
attempt ends and the same task is queued again; no-op and mixed self-updates
remain invalid.

Handlers may create bounded child, sibling, or successor work when supported by
current evidence. Broad reprioritization, duplicate removal, workflow rebinding,
and unrelated-branch cleanup belong to a bounded owner-review pass.

The reconciler never interprets task prose or invents project decomposition.

## Authorship

Resolver observations and admitted task actions declare desired state through
the same reconciler. Generation fencing and atomic admission serialize their
changes; a later resolver observation may intentionally reassert current App
policy. There is no persisted manager, authority-transfer lifecycle, or task-ID
prefix with mutation semantics. Apps use `validateAction` when a domain needs a
narrower policy than the generic task contract.

## One result and action vocabulary

The active handler-result vocabulary is exactly:

- `converged`;
- `waiting`; and
- workflow-only `needs-owner`.

The active task-action vocabulary is exactly:

- `create-task`;
- `update-task`;
- `close-task`; and
- `unblock-task`.

Existing-task actions use `expectedGeneration`. Active prompts, workflows,
fixtures, and model schemas must not emit or teach:

- `expectedRevision`;
- `progressing`;
- legacy Kanban states as handler results;
- implicit persistent-task policy; or
- invented action/result aliases.

Runtime admission remains strict. It does not normalize newly produced legacy
output. Authored deterministic workflows should use shared SDK builders when
that prevents field-name drift without creating a second contract.

Negative admission tests may contain removed vocabulary solely to prove that it
is rejected.

Action admission and result application remain atomic. A rejected batch applies
nothing and records one reviewable reason.

## Completion

On accepted achieve convergence, the reconciler atomically:

1. validates the current claim and generation;
2. admits the result and action batch;
3. runs the optional verifier;
4. records acceptance basis and evidence;
5. writes one compact receipt;
6. removes the task from the live graph; and
7. wakes dependents.

On accepted maintain convergence, it records observed generation and evidence,
removes the current attempt and obsolete Conditions, and leaves the task asleep
until a real wake.

Completed work does not return to the live tree and standing convergence is not
backlog.

## `needs-owner`

Keep the currently accepted semantic contract:

- only a workflow may request owner judgment;
- the same task is handed to the resolved owner at most once;
- an owner returns `converged` or `waiting`; and
- workflow failure, timeout, blocking, invalid output, or missing binding never
  implies fallback.

Changing how this handoff is persisted in attempts is a separate attempt-model
refinement. It is not required for this compatibility cleanup.

## Cleanup plan

The initial repository audit found no active `expectedRevision` producer and no
active workflow returning a legacy task disposition. Runtime admission already
rejects both. The first applied cleanup adds explicit containment-versus-ordering
guidance to owner prompts and the handler manual, preserves negative regression
coverage, and replaces a vague core test wait with an exact pipeline-run
Condition.

Current state:

- canonical result/action vocabulary and strict admission are implemented;
- containment, dependency, watcher, and progress guidance is current;
- the default WebUI reads the canonical task projection;
- no persisted-state migration or compatibility reader was required; and
- the rejected specification-manager alternative remains historical rationale,
  not an implementation dependency.

### Phase 1 — Freeze legacy growth

1. Remove legacy result/action vocabulary from active prompts, workflows,
   fixtures, and documentation.
2. Keep runtime admission strict around the canonical schema.
3. Report weak Conditions and invalid current-task self-mutation with exact
   reasons.

### Phase 2 — Repair active producers

1. Replace `expectedRevision` with `expectedGeneration`.
2. Replace legacy result words with canonical dispositions.
3. Replace weak wait subjects with exact provider/run subjects.
4. Move broad plan cleanup into owner-review workflows.
5. Use SDK action builders where repeated hand-built objects caused drift.

### Phase 3 — Remove compatibility

1. Run one explicit migration for persisted legacy state that is still live.
2. Remove legacy readers after every active producer is canonical.
3. Regenerate disposable projections.
4. Run app and SDK integrity tests from clean state.

### Phase 4 — Reviewability

Expose canonical phase, generation, current attempt, exact Conditions,
acceptance basis, and joined execution progress through read models. Do not add
browser-side task repair or mutation.

## Tests

Required focused coverage:

- executable task containment remains valid;
- parenthood never creates ordering or automatic completion;
- dependencies alone control task ordering;
- one generation is claimed once;
- stale results and rejected action batches apply nothing;
- matching Condition observation persists the trigger and wakes atomically;
- weak or malformed Conditions are rejected;
- deterministic post-observation handling performs no agent call;
- watchers never write task completion;
- achieve convergence writes one receipt and removes live work;
- converged maintain work is omitted from passive runnable IDs;
- targeted triggers wake the same maintain ID;
- current-task close/unblock, no-op update, and mixed self-update are rejected;
- active schemas and fixtures contain no legacy vocabulary; and
- read projections never become mutation authority.

## Acceptance criteria

The cleanup is complete when:

- the common task lifecycle is explainable by the decision diagram above;
- parent, dependency, and group semantics are distinct and unchanged;
- watchers wake and handlers/verifiers establish acceptance;
- every wait names an exact observable subject;
- progress is derived from traces rather than stored as a generic task phase;
- active producers use only the canonical result/action vocabulary;
- plan changes remain owner/app decisions rather than reconciler inference;
- finite work leaves a receipt and standing work converges and sleeps;
- the WebUI exposes the same canonical model without repair logic; and
- no new phase, controller, scheduler, graph restriction, or completion
  shortcut was introduced.

## Non-goals

This cleanup does not:

- require executable tasks to be leaves;
- flatten current task trees;
- add dynamic group actions;
- redesign `needs-owner` persistence;
- add generic watcher-driven completion;
- add progress mutation to task resources;
- retain completed work in a live done lane; or
- preserve active compatibility writers indefinitely.

## Recommended decision

Apply the cleanup in bounded steps. First stop active legacy vocabulary and
repair weak Conditions. Then remove compatibility readers after all producers
and persisted live state are canonical. Preserve the current graph and
lifecycle throughout.

## Completion

The canonical App rollout and its authoring-boundary closeout completed the
four phases. Runtime commit `804b8a7a` removed the final task-ID-prefix
authority exception and added uniform generation-fenced action coverage; it
was integrated on Runtime `main` in `d537af6b`. No persisted-state migration,
compatibility reader, manager field, phase, queue, or controller was added.
