# Default Project UI

**Design status:** Accepted.
**Implementation status:** The Task board uses bounded human Task list/detail
reads through the daemon. It no longer loads a path-based whole-App snapshot.
Tree layout and richer classification remain presentation guidance, not a second
state model. Some browser copy still calls convergence recurring work; that is
an implementation wording gap. See [the review](../archive/reviews/design-doc-hygiene-20260927.md).

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
  needs attention | running | pending | waiting | up to date | closed

Current work
  attention, running, and ready resources

Waiting and standing work
  exact Conditions and open Tasks with accepted outcomes

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

| Human label | Canonical basis | Meaning |
| --- | --- | --- |
| Needs attention | `phase=attention` | An attempt needs recovery or owner judgment; not automatically a human action |
| Running | Current running attempt | Execution is in progress; waits or accepted results may also exist |
| Pending | Eligible or gated unfinished work | Read readiness, retry and dependency facts for the reason |
| Waiting | `phase=waiting` | The current pass yielded; exact Conditions and review deadlines explain what can wake it |
| Up to date | Open converged Task without newly runnable work | Accepted work is current; the Task can accept later input |
| Closed / cancelled | Explicit owner closure record | No future execution; retained evidence may include success and unresolved work |

These labels summarize a view. Conditions, accepted results, failures and pending
input remain independent facts. `done` in an SDK Task read means an accepted
outcome; inspect its `closed` field for lifetime. Human views use `up-to-date`
for open convergence and retain `done` for historical completion receipts.
Accepted outcomes remain on Tasks; they are not physically moved out of storage.

Structural groups explain containment. They may appear in a relationship tree,
never in work lanes, readiness, or capacity counts.

## Shared task projection and server read model

The task-resource layer derives readiness and structural integrity once from a
current state snapshot. The server joins that projection with app metadata and
operational observations. The browser renders those facts and performs only
presentation work.

The shared list/detail capabilities together provide bounded views of:

- project identity, owner, posture, and configured concurrency;
- a page of current Tasks, with exact parent/dependency links on detail;
- canonical phase, closure, generation, and observed generation;
- task-projected state and its available readiness/retry explanation;
- current Conditions and task-to-Condition links;
- current status summary and evidence;
- active attempt and attempt count;
- compact satisfied-dependency identities;
- freshness and explicit missing/truncated information; and
- bounded recent completion activity.

The browser must not infer readiness, capacity, worker liveness, or health from
missing fields. Unknown stays unknown.

SQLite Task resources are authoritative. The board reads `/api/tasks` and
`/api/task` using exact App/Task identity and opaque paging cursors. It does not
rebuild a whole-App tree or infer global capacity/integrity from one page.
Legacy `.state/tasks/state.json` is retained evidence; any generated tree view
is disposable and cannot override current Task records.

## Tasks view

Cards lead with human purpose, followed by task identity and machine state.
Each executable card shows:

- outcome;
- current state and explicit closure;
- agent and workflow or direct-agent binding;
- priority and parent context;
- current summary or exact wait reason;
- evidence and Condition counts;
- freshness; and
- generation drift when desired and observed state differ.

The default ordering is attention, running, ready, pending, waiting, then
up-to-date work. Grouping by Condition and optional tree layout are presentation
guidance. Current paging and filters operate over the shared read API.

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

An ordinary open Task with declared observation inputs can support a durable
loop. The shared UI does not need a separate loop scheduler, lifecycle, or registry.

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

Shared execution controls use the existing Host control contract and its
authority checks. Domain-specific actions require a declared App input schema.
The UI exposes a control only when that surface supports it; this guidance does
not imply every control already has a button.

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
staging from activation, using the current `ui:sync` staging default. Project-specific
UI directories are independent extensions, not copies of the shared source.

## Acceptance

The default UI is complete when a person can:

- distinguish current work, exact waits, and up-to-date work and explicit closure;
- see desired state beside current observation;
- explain every readiness or attention classification from raw facts;
- inspect Conditions, evidence, and current execution without reading JSON;
- follow bounded links into events and sessions;
- steer through the accountable owner; and
- tell when information is unknown, stale, or structurally inconsistent.
