# Audit: Orphaned Test Files After Dead Code Removal

**Date**: 2026-04-12  
**Objective**: Find test files testing deleted modules from the dead code removal sprint (~4,800 lines removed).

## Modules Deleted in Sprint
- `src/lib/forced-externalization.ts` — confirmed DELETED
- `src/lib/stuck-detector.ts` — confirmed DELETED
- `src/lib/socket-watch.ts` — confirmed DELETED
- Memory JSONL system (writer, reader, subscriber) — confirmed DELETED
- Functions: `writeSkippedEvaluations`, `writeHeuristicEvaluations`, `computeHeuristicScores`, `detectFrustrationSignals` — confirmed DELETED from evaluator.ts

## Search Methodology
1. `find test/ -name "*.test.ts" | xargs grep -l` with patterns for all deleted modules
2. `grep -r "from.*<deleted-module>"` for direct imports from deleted paths
3. `find test/ -name "*<deleted-module>*"` for test files named after deleted modules
4. Cross-checked all import paths in test/ against existing source files

## Results: No Orphaned Test Files Found ✅

### False Positives Investigated

| Test File | Match Reason | Verdict |
|-----------|-------------|---------|
| `test/coach-setup.test.ts` | `expect(tools).not.toContain("socket-watch")` | Negative assertion — tests coach DOESN'T have deleted tools. **Keep.** |
| `test/agent-growth.test.ts` | Matched `agent-growth` pattern | Tests `src/lib/growth.ts` + `src/lib/tools/agent-growth.ts` — both still exist. **Keep.** |
| `test/session-digest-classify.test.ts` | Matched `stuck_detect` | Tests `classifyDigest()` with `"stuck_detected"` trigger string — function still exists. **Keep.** |
| `test/session-digest-switchover.test.ts` | Matched `stuck_detect` | Same — uses `"stuck_detected"` as trigger parameter value. **Keep.** |

### Additional Checks
- No test files import from `forced-externalization`, `stuck-detector`, `socket-watch`, or memory JSONL paths
- No test files named after any deleted module
- All import paths in test/ resolve to existing source files
- `opBudget` still exists in `src/lib/manager.ts` (5 references) — `test/operation-budget.test.ts` is NOT orphaned

## Conclusion
The dead code removal sprint was clean — test files for deleted modules were either:
1. Already removed during the sprint, or
2. Never existed (the deleted modules may not have had dedicated test files)

**No cleanup action needed.**
