# Default Project UI

**Design status:** Accepted.
**Implementation status:** Partial; the phase-1 browser control readout is
implemented and the remaining slices are described below.

The default project UI should be the shared control surface for every project
app. Project-specific UIs can go deeper into a domain, but the default UI must
answer the operator's first question without domain knowledge:

```text
Is this project moving, where can it be stuck, and what can I safely do next?
```

## What We Learned

The current default UI is useful, but it is mostly a state viewer. It shows the
project detail page, task board, task tree, metrics, sessions, lineage, and app
actions.

The `aks-rp-e2e.app` kanban UI adds a stronger operating model:

- start with a process readout, not the raw board;
- show raw facts separately from system hints;
- show confidence, blind spots, and clear conditions;
- make durable loops visible as first-class work queues;
- make human actions structured, contextual, and async;
- keep domain-specific feature/test knowledge out of the shared UI.

The default UI should reuse the operating model, not copy AKS-specific labels,
metrics, or test workflow assumptions.

## Product Shape

The project detail page should have these surfaces:

```text
Project overview
  - goal, owner, status, current state, last movement

Control readout
  - compact status strip
  - one primary signal
  - collapsed diagnostics for bottlenecks, trust, loops, and raw issue rows

Task board
  - backlog, active, review, blocked, done

Task tree
  - parent/child project understanding

Selected task
  - readiness, evidence, blocker, escalation, done knowledge

Actions
  - structured steering and declared project actions

Trace
  - sessions, lineage, events, reports
```

The first screen for a project should not force the user to infer health from
board columns, but it also should not front-load every diagnostic. Lead with a
small readout, one primary signal, and the task board. Keep deeper diagnostic
facts one click away.

## Layout Rule

The default project page should stay lean:

```text
Status strip
  - state, last movement, active/review/blocked/capacity

Primary signal
  - one question/fact to check first
  - affected task ids
  - one structured action

Task board
  - backlog, active, review, blocked, done

Task tree
  - structure and drill-down

Diagnostics
  - collapsed bottlenecks
  - coverage and blind spots
  - raw issue rows
```

Visible by default means "operator needs this before choosing the next click".
Everything else belongs in diagnostics or the selected task drawer.

## Read Model

The shared UI should render a stable project readout instead of duplicating
large amounts of browser-side inference.

Proposed endpoint:

```text
GET /api/projects/readout?path=<project-app-path>
```

Response shape:

```ts
type ProjectReadout = {
  project: {
    id: string;
    path: string;
    owner?: string;
    status?: string;
    goal?: string;
    currentState?: string;
    updatedAt?: string;
  };
  movement: {
    lastMovementAt?: string;
    lastTaskTreeUpdateAt?: string;
    lastMetricUpdateAt?: string;
    lastWorkflowRunAt?: string;
  };
  taskStats: {
    total: number;
    leaves: number;
    rootCount: number;
    byState: Record<string, number>;
    leafByState: Record<string, number>;
    maxConcurrent?: number;
    activeTaskIds: string[];
  };
  bottlenecks: ProjectBottleneck[];
  coverage: ProjectCoverageRow[];
  loops: ProjectLoopReadout[];
  issues: ProjectIssueRow[];
  actions: ProjectActionSuggestion[];
};
```

The browser can still compute light presentation details, but source-of-truth
classification should live in the server/read-model layer or in project-owned
state. That keeps the default UI consistent across projects and prevents each
project UI from inventing its own health semantics.

## Bottlenecks

Bottlenecks are diagnostic inputs for the "start here" signal. They should be
generic by default and project-extensible.

Default bottlenecks:

| Key | Question | Raw fact |
| --- | --- | --- |
| `task-tree-integrity` | Does the tree have exactly one root? | root count |
| `work-assigned` | Is there runnable work when gaps remain? | backlog/active/review counts |
| `worker-liveness` | Are active tasks attached to real work? | stale active count when available |
| `review-backlog` | Is review blocking progress? | review leaf count and age |
| `blocked-frontier` | Are waits exact and owned? | blocked leaf count and blocker shape |
| `capacity` | Is active work under or over capacity? | active count vs max concurrent |
| `unowned-work` | Is unfinished loop work represented? | unrepresented count when available |
| `repo-visibility` | Are workflow-relevant changes published? | project-provided metric, optional |

Each bottleneck should include:

```ts
type ProjectBottleneck = {
  key: string;
  name: string;
  question: string;
  rawValue: string | number | null;
  tone: "ok" | "watch" | "bad" | "unknown";
  meaning: string;
  candidates: string[];
  next: string;
  action?: ProjectActionSuggestion;
};
```

## Coverage And Blind Spots

The UI must show what it can prove. A green board without coverage context is
misleading.

Default coverage rows:

| Surface | Expected | Typical evidence |
| --- | --- | --- |
| Task tree | Current decomposition, owners, waits, evidence | `.state/tasks/tree.json` |
| Metrics | Sensor values, trend, alert state | `/api/metrics` |
| Loop ledgers | Durable queues and non-terminal records | project loop state or task context |
| Runtime events | Events reached handlers/workflows | events and workflow runs |
| Static graph | App event routes and emitted events are checked | app graph/check output |
| Reports | Human-facing summaries exist when expected | reports/readout paths |

Coverage values:

```text
complete | partial | inferred | missing | unknown
```

Every incomplete coverage row should explain the blind spot and, when useful,
offer a structured action to review or repair observability.

Coverage is important, but it is not first-screen material. It should be shown
inside the collapsed diagnostics section unless a coverage gap is selected as
the primary signal.

## Durable Loops

The default UI should understand loops as repeated business processes, not as
AKS-specific machinery.

Projects can declare loops in `project.json` or app metadata:

```json
{
  "ui": {
    "loops": [
      {
        "id": "spec-loop",
        "label": "Spec loop",
        "statePath": ".state/spec-loop/state.json",
        "taskId": "spec-loop",
        "expected": "Every non-terminal record is represented by work, exact wait, escalation, or terminal disposition."
      }
    ]
  }
}
```

Readout shape:

```ts
type ProjectLoopReadout = {
  id: string;
  label: string;
  expected: string;
  owner?: string;
  status:
    | "complete"
    | "represented"
    | "unrepresented"
    | "running"
    | "missing"
    | "unknown";
  updatedAt?: string;
  counts: {
    pending?: number;
    running?: number;
    done?: number;
    error?: number;
    blocked?: number;
    unrepresented?: number;
  };
  reason?: string;
  confidence: "known" | "inferred" | "unknown";
  clearCondition: string;
  taskId?: string;
  action?: ProjectActionSuggestion;
};
```

If a project does not declare loops, the default UI should still work. It simply
shows "no declared durable loops" and relies on task tree and metrics.

## Issue Rows

Issue rows are not verdicts. They are raw facts plus hints, and should normally
stay in diagnostics. The main page may surface only the highest-priority issue
as the primary signal.

```ts
type ProjectIssueRow = {
  key: string;
  severity: "P0" | "P1" | "P2" | "P3";
  group: string;
  rawFact: string;
  hint: string;
  confidence: "known" | "inferred" | "unknown";
  owner?: string;
  currentAttempt?: string;
  evidence?: string;
  clearCondition: string;
  requiredResponse: string;
  taskId?: string;
  action?: ProjectActionSuggestion;
};
```

This is the most important pattern to generalize from `aks-rp-e2e.app`: the UI
should not say "bad" without showing the raw fact, why it thinks the fact
matters, and what would clear the signal.

## Structured Steering

The default UI should stop treating human input as a vague project comment when
the user is acting from a concrete row.

Every button should prepare a structured request in a textarea before sending:

```text
[project-steer] <project> <topic>

action: review_bottleneck

Raw fact: ...
System hint: ...
Confidence: ...
Evidence: ...
Clear condition: ...

Expected response:
Convert this into concrete work, an exact wait, an escalation, or an accepted
no-op. Preserve the raw fact in the task tree or discussion.
```

Send behavior:

- project-wide steering emits `project.owner.requested` with selected project
  context;
- task-specific steering includes task id, parent chain, state, and local row
  context;
- declared project actions emit canonical project action events;
- UI never mutates task meaning directly unless it uses the same owner-reviewed
  task-tree tool path.

The confirmation text must be honest: the request was accepted, not completed.
Follow-up should appear as task-tree, wait, escalation, report, event, or
message changes.

## Selected Task Detail

The default task detail should include the fields that make owner state
auditable:

- id, goal, state, priority, kind;
- parent, children, top branch;
- readiness projection for backlog tasks;
- blocker, blocked owner, resume condition, next review time;
- escalation state, owner, requested action, resolution;
- acceptance, gates, forbidden paths/actions;
- outputs and evidence refs;
- done knowledge and `reusable_for`;
- conflict scope and dependency list;
- claimed worker, lease, session, latest attempt;
- verification verdict and reason.

The drawer should be a steering surface. It should offer actions such as:

- audit task;
- split task;
- challenge state;
- escalate or resolve escalation;
- rerun/retry when the project declares that action.

## Project-Specific Extensions

The shared UI owns the frame and generic control readout. A project app may add
domain-specific panels by declaring UI extensions, but those extensions should
not replace the shared readout.

Examples:

- `aks-rp-e2e.app`: feature knowledge map, spec verification, compact test
  plans, live run artifacts.
- `evaluation.app`: project/app health reports, session aftermath findings,
  calibration drift.
- `scout-knowledge-lib.app`: source queues, findings, synthesis status.

Extension rules:

- use stable `/api/projects/artifact`, readout, event, and action APIs;
- do not call private runtime DB routes directly from domain UI;
- show action receipts for async actions;
- keep domain-specific terms out of the shared default UI.

## Source Ownership

The only editable source is:

```text
/app/projects/may-agent/packages/webui/static
```

The HTTP server reads one generated deployment target:

```text
/app/projects/platform/ui
```

`bun run ui:sync` in `/app/projects/may-agent` refreshes vendor assets and
replaces that served target. The sync also removes the retired `/app/ui`,
`projects/may-agent/ui`, and `projects/may-agent.app/ui` copies so stale assets
cannot masquerade as another source. Project-specific UI directories remain
independent overrides and are never generated from the default source.

## Current Implementation

- Shipped: compact control readout, task-tree facts, coverage/issue diagnostics,
  one editable default source, and one served deployment target.
- Remaining: stable server-side `/api/projects/readout`, structured steering
  from every diagnostic/task row, and project-declared loop metadata.
- Keep `aks-rp-e2e.app` as the proving ground for domain extensions, not as
  copied platform code.

## Acceptance

The refined default UI is good enough when a human can open any project and
answer:

- What is the project trying to do?
- Is it moving?
- What is the first bottleneck to check?
- Which facts are known, inferred, or missing?
- Which loops are incomplete?
- Which task or owner should handle the next move?
- What exact request will the UI send if I click an action?
- What evidence or clear condition would make the signal go away?

If the UI cannot answer those questions, it is still only a board viewer.
