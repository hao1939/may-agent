# Finding: Bob 72-op EXP-173 Session Analysis

**Date**: 2026-04-16  
**Session**: s_1776358364254_320 (bob, 72 ops, ~27min)  
**Mode**: C — Skill & Technique Scouting  
**Quality**: 0.72 | **Efficiency**: 0.55 | **Verdict**: acceptable

## Task Summary

Bob executed EXP-173: a 6-arm experiment (A-F) on the cascading-fix-trap-v2 scenario testing which properties of expert analysis cross the recognition threshold. Required creating scenario variants, running controls, then full arms with N=15 per arm (95 total trials across 7 conditions).

## Key Inefficiency Patterns

### 1. Path Mismatch (Failure Chain 1)
Bob attempted `tests/scenarios/` (nonexistent) before discovering actual location under `agents/gym/scenarios/`. This is a recurring bob pattern — guessing paths before checking. Multiple wasted calls.

**Reusable fix**: Bob's context.md should include the canonical gym scenario path.

### 2. Failed DB Query (Failure Chain 2)
Attempted a bun:sqlite query against `.state/may.db` but hit an error and moved on without fixing. Wasted ops on an abandoned thread.

### 3. Repeated Grep Failures (Failure Chain 4)
Multiple grep searches returning exit code 2 / no output, repeated across scripts without tightening the hypothesis or reading files directly first.

**Reusable fix**: After 2 failed greps on same topic → switch to direct file read.

### 4. Deliverable Claim Mismatch
`git commit` showed only 1 file changed (results.md) even though finish() claimed multiple new scenario directories. Evidence gap between claimed and verified deliverables.

## What Drove the High Op Count

The 72 ops are mostly justified by the task scope: creating 4+ scenario variants and running ~95 gym trials across 7 conditions is legitimately expensive. The ~27min runtime confirms heavy gym execution.

**Estimated breakdown**:
- ~10 ops: Path discovery + file reading (3-5 wasted on wrong paths)
- ~15 ops: Scenario variant creation (4 arms × file writes)
- ~40 ops: Gym runs (~95 trials, batch execution)
- ~7 ops: Results aggregation + commit

## Verdict

**72 ops is largely justified** for a 95-trial experiment. The inefficiency (~5-8 wasted ops) came from path guessing and abandoned investigative threads. Efficiency would improve to ~64 ops with:
1. Correct path in context.md (saves ~3 ops)
2. Grep-fail-to-read escalation habit (saves ~2-3 ops)

## Recommendations

1. **Push canonical paths to bob/context.md**: `agents/gym/scenarios/` not `tests/scenarios/`
2. **Grep failure rule**: After 2 failed greps → read the file directly
3. **No structural intervention needed**: The high op count is task-appropriate, not a workflow problem
