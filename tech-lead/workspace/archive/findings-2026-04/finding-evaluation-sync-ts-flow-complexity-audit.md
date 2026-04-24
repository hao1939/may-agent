# Finding: evaluation-sync.ts Flow Complexity Audit

**Target**: `agents/may/handlers/evaluation-sync.ts` (404 LOC)
**Date**: 2026-04-16
**Lens**: B — Flow complexity

## Summary

The handler is moderately complex but well-structured. It has **3 major phases** (migration, heuristic batch, LLM sampling) executed sequentially, with ~8 decision branches total. The recently-added `evaluateStandaloneSession()` sampling path integrates cleanly. Main concerns are: (1) the migration check runs every invocation despite being a one-time operation, and (2) error handling in the LLM sampling loop silently swallows failures.

## Findings

### F1: Migration check runs every invocation (Severity: Low)

**Evidence**: Lines 200-218 — `SELECT COUNT(*) ... WHERE quality > 1.0 OR efficiency > 1.0` runs on every cron tick. This was a one-time migration from 1-5 → 0-1 scale. Once old-scale rows are gone, the query always returns 0 but still executes.

**Impact**: Minor performance waste. No correctness issue.
**Recommendation**: Add a flag file or config check to skip after first successful migration.

### F2: Heuristic logic does NOT duplicate evaluator.ts (Severity: None — Non-finding)

**Evidence**: `computeEvaluation()` (lines 120-190) is a simple waste-ratio + status-based scorer. `evaluator.ts:evaluateStandaloneSession()` (line 795+) spawns an actual LLM evaluator agent with transcript analysis. Completely different approaches — heuristic is O(1) file reads, LLM is a full agent session. No duplication.

### F3: Decision branch map — 8 branches, manageable (Severity: Low)

**Code paths through the handler**:
1. **Early exit**: `unevaluated.length === 0` → return (line ~237)
2. **No meta.json found** → minimal DB-only evaluation (lines 255-275)
3. **computeEvaluation** branches:
   - 3a: 0-op interrupted → skipped (line 133)
   - 3b: error status → needs_improvement (line 143)
   - 3c: shallow done (≤2 ops) → good (line 155)
   - 3d: high waste ratio → acceptable (line 178)
   - 3e: high op count → flagged (line 184)
   - 3f: default → good (line 168)
4. **LLM sampling**: random 30% filter + MAX_LLM_PER_RUN=5 cap (lines 300-340)

This is reasonable complexity for a batch evaluation handler. No unnecessary indirection.

### F4: evaluateStandaloneSession() integrates cleanly (Severity: None — Non-finding)

**Evidence**: Lines 300-340 — the LLM sampling section runs AFTER the heuristic transaction completes, iterates sampled sessions, calls `evaluateStandaloneSession()` from evaluator.ts, and logs results. It's a clean append to the handler — no interleaving with heuristic logic. The function handles its own DB writes internally (via `manager.run` + `manager.waitFor`). Error handling per-session with try/catch prevents one failure from blocking others.

### F5: Blast radius if handler throws (Severity: Medium)

**Evidence**: The handler is wrapped in a `try/finally` that calls `db.close()` (line 346). However, the LLM sampling section (lines 300-340) runs inside the try block but AFTER the heuristic transaction. If `evaluateStandaloneSession()` throws an uncaught error (unlikely given the per-session try/catch), the `finally` still closes DB. 

**Real risk**: If the DB operations in the heuristic phase throw (e.g., schema mismatch), the entire handler exits. The cron runner in `src/lib/cron-tool.ts` typically catches handler errors, so it shouldn't take down the cron cycle — but all 50 sessions in that batch would remain unevaluated until next tick.

**Recommendation**: Verify cron runner catches handler-level throws (likely already does).

### F6: Dead branch — evaluator skip comment but no code (Severity: Info)

**Evidence**: Line 128 — comment says "evaluator sessions are filtered out in the query (agent != 'evaluator') so we don't need a skip check here anymore." This is correct — the SQL WHERE clause at line 232 filters them. The comment documents a removed check, which is fine. No dead code, just a historical note.

## Severity Table

| # | Finding | Severity | Action |
|---|---------|----------|--------|
| F1 | Migration check runs every tick | Low | Add one-time flag |
| F2 | No duplication with evaluator.ts | None | — |
| F3 | 8 decision branches | Low | Acceptable complexity |
| F4 | LLM sampling integrates cleanly | None | — |
| F5 | Blast radius contained by finally + cron | Medium | Verify cron error handling |
| F6 | Historical comment, no dead code | Info | — |

## Non-Findings

- **No dead branches detected**: All code paths are reachable given the input space.
- **No unnecessary indirection**: Helper functions (loadSessionMeta, loadSessionUsage, countToolCalls, computeEvaluation) are single-use but cleanly separated.
- **Transaction usage is correct**: Heuristic batch runs in a transaction, LLM sampling runs outside (correctly, since it's async).
