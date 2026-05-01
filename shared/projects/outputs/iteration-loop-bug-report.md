# Iteration Loop Bug Report

**Date**: 2025-01-XX
**Project**: system-efficiency
**Issue**: Project keeps being re-dispatched despite "done" status

## Summary

The system-efficiency project has been complete since ~iteration 10. Despite project.md status being set to "done" (verified on line 3), the orchestration layer continues dispatching iterations (now at 24+).

## Root Cause Hypothesis

Something in the workflow/orchestration layer either:
1. Resets `**Status**: done` back to `active` between iterations
2. Ignores the status field when deciding whether to dispatch work
3. Has a stale cache of project status

## Evidence

- All 3 metrics at target since iteration ~6
- Closure documents produced at iteration 6
- Status explicitly set to "done" and verified multiple times
- Iterations 7-24+ all receive the same "project is done, stop dispatching" guidance

## Recommendation

The orchestrator should check `project.md` status field before dispatching and skip projects with status "done".
