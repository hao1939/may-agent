# aks-rp-e2e.app Design

Status: current operating model

## Simple Model

`aks-rp-e2e.app` is an event-driven project organizer.

```text
events wake workflows
workflows collect facts or run one bounded job
the task tree records durable work state
project.task.assigned dispatches runnable work
task-worker runs the scoped agent/workflow
task-reviewer judges completed output
project-planner/app-ops applies the next task-tree decision
```

The critical parties are deliberately few:

```text
agent     -> responsible actor and judgment owner
workflow  -> reusable executable process; plain JS, agent-backed, or both
event     -> trigger or fact from project, workflow, user, or infrastructure
task tree -> durable work graph and relationship/state tracker
metric    -> process signal that emits events when closure is missing
```

`handler` is not a project-level concept. In implementation, `app.ts` declares
event routes that map event selectors to a target. Treat that as manifest
plumbing:

```text
event -> event route -> target
```

The route target is inferred by convention. A route with a workflow runs that
workflow. A route or event with an owner and no workflow is an owner handoff.
If no explicit route matches, runtime fallback follows the ownership chain.

For task-backed work, keep task-tree mechanics in adapters and orchestration
workflows:

```text
project.task.assigned -> task-worker adapter -> business workflow
business workflow -> structured result -> reviewer/planner
```

Business workflows should receive scoped input and return structured output.
They should not need to know parent rollup, assignment queues, review state, or
task-tree storage unless their business purpose is orchestration, such as
`project-planner` or a durable loop controller.

Keep one task tree with two visible roots:

```text
domain/ -> AKS specs, features, compact plans, live results, model updates
ops/    -> app health, metrics, watchdog, recovery, observability, routing
```

Agent responsibilities:

```text
app-ops      -> app operation and planner judgment
aks-explorer -> AKS domain work under domain/*
aks-reviewer -> read-only review of completed task output
```

Workflow roles:

```text
project-planner -> planning workflow; may call app-ops and applies decisions
task-worker     -> task adapter; dispatches task.workflow or default worker
watchdog        -> normal workflow that observes liveness/closure gaps
loop controller -> normal workflow that reconciles a durable ledger and refills
```

`project.task.assigned` is the existing event name, but its meaning is
dispatch: start this runnable task now.

Use "test result" for execution output from a spec, compact plan, or pipeline.
Use "evidence" only as a generic word for proof artifacts such as run ids,
logs, source links, review notes, or test results.

## Rules

- Use task scope/name for domain versus ops. Do not add `workKind`.
- One-off work is allowed. When the same shape repeats, tidy it into a reusable
  workflow and task context convention.
- Add workflow before adding event. Add event only when a new durable command
  or fact cannot be expressed by the existing vocabulary.
- App-ops may route domain work but must not decide AKS correctness.
- Aks-explorer owns AKS judgment and executable domain fixes.
- Aks-reviewer stays read-only; the planner mutates the task tree.
- Blocked is not done. It must name what we wait for, who checks it, how it is
  checked, and what happens when waiting expires.
- Metrics and watchdog are fallback. Repeated fallback becomes ops repair work.
- Git tracks source and design. `.state/` tracks runtime.

## Reading Order

1. `project-knowledge-layers.md` - domain versus ops and one-tree/two-root
   model.
2. `project-app-event-contract.md` - event vocabulary and dispatch semantics.
3. `project-planner-contract.md` - how app-ops/planner keeps the task tree
   closed and moving.
4. `reusable-task-workflows.md` - how the same workflows are used by direct
   agent requests and app-tracked tasks, and how one-off work graduates into
   reusable workflows/routes.
5. `fix-forward-loop.md` - how failed specs and compact plans become fixes
   instead of blind reruns.
6. `project-observability.md` - how to see whether the process is working.
7. Loop-specific docs:
   - `spec-verification-loop.md`
   - `feature-reference-loop.md`
   - `feature-compact-loop.md`
8. `runtime-state-separation.md` - source files versus `.state/` runtime data.

## Source Of Truth

The design goal is intentionally small:

```text
Domain work does AKS testing.
Ops work keeps the app process healthy.
The shared task tree shows both.
Events move work forward.
```
