# Task Reconciliation WebUI Cutover

**Historical context:** [Default Project UI](../../2a-design/default-project-ui.md). Retained rationale and evidence; this record does not define the current contract.

> Historical record. Use the [current contract index](../../INDEX.md) for present behavior; dated claims below describe their original review.


**Status:** Implemented (2026-07-20)

**Design authority:** [Default Project UI](../../2a-design/default-project-ui.md)
and [Task Resource Engine](../../2a-design/task-resource-engine.md)

**Scope:** Default May WebUI task surface and server-owned read models

## Implementation

The cutover is implemented as one canonical path:

- the SDK builds schema-v2 current-state projection, readiness, and integrity;
- HTTP preserves that projection, joins app identity, and reads bounded
  reconciliation/completion evidence from the event log;
- `/api/projects/task` returns `live | completed` detail and at most 20 timeline
  records;
- the default WebUI renders reconciliation sections and stable task URLs
  without controller or readiness policy; and
- direct repository consumers use `phase`, `outcome`, `category`, `mode`,
  Conditions, projected readiness, and bounded desired input/trigger fields.

Canonical `state.json` and controller behavior were not changed. Generated
`tree.json` remains disposable current-state projection, and completed work
remains event-backed rather than retained in the live graph.

The sections below preserve the implemented proposal's rationale and
acceptance criteria. Gap and decision wording is historical; current behavior
is governed by the linked Tier-2 design.

## Goal

Make the current task UI explain the accepted reconciliation model without
changing canonical task state or adding another controller.

The operator should be able to answer:

1. What outcome does this task own?
2. What does the system currently observe?
3. Why is it ready, pending, running, waiting, healthy, or asking for attention?
4. What evidence and causal trace support that state?
5. What can the operator safely ask the owner to do next?

## Historical gap

The runtime and UI currently speak different languages.

| Canonical state      | Current UI projection | Lost meaning                                                 |
| -------------------- | --------------------- | ------------------------------------------------------------ |
| `pending`            | `backlog`             | Ready now versus dependency-, lifecycle-, or capacity-bound  |
| `running`            | `active`              | Desired generation, observed generation, and current attempt |
| `waiting`            | `blocked`             | Exact linked Conditions and wake observations                |
| `attention`          | `review`              | Recovery failure versus ordinary human review                |
| converged `maintain` | `backlog`             | Healthy standing state                                       |

The compact `tree.json` projection now omits full attempt and receipt history,
but the HTTP endpoint still drops canonical facts and exposes legacy task
state. The browser then reconstructs readiness, capacity, and liveness from
incomplete data. The detail drawer is a state dump rather than a review path,
and task selection does not survive reload.

## Accepted decisions

1. Use the reconciliation sections defined by the accepted Default Project UI;
   do not keep Kanban lanes as another task lifecycle.
2. Treat `Review` as a human action or project posture, not a task phase.
3. Derive readiness and structural integrity once in a shared pure task
   projection. HTTP composes that result with app metadata and operational
   observations; the browser only presents it.
4. Keep `state.json` canonical and `tree.json` compact and disposable.
5. Use `/projects/:id/tasks?task=<encoded-task-id>` for stable selection.
6. Derive bounded recent completion activity from persisted completion events.
   Keep compact receipt identity only for live dependency explanation; do not
   retain completed `achieve` tasks in the live graph or expand `tree.json`
   into history.
7. Change all repository consumers together and remove the legacy flattened
   task `state`; do not leave two steady-state meanings.

## Collection read model

Keep the existing collection route:

```text
GET /api/projects/tasks?path=<project-app-path>
```

The task-resource layer produces the canonical current-state classification.
The HTTP layer joins project identity and presentation metadata; it does not
reimplement controller eligibility rules. The response contains enough current
information for the status strip, sections, filters, and tree:

- schema version and measurement time;
- project ID, path, owner, posture, and configured concurrency;
- task-projection and task-status freshness;
- structural groups and current live resources;
- outcome, parent, owner, workflow binding, category, and priority;
- mode, phase, resource version, desired generation, and observed generation;
- task-projected readiness, exact reason, and related IDs;
- current summary, evidence, linked Condition IDs, and Conditions;
- active attempt and attempt count;
- compact satisfied-dependency identities;
- optional bounded recent completion summaries after delivery slice 3;
- executable-resource counts by UI section; and
- explicit integrity findings.

Structural groups are present for the tree but excluded from readiness,
capacity, and task-state counts.

The shared task projection derives structural findings from its current state
snapshot:

- malformed structure or generation inconsistency;
- inconsistent running attempts; and
- waits with missing Conditions or dependencies.

HTTP may add an operational finding such as runnable work without recent
controller movement when it has authoritative timestamps. The pure projector
does not inspect wall-clock services, events, or controller internals and does
not schedule work.

The UI may choose one finding to emphasize, but emphasis is presentation, not
another health classifier. No finding is not proof of health.

## Detail read model

Add a task detail route:

```text
GET /api/projects/task?path=<project-app-path>&taskId=<task-id>
```

It adds the bounded information needed to review one task:

- complete bounded desired-state fields;
- observed state and generation synchronization;
- linked Condition details and evidence;
- dependency disposition: live, satisfied, missing, or structurally invalid;
- current attempt, handler, trigger, session, and workflow-run links;
- normalized safe evidence links; and
- the latest task-linked reconciliation records, newest first.

The timeline is a read model over existing event/session evidence, not another
history store. A normal response returns at most the latest 20 records.

The detail response is a discriminated result:

```ts
type ProjectTaskDetail =
  | { kind: "live"; task: LiveTaskDetail }
  | { kind: "completed"; completion: TaskCompletionSummary };
```

An old link to a recently completed `achieve` resource returns the completed
form with a normal `200` response. Only a task that is neither live nor present
in bounded completion evidence returns `404`. This lets the browser explain
why finite work left the graph without treating completion as an error or
restoring the resource.

## Evidence and navigation

Raw evidence strings remain visible. The server/browser may recognize safe
reference prefixes such as `session:`, `workflow-run:`, `event:`, `report:`,
and `artifact:` and link them to existing read surfaces. Unknown evidence stays
plain text. Absolute filesystem paths never become arbitrary browser reads.

Task cards lead with outcome. Machine identity, phase, mode, owner, binding,
summary, freshness, evidence count, Condition count, and generation drift are
secondary facts.

Waiting resources are grouped by Condition type and subject. Converged
maintain resources are collapsed as healthy standing work. Structural groups
stay in the tree. Large groups render a bounded first page and an explicit
count.

## Integrity and freshness

Expose these times separately:

- HTTP measurement time;
- projection update time;
- resource status update time; and
- Condition observation time.

Condition age is a fact. It becomes stale only when the Condition or owning app
declares an authoritative staleness rule.

Surface, rather than normalize away:

- missing Conditions or dependencies;
- generation inversion or drift;
- a running resource without its active attempt;
- malformed containment; and
- unavailable trace data.

If trace lookup fails, current task state still renders with an explicit trace
error. Trace availability does not change task meaning.

## Steering

Shared controls remain asynchronous and owner-mediated:

- ask owner to audit;
- challenge current state;
- request a split;
- request unblock or Condition review; and
- request escalation.

The UI prepares editable structured context containing the task purpose,
generation, phase, summary, Conditions, selected evidence, and expected owner
response. Submission reports `accepted` or `queued`. It never claims the task
changed before later evidence proves a disposition.

Retry, rerun, pause, resume, and domain operations appear only when the Agent
App declares a typed action.

## Implemented delivery slices

Each slice is independently reviewable. Only the first slice changes shared
task meaning and therefore must move projection, HTTP, browser, query, and test
consumers together.

### 1. Canonical correctness cutover

- Add canonical phase, generation, observed generation, status freshness,
  Condition links, and compact satisfied dependencies.
- Add one shared pure readiness/structural-integrity projector owned by the
  task-resource layer and use it from HTTP.
- Keep only current Conditions, active attempt, attempt count, and current
  status evidence.
- Inventory every repository consumer of legacy task `state`.
- Preserve canonical facts and Conditions through HTTP.
- Load owner, posture, and concurrency from the Agent App.
- Render attention, running, ready, pending, waiting, and healthy standing.
- Keep groups in the tree only.
- Remove browser-side controller, readiness, capacity, and liveness inference.
- Move every query, app, and test consumer to canonical phase and mode.
- Remove legacy flattened task `state` and obsolete Kanban helpers in the same
  repository migration.

This slice is complete when the basic shared UI tells the truth. It does not
wait for a rich detail panel, timeline, filters, or steering redesign.

### 2. Task detail and Conditions

- Show desired state beside observed state.
- Add the typed `live | completed` detail response.
- Show Conditions, dependencies, current attempt, and evidence.
- Preserve task selection in the URL.

### 3. Operational reviewability

- Add the bounded event/session timeline.
- Add bounded recent completion activity from persisted completion events.
- Add purpose-first cards, grouped waits, filters, and large-tree pagination.
- Complete keyboard, narrow-screen, and structured steering behavior.

## Test strategy

Projection and HTTP fixtures cover:

- pending achieve work, both ready and not ready;
- running achieve work with an active attempt;
- waiting maintain work with exact Conditions;
- attention work;
- converged maintain work;
- completed achieve work represented only by compact completion evidence;
- missing capacity, Condition, dependency, and attempt data; and
- desired/observed generation drift.

Browser fixtures cover deep-link reload, purpose-first labels, grouped waits,
evidence links, honest steering, keyboard use, and narrow screens. A large
fixture with at least 200 resources and 150 Conditions verifies bounded
rendering without changing task meaning.

## Acceptance

The correctness cutover is complete when:

- no healthy maintain task appears as backlog or runnable;
- no attention task appears as ordinary review;
- every wait shows exact Conditions or an integrity error;
- capacity is correct or explicitly unknown;
- running work shows its current attempt;
- the browser contains no controller or readiness policy;
- no repository reader depends on the legacy task `state`; and
- one shared pure projector supplies readiness and structural-integrity
  classification.

The full proposal is complete when, in addition:

- a task link survives reload and explains purpose, desired state, observation,
  owner, next wake, and evidence;
- finite completion remains reviewable outside the live graph;
- controls remain honest about asynchronous disposition; and
- small and large task trees remain usable by keyboard and on narrow screens.

## Cost and risk

The main risk is an incomplete correctness cutover: removing legacy state
before HTTP, UI, query, and tests move together would make tasks disappear or
become misclassified. Slice 1 should therefore land as one reviewable migration
with focused fixtures. Slices 2 and 3 can follow independently. Canonical
storage and controller mechanics are unchanged.
