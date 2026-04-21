# Design: Project System

**Status:** Draft
**Date:** 2026-04-21
**References:** [core-principles.md](core-principles.md), [closing-the-loop.md](closing-the-loop.md)

## What is a Project?

Work that spans multiple sessions. A project has:
- **Goal** — what we're trying to achieve
- **Owner** — the accountable agent
- **Milestones** — concrete steps toward the goal
- **Metrics** — how we measure success (optional, for metric-driven projects)
- **Health** — evaluator score reflecting real state

## Project ID

`<owner>/<name>`. E.g., `bob/reviewer-effectiveness`.

Goes on every session, workflow run, and event related to this project. One field, one query.

```sql
SELECT * FROM sessions WHERE projectId = 'bob/reviewer-effectiveness' ORDER BY startedAt
```

## Two Kinds of Projects

### Milestone projects (short-term)
Have a defined end state. Done when milestones are complete.

```markdown
## Goal
Design how agents learn from experience.

## Milestones
- [x] Audit DD library
- [ ] Complete design doc
- [ ] Propose integration points
```

Evaluator checks: are milestones genuinely done? Health reflects milestone completion.

### Metric projects (long-term)
Pursue a metric. Never truly "done" — paused when metric is healthy, resumed when it regresses.

```markdown
## Goal
Keep coder quality above 0.7.

## Metrics
- coder.quality: target > 0.7, baseline 0.29 (at project start)
- coach.skill-effectiveness: target > 60%, baseline 29%

## Milestones
- [x] Investigate root cause of quality drop
- [x] Design intervention (read-before-edit skill)
- [ ] Deploy and verify skill improves metric
- [ ] Monitor for 1 week — no regression
```

Evaluator checks: did the metric actually move? Health factors in both milestones AND metric values. A project can't score PASS if its target metrics haven't improved.

### Lifecycle

```
Milestone project:  active → done (milestones complete, evaluator PASS)
Metric project:     active → paused (metric healthy) → active (metric regresses) → paused ...
```

For metric projects, the project handler watches the declared metrics. When a metric regresses below target, the project reactivates. The owner's heartbeat is the natural check: "is my metric still healthy?"

## Project File (project.md)

```markdown
# Project: Reviewer Effectiveness

**Status**: active
**Owner**: bob
**Priority**: P0
**Iteration**: 3
**Health**: 7/10 (PASS)

## Goal
Make the persistent-task reviewer powerful enough to push projects forward.

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

## Components

### Project Handler

One handler. Reacts to events + timer. Launches the project workflow.

```json
{
  "name": "project",
  "handler": "project",
  "intervalMs": 300000,
  "on": ["project.changed", "project.commented"],
  "description": "Detect projects needing attention, run project workflow."
}
```

What it does:
1. Scan for projects: status=active OR file changed since last check
2. Skip projects already in-flight
3. Load and execute project workflow with projectId
4. Track in-flight state

What it does NOT do:
- Parse project logic (workflow does that)
- Decide continue/block/done (workflow does that)

### Project Workflow

Drives a project forward. Reads project.md, runs iterations, evaluates transitions.

```
Read project.md
  → Check for pending comments → comment iteration (reviewer only)
  → Check status (done/blocked with no comments → exit)
  → Run worker iteration → run reviewer → update milestones
  → If DONE/BLOCKED → run evaluator (checks milestones + metrics)
  → Update Health, Current State
  → Emit project events
```

The evaluator for metric projects:
```
Standard checks (deliverables, milestones, evidence, verification)
  + Metric check: query declared metrics from DB
  + Compare current values to targets and baselines
  + Score low if metrics haven't moved despite milestones being "done"
```

### Session Tracking

Every session carries `projectId`:

```
sessions table:
  sessionId | agent | projectId                  | workflowRunId | ...
  s_001     | bob   | bob/reviewer-effectiveness | wr_001        | ...
  s_002     | bob   | bob/reviewer-effectiveness | wr_001        | ...
```

Add to sessions table:
```sql
ALTER TABLE sessions ADD COLUMN projectId TEXT;
CREATE INDEX idx_sessions_project ON sessions(projectId);
```

Flows through: handler → workflow → ctx.runAgent(agent, task, { projectId }) → session record.

### Events

The workflow emits at key points:

| Event | When | Data |
|-------|------|------|
| `project.iteration` | After each iteration | projectId, owner, iteration, milestonesDone/Total |
| `project.status-changed` | Status transitions | projectId, owner, from, to |
| `project.completed` | Evaluator PASS | projectId, owner, health, iterations, metricDeltas |
| `project.blocked` | Evaluator assessed blocker | projectId, owner, health, reason |

Events persisted in events table. Dashboard shows real-time project progress.

### Metric Integration

The `## Metrics` section in project.md declares target metrics:
```markdown
## Metrics
- coder.quality: target > 0.7, baseline 0.29
```

The workflow reads this section and:
1. **During evaluation**: queries metric values from DB, compares to targets and baselines
2. **On completion**: includes metric deltas in the `project.completed` event
3. **Health scoring**: evaluator factors in metric movement — can't PASS if metrics didn't improve

The metric-breach event system (from metric-reactivity) naturally connects:
```
coder.quality drops below 0.7
  → metric.breach event
  → coach sees it in heartbeat
  → coach checks: do I have a project for this metric?
  → if yes: adds comment to reactivate
  → if no: creates a new metric project
```

No special code for this — the owner's judgment connects metrics to projects.

## Dashboard (Web UI)

Projects tab shows:

| Project | Owner | Status | Health | Milestones | Metrics | Updated |
|---------|-------|--------|--------|-----------|---------|---------|
| reviewer-effectiveness | bob | active | 7/10 | 1/4 ████░░ | — | 2m ago |
| agent-autonomy | coach | paused | 7/10 | 3/5 ██████░ | HPR: 60% | 2h ago |
| coder-quality | coach | paused | 8/10 | 4/4 ████████ | quality: 0.72 ✅ | 1d ago |

Click to see: project.md, journal, session list (by projectId), metric chart.

## Migration

1. Add `projectId` column to sessions table
2. Add `projectId` parameter to `callAgent` / `manager.run` API
3. Rename workflow: `persistent-task` → `project` (keep old name as alias during transition)
4. Rename handler: `project-resume` → `project` (keep old handler during transition)
5. Parse `## Metrics` section in project workflow for evaluator
6. Update web UI to query by projectId

## Alignment

| Principle | How |
|-----------|-----|
| P1: Everything is an event | Handler reacts to events. Workflow emits events. Metric breach → project reactivation. |
| P2: Everything has an owner | projectId includes owner. Metrics have owners. Owner connects them. |
| P3: Events must be consumed | project.changed → handler fires. metric.breach → owner checks projects. |
| P7: Metrics are signals | Project declares target metrics. Evaluator checks them. Owner uses judgment. |
| P9: Convention | projectId = `<owner>/<name>`. Metrics section follows standard format. |
| P10: Simple first | One handler, one workflow, one ID field. Metric integration is a section in project.md, not a new table. |
