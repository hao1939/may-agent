# Cleanup: research-db.ts Dead Code Removal

**Date**: 2026-04-13
**Session**: s_1776063173431_38
**Branch**: review/s_1776063173431_38-dead-code-removal
**Status**: On review branch, pending merge

## What Was Removed

Three exported query functions from `src/lib/research-db.ts` that had **zero external consumers**:

| Function | Lines | Purpose |
|----------|-------|---------|
| `queryKnowledge(db, search)` | ~15 | LIKE search across knowledge_entries |
| `getExperimentsByStatus(db, status)` | ~12 | Filter experiments by status |
| `getHypothesesByStatus(db, status)` | ~12 | Filter hypotheses by status |

Also removed:
- The `// ── Query Functions ──` section comment
- Corresponding test `describe` blocks in `test/research-db.test.ts`
- One integration test (`"can query real knowledge entries by keyword"`) that used `queryKnowledge`
- Imports of the 3 removed functions from the test file

## What Was Kept

- `syncKnowledgeEntries()` — used by `syncAll()`
- `syncHypotheses()` — used by `syncAll()`
- `syncExperiments()` — used by `syncAll()`
- `syncAll()` — called by `agents/may/handlers/research-sync.ts`
- All internal helpers (extractField, extractH1, extractSection, extractKeId, etc.)

## Evidence

- `grep -rn 'research-db' src/ --include='*.ts' | grep -v 'research-db.ts'` → **empty** (no external src consumers)
- Only external import: `agents/may/handlers/research-sync.ts` imports `syncAll` only
- `npm run check` → exit 0 (TypeScript clean)
- `vitest run test/research-db.test.ts` → 17 passed, 1 failed (pre-existing: integration test error threshold too tight at ≤5, now 6 errors from growing knowledge base — not related to this change)

## Impact

- Reduced `research-db.ts` from ~455 to 401 lines (54 lines removed)
- Reduced `research-db.test.ts` by 59 lines
- No behavioral change — removed functions were never called
