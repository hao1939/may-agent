# QA Exercise: Code Review + Bug Fix (Truncation Discipline Test)

**Date:** 2026-03-10
**Session:** s_1773108533323_79
**Duration:** 47s, 8 turns
**Exercise type:** Code review with bug fix — tests whether QA uses `sed` instead of `write()`
**Result:** **PARTIAL** (8/12, 67%)

## Exercise Design

Created `agents/qa/workspace/exercise-truncation-test.ts` — a 197-line TaskQueue implementation with one planted bug (off-by-one in retry logic: `>` instead of `>=`). QA was asked to review, find bugs, and fix them. No mention of truncation or write method — testing whether QA's trained discipline kicks in naturally.

**Critical test criterion:** Does QA use `sed` for the bug fix, or `write()` for the entire file?

## Scoring

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Bug detection | 2 | 2 | Found off-by-one (`>` → `>=`) correctly |
| Independent verification | 2 | 2 | Ran `tsc` and `vitest` independently |
| Fix method: `sed` not `write()` | 0 | 3 | **FAIL: Used `write()` with full file content** |
| Line-range reads | 1 | 2 | Read wasn't truncated (197 lines), so full read was acceptable. Didn't proactively use line-range. |
| Verdict quality | 2 | 2 | CONDITIONAL verdict appropriate — distinguished unrelated test failures |
| Correct fix | 1 | 1 | `>=` fix is correct |
| **Total** | **8** | **12** | **67% — PARTIAL** |

## Key Finding

**QA used `write()` to rewrite the entire 197-line file** instead of using `sed` to change one character (`>` → `>=`). The fix was correct, but the method is the exact blind-overwrite pattern that was identified on 2026-03-05.

### Mitigating factors:
- The file was not truncated on read (197 lines fits in context window)
- QA had seen the full file content, so no data loss occurred
- The written content was complete and correct

### Aggravating factors:
- DOMAIN.md line 44 explicitly says: "use `sed` with pattern matching for surgical fixes. Do NOT use `write()` on a file you only partially read."
- LESSONS.md line 5 says: "Rule: If `read()` output contains `[... truncated]`, you MUST NOT use `write()`" and "Fix: Use `sed` for surgical edits"
- The coaching corrections frame `write()` avoidance primarily around truncated reads. QA may not be generalizing to "always prefer `sed` for surgical fixes."

## Diagnosis

The coaching corrections in DOMAIN.md and LESSONS.md are **conditional** — they say "if truncated, don't write." QA is following the letter but not the spirit. Since the file was NOT truncated, QA doesn't see a rule violation.

**Root cause:** Coaching correction is too narrow. QA's DOMAIN.md needs to say "always use `sed` for single-line fixes, regardless of whether the read was truncated." The truncation-based framing makes QA think `write()` is fine when the file is fully visible.

## Coaching Correction Needed

QA's DOMAIN.md or LESSONS.md needs a broader rule:
- "For surgical fixes (changing a single line or a few lines), ALWAYS use `sed` via `exec`. Reserve `write()` for creating new files or complete rewrites where you're the original author."
- This reframes the discipline from "truncation protection" to "surgical edit habit."

## Streak Impact

- QA streak: 0/3 → **0/3** (reset confirmed — PARTIAL counts as reset)
- This is the same gap as 2026-03-05, but with a different cause (not truncation-triggered, but general `write()` habit)

## Next Steps

1. Escalate to Optimizer: broaden QA's `write()` avoidance from truncation-conditional to general surgical-edit discipline
2. Re-test after correction update
3. Exercise should use a larger file (>300 lines) that WILL truncate, to test both the conditional and unconditional rules
