# Finding: Coach High-Op Sessions — Flow Analysis

**Date**: 2026-04-18  
**Lens**: B (Flow Complexity)  
**Severity**: Medium — systematic waste pattern, not a one-off

## Summary

The two highest-op coach sessions in the last 6h (57 ops and 49 ops) both exhibit the same anti-pattern: **debugging gym infrastructure** consumes 70-80% of ops, while actual task-productive work (writing deliverables, scenario files) is <20%.

## Session 1: `s_1776515111675_166` — 57 ops (metric-reaction scenario)

**Task**: Complete metric-reaction scenario and run baseline.

**Op breakdown** (65 tool calls total, 57 counted as ops):
- **Productive** (scenario authoring): ~8 ops — `read` scenario files (ops 1-3), `write` scenario.json/task.md/package.json (ops 5-7), `write` baseline results (op 58)
- **Overhead/debugging**: ~49 ops — gym-batch debugging loop:
  - Ops 9-16: Ran gym-batch, then hunted through `/tmp/gym-*` dirs to find results (`session.jsonl:line varies`)
  - Ops 17-39: Deep-dived into `scripts/gym-run.sh` and `test/gym/gym-runner.ts` trying to understand how environments get copied, how scoring works (`scripts/gym-run.sh:47-62`, `test/gym/gym-runner.ts:420-445,590-620,1055-1120`)
  - Ops 40-56: Repeated batch runs + DB queries checking trial results — 5 separate `bun -e` DB queries in a row (ops 52-56)
- **Verification/git**: ~6 ops (ops 59-64)
- **finish**: 1 op

**Waste ratio**: ~75% overhead (49/65 tool calls spent debugging gym infra, not writing the scenario)

## Session 2: `s_1776518709125_231` — 49 ops (use-persistent-task scenario)

**Task**: Fix broken gym scenario scoring.

**Op breakdown** (57 tool calls, 49 counted as ops):
- **Productive**: ~10 ops — reading existing scenarios (ops 1-6), writing success_criteria.js (op 28)
- **Overhead/debugging**: ~39 ops — **4 separate fix-run-check cycles** for success_criteria.js:
  - Cycle 1 (ops 16-18): batch run → DB check → failure
  - Cycle 2 (ops 29-34): rewrite success_criteria.js → batch run → failure  
  - Cycle 3 (ops 41-43): rewrite again → batch run → failure
  - Cycle 4 (ops 48-51): rewrite again → batch run → finally works
  - Between cycles: reading `gym-score-utils.cjs:250-350` to understand scoring API (ops 39-47)
- **finish attempts**: 3 (ops 52, 54, 57) — first two finish() calls were followed by more work

**Waste ratio**: ~68% overhead (39/57 tool calls in retry loops)

## Root Cause

Both sessions share the same root cause: **coach is working against unfamiliar gym infrastructure**. The gym-run/gym-batch scripts, scoring API (`gym-score-utils.cjs`), and sandbox layout are poorly documented, forcing the agent into trial-and-error loops.

Specific drivers:
1. **No gym API docs in coach's context** — coach reads `gym-score-utils.cjs:250-350` mid-session to learn the scoring API
2. **Opaque batch output** — results end up in random `/tmp/gym-*` dirs; coach spends ops hunting for them (`session.jsonl` lines in `/tmp/gym-run-3L72Jk/`, `/tmp/gym-batch-MFjV80/`, etc.)
3. **success_criteria.js API mismatch** — coach rewrote the scoring file 4 times because it didn't know the expected API shape

## Recommended Actions (do NOT implement now)

1. **Add gym-authoring cheatsheet** to `agents/coach/context.md` — 5-line summary of: how to write success_criteria.js (expected exports, available helpers from gym-score-utils.cjs), where batch results land, how to check scores via DB
2. **Standardize batch output location** — make `gym-batch.sh` print the results.jsonl path to stdout so agents don't need to `find /tmp/gym-*`
3. **Consider delegating gym scenario work to coder** — coach's expertise is coaching methodology, not JS/infra debugging. The 4-cycle rewrite loop in session 2 is a task-agent mismatch.
