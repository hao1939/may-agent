# Design: Persistent-Task System (v3)

## Overview

The persistent-task system drives multi-iteration project work. It has three components:
1. **Project files** — project.md (truth) + journal.md (history)
2. **Workflow** — persistent-task.ts orchestrates worker/reviewer/evaluator
3. **Project-resume handler** — triggers workflows for active projects

## Project Files

```
agents/<owner>/workspace/projects/<name>/
  project.md   — the project document (goal, milestones, state, health)
  journal.md   — iteration log (append-only)
```

### project.md — The Truth

```markdown
# Project: Context Learning

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 5
**Health**: 7/10 (PASS)

## Goal
Agents learn from experience and get better over time.

## Milestones
- [x] Audit DD library for applicable patterns
- [x] Synthesize candidate approaches
- [ ] Design gym experiment
- [ ] Run controlled A/B test
- [ ] Measure behavior change

## Current State
Iteration 5. Milestones: 2/5 done. Next: Design gym experiment

## Iteration Summary
- **Iter 1-2**: DD library audit, 6 candidates identified
- **Iter 3-5**: Synthesized into 3 approaches, selected reflexion pattern

## Comments
```

**Fields and who updates them:**

| Field | Updated by | How |
|-------|-----------|-----|
| Status | Orchestrator | On transition (active/done/blocked/paused) |
| Owner, Priority | Human | Direct edit |
| Iteration | Orchestrator | Incremented each iteration |
| Health | Orchestrator | From evaluator score on status transition |
| Goal | Human | Direct edit |
| Milestones | Orchestrator | Checks off based on reviewer assessment |
| Current State | Orchestrator | Structured: iteration + milestone progress + next |
| Iteration Summary | Orchestrator | Appends brief per iteration |
| Comments | Human, agents | Queue — processed then cleared by orchestrator |

**Key rule**: Worker CANNOT edit project.md or journal.md. Produces deliverables in workspace only.

### journal.md — The History

Append-only log of every iteration:

```markdown
# Journal

### Iteration 5 — 2026-04-20T10:30:00Z
**Worker**: Created reflexion experiment design doc at workspace/reflexion-design.md
**Reviewer**: CONTINUE — Good design. Next: implement the gym scenario.

### Iteration 4 (comment) — 2026-04-20T09:15:00Z
**Comment**: Don't mark done until milestones are checked off.
**Reviewer**: CONTINUE — Acknowledged. Focus on milestone 3 next.

### Iteration 3 — 2026-04-20T08:00:00Z
**Worker**: Synthesized 3 approaches from DD audit.
**Reviewer**: CONTINUE — Good synthesis. Milestone 2 complete.
**Evaluator**: BLOCKED eval (score=6/10) — ...
```

**Entry types:**
- **Regular iteration**: Worker output + Reviewer decision
- **Comment iteration**: Comment text + Reviewer decision (no worker)
- **Evaluator**: Runs on status transitions (done/blocked), scores 1-10

## Workflow: persistent-task.ts

### Iteration Loop

```
while (iteration <= maxIterations):
  1. Re-read project.md
  2. Check for pending comments → if found, run COMMENT ITERATION
  3. Run WORKER → produces deliverables
  4. Run REVIEWER → CONTINUE/DONE/BLOCKED
  5. Orchestrator updates milestones from reviewer text
  6. If DONE or BLOCKED → run EVALUATOR → update Health
  7. Log everything to journal.md
  8. Update project.md (Iteration, Current State, milestones, Health)
```

### Comment Iterations

Comments in project.md are a queue. When the workflow detects pending comments:

1. Skip worker — comments don't need work, they need review
2. Run reviewer with comments as input
3. Reviewer produces guidance incorporating the comments
4. Comments cleared from project.md (now in journal)
5. Next iteration: worker gets reviewer's guidance (informed by comments)

### Milestone Updates

The reviewer prompt asks to mention completed milestones by name. After the reviewer runs, the orchestrator:

1. Matches reviewer text against pending milestone text (first 30 chars)
2. Checks off matching milestones in project.md
3. Worker can't edit project.md, so this is the only way milestones get checked off

### Evaluator Gate

Runs on every status transition (active → done, active → blocked):

1. LLM evaluator checks: deliverables exist? Goal met? Evidence? Milestones honest? Blocker real?
2. Scores 1-10
3. For DONE: score ≥ 7 = accept, < 7 = override to CONTINUE
4. For BLOCKED: score logged, blocker assessed (did worker try alternatives or give up?)
5. Health field updated in project.md with score

### Current State — Honest and Structured

Not raw worker output. Always:
```
Iteration N. Milestones: X/Y done. Next: <first pending milestone>
```

On completion: `Complete. X/Y milestones. <brief summary>`
On blocked: `Blocked: <reason, truncated to 150 chars>`

### Health Field

```
**Health**: 8/10 (PASS)     — evaluator approved completion
**Health**: 4/10 (FAIL)     — evaluator rejected false-done
**Health**: 5/10 (BLOCKED)  — evaluator assessed blocker
```

Agents see Health at a glance during heartbeats. Low health = project needs attention.

## Project-Resume Handler

Scans for active projects every 5 minutes:

1. Find all `project.md` files with `Status: active`
2. Check DB for running sessions on the same project path
3. If no running session → fork owner with "Run persistent-task workflow"
4. One agent can work on multiple projects, but one project can't have concurrent sessions

## How Agents Interact with Projects

### During heartbeat (autonomous):
- Agent sees their project, reads Status + Health + Current State
- **Health 7+**: project is healthy, no action needed
- **Health < 7 or BLOCKED**: investigate — read journal, check deliverables, decide action
- Agent can: add a comment, try to unblock, or leave for next workflow run

### During persistent-task (structured):
- Worker gets goal + milestones + guidance, produces deliverables
- Reviewer evaluates, guides next iteration
- Evaluator gates transitions
- All updates go through the orchestrator

### Commenting:
- Anyone (human, agent) can add to `## Comments` at any time
- Next workflow run processes comments as a comment iteration
- Comments are cleared after processing (now in journal)

## Metrics

| Metric | Source | Meaning |
|--------|--------|---------|
| project.false-done | Evaluator FAIL count | How often reviewer falsely claims done |
| project.health | Health field | Per-project quality score |
| project.velocity | Iterations to complete | How fast projects finish |
| project.stall-rate | continueWithoutProgress | How often projects get stuck |
