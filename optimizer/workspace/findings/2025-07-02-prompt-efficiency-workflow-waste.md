# Finding: prompt-efficiency Project Spawned 15 Failing Workflow Runs

**Date**: 2025-07-02
**Severity**: P1
**Status**: FIXED

## Problem
The `prompt-efficiency` project had owner set to `optimizer (system-efficiency satellite)` — an invalid agent name. The project cron repeatedly tried to dispatch workflow runs using this name, generating **15 consecutive error runs** in `.state/workflow-runs/`, all with `"status": "error"` and empty steps.

## Impact
- 15 wasted workflow runs × ~40s each = ~10 min compute
- Polluted workflow-runs directory
- Project iteration stuck at 0 despite actual progress being made

## Fix
Changed owner from `optimizer (system-efficiency satellite)` to `optimizer` in `agents/shared/projects/prompt-efficiency/project.md`.

## Prevention
Project owner field should be validated against known agent names when projects are created or updated.
