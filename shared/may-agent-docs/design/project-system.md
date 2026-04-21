# Design: Project System — Rethink

**Status:** Draft
**Date:** 2026-04-21

## Core Concepts

### Project
Work that spans multiple sessions. Has goal, milestones, owner, lifecycle.

### Project ID
`<owner>/<name>` — derived from path. E.g., `bob/reviewer-effectiveness`.
- Short, readable, unique
- Goes on every session, workflow run, and event related to this project
- Queryable: `SELECT * FROM sessions WHERE projectId = 'bob/reviewer-effectiveness'`

### Project Workflow
Drives a project forward. Reads project.md, runs iterations (worker → reviewer), evaluates transitions, updates health. One workflow, clear name: `project`.

Replaces: `persistent-task` (confusing name).

### Project Handler
Reacts to project events. Detects projects that need attention, launches the project workflow. One handler, clear name: `project`.

Replaces: `project-resume` (confusing name — it does more than resume).

## Session Tracking

Every session created by the project workflow carries `projectId`:

```
sessions table:
  sessionId | agent | projectId              | workflowRunId | task | ...
  s_001     | bob   | bob/reviewer-effectiveness | wr_001     | iteration 6...
  s_002     | bob   | bob/reviewer-effectiveness | wr_001     | [REVIEW]...
  s_003     | bob   | bob/reviewer-effectiveness | wr_001     | [EVALUATION]...
```

Query all project sessions:
```sql
SELECT * FROM sessions WHERE projectId = 'bob/reviewer-effectiveness' ORDER BY startedAt
```

Query project session count and cost:
```sql
SELECT projectId, COUNT(*) as sessions, SUM(opCount) as ops
FROM sessions WHERE projectId IS NOT NULL
GROUP BY projectId
```

## Architecture

```
Project event fires (comment, status change, timer)
  → Project handler detects it
  → Launches project workflow with projectId
  → Workflow creates sessions with projectId + workflowRunId
  → All sessions trackable back to the project
  → Workflow emits project events (iteration, status-changed, completed)
  → Events persisted in events table
```

### Project Handler

Responsibilities:
- React to: timer (scan active projects), events (project.changed, project.commented)
- For each project needing attention: load and execute the project workflow
- Pass projectId to the workflow

Does NOT:
- Parse project logic (workflow does that)
- Decide continue/block/done (workflow does that)
- Create LLM sessions (workflow does that via callAgent)

```
cron.json:
{
  "name": "project",
  "handler": "project",
  "intervalMs": 300000,
  "on": ["project.changed", "project.commented"]
}
```

### Project Workflow

Same logic as current persistent-task, with:
1. `projectId` passed to every `callAgent` call → stored on session
2. Events emitted at key points via RuntimeCtx.emit
3. Named `project` instead of `persistent-task`

```typescript
export const name = "project";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectId = `${config.owner}/${projectName}`;
  
  // Every callAgent includes projectId
  const workerResult = await ctx.runAgent(config.worker, workerPrompt, {
    projectId,
  });
  
  // Emit events
  ctx.emit({ type: "emit", event: "project.iteration", data: {
    projectId,
    owner: config.owner,
    iteration,
  }});
}
```

### What Changes in Sessions Table

Add `projectId` column:
```sql
ALTER TABLE sessions ADD COLUMN projectId TEXT;
CREATE INDEX idx_sessions_project ON sessions(projectId);
```

The `callAgent` / `manager.run` API gains an optional `projectId` parameter that flows through to the session record.

## Migration

1. Rename `persistent-task.ts` → keep as-is, add `project.ts` as new name (both export same logic during transition)
2. Rename `project-resume.ts` → `project.ts` handler
3. Add `projectId` column to sessions table
4. Pass `projectId` through callAgent → session creation
5. Update web UI projects view to query by projectId

## Alignment with Core Principles

| Principle | How it aligns |
|-----------|--------------|
| P1: Everything is an event | Project handler reacts to events. Workflow emits events. |
| P2: Everything has an owner | Project has explicit owner. projectId includes owner name. |
| P3: Events must be consumed | project.changed/commented → handler fires → workflow runs |
| P4: Context discovered | Workflow reads project.md and journal.md on demand |
| P9: Convention | projectId = `<owner>/<name>`, consistent naming |
| P10: Simple first | One handler, one workflow, one ID field |
