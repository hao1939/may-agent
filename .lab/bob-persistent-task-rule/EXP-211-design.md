# EXP-211: Persistent-Task Context Rule for Bob

**Date**: 2026-06-29
**Status**: DESIGNED
**Hypothesis**: Adding a context.md rule about persistent-task workflow will increase bob's use-persistent-task pass rate from 7% to ≥50%.

## Background

Bob fails use-persistent-task 93% of the time (8/122 passes in last 7 days). The scenario requires bob to invoke `workflow.run("persistent-task", ...)` when resuming active projects. Bob has a helper script (`check-active-projects.sh`) but nothing in context.md cues him to use the persistent-task workflow.

## Design

- **Control**: Current bob context.md (baseline from existing 122 runs: 7%)
- **Treatment**: Add one line to context.md: "When resuming an active project (Status: active in project file), use `workflow.run('persistent-task', 'project: <path>\nagent: bob\ngoal: <next step>')` — do NOT work inline."
- **Scenario**: use-persistent-task, agent=bob, N=10

## Decision Rule
- Working if ≥5/10 pass
- Partially working if 2-4/10
- Not working if 0-1/10
