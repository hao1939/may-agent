# Default Project UI

**Design status:** Accepted.
**Implementation status:** The project UI exists, but its Task view still uses
older path-based endpoints and a generated projection. Migration to the shared
App-ID Task reader remains open.

The default project UI is the shared control surface for every App.
Domain UIs may go deeper, but a person should be able to open any project and
answer:

```text
What is this project trying to achieve?
What is happening now?
Why is work running, waiting, or asking for attention?
What evidence supports that state?
What can I safely ask the owner to do next?
```

## Product shape

```text
Project overview
  goal | owner | posture | last movement

Task status
  needs attention | running | ready | pending | waiting | healthy standing

Current work
  attention, running, and ready resources

Waiting and standing work
  exact Conditions and converged maintain resources

Structure and review
  tasks | selected task | optional relationship tree | recent completions

Diagnostics and trace
  metrics | events | sessions | reports | blind spots
```

The first screen leads with one compact status readout and current work. Large
diagnostic tables and healthy standing work stay collapsed until requested.

## Task semantics

The UI presents the accepted task-resource model; it does not translate it
back into a Kanban lifecycle.

| Human label      | Canonical basis                              | Meaning                                                        |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Needs attention  | `phase=attention`                            | Normal recovery did not produce an applicable result           |
| Running          | `phase=running`                              | One current attempt owns this generation                       |
| Ready            | `phase=pending` and task-projected readiness | The resource can be claimed now                                |
| Pending          | `phase=pending` but not ready                | A known dependency, lifecycle, or capacity fact prevents claim |
| Waiting          | `phase=waiting`                              | One or more exact Conditions remain open                       |
| Healthy standing | `mode=maintain`, `phase=converged`           | Current desired standing state is satisfied                    |

Completed `achieve` resources leave the live graph. They appear only as bounded
completion activity or trace evidence. `Review` is a human action or project
posture, not a task phase.

Structural groups explain containment. They may appear in a relationship tree,
never in work lanes, readiness, or capacity counts.

## Shared task projection and server read model

The task-resource layer derives readiness and structural integrity once from a
current state snapshot. The server joins that projection with app metadata and
operational observations. The browser renders those facts and performs only
presentation work.

The collection read model must provide:

- project identity, owner, posture, and configured concurrency;
- current task resources and structural groups;
- canonical phase, mode, generation, and observed generation;
- task-projected readiness and its exact reason;
- current Conditions and task-to-Condition links;
- current status summary and evidence;
- active attempt and attempt count;
- compact satisfied-dependency identities;
- freshness timestamps and integrity problems; and
- bounded recent completion activity.

The browser must not infer readiness, capacity, worker liveness, or health from
missing fields. Unknown stays unknown.

After an App's guarded cutover, its EventHub task-resource rows are canonical.
`.state/tasks/state.json` is retained only as legacy evidence and must not be
recreated; `.state/tasks/tree.json` is a compact disposable projection, not a
second authority or a history archive.

## Tasks view

Cards lead with human purpose, followed by task identity and machine state.
Each executable card shows:

- outcome;
- phase and reconciliation mode;
- agent and workflow or direct-agent binding;
- priority and parent context;
- current summary or exact wait reason;
- evidence and Condition counts;
- freshness; and
- generation drift when desired and observed state differ.

The default ordering is attention, running, ready, pending, waiting, then
healthy standing. Waiting resources may be grouped by Condition type and
subject. Healthy standing resources are collapsed by default.

An optional tree layout explains decomposition and ownership, not scheduling.
It shows the same tasks and groups with descendant phase counts; it is not a
separate read model or resource. Selecting a row opens the same task detail as
selecting a card.

## Selected task review

Task selection is routable and survives reload, copy link, back, and forward.
The review surface shows:

1. **Purpose:** outcome, acceptance, inputs, outputs, dependencies, owner, and
   selected workflow.
2. **Observation:** phase, summary, evidence, desired and observed generation,
   and freshness.
3. **Conditions:** expected observation, current observed value, owner, and
   evidence for each exact wait.
4. **Execution:** current attempt, handler, workflow run or session, trigger,
   and acceptance basis when available.
5. **Trace:** a bounded reconciliation timeline linked to existing event and
   session surfaces.

Evidence strings remain visible even when the UI can turn a safe reference
into a link. Absolute filesystem paths do not become arbitrary browser reads.

A missing dependency, unresolved Condition link, inverted generation, or
running resource without an active attempt is an integrity problem. It never
silently becomes ready or healthy.

## Diagnostics

Diagnostics show raw facts before hints. Useful generic inputs include:

- malformed task structure or generation drift;
- attention or interrupted work;
- exact waits and missing Condition observations;
- runnable work without controller movement;
- configured concurrency and current claims;
- metric alerts and blind spots; and
- event, session, report, and projection freshness.

Every hint names the raw fact, confidence, affected resources, and clear
condition. Absence of a signal is not proof of health.

Maintain tasks are the normal representation for durable loops. The shared UI
does not need a separate loop scheduler, lifecycle, or registry.

## Steering

The UI is not a task mutation authority. Shared actions are owner-mediated:

- ask the owner to audit;
- challenge current state;
- request a split;
- request Condition review or unblock; and
- request escalation.

Before submission, the UI shows editable structured context: project, task,
purpose, generation, phase, summary, Conditions, selected evidence, and the
expected owner response. Confirmation says `accepted` or `queued`, never
`completed`.

Retry, rerun, pause, resume, and domain actions appear only when the App
declares a typed action.

## Domain extensions

The shared UI owns the frame and generic read models. A project may add a
domain panel without changing shared task semantics.

Examples include AKS feature/test evidence, Evaluation calibration reports,
and Scout source findings. Extensions use stable project artifact, event,
readout, and action APIs; they do not read private runtime storage directly.

## Source ownership

The editable default UI source is:

```text
/app/projects/may-agent/packages/webui/static
```

The server reads the generated deployment target:

```text
/app/projects/platform/ui
```

Explicit deployment refreshes that target. The
[UI source/build boundary](webui.md#source-ownership) distinguishes checkout-local
staging from activation, including the older `ui:sync` default. Project-specific
UI directories are independent extensions, not copies of the shared source.

## Acceptance

The default UI is complete when a person can:

- distinguish current work, exact waits, and healthy standing state;
- see desired state beside current observation;
- explain every readiness or attention classification from raw facts;
- inspect Conditions, evidence, and current execution without reading JSON;
- follow bounded links into events and sessions;
- steer through the accountable owner; and
- tell when information is unknown, stale, or structurally inconsistent.
