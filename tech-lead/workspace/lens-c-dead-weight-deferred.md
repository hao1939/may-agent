# Lens C: Dead Weight — Deferred (P3) Section

**Date**: 2026-04-19  
**Scope**: `agents/tech-lead/workspace/todo.md:44-53`, `agents/shared/protocols/`

## Finding 1: Most "Blocked on Source Access" blockers are now resolved

The deferred section (`todo.md:44`) lists 6 items blocked on source access. Current status:

| Item | Referenced File | Actual Path | Accessible? |
|------|----------------|-------------|-------------|
| Coach growth-cycle reliability (`todo.md:48`) | manager.ts | `src/lib/manager.ts` | ✅ Yes |
| meta.json cost tracking (`todo.md:49`) | PersistedSession | `src/lib/manager.ts` | ✅ Yes |
| Gym Evolution Dual-Score (`todo.md:50`) | gym runner | **Not found anywhere in src/** | ❌ No |
| Fix gym/oneshot agent registration (`todo.md:51`) | may.ts | `src/app/may.ts` | ✅ Yes |
| Gym Convention Compliance Testing (`todo.md:52`) | gym-runner.ts | **Not found anywhere in src/** | ❌ No |
| Evaluator→lessons dead path fix (`todo.md:53`) | evaluator.ts | `src/lib/evaluator.ts` | ✅ Yes |

**4 of 6** source-access blockers are now resolved. The 2 gym-related items remain genuinely blocked (no `gym-runner.ts` exists in the codebase).

## Finding 2: Non-blocked deferred items are pure noise

Items at `todo.md:45-47` (SIGNALS.md removal, graph_nav/CodeCompass, MAST Failure Codes) are struck-through with no clear blocker resolution path. They add visual clutter with no actionable value.

## Finding 3: `agents/shared/protocols/` directory does not exist

The directory simply doesn't exist on disk. References to it appear only in `.lab/` experiment files (archived/inactive experiments), not in any active agent configuration. No dead-weight concern — there's nothing to clean up.

## Severity: Low

The deferred section is 10 lines of noise. It doesn't break anything, but 4 items are mislabeled as blocked when they're actually actionable.

## Recommended Action (separate session)

1. **Unblock 4 items**: Remove "blocked on source access" label for manager.ts, may.ts, evaluator.ts items; re-evaluate whether they're still worth doing.
2. **Remove 3 noise items**: Delete SIGNALS.md, graph_nav, MAST items — indefinitely deferred with no resolution path.
3. **Keep 2 gym items**: Gym-runner genuinely doesn't exist in codebase; keep deferred or drop.
