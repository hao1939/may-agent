# Iteration Loop Bug Report

**Date**: 2025-01-31
**Project**: system-efficiency
**Issue**: Worker keeps being dispatched to a completed project

## Summary

The system-efficiency project has been **done** since ~iteration 10. The worker has now been dispatched 30+ times to a completed project. Something in the orchestration layer resets project status to "active" between iterations or fails to check status before dispatching.

## Evidence

- All 3 metrics at target
- All plan items checked off
- 80+ output files produced
- 5 satellites spawned
- project.md status set to "done" (verified multiple times)
- Iterations 7-30+ all received identical "project is done, stop dispatching" guidance

## Root Cause Hypothesis

The workflow infrastructure either:
1. Resets `**Status**: done` back to `active` between iterations
2. Does not check project status before dispatching work
3. Has a stuck loop that ignores the done state

## Recommendation

Fix the orchestration layer to respect project status = "done" and stop dispatching iterations.
