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
**Type**: milestone | continuous
**Priority**: P0 | P1 | P2
**Iteration**: 0
**Health**: —

## Goal
One paragraph: what does success look like? Be specific and measurable.

## Current State
Where are we now? What's the gap between here and the goal?

## Metrics
- metric.name: target value, current baseline
(Even milestone projects benefit from a metric that tracks whether the goal is actually met)

## Milestones
- [ ] First small, concrete step (completable in 1-2 sessions)
- [ ] Second step
(Start with 3-5 milestones. Add more as you progress. Each should be independently verifiable.)

## Resources
- Key files: paths to code, docs, configs the worker needs
- How to measure: exact commands/queries to check metrics
- How to verify: how to confirm a milestone is really done
- Related knowledge: link relevant knowledge entries, skills, experiments

## Comments

## Iteration Summary
```

### 3. Key decisions

**Type:**
- **milestone**: Has a defined end state. Done when goal is met (not when milestones are checked).
- **continuous**: Pursues a number. Pauses when healthy, reactivates on regression.

**Priority:**
- P0: Blocking other work or metrics are red
- P1: Important, do this heartbeat if possible
- P2: Nice to have, do when P0/P1 are clear

**Good milestones:**
- Completable in 1-2 sessions
- Independently verifiable (you can tell if it's done without asking)
- Ordered by dependency
- **Iterative** — measure after each milestone, adjust the next one based on results. Don't plan 13 milestones upfront. Plan 3-5, execute, learn, plan the next batch.

**Stop reasons — only two valid kinds:**
- **Goal met**: the metric/outcome you set out to achieve is actually achieved (not "milestones checked off")
- **Waiting for a specific condition**: "waiting for PR merge", "waiting for API key". Must include a resume condition.
- "All milestones complete" is NOT a stop reason unless the goal is met. If milestones are done but metrics haven't moved, add more milestones.

**Current State goes right after Goal** — so anyone reading the project immediately sees the gap.

**Resources must be actionable** — not just file paths, but exact commands to run, queries to execute, and how to verify results.

**Iteration Summary should capture decisions** — what was attempted, what the measurement showed, what changed. "CONTINUE. Good progress." is useless.

### 4. Commit
```bash
bash agents/shared/scripts/commit-and-merge.sh "project: <name> - <what>"
```

## Close the Loop

Creating a project is just the start. As the project progresses:
- **Metric breaching?** → Investigate, then write a guard or handler to prevent recurrence
- **Same failure pattern 3+ times?** → Write a skill teaching the fix, or a guard enforcing it
- **Manual check you keep doing?** → Write a handler to automate it (zero LLM cost)

The goal isn't just to finish the project — it's to leave the system better than you found it.

## Common Mistakes
- **Too vague**: "Improve agent quality" → Instead: "Reduce FM-1.1 goal drift from 5 to ≤2 occurrences in 10 sessions"
- **Too many milestones upfront**: >5 milestones at once means you're planning too far ahead. Plan iteratively.
- **No metrics**: How will you know the goal is met? Every project needs a measurable signal.
- **Stop when milestones checked, not when goal met**: Milestones are steps, not the destination.
- **Resources with no guidance**: Listing file paths without explaining how to use them
- **Empty iteration summaries**: Each iteration should capture what you learned, not just "progress"
