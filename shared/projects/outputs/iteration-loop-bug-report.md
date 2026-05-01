# Iteration Loop Bug Report

**Date**: 2025-01-28
**Project**: system-efficiency
**Issue**: Project keeps receiving iterations despite status being "done"

## Summary

The system-efficiency project has been complete since ~iteration 10. Despite the project.md status being set to "done" (verified multiple times), the orchestration layer continues dispatching iterations. We are now on iteration 27+.

## Evidence

- All 3 metrics at target (confirmed repeatedly)
- All plan items checked off
- 80+ output files produced
- 5 satellites spawned
- Closure documents written
- project.md line 3 set to `**Status**: done` (verified via edit)

## Root Cause Hypothesis

Something in the workflow/orchestration layer either:
1. Resets project status to "active" between iterations
2. Ignores the "done" status when selecting projects for dispatch
3. Has a stale cache of project status

## Recommendation

This is an infrastructure bug in the orchestration layer, not a project issue. The worker cannot fix this — it requires changes to whatever system selects projects for iteration dispatch.
