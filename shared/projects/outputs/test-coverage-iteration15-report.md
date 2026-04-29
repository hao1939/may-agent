# Test Coverage Report — Iteration 15

## Summary
- **Overall line coverage: 91.05%** (up from ~88.85%)
- **All 1475 tests pass** (0 failures, 1 skipped)
- **72 test files**, all passing

## Changes Made

### 1. Fixed `full-stack-integration.test.ts` (13 pre-existing failures → 0)
All 13 failures were API mismatches from a previous iteration:
- `withRetry()` returns `RetryResult<T>` not `T` — fixed assertions to use `.value`
- `budget.check().remaining` → `budget.check().tokensRemaining`
- `validateOutput(content, filename)` → `validateOutput(filename, content)` (arg order)
- `result.reason` → `result.errors.join(' ')` (different field name)
- `CheckpointData` interface requires `iteration`, `task`, `toolsCalled`, `completed` fields
- `fastWrite` skippedValidation uses `'duplicate-detection'` not `'duplicate'`

### 2. Added `context-learn-coverage.test.ts` (33 new tests)
Covers previously untested internal functions:
- **Command corrections**: npm→bun, node→bun, node→deno, npm test→vitest/bun test, generic command-not-found, same-binary flag corrections
- **Runtime detection**: deno.json, deno.jsonc, bunfig.toml, package.json runtime field
- **Path discoveries**: corrected file paths from failed reads
- **Transcript formatting**: text parts, tool_use type, array content, string arguments
- **mergeContext**: LLM merge, no-code-block response, maxSize enforcement, truncation, removed facts, no-change detection
- **learnFromSessionLLM**: LLM success and fallback to mechanical
- **learnFromText**: delegation to mergeContext
- **learnFromSession**: no-op messages, extraction and application
- **extractFacts**: JSON parsing, invalid filtering, remove actions

### Key Coverage Improvements
| File | Before | After |
|------|--------|-------|
| context-learn.ts | 57.55% | 96.51% |
| full-stack-integration.test.ts | 13 failures | 0 failures |
| **Overall** | **~88.85%** | **91.05%** |

## Files Modified
- `shared/tests/full-stack-integration.test.ts` — rewrote to match current APIs
- `shared/tests/context-learn-coverage.test.ts` — new, 33 tests for deep coverage
