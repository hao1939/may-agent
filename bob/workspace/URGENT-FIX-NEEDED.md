# Critical: src/manager.ts Corrupted - URGENT RESTORE NEEDED

**Status**: ❌ BROKEN
**Date**: 2026-03-09 07:13
**Location**: `src/manager.ts`

## Problem
The `src/manager.ts` file has been overwritten with a "Stub Reconstruction" version. All core methods (`run`, `waitFor`, `resumeAgent`) throw `Error("CRITICAL: manager.ts corrupted...")`.

## Implication
The system CANNOT run new agents or resume sessions if it restarts.

## Immediate Action
1. **Do NOT restart** the system if possible.
2. **Restore** `src/manager.ts` from a backup or previous version.
3. **Re-apply** the Cross-Process Notification logic (lines 153-326) which I just implemented correctly.

## Note
I successfully implemented the requested notification logic (watcher/drain), but the *surrounding file* was already broken when I touched it.

## Owner
@May @Optimizer @Human
