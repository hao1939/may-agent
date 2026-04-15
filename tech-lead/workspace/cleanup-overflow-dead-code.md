# Cleanup: overflow.ts Dead Code Removal

**Date**: 2026-04-15
**Branch**: `review/cleanup-overflow-dead-code`
**Lens**: C (dead weight)

## What Was Removed

| Item | Type | Lines | Reason |
|------|------|-------|--------|
| `extractProgress()` | exported function | ~65 | Zero production callers — never wired into manager.ts overflow handling |
| `redactArgs()` | private function | ~12 | Only used by `extractProgress` |
| `REDACT_KEYS` | private constant | ~14 | Only used by `redactArgs` |
| `import { extractKeyFacts }` | import | 1 | Only used by `extractProgress` |
| `import type { AgentMessage }` | import | 1 | Only used by `extractProgress` signature |
| `extractProgress` tests | 5 test cases | ~85 | Tests for removed function |
| index.ts re-export | 1 export | 1 | `extractProgress` no longer exists |

**Total removed**: ~135 lines of source code, 5 test cases

## What Remains

- `isOverflowError()` — regex-based overflow detection, actively used by:
  - `manager.ts` (2 call sites)
  - `manager-retry.ts` (1 call site)
  - `chat-session.ts` (2 call sites)
- `OVERFLOW_PATTERNS` — 16 regex patterns (private constant)
- 7 tests for `isOverflowError` — all passing

**overflow.ts**: 163 → 28 lines
**overflow.test.ts**: 127 → 42 lines

## No Other Dead Exports Found

`isOverflowError` is the only remaining export in overflow.ts and has 5 active production callers. No other dead exports.

## Verification

- `tsc --noEmit`: ✅ clean (exit 0)
- `vitest run test/overflow.test.ts`: ✅ 7/7 tests pass

## Prior Evidence

This cleanup was recommended by two independent audits:
1. **Lens D audit** (2026-04-13): `workspace/audit-overflow-fragility.md` — Finding #1, P2 recommendation
2. **Token budget audit** (2026-04-14): `workspace/archive/2026-04/audit-token-budget-management.md` — P1 recommendation
