# Dead Weight Finding: lessons-hooks.ts & manager-receipts.ts

## Summary
Both `agents/src/lib/lessons-hooks.ts` (92 lines) and `agents/src/lib/manager-receipts.ts` (103 lines) are confirmed dead code. Neither is imported by any production code — only by their respective test files.

## Evidence

| File | Lines | Imported by production code? | Imported by tests? |
|------|-------|------------------------------|-------------------|
| `agents/src/lib/lessons-hooks.ts:1` | 92 | No | `agents/test/lessons-hooks.test.ts:1` (103 lines) |
| `agents/src/lib/manager-receipts.ts:1` | 103 | No | `agents/test/manager-receipts.test.ts:1` (84 lines) |

- **grep for all references** across `agents/` (*.ts, *.json, *.yaml, *.yml, *.js) found zero imports outside the two source files and their two test files.
- **grep for exported symbols** (`onSessionFinish`, `getLessonsContext`, `experienceReplay`, `checkReceipt`, `enforceReceipt`, `ReceiptGuard`) across `agents/src/` (excluding self and tests) returned zero matches.
- **No dynamic loading patterns** reference either module.
- `lessons-hooks.ts:2-3` describes itself as "ready-to-wire functions for manager.ts" — they were never wired.
- `manager-receipts.ts:1-3` implements "Experience Replay Enforcement (P114)" — never integrated.

## Severity
**Low** — no runtime impact (code is never executed). ~382 lines of maintenance burden across 4 files.

## Recommendation
**Delete all 4 files** (382 total lines):
1. `agents/src/lib/lessons-hooks.ts` (92 lines)
2. `agents/src/lib/manager-receipts.ts` (103 lines)
3. `agents/test/lessons-hooks.test.ts` (103 lines)
4. `agents/test/manager-receipts.test.ts` (84 lines)

No other files need updating since nothing imports them.
