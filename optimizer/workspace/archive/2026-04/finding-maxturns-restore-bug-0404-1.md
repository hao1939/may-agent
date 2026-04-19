# Finding: maxTurns Lost on Process Restart — Sessions Run Without Limits

**Date**: 2026-04-04
**Status**: FIXED (2 commits: f7374ed + new RESTORED_MAX_TURNS_FALLBACK)
**Impact**: All restored sessions lose their turn limit after process restart, running unbounded

## Evidence

1. **optimizer session s_1775277916508_2**: 104 ops — should have been limited to 40 turns
2. **optimizer session s_1775288719514_12**: 268+ ops, UNLIMITED — confirmed via meta.json
3. **may session s_1774796644661_0**: 1988+ ops, UNLIMITED — burning tokens without limit
4. After fix deployed in bundle 28f1912: NEW sessions correctly get `maxTurns=40` in meta.json
5. OLD sessions (created before fix) remain unlimited — `persisted.maxTurns ?? 0` = unlimited

## Root Cause

Two-part bug:

### Part 1 (FIXED in f7374ed): maxTurns not persisted
- maxTurns wasn't in PersistedSession interface
- Never saved to meta.json on session creation
- On restore: hard-coded `maxTurns: 0` (unlimited)

### Part 2 (NEW FIX): Old sessions without persisted maxTurns get 0
- Even after Part 1 fix, old meta.json files don't have maxTurns
- `persisted.maxTurns ?? 0` = 0 = unlimited for all pre-fix sessions
- These sessions keep getting restored on each restart, staying unlimited forever

## Fix

### Part 1 (commit f7374ed — DEPLOYED in bundle 28f1912)
- Added `maxTurns?: number` to PersistedSession interface
- Save maxTurns in session creation: `maxTurns: session.maxTurns || undefined`
- Restore from persisted value

### Part 2 (NEW — manager-utils.ts + manager.ts)
```typescript
// manager-utils.ts
export const RESTORED_MAX_TURNS_FALLBACK = 40;

// manager.ts — restore path
maxTurns: persisted.maxTurns ?? RESTORED_MAX_TURNS_FALLBACK,  // Was: ?? 0
```

This ensures old sessions without persisted maxTurns get the standard 40-turn limit instead of unlimited.

## Verification (2026-04-04)

- New sessions (scout, qa, coach) created by current bundle: `maxTurns=40` in meta ✅
- 7 old sessions still running unlimited — will be fixed by Part 2 on next restart
- `npx tsc --noEmit` — no errors from my changes
