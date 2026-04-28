# Skill: Creating Projects

## When to Use
When your heartbeat reveals a problem that needs **multiple sessions** to resolve:
- 3+ distinct steps of work
- Same issue seen across multiple heartbeats
- Needs tracking with metrics

**Don't create a project** for one-off tasks or quick fixes you can finish this session.

## Project Structure

```
agents/shared/projects/<name>/
  project.md      — source of truth
  journal.md      — iteration log
  discussion.md   — comments from agents/humans
  outputs/        — all deliverables
```

## project.md Template

```markdown
# Project: <Name>

**Status**: active
**Owner**: <your-agent-name>
**Priority**: P0 | P1 | P2
**Workflow**: master-worker
**Iteration**: 0

## Goal
What does success look like? One paragraph, specific.

## Metrics
Encode goals into metrics. These drive the project, not milestones.
- metric.name: current → target (what it measures)
- another.metric: current → target

## Current State
Where are we now? Gap between here and the goal.
Updated each iteration with findings, facts, decisions.

## Plan
- [ ] First concrete step
- [ ] Second step
- [ ] Third step
(Start with 3-5 items. Add more as you learn. These are a work log, not a completion trigger.)

## References

**Resources:**
- path/to/key/file — what it is
- command to run — how to measure

**Artifacts:**
- outputs/report.md — what was produced
```

## Project Lifecycle

Four states:
- **active** — working on it
- **waiting** — paused by design (deprioritized, waiting for condition)
- **blocked** — something is broken, needs fix
- **closed** — human or May decided it's finished

**Rules:**
- Projects are NEVER closed by agents. Only human or May closes projects.
- Projects keep iterating while active, pushing metrics toward targets.
- Plan items are a work log. Checking them all off does NOT mean the project is done.
- Metrics ARE the goal. When metrics hit targets, project is healthy but still active.

## Key Decisions

**Priority:**
- P0: Blocking other work or metrics are red
- P1: Important, do this heartbeat
- P2: Nice to have

**Good plan items:**
- Completable in 1-2 sessions
- Independently verifiable
- Start with 3-5, add more as you learn

## Common Mistakes
- **No metrics**: Every project needs measurable signals. No metrics = no way to know if it's working.
- **Closing when plan items checked**: Plan items are steps, not the goal. Check the metrics.
- **Too many items upfront**: Plan 3-5, execute, learn, then plan next batch.
- **Vague goal**: "Improve quality" → "Reduce error rate from 15% to 5%"
- **Current State at the bottom**: Put it right after Metrics so the gap is visible.
