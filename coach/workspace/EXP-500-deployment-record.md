# EXP-500: Structural Read-Before-Edit — Deployment Record

**Date**: 2026-05-10
**Status**: DEPLOYED ✅
**Location**: `agents/shared/workflows/master-worker.ts` lines 423-448

## What Was Deployed

Pre-read injection for edit tasks targeting existing files. When a worker task mentions editing a specific file, the system automatically reads that file and injects its content into the worker's prompt before execution.

This is a **structural** intervention — agents don't need to remember to read before editing; the system does it for them.

## Baseline (Pre-Deployment)

- **Edit failure rate**: 15.4% (108/703 edit calls)
- **Session-level**: 48% of sessions (62/130) have ≥1 edit failure
- **Source**: `agents/coach/workspace/EXP-500-baseline-measurement.md`

## Target

- **Edit failure rate**: ≤7.7% (50% reduction)
- **Session-level**: ≤24% of sessions with ≥1 edit failure

## Measurement Plan

**When**: After 50+ worker sessions post-deployment (~2026-05-15)
**Method**: 
1. Sample edit() calls from post-deployment sessions
2. Count failures (oldText not found / file doesn't exist)
3. Compare to 15.4% baseline
4. Also measure: did pre-read fire? (look for "EXP-500: Pre-read injected" in logs)

**Success criteria**:
- Primary: edit failure rate ≤7.7%
- Secondary: pre-read injection fires on ≥50% of edit tasks
- Tertiary: no regression in session duration or quality

## Chain of Evidence

- KE-480: Text coaching dead for verification behaviors
- EXP-495: Write-first scaffold (NEGATIVE, 0% compliance) — confirms text can't change tool behavior
- EXP-500 baseline: 15.4% failure rate measured
- EXP-500 deployed: structural injection (no agent cooperation needed)
