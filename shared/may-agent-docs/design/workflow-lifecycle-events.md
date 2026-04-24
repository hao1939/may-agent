# Design: Workflow Lifecycle Events

## Context

Today we have two event layers:
- **Session events** (`session_start`, `session_end`, `turn_end`, etc.) — per-API-call granularity
- **Workflow events** on the bus (`type: "workflow"`, `event: "start" | "step_start" | "step_done" | "done" | "escalated"`) — per-run, but flat and missing key state transitions

What's missing: **workflow-level lifecycle events** that capture decisions, phase transitions, and status changes across iterations. Today if you want to know "is the auth project blocked?" you have to read project.md from disk. There's no event stream for it.

## Goals

1. Any subscriber (UI, DB writer, metrics, notifications) can track workflow state in real-time
2. A workflow's full history can be reconstructed from its event stream
3. Events are workflow-mode-agnostic — master-worker, solo, collaborative all emit the same event type with different transitions
4. Works for workflows launched from handlers (no parent session) AND from within sessions (workflow tool)

## Non-goals

- Project-level events. Projects are spec files on disk; workflows are the execution unit. Project status is derived from the latest workflow's events.
- Replacing session events. Session-level detail (tool calls, text, turns) stays at the session layer.

## Event Schema

```typescript
// Added to SystemEvent union in event-bus.ts
type WorkflowLifecycleEvent = {
  type: "workflow";
  workflowId: string;           // unique run ID (existing runId)
  workflow: string;             // workflow type: "master-worker", "solo", etc.
  event: WorkflowTransition;
  
  // Optional context — included when relevant
  agent?: string;               // which agent triggered this transition
  sessionId?: string;           // which session triggered this transition
  projectId?: string;           // link to project, if project-backed
  iteration?: number;           // current iteration count
  detail?: string;              // human-readable context
  data?: Record<string, unknown>; // structured data for programmatic consumers
};
```

## Transitions

```typescript
type WorkflowTransition =
  // ── Lifecycle ──
  | "started"         // workflow execution begins
  | "completed"       // workflow finished successfully
  | "error"           // workflow failed with an error
  | "cancelled"       // workflow was externally cancelled (steering, abort)

  // ── Phases ──
  | "phase"           // entered a named phase; detail = phase name
                      //   master-worker: "planning", "working", "reviewing"
                      //   solo: "working"
                      //   any: custom phase names

  // ── Decisions ──
  | "decision"        // a decision point was reached
                      //   detail = "CONTINUE", "PIVOT", "BLOCKED: ...", "WAITING: ..."
                      //   data = { status, guidance, iteration }

  // ── Status changes ──
  | "blocked"         // workflow is blocked on external dependency
  | "waiting"         // workflow is waiting (precondition not met)
  | "resumed"         // workflow resumed from blocked/waiting
  | "escalated"       // system escalated to human attention
```

## Event Sequences by Workflow Mode

### Master-Worker (current project workflow)

```
started        { workflow: "master-worker", projectId: "bob/auth" }
phase          { detail: "planning", iteration: 1 }
phase          { detail: "reviewing", iteration: 1 }
decision       { detail: "CONTINUE — implement auth endpoint", data: { status: "continue", iteration: 1 } }
phase          { detail: "working", iteration: 1 }
phase          { detail: "reviewing", iteration: 2 }
decision       { detail: "CONTINUE — add tests", data: { status: "continue", iteration: 2 } }
phase          { detail: "working", iteration: 2 }
phase          { detail: "reviewing", iteration: 3 }
decision       { detail: "WAITING — all milestones complete", data: { status: "waiting", iteration: 3 } }
waiting        { detail: "awaiting human review" }
completed      { detail: "3 iterations, 5/5 milestones" }
```

### Solo (single agent, no review loop)

```
started        { workflow: "solo" }
phase          { detail: "working" }
completed      { detail: "report generated" }
```

### Blocked then Resumed

```
...
decision       { detail: "BLOCKED — missing API key" }
blocked        { detail: "missing API key" }
escalated      { detail: "blocked 2h, needs attention" }
resumed        { detail: "API key provided via comment" }
phase          { detail: "working", iteration: 4 }
...
```

## Relationship to Existing Events

```
┌─────────────────────────────────────────────┐
│ Workflow lifecycle events (this design)      │
│   started → phase → decision → completed    │
│                                              │
│   ┌─────────────────────────────────────┐   │
│   │ Session events (existing)            │   │
│   │   session_start → turn_end →         │   │
│   │   tool_call → tool_result →          │   │
│   │   session_end                        │   │
│   │                                      │   │
│   │   (carry workflowId + projectId)     │   │
│   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

Session events carry `workflowRunId` (already wired today via `session_start`). Workflow events carry `sessionId` when a specific session triggered the transition. Together they form a complete picture.

## Where Events Are Emitted

### From workflow execute() — workflow code emits its own transitions

```typescript
// Inside master-worker workflow
export async function execute(ctx: WorkflowContext) {
  ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "started", workflow: "master-worker", projectId });

  // Planning phase — reviewer assesses current state
  ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "phase", detail: "planning", iteration });
  reviewer.followUp("Assess current project state...");
  await reviewer.waitForIdle();

  while (running) {
    // Review phase
    ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "phase", detail: "reviewing", iteration });
    reviewer.followUp(workerSummary);
    await reviewer.waitForIdle();
    const decision = extractDecision(reviewer);
    ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "decision", detail: decision.text, data: { status: decision.status, iteration } });

    if (decision.status === "BLOCKED") {
      ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "blocked", detail: decision.detail });
      break;
    }

    // Work phase
    ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "phase", detail: "working", iteration });
    worker.followUp(decision.guidance);
    await worker.waitForIdle();
    iteration++;
  }

  ctx.emit({ type: "workflow", workflowId: ctx.runId, event: "completed", detail: summary });
}
```

### From handlers — status changes outside workflow execution

The project handler emits `resumed` when it detects a blocked workflow can continue (e.g., comment added to project.md):

```typescript
// In project handler
if (action.type === "reactivate") {
  ctx.emit({ type: "workflow", workflowId: lastRunId, event: "resumed", detail: action.reason, projectId });
}
```

## DB Persistence

The existing `DbWriter` subscriber on the event bus writes session events to SQLite. Extend it to write workflow events:

```sql
CREATE TABLE workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL,        -- runId
  workflow TEXT NOT NULL,           -- "master-worker", "solo"
  event TEXT NOT NULL,              -- transition name
  project_id TEXT,
  agent TEXT,
  session_id TEXT,
  iteration INTEGER,
  detail TEXT,
  data TEXT,                        -- JSON
  created_at INTEGER NOT NULL       -- epoch ms
);

CREATE INDEX idx_wf_events_workflow_id ON workflow_events(workflow_id);
CREATE INDEX idx_wf_events_project_id ON workflow_events(project_id);
CREATE INDEX idx_wf_events_event ON workflow_events(event);
```

### Query: current status of all projects

```sql
SELECT project_id, event, detail, created_at
FROM workflow_events
WHERE project_id IS NOT NULL
  AND event IN ('decision', 'blocked', 'waiting', 'completed', 'started', 'resumed')
  AND id IN (
    SELECT MAX(id) FROM workflow_events
    WHERE project_id IS NOT NULL
    GROUP BY project_id
  )
ORDER BY created_at DESC
```

### Query: full timeline of a workflow

```sql
SELECT event, detail, iteration, agent, session_id, created_at
FROM workflow_events
WHERE workflow_id = ?
ORDER BY created_at
```

## WorkflowContext Changes

Add `runId` to the context so workflows can emit events with their own ID:

```typescript
interface WorkflowContext {
  // ... existing fields ...

  /** Unique run identifier for this workflow execution. */
  runId: string;
}
```

The handler already generates `runId` — just pass it through.

## Launching Workflows Without a Session

Workflows can be launched two ways:
1. **From a handler** (cron tick, event trigger) — no parent session. The handler builds WorkflowContext with `ctx.manager.callAgent` for runAgent.
2. **From the workflow tool** (inside a session) — parent session exists. The tool builds WorkflowContext with the calling session's manager.

Both paths emit the same workflow lifecycle events. The only difference: handler-launched workflows have no `parentSessionId`; tool-launched workflows do.

This is already how it works. No change needed for event emission — both paths have access to `ctx.emit()`.

## Migration Path

1. Add `WorkflowLifecycleEvent` to the `SystemEvent` union in `event-bus.ts` (replaces current flat workflow event)
2. Add `workflow_events` table to DB schema
3. Extend `DbWriter` to persist workflow events
4. Add `runId` to `WorkflowContext`
5. Emit events from `project.ts` workflow (master-worker)
6. Web UI subscribes to workflow events for live project status

Steps 1-4 are infra. Step 5 is where the value lands. Step 6 is optional polish.
