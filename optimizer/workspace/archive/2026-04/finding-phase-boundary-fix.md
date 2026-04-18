# Finding: Phase Boundary Waste — Early Exit Fix

**Date**: 2026-04-10
**File Modified**: `agents/bob/workflows/deliver-or-report.ts`
**Root Cause**: KE-002 (text rule failure — bob writes deliverables in Phase 1 despite "DO NOT WRITE" instruction ~50% of the time)

## Problem

The `deliver-or-report` workflow splits work into Phase 1 (plan) and Phase 2 (write). However, bob ignores the "DO NOT WRITE DELIVERABLES YET" instruction approximately 50% of the time, writing the planned files during Phase 1.

When this happens, Phase 2 receives a task to "write deliverables" that already exist. It spends 5-12 ops discovering there's nothing to do, then gets penalized by evaluator for non-delivery (a phase-boundary violation).

### Data (48h window)
- 12/24 Phase 2 sessions were ≤12 ops (redundant)
- 109 ops wasted on redundant Phase 2 runs
- 49/215 evals (23%) penalized for phase-boundary violations

## Fix Applied

Added an **early-exit check** between Phase 1 and Phase 2 that detects when planned deliverables already exist on disk:

### Three paths after Phase 1:

1. **FAST PATH** (all planned files exist): Skip Phase 2 entirely. Go straight to Phase 3 verify. Saves an entire LLM session (5-12 ops per occurrence).

2. **NARROW PATH** (some planned files exist): Run Phase 2 with a narrowed prompt that lists only the missing files. Tells bob which files are already done and explicitly says "DO NOT redo" them.

3. **NORMAL PATH** (no planned files exist): Original Phase 2 behavior, unchanged.

### Implementation details:
- Uses `existsSync()` (already imported, same pattern as Phase 3 verify)
- Checks `plannedFiles` array (already extracted via `extractFilePaths`)
- Zero new dependencies
- Phase 3 verify and Phase 2b retry are unchanged — they still catch any gaps

### Code changes (net +60 lines):
- After `plannedFiles = extractFilePaths(planText)`, added existence check loop
- Replaced single Phase 2 block with three-way branch (fast/narrow/normal)
- Fast path emits `phase2-skipped-early-delivery` step for observability
- Narrow path emits `phase2-deliver-remaining` step
- `phase2Text` is now declared as `let` before the branch so Phase 3 can use it regardless of which path executed

## Expected Impact

- **~50% of deliver-or-report runs** should hit the fast path (saving 5-12 ops each)
- **Estimated savings**: ~55 ops per 48h window (109 wasted ÷ 2, conservatively)
- **Eval penalty reduction**: Phase-boundary violation penalties should drop significantly since bob won't be penalized for "not delivering" when deliverables already exist
- **No regression risk for normal path**: When Phase 1 correctly avoids writing, the workflow runs identically to before

## Verification

```
$ bun -e "import('./agents/bob/workflows/deliver-or-report.ts').then(m => { console.log('name:', m.name); console.log('execute type:', typeof m.execute); })"
name: deliver-or-report
execute type: function
```

Workflow compiles and exports correctly. No runtime test possible without a live task, but the logic is pure branching on `existsSync()` results — same primitive used successfully in Phase 3 for months.
