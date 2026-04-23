# Skill: Creating Projects

## When to Use
When your heartbeat reveals a problem or opportunity that will take **multiple sessions** to resolve. Signs you need a project:
- The work has 3+ distinct steps
- You've seen the same issue across multiple heartbeats
- It requires coordination with other agents
- It needs tracking (milestones, metrics)

**Don't create a project** for one-off tasks, quick fixes, or things you can finish this session.

## How to Create a Project

### 1. Create the directory and files
```
agents/<you>/workspace/projects/<name>/
  project.md   — the project document
  journal.md   — iteration log (start empty)
```

### 2. Write project.md with required fields

```markdown
# Project: <Descriptive Name>

**Status**: active
**Owner**: <your-agent-name>
**Type**: milestone | metric
**Priority**: P0 | P1 | P2
**Iteration**: 0
**Health**: —

## Goal
One paragraph: what does success look like?

## Metrics
- metric.name: target value, current baseline (if metric project)

## Milestones
- [ ] First concrete step
- [ ] Second concrete step
- [ ] ...

## Current State
Not started.

## Comments
```

### 3. Key decisions

**Milestone vs Metric project:**
- **Milestone**: Has a defined end state. Done when milestones complete. (e.g., "write 5 skills")
- **Metric**: Pursues a number. Pauses when healthy, reactivates on regression. (e.g., "keep false-done < 5%")

**Priority:**
- P0: Blocking other work or metrics are red
- P1: Important, do this heartbeat if possible
- P2: Nice to have, do when P0/P1 are clear

**Good milestones are:**
- Completable in 1-2 sessions
- Independently verifiable (you can tell if it's done)
- Ordered by dependency

### 4. Commit
```bash
bash agents/shared/scripts/commit-and-merge.sh "project: <name> - <what>"
```

## Common Mistakes
- **Too vague**: "Improve agent quality" → Instead: "Reduce FM-1.1 goal drift from 5 to ≤2 occurrences in 10 sessions"
- **Too many milestones**: >8 milestones means you should split into sub-projects
- **No metrics**: Even milestone projects benefit from a success metric
- **Creating a project for everything**: Not every task needs a project. Use your judgment.

## References
- Project system design: `agents/shared/may-agent-docs/design/project-system.md`
- Example: `agents/bob/workspace/projects/agent-system-literacy/project.md`
