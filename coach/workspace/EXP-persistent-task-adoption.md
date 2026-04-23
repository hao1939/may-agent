# EXP: Persistent-Task Adoption Context Skill for Bob

**Status**: DESIGNED — lab fork ready, awaiting gym runner
**Created**: 2026-04-24

## Problem
Bob passes `use-persistent-task` only 8/122 (6.6%). The scenario asks bob to resume a project via `workflow.run("persistent-task", ...)`. Bob has docs in `reference.md` but no direct context.md instruction.

## Intervention
One line added to bob's context.md (top section, near other workflow instructions):
> **Project resumption**: When asked to resume a project (task mentions a project file), use `workflow.run("persistent-task", "project: <path>\nagent: bob\ngoal: <from project file>")` — do NOT work inline.

This is a TRIGGER/ACTION pattern (proven effective at 75% in EXP-186).

## Lab Fork
`agents/.lab/bob-persistent-task-skill/bob/context.md` — single line added after line 5.

## Expected Outcome
Baseline: 6.6% → Target: ≥50% (TRIGGER/ACTION pattern typically achieves 75%).

## To Run
When gym runner is available:
```bash
scripts/gym-batch.sh use-persistent-task --agent bob --trials 10 --lab bob-persistent-task-skill --timeout 600
```

## Promote If
≥50% pass rate on 10 trials → add the line to production `agents/bob/context.md`.
