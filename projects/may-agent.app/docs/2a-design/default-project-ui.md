# Default Project UI

Status: phase 1 browser-side control readout implemented

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
  - start-here process summary
  - bottlenecks
  - trust and blind spots
  - durable loops
  - raw issue rows

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
board columns. It should lead with the control readout, then let the user drill
into the board and task tree.

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

Bottlenecks are the "start here" cards. They should be generic by default and
project-extensible.

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

Issue rows are not verdicts. They are raw facts plus hints.

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

- project-wide steering emits `project.planning.requested` or
  `project.owner.requested` with selected project context;
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

Do not deepen the current static copy drift.

Observed copies:

```text
/app/projects/may-agent/packages/webui/static
/app/projects/may-agent/ui
/app/ui
/app/projects/platform/ui
/app/projects/may-agent.app/ui
```

The source of truth is:

```text
/app/projects/may-agent/packages/webui/static
```

`bun run ui:sync` in `/app/projects/may-agent` syncs that source into the
generated and served copies. A design or code change to the default project UI
should not require editing unrelated static trees by hand.

## Implementation Plan

1. Add `/api/projects/readout` with only generic task tree and metric facts.
2. Render the control readout above the current task board. Done in phase 1.
3. Add coverage rows and issue rows, even if some rows are `missing`. Done in
   phase 1 for browser-side task-tree facts.
4. Add structured steering from bottleneck, coverage, loop, issue, and task
   rows.
5. Add project-declared loop metadata and loop state loading.
6. Move browser-side inference into the readout endpoint once the shape proves
   useful.
7. Keep default UI source ownership and sync targets explicit.
8. Keep `aks-rp-e2e.app` domain UI as a proving ground for richer extensions,
   not as copied platform code.

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
