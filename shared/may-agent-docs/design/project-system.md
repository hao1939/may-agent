# Design: Project System

**Status:** Approved
**Date:** 2026-04-21
**Supersedes:** [persistent-task-files.md](persistent-task-files.md)
**References:** [core-principles.md](core-principles.md), [closing-the-loop.md](closing-the-loop.md), [runtime-ctx.md](runtime-ctx.md)

## What is a Project?

Work that spans multiple sessions. A project has:
- **Goal** — what we're trying to achieve
- **Owner** — the accountable agent
- **Milestones** — concrete steps toward the goal
- **Metrics** — how we measure success (optional)
- **Health** — evaluator score reflecting real state
- **Project ID** — `<owner>/<name>`, on every session and event

## Project ID

`<owner>/<name>`. Derived from path. E.g., `bob/reviewer-effectiveness`.

One field. One query. Goes on every session, workflow run, and event.

```sql
SELECT * FROM sessions WHERE projectId = 'bob/reviewer-effectiveness' ORDER BY startedAt
```

## Two Kinds of Projects

### Milestone projects
Defined end state. Done when milestones complete and evaluator passes.

```
active → done
```

### Metric projects
Pursue a metric target. Pause when healthy, reactivate when metric regresses.

```
active → paused (metric healthy) → active (metric breaches) → paused → ...
```

Both use the same project.md format, same workflow, same handler. The difference is the `## Metrics` section and the lifecycle.

## Project File

```markdown
# Project: Reviewer Effectiveness

**Status**: active
**Owner**: bob
**Priority**: P0
**Iteration**: 3
**Health**: 7/10 (PASS)

## Goal
Make the project reviewer powerful enough to push projects forward.

## Metrics
- workflow.false-done: target < 5%, baseline 40%
- project.stall-rate: target < 20%, baseline 60%

## Milestones
- [x] Investigate reviewer failures across 10+ projects
- [ ] Redesign reviewer prompt
- [ ] A/B test new prompt vs old
- [ ] Measure false-done rate improvement

## Current State
Iteration 3. Milestones: 1/4 done. Next: Redesign reviewer prompt.

## Iteration Summary

## Comments
```

### Fields

| Field | Updated by | How |
|-------|-----------|-----|
| Status | Workflow | On transitions (active/done/blocked/paused) |
| Owner, Priority | Human | Direct edit |
| Iteration | Workflow | Incremented each iteration |
| Health | Workflow | From evaluator score on status transitions |
| Goal | Human | Direct edit |
| Milestones | Workflow | Checks off based on reviewer assessment |
| Metrics | Human | Declares targets, workflow reads them |
| Current State | Workflow | Structured: iteration + milestones + next |
| Comments | Human, agents | Queue — processed then cleared by workflow |

Worker CANNOT edit project.md or journal.md. Produces deliverables in workspace only.

## Three Components

### 1. Project Handler

One handler. Detects projects needing attention. Launches the project workflow.

```json
{
  "name": "project",
  "handler": "project",
  "intervalMs": 300000,
  "on": ["project.changed", "project.commented", "metric.breach"],
  "description": "Detect projects needing attention, run project workflow."
}
```

**Detection rules:**
- Status = active → always launch
- File mtime changed since last check → launch (picks up comments, status changes)
- `metric.breach` event → check if any paused project declares that metric → reactivate and launch
- Skip if project already has a running workflow (inflight tracking)

**On startup:** Reset lastCheck to 0. First scan picks up everything.

**What it does NOT do:** Parse project logic, decide continue/block/done. The workflow handles all project decisions.

### 2. Project Workflow

Drives a project forward. Reads project.md, runs iterations, evaluates transitions, emits events.

```
Read project.md + journal.md
  │
  ├─ Pending comments? → Comment iteration (reviewer only, clear comments)
  │
  ├─ Status done/blocked, no comments? → Exit
  │
  ├─ Worker iteration
  │   └─ ctx.runAgent(worker, prompt, { projectId })
  │
  ├─ Reviewer iteration
  │   └─ ctx.runAgent(owner, prompt, { projectId })
  │   └─ Update milestones from reviewer text
  │
  ├─ Status transition (DONE/BLOCKED)?
  │   └─ Evaluator
  │       └─ ctx.runAgent(owner, evalPrompt, { projectId })
  │       └─ Checks: deliverables, milestones, evidence, verification
  │       └─ For metric projects: query declared metrics, compare to targets
  │       └─ Update Health field
  │       └─ Score ≥ 7: accept transition
  │       └─ Score < 7: override to CONTINUE
  │
  ├─ Update project.md (Status, Iteration, Current State, Health)
  │
  └─ Emit events (project.iteration, project.status-changed, etc.)
```

**Evaluator for metric projects:**
```
Standard checks (deliverables, milestones, evidence, building ≠ verifying)
  + Query declared metrics from DB via ctx.getDb()
  + Compare current values to targets and baselines
  + Can't PASS if target metrics haven't improved
```

### 3. Journal (journal.md)

Append-only log. One entry per iteration.

```markdown
### Iteration 6 — 2026-04-21T10:30:00Z
**Worker**: Created reviewer prompt redesign at workspace/reviewer-v2.md
**Reviewer**: CONTINUE — Good design. Milestone 2 complete. Next: A/B test.

### Iteration 5 (comment) — 2026-04-21T09:15:00Z
**Comment**: Focus on false-done rate, not just rubber-stamping.
**Reviewer**: CONTINUE — Acknowledged. Adjusted approach.

### Iteration 4 — 2026-04-21T08:00:00Z
**Worker**: Analyzed 12 reviewer decisions from recent projects.
**Reviewer**: CONTINUE — Good investigation. Milestone 1 complete.
**Evaluator**: BLOCKED eval (score=6/10) — ...
```

Entry types: regular (worker + reviewer), comment (comment + reviewer), evaluator (on transitions).

## Session Tracking

Every session carries `projectId`:

```sql
-- Schema change
ALTER TABLE sessions ADD COLUMN projectId TEXT;
CREATE INDEX idx_sessions_project ON sessions(projectId);
```

Flows through: handler → workflow → ctx.runAgent(agent, task, { projectId }) → session record.

```
sessions table:
  sessionId | agent | projectId                  | workflowRunId | source   | task
  s_001     | bob   | bob/reviewer-effectiveness | wr_001        | workflow | iteration 6...
  s_002     | bob   | bob/reviewer-effectiveness | wr_001        | workflow | [REVIEW]...
  s_003     | bob   | bob/reviewer-effectiveness | wr_001        | workflow | [EVALUATION]...
```

Query all project sessions: `WHERE projectId = 'bob/reviewer-effectiveness'`
Query project cost: `SELECT SUM(opCount) FROM sessions WHERE projectId = ?`

## Events

The workflow emits at key points via `ctx.emit()`:

| Event | When | Data |
|-------|------|------|
| `project.iteration` | After each iteration | projectId, owner, iteration, milestonesDone/Total |
| `project.status-changed` | Status transitions | projectId, owner, from, to |
| `project.completed` | Evaluator PASS on done | projectId, owner, health, iterations |
| `project.blocked` | Evaluator assessed blocker | projectId, owner, health, reason |

All events persisted in events table. Queryable in Events tab.

## Metric Project Lifecycle

```
1. Human creates project with ## Metrics section
   - coder.quality: target > 0.7, baseline 0.29

2. Project works toward milestones (same as milestone project)

3. Evaluator checks metrics on DONE transition
   - Query: SELECT current FROM metrics WHERE id = 'coder.quality'
   - Compare to target: 0.72 > 0.7 ✅
   - Factor into health score

4. Project status → paused (metric healthy, milestones done)

5. Later: metric regresses
   - metrics-snapshot detects: coder.quality = 0.65 < 0.7
   - Emits: metric.breach { metric: coder.quality, owner: coach }
   - Project handler receives event
   - Checks paused projects: does any declare coder.quality?
   - Yes → set status to active, launch workflow

6. Project resumes, works on new fix

7. Metric recovers → paused again
```

## Dashboard

Projects tab:

| Project | Owner | Status | Health | Milestones | Metrics | Updated |
|---------|-------|--------|--------|-----------|---------|---------|
| reviewer-effectiveness | bob | active | 7/10 | 1/4 ████░░ | — | 2m ago |
| coder-quality | coach | paused | 8/10 | 4/4 ████████ | 0.72 ✅ | 1d ago |

Click → project.md content, journal, session list (by projectId), metric chart.

## Implementation

### Schema (src/lib/requests.ts)
```sql
ALTER TABLE sessions ADD COLUMN projectId TEXT;
CREATE INDEX idx_sessions_project ON sessions(projectId);
```

### callAgent / manager.run gains projectId
```typescript
// In manager.ts
callAgent(agent, task, { projectId, workflowRunId, source })
// projectId flows to session creation → stored in DB
```

### Rename workflow
- `agents/shared/workflows/persistent-task.ts` → `agents/shared/workflows/project.ts`
- Export `name = "project"` (also export alias `"persistent-task"` for transition)

### Rename handler  
- `agents/may/handlers/project-resume.ts` → `agents/may/handlers/project.ts`
- Cron entry: `"name": "project", "handler": "project"`

### Metric section parsing (~20 LOC in workflow)
```typescript
function parseMetrics(content: string): Array<{ id: string; target: string; baseline: string }> {
  const section = extractSection(content, "Metrics");
  if (!section) return [];
  return section.split("\n").filter(l => l.startsWith("- ")).map(line => {
    const m = line.match(/^- (\S+):\s*target\s*([<>]=?\s*[\d.]+%?),?\s*baseline\s*([\d.]+%?)/);
    return m ? { id: m[1], target: m[2].trim(), baseline: m[3].trim() } : null;
  }).filter(Boolean);
}
```

### Event emission (~15 LOC in workflow)
```typescript
// After each iteration
ctx.emit({ type: "emit", event: "project.iteration", data: {
  projectId, owner: config.owner, iteration,
  milestonesDone: ms.done, milestonesTotal: ms.total,
}});

// On status change
ctx.emit({ type: "emit", event: "project.status-changed", data: {
  projectId, owner: config.owner, from: oldStatus, to: newStatus,
}});
```

### Metric breach → reactivate (~15 LOC in handler)
```typescript
// In project handler, when metric.breach event arrives:
const metric = eventData.metric;
for (const project of pausedProjects) {
  const declaredMetrics = parseMetrics(projectContent);
  if (declaredMetrics.some(m => m.id === metric)) {
    updateField(projectContent, "Status", "active");
    // Will be picked up on next scan
  }
}
```

### Dashboard metric column (~10 LOC in web UI)
Query metric values for projects with `## Metrics` section. Show current vs target.

## Total: ~100 LOC across 6 files

| Change | LOC | Files |
|--------|-----|-------|
| projectId schema + threading | 20 | requests.ts, manager.ts |
| Rename workflow + handler | 10 | persistent-task.ts → project.ts, project-resume.ts → project.ts, cron.json |
| Event emission | 15 | project.ts (workflow) |
| Metric parsing | 20 | project.ts (workflow) |
| Metric breach reactivation | 15 | project.ts (handler) |
| Dashboard metric column | 10 | web.ts, index.html |
| Evaluator metric check | 10 | project.ts (workflow) |
