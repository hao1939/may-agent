# Iteration Loop Diagnostic

**Date**: 2025-01-XX
**Issue**: system-efficiency project keeps receiving iterations despite being "done"

## Problem
This project has received 20+ iterations after completion. The project status is set to "done" in project.md, yet the orchestrator continues dispatching work to it.

## Root Cause Hypothesis
The workflow/orchestrator that dispatches iterations is not checking project status before dispatching, or the status check is racing with the dispatch.

## Recommendation
The orchestrator should:
1. Check `project.md` status field before dispatching
2. If status == "done", skip and move to next active project
3. Do NOT dispatch "CONTINUE" to done projects

## Project Final State
- All 3 metrics at target
- 80+ output files produced
- 5 satellites spawned
- Status: done (verified in project.md line 3)
