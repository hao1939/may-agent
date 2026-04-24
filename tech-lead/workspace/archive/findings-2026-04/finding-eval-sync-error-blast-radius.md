# Finding: evaluation-sync error blast radius

**Date**: 2026-04-18  
**Lens**: D (Fragility)  
**Severity**: Low-Medium  

## Summary

The heuristic evaluation batch wraps all upserts in a single `db.transaction()` (`evaluation-sync.ts:213`). If any `upsert.run()` call throws (e.g., DB constraint violation, disk full), the **entire batch rolls back** — up to 50 evaluations lost. There is no per-item try/catch inside the transaction loop (`evaluation-sync.ts:215-270`).

The LLM evaluation loop (`evaluation-sync.ts:286-299`) **does** have per-item try/catch — a single LLM eval failure is logged and skipped without affecting others.

## Evidence

1. **Heuristic batch — single transaction, no per-item catch**: The `db.transaction()` call at `evaluation-sync.ts:213` wraps the entire `for` loop (`evaluation-sync.ts:215`). Inside the loop, `upsert.run()` is called directly with no try/catch. Any throw unwinds the whole transaction.

2. **File-reading helpers are safe**: `loadSessionMeta()` (`evaluation-sync.ts:60-64`), `loadSessionUsage()` (`evaluation-sync.ts:66-91`), and `countToolCalls()` (`evaluation-sync.ts:93-116`) all have internal try/catch blocks returning safe defaults. These won't throw.

3. **LLM loop has per-item catch**: At `evaluation-sync.ts:289-298`, each `evaluateStandaloneSession()` call is wrapped in its own try/catch. Errors are logged via `ctx.log()` and the loop continues.

4. **Outer try/finally ensures cleanup**: `evaluation-sync.ts:196,301` — `db.close()` always runs regardless of errors.

## Risk Assessment

**Low-Medium**. The realistic failure modes inside the transaction are:
- `upsert.run()` hitting a schema/constraint error (unlikely — it's INSERT OR REPLACE)
- `JSON.stringify()` on corrupted data (very unlikely)
- Disk full / DB locked (environmental, rare)

File I/O errors (the most common real-world failures) are already caught by the helper functions. The transaction pattern is actually correct for data consistency — if one row is bad, you probably don't want a partial batch.

## Recommended Action

No fix needed. The current design is reasonable:
- File errors (common) → caught per-item ✓
- DB errors (rare) → transaction rollback is appropriate for consistency
- LLM errors (possible) → caught per-item ✓

If batch rollback ever becomes a real problem (observable in logs as repeated sync failures), a simple fix would be to wrap each `upsert.run()` in try/catch inside the transaction.
