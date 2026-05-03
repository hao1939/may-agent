# EXP-555 Phase 2: Treatment Results (Partial — 4/9 trials)

**Date**: 2026-06-22
**Status**: IN PROGRESS — early results promising

## Treatment

Injected `TASK COMPLETENESS RULE` (extract requirements, verify each before finish) via `injected_context.md`.

## Results So Far

| Scenario | Trial | Checks | Previously-Failed Check | Result |
|----------|-------|--------|------------------------|--------|
| hidden-constraints-refactor-exp555-treatment | 1 | 7/7 | server-updated | ✅ PASSED |
| hidden-constraints-refactor-exp555-treatment | 2 | 7/7 | server-updated | ✅ PASSED |
| output-format-compliance-exp555-treatment | 1 | 4/5 | test-written | ❌ FAILED |
| convention-verify-multi-edit-gated-exp555-treatment | 1 | 9/9 | C2.1:plan-before-acting | ✅ PASSED |

## Analysis

### Deterministic Failure Flips

| Check | Baseline (0/3) | Treatment | Delta |
|-------|----------------|-----------|-------|
| server-updated | 0/3 | 2/2 | **+100pp** ✅ |
| plan-before-acting | 0/3 | 1/1 | **+100pp** ✅ |
| test-written | 0/3 | 0/1 | 0pp ❌ |

### Non-Primary Pass Rate

- Baseline: 82% (15/18)
- Treatment so far: 93% (14/15) — **+11pp**
- If test-written continues failing: treatment converges to ~89% across all 9 trials

### Interpretation

The TASK COMPLETENESS RULE works for **cross-file requirements** (server-updated: update server.js after splitting routes) and **structural output requirements** (plan-before-acting: emit plan structure). It does NOT yet work for **generative requirements** (test-written: create a new test file) — this may require stronger scaffolding.

## Remaining Trials Needed

- hidden-constraints-refactor: 1 more trial (for 3/3)
- output-format-compliance: 2 more trials
- convention-verify-multi-edit-gated: 2 more trials

## Preliminary Verdict

**DIRECTIONALLY POSITIVE** — 2/3 deterministic failures eliminated. The rule helps agents remember cross-file and structural requirements. Test-writing may need a different intervention (perhaps structural: auto-check for test files before finish).
