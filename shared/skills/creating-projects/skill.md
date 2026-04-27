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
agents/shared/projects/<name>/
  project.md   — the project document (source of truth)
  journal.md   — iteration log (start empty)
  meta.json    — machine metadata (sessions, comments, timestamps)
  outputs/     — all deliverables, scripts, intermediate files
```

### 2. Write project.md with required fields

```markdown
# Project: <Descriptive Name>

**Status**: active
**Owner**: <your-agent-name>
**Type**: milestone | continuous
**Priority**: P0 | P1 | P2
**Iteration**: 0

## Goal
One paragraph: what does success look like? Be specific and measurable.

## Current State
Where are we now? What's the gap between here and the goal?

## Context
(Key discoveries and facts accumulated across iterations by the reviewer. Starts empty.)

## Milestones
- [ ] First small, concrete step (completable in 1-2 sessions)
- [ ] Second step
(Start with 3-5 milestones. Add more as you progress. Each should be independently verifiable.)

## Resources
- Key files: paths to code, docs, configs the worker needs
- How to measure: exact commands/queries to check metrics
- How to verify: how to confirm a milestone is really done
- Related knowledge: link relevant knowledge entries, skills, experiments

## Artifacts
(Files produced by this project, living in outputs/)

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

## Collaboration

**Comments**: Other agents add comments via `meta.json.comments[]`:
```json
{ "from": "coach", "at": "2026-04-26T10:00:00Z", "text": "Split M3", "read": false }
```
The project workflow shows unread comments to the worker at iteration start, then marks them read.

**Context maintenance**: The reviewer accumulates key findings in `## Context` after each iteration. This saves future workers from re-discovering the same things.

## Close the Loop

Creating a project is just the start. As the project progresses:
- **Metric breaching?** → Investigate, then write a guard or handler to prevent recurrence
- **Same failure pattern 3+ times?** → Write a skill teaching the fix, or a guard enforcing it
- **Manual check you keep doing?** → Write a handler to automate it (zero LLM cost)

The goal isn't just to finish the project — it's to leave the system better than you found it.

**Every skill and workflow you create must be verifiable and testable.** If you can't write a gym scenario or a test that checks whether the skill works, it's not a real skill — it's wishful thinking. Before marking a skill "done":
1. Write a gym scenario that tests the behavior the skill teaches
2. Run it and confirm the agent follows the skill
3. If the test fails, iterate on the skill until it passes

## Common Mistakes
- **Too vague**: "Improve agent quality" → Instead: "Reduce FM-1.1 goal drift from 5 to ≤2 occurrences in 10 sessions"
- **Too many milestones upfront**: >5 milestones at once means you're planning too far ahead. Plan iteratively.
- **No metrics**: How will you know the goal is met? Every project needs a measurable signal.
- **Stop when milestones checked, not when goal met**: Milestones are steps, not the destination.
- **Resources with no guidance**: Listing file paths without explaining how to use them
- **Empty iteration summaries**: Each iteration should capture what you learned, not just "progress"
