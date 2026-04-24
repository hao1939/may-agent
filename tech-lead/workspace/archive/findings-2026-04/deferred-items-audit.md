# Deferred Items Audit — 2026-04-19

## Summary
6 of 9 deferred items in `todo.md:44-53` claimed "blocked on source access." 4 are now unblocked (files exist and are readable). 2 reference gym-runner.ts which doesn't exist as a .ts file. 3 items were never blocked on source access at all.

## Item-by-Item Assessment

### Not blocked on source (never were)
1. **SIGNALS.md removal** (`todo.md:45`) — "deferred for transition period." No source dependency. `agents/shared/SIGNALS.md` does not exist — may already be removed. **Status: Possibly obsolete.**
2. **graph_nav / CodeCompass tool** (`todo.md:46`) — "deferred per Bob." Design decision, not source access. **Status: Still deferred by design.**
3. **MAST Failure Codes** (`todo.md:47`) — "deferred" with no source dependency stated. **Status: Unclear blocker.**

### Unblocked (files now accessible)
4. **Coach growth-cycle reliability** (`todo.md:48`) — needs `src/lib/manager.ts`. File exists, 98KB, readable (`src/lib/manager.ts:1`). **Status: UNBLOCKED.**
5. **meta.json cost tracking** (`todo.md:49`) — needs PersistedSession type. Found at `src/lib/manager.ts:78` (imported from `./persistence.js`). **Status: UNBLOCKED.**
6. **Fix gym/oneshot agent registration** (`todo.md:51`) — needs `src/app/may.ts`. File exists, 46KB, readable (`src/app/may.ts:1`). **Status: UNBLOCKED.**
7. **Evaluator→lessons dead path fix** (`todo.md:53`) — needs `src/lib/evaluator.ts`. File exists, 39KB, readable (`src/lib/evaluator.ts:1`). **Status: UNBLOCKED.**

### Still blocked (file doesn't exist as expected)
8. **Gym Evolution Dual-Score Architecture** (`todo.md:50`) — needs "gym runner" source. No `gym-runner.ts` exists. Only `scripts/gym-run.sh` (shell script, 2.3KB). May need re-scoping to target the shell script or a different file. **Status: Partially blocked — wrong file reference.**
9. **Gym Convention Compliance Testing** (`todo.md:52`) — needs `gym-runner.ts`. Same issue — file doesn't exist. **Status: Partially blocked — wrong file reference.**

## Recommended Actions
- **Clean up todo.md**: Move items 4-7 out of the "Blocked on Source Access" section — they're unblocked.
- **Re-evaluate items 1, 3**: Check if SIGNALS.md removal is already done; clarify MAST blocker.
- **Re-scope items 8-9**: Update to reference `scripts/gym-run.sh` or identify the actual gym runner source.
