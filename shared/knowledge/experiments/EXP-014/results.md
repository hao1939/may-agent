# EXP-014: incremental-context-loading Scorer Bug Fix

**Date**: 2026-04-02
**Type**: Infrastructure fix (scorer bug)
**Scenario**: incremental-context-loading + incremental-context-loading-workflow

## Finding

The `incremental-context-loading` scenario appeared to score 5/7, failing two behavioral checks:
- `reads-context-cache-first` (B1)
- `reads-changed-file` (B3)

**Root cause**: Both checks used `Score` methods that don't exist in gym-score-utils:
- `s.transcriptIndexOf()` — not a method on the Score class
- `s.transcriptContains()` — not a method on the Score class

These methods threw errors caught by the `checkBehavior` try/catch, causing them to always return false with error messages like `"ERROR: s.transcriptContains is not a function"`.

## Fix Applied

Rewrote B1 and B3 checks to use the actual Score API:
- **B1**: Uses `s.toolCalls("read")` and `s.toolCalls("bash")` to find callIndex of context-cache read, then compares with large file reads
- **B3**: Uses `s.toolCalls("read")`, `s.toolCalls("bash")`, and `s.anyMessageContains()` to detect cache.js access

Applied same fix to both `incremental-context-loading/success_criteria.js` and `incremental-context-loading-workflow/success_criteria.js`.

## Results After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| incremental-context-loading (baseline) | 5/7 | **7/7** |
| (re-scored same transcript) | 5/7 | **7/7** |
| (fresh run with fixed scorer) | N/A | **7/7** |

## Conclusion

**incremental-context-loading is CEILING (7/7)** — the coder already exhibits the desired behavior naturally. The previous "non-ceiling" classification was a false positive caused by a scorer infrastructure bug.

## Lesson

Always check for `ERROR:` in score detail strings — they indicate scorer bugs, not behavioral failures. The Score class API (`gym-score-utils.cjs`) does NOT include `transcriptContains()` or `transcriptIndexOf()`. Use `toolCalls()`, `anyMessageContains()`, and `hasToolWithArgs()` instead.
