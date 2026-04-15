# Finding: Tool Quality Regression — Empty Args Guard Deployed

**Date**: 2026-03-24T15:10
**Category**: Cost & Efficiency / Tool Quality

## Problem

Tool quality regressed significantly since last review:
- **Waste rate: 5.9%** (was 1.0% — 6x increase)
- **156 wasted calls** across 2655 total in 24h window
- **Key regressions:**
  - bash:other: 106 (was 18, +489%) — optimizer(40), qa(34), coach(28), coder(4)
  - bash:nonexistent-path: 28 (was 2, +1300%) — optimizer(12), coder(12), coach(4)
  - read:empty-args: 10 (was 0, +100%) — coach(10)
  - bash:empty-args: 8 (was 0, +100%) — coder(8)

## Root Cause Analysis

1. **Empty args (18 calls)**: Coach calling `read({})` without path (10x), coder calling `bash({})` without command (8x). These are validation errors that waste a full tool round-trip for nothing.

2. **bash:other (106 calls)**: Mostly parsing errors from complex bash commands. Optimizer accounted for 40 (likely from earlier sessions with complex multi-line scripts). QA agent (34) and coach (28) also contributing.

3. **nonexistent-path (28 calls)**: Path guessing — agents trying files that don't exist. Optimizer (12) and coder (12) worst offenders.

## Intervention: Empty Args Guard

Created `src/lib/tools/empty-args-guard.ts` — a beforeToolCall hook that blocks tool calls with missing required parameters BEFORE they reach the tool executor.

**Covered tools:**
- `read`: requires `path`
- `bash`: requires `command`
- `edit`: requires `path`, `oldText` (newText intentionally not required — empty string = deletion)
- `write`: requires `path`, `content`

**Design decisions:**
- Runs FIRST in the guard chain (before finish-guard, read-dedup, etc.) since empty args make other guards irrelevant
- Returns helpful error message with fix hints (e.g., "Use read({ path: 'path/to/file.md' })")
- Stateless — no per-session state needed
- Does NOT check `edit:newText` — empty string is a valid deletion operation

**Files changed:**
- `src/lib/tools/empty-args-guard.ts` — new guard (89 lines)
- `src/lib/manager.ts` — added import and guard to both composeGuards calls
- `test/empty-args-guard.test.ts` — 16 tests, all passing

**Expected impact:** Eliminates 18+ wasted calls/day from empty-args pattern. The guard provides a helpful error message that should help agents self-correct faster than the generic validation error.

## What This Doesn't Address

1. **bash:other (106 calls)** — These are heterogeneous parsing errors. No single guard can fix them. Continued skill deployment (e.g., the tool-discipline patterns in SOUL.md) is the right approach.

2. **bash:nonexistent-path (28 calls)** — Would need a file-existence pre-check guard, but that's more complex and could have false positives (agent might be intentionally checking if a file exists).

## Verification

```
16/16 tests pass (empty-args-guard.test.ts)
30/30 total guard tests pass (+ compose-guards, read-dedup)
TypeScript compiles clean
```

## Status

✅ Code complete. Blocked on binary rebuild to deploy (same blocker as 5 other handlers).
