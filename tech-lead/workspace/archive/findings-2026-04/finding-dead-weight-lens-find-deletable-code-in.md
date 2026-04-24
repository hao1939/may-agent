# Dead Weight: agents/shared/ deletable code

**Date**: 2025-07-21  
**Scope**: agents/shared/workflows/, agents/src/lib/finish-guard.ts

## Finding 1: persistent-task.ts alias (DELETE)

**File**: `agents/shared/workflows/persistent-task.ts` (3 lines)  
**Severity**: Low — pure dead weight, no runtime impact

This file is a re-export alias pointing to `project.ts` (`persistent-task.ts:2-3`). The workflow runtime resolves workflows by filename, so `persistent-task` as a workflow name still works only if this file exists. However:

- The `"persistent-task"` string is **hardcoded in finish-guard.ts** at `agents/src/lib/finish-guard.ts:298` and `:309`, inside `validatePersistentTaskEnforcement()`.
- That function is **never called** outside finish-guard.ts — zero callers across the entire `agents/` tree (grep confirmed).
- The REGISTRY still lists it (`agents/shared/workflows/REGISTRY.md:14`) but only as documentation.

**Action**: Delete `persistent-task.ts`. Remove the REGISTRY entry at line 14.

## Finding 2: FM-3.4 persistent-task enforcement in finish-guard.ts (TRIM)

**File**: `agents/src/lib/finish-guard.ts:251-325` (~75 lines)  
**Severity**: Medium — dead exported functions bloating a shared library

The entire "Gate 3" section (`validatePersistentTaskEnforcement`, `enforcePersistentTaskWorkflow`, `PersistentTaskEnforcementParams`, `PersistentTaskEnforcementResult`) is **exported but never imported** by any other file. This is vestigial from an abandoned enforcement experiment.

**Action**: Delete lines 251-325 of `finish-guard.ts` and remove the exports.

## Finding 3: archive/implement-and-review.ts (DELETE)

**File**: `agents/shared/workflows/archive/implement-and-review.ts` (163 lines)  
**Severity**: Low — archived, zero non-.lab references

This workflow was superseded by `implement-and-verify.ts`. All remaining references are in `.lab/` experiment snapshots (frozen-in-time, not live code).

**Action**: Delete `agents/shared/workflows/archive/implement-and-review.ts`.

## Summary

| # | File | Lines | Action |
|---|------|-------|--------|
| 1 | `agents/shared/workflows/persistent-task.ts` | 3 | Delete |
| 2 | `agents/src/lib/finish-guard.ts:251-325` | ~75 | Trim |
| 3 | `agents/shared/workflows/archive/implement-and-review.ts` | 163 | Delete |

**Total deletable**: ~241 lines across 3 files.

## Follow-up

- After deleting persistent-task.ts, update `agents/shared/workflows/REGISTRY.md:14` to remove the entry.
- Verify `agents/test/finish-guard.test.ts` doesn't test the Gate 3 functions (if it does, remove those tests too).
