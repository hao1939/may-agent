# Design: Project Lifecycle — Session Model & Event Integration

**Status:** Draft
**Date:** 2026-04-21
**References:** [persistent-task-files.md](persistent-task-files.md), [core-principles.md](core-principles.md), [event-driven-handlers.md](event-driven-handlers.md)

## Session Model

### One workflow run per project resume

Each time a project is picked up (by handler or event), a new workflow run starts. The workflow reads project.md and journal.md, continues from where it left off.

```
project-resume fires
  → new workflow run (wr_xxxxx)
  → reads project.md: iteration=5, status=active
  → runs iteration 6: worker session (child, workflowRunId=wr_xxxxx)
  → runs iteration 6: reviewer session (child, workflowRunId=wr_xxxxx)
  → if DONE: evaluator session (child, workflowRunId=wr_xxxxx)
  → updates project.md: iteration=6
  → workflow run completes
```

**The project file is the resume mechanism.** No session resumption needed. Each workflow run is independent — it reads state from files, does work, writes state back.

### Session tree

```
workflow run: wr_xxxxx (project: agents/bob/reviewer-effectiveness)
  ├── worker session: s_001 (agent: bob, task: "iteration 6...")
  ├── reviewer session: s_002 (agent: bob, task: "[REVIEW]...")
  └── evaluator session: s_003 (agent: bob, task: "[EVALUATION]...")
```

All child sessions carry `workflowRunId` and `source: "workflow"`. Queryable: "show me all sessions for this project run."

### Why not one long session?

- Worker and reviewer need different prompts (different system instructions)
- Evaluator should be independent of the worker
- Each iteration is a clean context — no accumulated hallucinations
- Sessions are the unit of tracking (opCount, cost, outcome)

### Why not resume old sessions?

- Sessions are stateless — they start, run, finish
- Project.md + journal.md carry all state between runs
- Resuming a session means replaying message history — expensive and fragile
- Clean starts are simpler and more reliable

## Event Integration

### Today (interim)

```
project-resume handler (timer: 5min)
  → scans project directories
  → detects: mtime changed OR status=active
  → loads persistent-task workflow
  → executes workflow directly (no LLM wrapper)
```

### Target (event-driven)

```
persistent-task workflow finishes iteration
  → emits: project.updated { project, owner, status, iteration }

Human adds comment
  → file mtime changes
  → project-resume detects on next scan
  → OR: human runs `may-agent --emit project.commented`

Metric breaches
  → metrics-snapshot emits: metric.breach { owner }
  → metric-alert handler forks owner
  → owner checks their projects as part of investigation
```

### What the workflow emits

The persistent-task workflow should emit events at key points (using RuntimeCtx.emit):

```typescript
// After each iteration
ctx.emit({ type: "emit", event: "project.iteration", data: {
  project: config.projectPath,
  owner: config.owner,
  iteration,
  milestonesDone: ms.done,
  milestonesTotal: ms.total,
}});

// On status change
ctx.emit({ type: "emit", event: "project.status-changed", data: {
  project: config.projectPath,
  owner: config.owner,
  from: oldStatus,
  to: newStatus,
}});

// On completion
ctx.emit({ type: "emit", event: "project.completed", data: {
  project: config.projectPath,
  owner: config.owner,
  health: score,
  iterations: iteration,
}});
```

These events are persisted (G1) and visible in the Events tab. They enable:
- Dashboard showing real-time project progress
- Handlers reacting to project completions
- Metrics on project velocity

## project-resume Handler Design

### Responsibilities

1. **Detect** projects that need attention (mtime changed, status active)
2. **Load** the persistent-task workflow
3. **Execute** it with a proper WorkflowContext (with RuntimeCtx)
4. **Track** the workflow run (workflowRunId on child sessions)

### What it does NOT do

- Parse project status/comments (the workflow does that)
- Decide whether to continue/block/done (the workflow does that)
- Fork LLM sessions with text instructions (workflow calls callAgent directly)

### Simplicity

The handler is a bridge between the cron/event system and the workflow system. It should be thin:

```
detect changed/active projects
  → for each: load workflow, execute with RuntimeCtx
```

No business logic. No project parsing beyond status/mtime. The workflow owns all project logic.

## Tracking

### Workflow run records

Each execution creates a workflow run record in `.state/workflows/`:
```json
{
  "runId": "wr_xxxxx",
  "workflow": "persistent-task",
  "task": "project: agents/bob/...",
  "status": "done",
  "steps": [
    { "sessionId": "s_001", "agent": "bob", "task": "iteration 6..." },
    { "sessionId": "s_002", "agent": "bob", "task": "[REVIEW]..." }
  ],
  "startedAt": 1776xxx,
  "endedAt": 1776xxx
}
```

### Queryability

- "What workflow runs happened for this project?" → scan `.state/workflows/` by task
- "What sessions belong to this project run?" → query sessions by workflowRunId
- "What's the project health over time?" → Health field in project.md + event log

Once project-tracking-db (G10) is implemented, this becomes a SQL query.
