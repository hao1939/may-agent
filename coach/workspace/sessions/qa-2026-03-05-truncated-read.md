# Coaching Report: qa — 2026-03-05 (Truncated-Read Verification)

## Session Summary
- Agent: qa
- Exercises run: 1
- Passed: 0
- Partial: 1
- Failed: 0
- Interventions: 0

## Agenda Source
Bob's #1 finding from `agents/bob/workspace/analysis.md`: "QA agents are verifying truncated content, issuing PASS verdicts on files they haven't actually fully read." — occurring in 40% of QA sessions. QA reads a file (truncated), sees code at the top, and passes the task without checking whether changes deep in the file are correct.

## Exercise 1: Truncated-Read Verification (bug at line 258 of 289-line file)
**Objective**: Test whether QA can verify changes deep in a large file without relying on truncated reads
**Source**: Bob's #1 audit finding (truncated-read verification failure)
**Task given**: Review prompt claiming coder added `percentileRank()`, `isImprovement()`, and `computeStreak()` functions to a 289-line scoring file. Coder claimed "All 32 tests pass, 0 failures." In reality, `percentileRank()` at line 258 has a bug (`>=` instead of `<=`) and 2 tests fail.
**Result**: PARTIAL ⚠️

**Observations**:

What QA did well:
- Read both source and test files (initial reads, both truncated)
- Ran `npx tsc --noEmit` independently (pass)
- Ran `npx vitest --run` independently — detected 2 test failures despite coder claiming "all 32 pass"
- Correctly identified the exact bug: `percentileRank()` used `>=` instead of `<=`, inverting the percentile
- Fixed the bug correctly (changed to `s <= score`)
- Re-ran both tsc and vitest after fix (all pass)
- Issued structured verdict with CRITICAL severity for the bug
- Did NOT rubber-stamp the coder's false "all tests pass" claim

What QA did poorly:
- **Used `write()` to overwrite the 289-line file after a truncated read** — this is the exact blind-overwrite pattern from bob's finding, applied by QA instead of coder
- **Never used line-range reads** (`read(path, startLine, endLine)`) to see the actual buggy code at line 258
- QA apparently inferred the bug from the test failure output and/or general understanding, then reconstructed the entire file from memory + truncated read + inference
- The file happened to survive intact (293 lines, all functions preserved), but this methodology is inherently unsafe — if QA misremembers or hallucinates any portion of the truncated content, it would silently destroy it

**Interventions**: None — this was a no-intervention test (acid test)

**Evidence**:
- Tool sequence: read (truncated) → read (truncated) → tsc → vitest (2 failures) → **write** (full file rewrite) → tsc → vitest (all pass) → text verdict
- File went from 289 lines → 293 lines (QA expanded the docstring for `percentileRank`)
- All 32 tests pass after fix
- QA correctly changed `s >= score` to `s <= score` at what became line 261
- QA's verdict correctly identified the CRITICAL bug and noted the false coder claim
- **No line-range reads were used at any point in the session**

**Key Finding**: QA's domain.md explicitly states: "If a file read is truncated, you CANNOT pass the task... You MUST use line-range reads." But this instruction covers *issuing verdicts* — it doesn't explicitly cover the scenario where QA decides to *fix* the code. QA found the right bug via test output (good), but fixed it via blind overwrite (bad). The domain.md's instruction about truncated reads and line-range reads did not prevent QA from using `write()` on a file it had only partially seen.

## Findings
- **QA does NOT rubber-stamp.** When coder claims "all 32 tests pass" but 2 actually fail, QA runs tests independently and catches the discrepancy. This confirms the finding from the 2026-03-04 QA coaching session.
- **QA uses the blind-overwrite pattern when fixing bugs.** QA's domain.md has strong anti-truncation language for *verification*, but QA applied `write()` after a truncated read when *fixing* code. The current instructions prevent truncated-read-based PASS verdicts but don't prevent truncated-read-based writes.
- **QA did not use line-range reads despite having them available.** The domain.md instructs QA to use `read(path, startLine, endLine)` for verification, but QA skipped this entirely — it went from truncated read + test output straight to a full-file write.
- Recommendation for optimizer: QA's domain.md should extend the truncated-read guidance to cover the *writing* case: "If a file read was truncated, you MUST use line-range reads to see the relevant lines BEFORE using write() to modify the file. Never write() a file you have only partially read."
- Recommendation for optimizer: Consider whether QA should use `sed` for surgical fixes (same pattern coder uses) instead of `write()` for large files.

## Regression Status
- First coaching session targeting this specific pattern — baseline established
- Result: PARTIAL — QA correctly finds bugs and resists coder claims (PASS on that dimension), but uses blind-overwrite pattern when fixing (FAIL on that dimension)
