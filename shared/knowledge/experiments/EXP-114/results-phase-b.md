# EXP-114b Results: Tool Schema Guard — Production Implementation

**Status**: COMPLETE
**Date**: 2026-04-10
**Author**: Tech-Lead
**Implements**: EXP-114a prototype → production code

---

## Summary

Implemented the Tool Schema Guard from Coach's EXP-114a prototype as production code:
- **Guard**: `src/lib/tools/tool-schema-guard.ts` (315 lines)
- **Tests**: `test/tool-schema-guard.test.ts` (625 lines, 71 tests, 153 assertions)

All 8 patterns from the retrospective analysis are implemented. The guard defaults to **log-only mode** (`block: false`) per the phased deployment plan.

---

## What Was Built

### Guard Implementation (`src/lib/tools/tool-schema-guard.ts`)

- `createToolSchemaGuard(options?)` — factory function returning a synchronous guard
- 8 pattern detectors: BASH_EMPTY, READ_EMPTY, FINISH_EMPTY, READ_WRONG_ARG, EDIT_EMPTY, BASH_WRONG_ARG, AGENTS_EMPTY, WRITE_EMPTY
- Configurable `block` mode (default: false = log-only)
- `onMatch` callback for telemetry
- Full fail-open architecture (triple try/catch: top-level, per-pattern, callback)
- Pure synchronous — no IO, no async, ~0ms overhead
- Exports `SCHEMA_PATTERNS` array for testing/introspection

### Test Suite (`test/tool-schema-guard.test.ts`)

| Category | Tests | Assertions |
|----------|-------|------------|
| Pattern detection (8 patterns) | 31 | ~70 |
| Log-only mode | 2 | 4 |
| Block mode | 1 | 2 |
| onMatch callback | 3 | 5 |
| Fail-open safety | 4 | 4 |
| No false positives | 8 | 8 |
| SCHEMA_PATTERNS metadata | 3 | 11 |
| Helper functions | 10 | 10 |
| Error message quality | 8 | ~40 |
| **Total** | **71** | **153** |

---

## Architecture Decisions

### 1. Standalone Module (Not Integrated into composeGuards Yet)

The existing codebase has `createFinishGuard()` in `src/lib/tools/finish-guard.ts` but there's no `composeGuards()` function yet. Rather than modifying integration points, the guard is built as a standalone module with the same interface pattern:

```typescript
createToolSchemaGuard(options?) → (ctx: ToolCallContext) → GuardResult | undefined
```

Integration into the tool dispatch pipeline is a separate step once the log-only phase validates the guard.

### 2. Default Log-Only Mode

`block: false` by default. This means the guard returns `{ block: false, reason: "..." }` instead of `{ block: true, reason: "..." }`. The calling code can:
- Log the match for telemetry
- Let the tool call through
- Compare guard predictions against actual outcomes

### 3. No Prototype File

The Coach's prototype (`agents/coach/workspace/tool-schema-guard-draft.ts`) was referenced in EXP-114a results but doesn't exist on disk. The implementation was built from the design doc specs and results analysis directly.

---

## Verification

```
$ bun test test/tool-schema-guard.test.ts
71 pass, 0 fail, 153 expect() calls — 73ms

$ bun test test/tools-finish-guard.test.ts
82 pass, 0 fail — 75ms (existing tests unaffected)
```

---

## Next Steps

1. **Phase 1 deployment**: Wire `createToolSchemaGuard()` into tool dispatch with `block: false`
2. **Measure**: After 100+ sessions, compare FM-2.1 detection rate vs EXP-114a's 54% estimate
3. **Phase 2**: Flip to `block: true` after validating zero false positives
4. **Tool hallucination guard**: Separate mechanism for non-existent tool names (17.7% of FM-2.1)

---

## Files

- `src/lib/tools/tool-schema-guard.ts` — Production guard (315 lines)
- `test/tool-schema-guard.test.ts` — Test suite (625 lines, 71 tests)
- `agents/shared/knowledge/experiments/EXP-114/results-phase-b.md` — This report
