# Iteration Loop Bug Report

**Date**: 2025-01-28
**Project**: system-efficiency
**Issue**: Worker keeps being dispatched to a completed project

## Summary

The system-efficiency project has been **done** since approximately iteration 10. Despite the project status being set to "done" in project.md (verified multiple times), the orchestration layer continues dispatching iterations. We are now at iteration 25+.

## Evidence

- All 3 metrics at target
- All plan items complete
- 80+ output files produced
- 5 satellites spawned
- Status line in project.md verified as `**Status**: done`
- Iterations 7-25 have all been no-ops with the same "redirect worker" message

## Root Cause Hypothesis

Something in the workflow/orchestration layer resets the project status to "active" between iterations, or does not check status before dispatching work.

## Recommendation

Stop dispatching iterations to this project. Redirect the worker to other active projects.
