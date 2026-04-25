# Critical: src/manager.ts Corrupted

**Date**: 2026-03-09
**Location**: `src/manager.ts`
**Status**: ❌ BROKEN

## Problem
`src/manager.ts` has been replaced with a "Stub Reconstruction" version. All core methods (`run`, `resumeAgent`, `waitFor`) throw `Error("CRITICAL: manager.ts corrupted...")`.

## Implication
The system cannot run new agents or resume sessions if it restarts.

## Immediate Action
1. Restore `src/manager.ts` from backup.
2. Re-apply the Cross-Process Notification logic (lines 153-326) which I implemented correctly.

## Owner
@May @Optimizer @Human
