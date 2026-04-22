# Finding: Metrics-Dashboard Ghost Workflow Loop Dragging workflow-effectiveness

**Date**: 2026-07-16  
**Severity**: P1  
**Metric Impact**: workflow-effectiveness 84.7% → ~97% (projected after fix)

## Problem

The `project` workflow cron keeps launching workflow runs for `agents/may/workspace/projects/metrics-dashboard` every ~5 minutes. Each run:
- Fails instantly (0 steps, 2ms duration)
- Status: `error`
- Agent: "Hao" (not a valid agent — project owner is human)
- Project status is **done** but cron doesn't check this

## Data

- **190 out of 198** recent project workflow errors are from metrics-dashboard
- In last 500 workflows: 310 real workflows with 8 real errors = **97.4% real effectiveness**
- Ghost errors inflate failure count, dragging metric from ~97% to 84.7%
- Two duplicate entries in `project-health-state.json` (with and without `.md` extension) — both firing

## Root Cause

1. `project-health-state.json` has `consecutiveSkips: 0` and `blockerHash: "0"` for metrics-dashboard entries
2. The project cron launches a `project` workflow for any entry not being skipped
3. The workflow fails immediately because agent "Hao" can't be dispatched
4. The error doesn't increment `consecutiveSkips`, so it retries forever

## Fix Applied

Set `consecutiveSkips: 293` and `blockerHash: "done-project"` for both metrics-dashboard entries in `project-health-state.json`. This matches the skip pattern used by other blocked/done projects.

## Recommended Structural Fix

The project health cron should:
1. Read the project file and check `Status: done` before launching
2. Skip projects where `owner` is not a valid agent
3. Increment `consecutiveSkips` on workflow errors (backoff)
