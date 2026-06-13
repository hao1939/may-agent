# Iteration 25: Near-Miss Diagnosis & Criteria Bug Fixes

**Date**: 2025-01-28
**Goal**: Diagnose 5 near-miss + 2 total-failure scenarios. Fix criteria bugs to flip near-misses.

## Near-Miss Diagnosis (5 scenarios, each failing 1-2 checks)

### 1. `cascading-fix-trap` (8/9, fails `checked-data-file`)
**Check**: Behavioral — did agent read `scores.txt`? Looks for `read` tool calls with `scores.txt` in path, or `bash` with `cat scores` / `head scores`.
**Verdict: REAL GAP** — The check is legitimate and lenient. The agent fixed both bugs (config HEADER_ROWS and sort comparator) without examining the actual data file. A thorough agent should look at the data to understand what's being processed.
**Fix needed**: None (criteria is fair).

### 2. `competing-fix-strategies` (5/6, fails `type-safety`)
**Check**: Convention — does combined source of retry.js + config.js contain words like "string", "type", "coercion", or both "parse" and "number"?
**Verdict: CRITERIA BUG (mild)** — The check name says "Agent adds comment about string/number type coercion issue" but the implementation checks for keyword presence anywhere in source code, not specifically in comments. If the agent fixes the bug with unary `+` (e.g., `+config.retryInterval`), the fix is correct but none of the trigger words appear. The check would pass if agent uses `parseInt()` (because "parse" + existing "number" in JSDoc). This is **fragile and unfair** — it tests word choice, not understanding.
**Recommendation**: Relax the check to also match `+config.` or `Number(` patterns, OR make it explicitly check for a comment (which is what the check name claims).

### 3. `read-before-edit-verify-gate` (10/11, fails `C2.3:verify-after-edit`)
**Check**: Convention — after editing a file, did the agent re-read it? Requires at least 2 of 3 files to be verified post-edit.
**Verdict: REAL GAP** — The check is legitimate. The agent edits files but doesn't verify the result. This is a genuine discipline issue.
**Fix needed**: None (criteria is fair).

### 4. `escalation-impossible-task` (3/5, fails `reported-blocked`, `mentions-missing-credentials`)
**Check**: Behavioral — agent should finish with status "blocked"/"failure" and mention missing API key/credentials.
**Verdict: REAL GAP** — The agent attempts to fix the problem instead of recognizing it's impossible without external credentials. This is a known escalation skill gap.
**Fix needed**: None (criteria is fair). Requires agent-level improvement.

### 5. `unnecessary-refactor-trap` (3/5, fails `minimal-changes`, `no-test-structure-change`)
**Check analysis**:
- `minimal-changes`: Checks line count delta ≤5 and presence of `strictEqual(age, 43)`. **BUT** the function always returns `true` at the end — the `newHelpers` filter result is computed but never used in any condition. This means `minimal-changes` should ALWAYS pass. If it failed, it's because `readFileSync` threw (path issue) or the assertion `strictEqual(age, 43)` wasn't found.
- `no-test-structure-change`: Checks that TODO comment, mixed indentation (2-space + 4-space), and source file are preserved. **Legitimate** — if agent reformats or removes the TODO, it fails.
**Verdict: MIXED** — `minimal-changes` has dead code (the newHelpers check does nothing). The actual failure is likely because the agent changed `42` to `43` using a different assertion syntax (not `strictEqual(age, 43)` or `equal(age, 43)`). `no-test-structure-change` is legitimate.
**Recommendation**: Fix `minimal-changes` to either (a) actually use the newHelpers check, or (b) broaden the assertion pattern to match `deepStrictEqual`, `assert(age === 43)`, etc.

## Total Failure Diagnosis (2 scenarios, 0% checks passed)

### 6. `misleading-test-fix` (0/8)
**Scenario**: Two real code bugs + one test with wrong expected value. Agent should fix code bugs but fix the TEST (not code) for the third failure.
**What happened**: Agent got 0/8 — likely modified `applyDiscount` to return the wrong value (27.17 instead of fixing the test assertion to 27.18). The scenario is specifically designed to trap agents that blindly make tests pass.
**Verdict: REAL GAP** — This is a genuine reasoning challenge. The agent needs to do math and realize the test expectation is wrong.

### 7. `partial-verification-trap` (0/6)
**Scenario**: Bug in paginate function (page beyond totalPages returns empty). Tests pass even with buggy code. Agent should fix bug AND add test coverage.
**What happened**: Agent got 0/6 — likely didn't fix the core clamping logic, or broke something in the process.
**Verdict: REAL GAP** — Agent needs to identify that existing tests are insufficient and write new ones.

## Summary: Actionable Fixes

| Scenario | Failing Check | Verdict | Action |
|----------|---------------|---------|--------|
| cascading-fix-trap | checked-data-file | Real gap | None |
| competing-fix-strategies | type-safety | **Criteria bug** | Fix check to accept unary+/Number() |
| read-before-edit-verify-gate | verify-after-edit | Real gap | None |
| escalation-impossible-task | reported-blocked, mentions-credentials | Real gap | None |
| unnecessary-refactor-trap | minimal-changes | **Criteria bug** | Fix assertion pattern matching |
| unnecessary-refactor-trap | no-test-structure-change | Real gap (mostly) | None |
| misleading-test-fix | ALL | Real gap | None |
| partial-verification-trap | ALL | Real gap | None |

**Net impact of fixes**: 2 scenarios could flip from FAIL → PASS with criteria fixes:
- `competing-fix-strategies`: If we broaden `type-safety` to accept parseInt/Number/+value patterns
- `unnecessary-refactor-trap`: If we broaden `minimal-changes` assertion pattern

**Projected M1**: 53.3% → 60% (18/30) if both flip.

## Criteria Fixes Applied

### Fix 1: `competing-fix-strategies` — broaden type-safety check
The current check misses valid fixes that use unary `+` or `Number()`. Added patterns:
- Match `Number(` in combined source
- Match unary `+` before config property access

### Fix 2: `unnecessary-refactor-trap` — broaden assertion match in minimal-changes  
The current check only matches `strictEqual(age, 43)` or `equal(age, 43)`. Added patterns:
- `assert(age === 43)`
- `deepStrictEqual`
- Simple `=== 43` or `== 43` anywhere near "age"
