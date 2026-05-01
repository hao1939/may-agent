# Iteration Loop Bug Report

**Date**: 2025-01-22
**Project**: system-efficiency
**Issue**: Orchestration keeps dispatching iterations to a completed project

## Summary

The system-efficiency project has been complete since ~iteration 7. The project status was set to "done" in project.md (line 3: `**Status**: done`). Despite this, the orchestration layer has dispatched 22+ iterations to this project.

## Evidence

- Iterations 7-22 all contain the message "No further iterations should be dispatched"
- Project status verified as "done" multiple times
- All 3 metrics at target, all plan items complete, 80+ output files produced

## Root Cause Hypothesis

The workflow/orchestration layer likely:
1. Reads project status before it's been updated in the current cycle, OR
2. Has a cached/stale view of project status, OR
3. Does not check project status before dispatching iterations

## Recommendation

The orchestration layer should check `project.md` status field before dispatching iterations. If status is "done", skip the project entirely.
