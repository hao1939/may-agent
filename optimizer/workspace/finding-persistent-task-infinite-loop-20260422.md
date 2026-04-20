# Finding: Persistent Task Infinite Loop — Workflow-First Project

**Date**: 2026-04-22
**Severity**: HIGH (500+ ops wasted)

## Problem

The workflow-first persistent task entered an unrecoverable loop:
1. Evaluator scores against goal "80% workflow coverage"  
2. Worker correctly identifies this requires infra changes (binary writing workflowRunId)
3. Evaluator rejects → owner re-dispatches → worker explains again → repeat

This burned 500+ ops across 15+ iterations in the last 12 hours, with individual sessions hitting 109, 85, 62 ops.

## Root Cause

The persistent-task workflow has no **stuck detection**. When a task is genuinely blocked on external dependencies, it keeps re-iterating forever. The evaluator's goal doesn't account for "blocked on infra."

## Fix Applied

Paused the project (`Status: paused`) to stop immediate bleeding.

## Recommended Systemic Fix

The persistent-task workflow needs a hard cap: if 3+ consecutive iterations produce BLOCKED/DONE outcomes with no milestone progress, auto-pause. This should be a tech-lead fix.

## Impact

- **Saved**: ~200 ops/hour going forward (was iterating every ~20 min)
- **Agent**: tech-lead was the primary victim (dispatched as worker)
