# Design: Project System

**Status:** Implemented (core), In Progress (projectId DB column)
**Date:** 2026-04-21
**Supersedes:** [persistent-task-files.md](archive/persistent-task-files.md), [project-lifecycle.md](archive/project-lifecycle.md)
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

```
agents/<owner>/workspace/projects/<name>/
  project.md   — the project document (goal, milestones, state, health)
  journal.md   — iteration log (append-only)
```

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
| Milestones | Workflow | Checks off based on reviewer assessment (first 30 chars match) |
| Metrics | Human | Declares targets, workflow reads them |
| Current State | Workflow | Structured: iteration + milestones + next |
| Comments | Human, agents | Queue — processed then cleared by workflow |

Worker CANNOT edit project.md or journal.md. Produces deliverables in workspace only.

## Three Components

### 1. Project Handler (`agents/may/handlers/project.ts`)

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

### 2. Project Workflow (`agents/shared/workflows/project.ts`)

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
  ├─ False-done protection
  │   └─ 3 consecutive false-done → auto-block and escalate
  │   └─ Milestones not all checked + evaluator PASS → override to CONTINUE
  │
  ├─ Stall detection
  │   └─ 5 iterations without milestone progress → auto-block and escalate
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

**Why separate sessions per step (not one long session):**
- Worker and reviewer need different prompts (different system instructions)
- Evaluator should be independent of the worker
- Each iteration is a clean context — no accumulated hallucinations
- Sessions are the unit of tracking (opCount, cost, outcome)

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

## How Agents Interact with Projects

### During heartbeat (autonomous):
- Agent sees their project, reads Status + Health + Current State
- **Health 7+**: project is healthy, no action needed
- **Health < 7 or BLOCKED**: investigate — read journal, check deliverables, decide action
- Agent can: add a comment, try to unblock, or leave for next workflow run

### During workflow (structured):
- Worker gets goal + milestones + guidance, produces deliverables
- Reviewer evaluates, guides next iteration
- Evaluator gates transitions
- All updates go through the workflow orchestrator

### Commenting:
- Anyone (human, agent) can add to `## Comments` at any time
- Next workflow run processes comments as a comment iteration
- Comments are cleared after processing (now in journal)

## Session Tracking

Every session carries `projectId`:

```sql
-- Schema change (not yet applied to DB)
ALTER TABLE sessions ADD COLUMN projectId TEXT;
CREATE INDEX idx_sessions_project ON sessions(projectId);
```

Handler derives projectId and passes through callAgent:
```
handler → workflow → ctx.runAgent(agent, task, { projectId }) → session record
```

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

## Project Metrics

| Metric | Source | Meaning |
|--------|--------|---------|
| project.false-done | Evaluator FAIL count per run | How often reviewer falsely claims done |
| project.health | Health field in project.md | Per-project quality score |
| project.velocity | Iterations to complete | How fast projects finish |
| project.stall-rate | continueWithoutProgress counter | How often projects get stuck |

## Dashboard

See [webui-improvements.md](webui-improvements.md) for full UI design.

Projects tab (✅ implemented):

| Project | Owner | Status | Health | Milestones | Metrics | Updated |
|---------|-------|--------|--------|-----------|---------|---------|
| reviewer-effectiveness | bob | active | 7/10 | 1/4 ████░░ | — | 2m ago |
| coder-quality | coach | paused | 8/10 | 4/4 ████████ | 0.72 ✅ | 1d ago |

Click → project.md content. Journal, session list, and metric chart are planned enhancements.

## Implementation Status

| Change | Status |
|--------|--------|
| Rename workflow → `project.ts` | ✅ Done |
| Rename handler → `project.ts` | ✅ Done |
| Event emission (4 event types) | ✅ Done |
| Metric parsing in workflow | ✅ Done |
| Metric breach → reactivate in handler | ✅ Done |
| Evaluator metric check | ✅ Done |
| projectId threading via callAgent | ✅ Done (handler passes projectId) |
| projectId DB column on sessions | ❌ Not yet — DB schema change pending |
| Dashboard projects tab | ✅ Done (basic list + detail view) |
| Dashboard metric values | ❌ Not yet |

## Design Decisions

### Why file-based state, not DB?
Project.md + journal.md are the source of truth. Readable by humans and agents. Editable with any text editor. No migration needed. The workflow reads state from files, does work, writes state back. Each workflow run is independent.

### Why not resume old sessions?
Sessions are stateless — they start, run, finish. Project.md + journal.md carry all state between runs. Resuming a session means replaying message history — expensive and fragile. Clean starts are simpler and more reliable.

### Why evaluator runs as project owner? (G11)
Self-evaluation bias risk. But adding an independent evaluator agent adds complexity. Monitor false-done rates first — if self-evaluation works, keep it simple.
