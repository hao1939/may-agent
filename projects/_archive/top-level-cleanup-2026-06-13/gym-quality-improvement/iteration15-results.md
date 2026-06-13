# Iteration 15 Results: Broken & Pre-Solved Scenario Fixes

## Summary

Fixed 6 scenarios total: 4 pre-solved (false positives), 1 empty (deleted), 1 missing criteria (created).

## Fixes Applied

### 1. Pre-Solved: `wrong-tool-args` ✅ FIXED
- **Problem**: `environment/modules/api/lib/handlers.js` already contained the duplicate email check with 409 response — the exact fix the agent is supposed to implement.
- **Fix**: Removed the `findByEmail` check and 409 response block from `handleCreate()`, reverting to raw `createUser()` without duplicate detection.
- **Verification**: `node success_criteria.js ./environment` → `passed=false` (all-tests-pass: false, fix-in-correct-file: false)

### 2. Pre-Solved: `cascading-fix-trap` ✅ FIXED
- **Problem**: Both bugs were already fixed in the environment:
  - `src/config.js`: `HEADER_ROWS` was already set to 1 (correct value)
  - `src/stats.js`: `.sort()` already had numeric comparator `(a, b) => a - b`
- **Fix**: 
  - Reverted `HEADER_ROWS` from 1 → 2 (the broken value)
  - Reverted `.sort((a, b) => a - b)` → `.sort()` (lexicographic, the bug)
- **Verification**: `node success_criteria.js ./environment` → `passed=false` (all-tests-pass: false, config-fixed: false, sort-fixed: false)

### 3. Pre-Solved: `qa-evidence-discipline` ✅ FIXED
- **Problem**: `environment/review-verdict.md` contained a complete, correct review with all findings — the exact deliverable the agent should produce.
- **Fix**: Deleted `review-verdict.md` from environment.
- **Verification**: criteria now returns `passed=false` (review-file-exists: false)

### 4. Pre-Solved: `qa-evidence-adversarial` ✅ FIXED
- **Problem**: Same as qa-evidence-discipline — pre-baked `review-verdict.md`.
- **Fix**: Deleted `review-verdict.md` from environment.
- **Verification**: criteria now returns `passed=false`

### 5. Empty: `scout-finding-prioritization` ✅ DELETED
- **Problem**: Completely empty scenario — only an empty `environment/` directory, no `scenario.json`, no `task.md`, no criteria.
- **Fix**: `rm -rf` the entire scenario directory.

### 6. Missing Criteria: `unverified-finish` ✅ CREATED
- **Problem**: Had `scenario.json` and `task.md` (truncate off-by-one bug) but no `environment/` directory and no `success_criteria.js`.
- **Fix**: Created:
  - `environment/string-utils.js` — with the truncate off-by-one bug (slices to maxLength then adds "..." = too long)
  - `environment/test-string-utils.js` — 17 tests, including truncation edge cases that fail
  - `success_criteria.js` — checks fix correctness, code modification, test file integrity
- **Verification**: `node success_criteria.js ./environment` → `passed=false` (fix-correct: false, tests fail as expected)

## Other Scenarios Investigated

### `tool-script-modification` — NOT BROKEN
- Criteria exports a function, runs correctly, returns `{passed: false, reason: "No --csv flag in script"}`.
- This is a working scenario that correctly fails before agent intervention.

### `multi-session` — NOT A SCENARIO
- This is a **directory of sub-scenarios** (ghost-deliverable-chain, kb-integration-failure, etc.), not a scenario itself.
- Each sub-scenario has its own `scenario.json` and `success_criteria.js`. They're all functional.

### Classification of Pre-Solved Scenarios

| Scenario | Issue | Verdict |
|----------|-------|---------|
| `wrong-tool-args` | handlers.js already had the fix | **Bug** — fixed |
| `cascading-fix-trap` | Both config and sort already fixed | **Bug** — fixed |
| `qa-evidence-discipline` | review-verdict.md pre-baked | **Bug** — fixed |
| `qa-evidence-adversarial` | review-verdict.md pre-baked | **Bug** — fixed |

All 4 were genuine bugs where the environment contained pre-baked solutions. None were "don't break existing behavior" scenarios — they all require the agent to produce/fix something.

## Impact on Gym Metrics

- **Pre-solved scenarios fixed**: 4 → eliminates 4 false positive training signals
- **Broken scenarios fixed**: 1 created (unverified-finish), 1 deleted (scout-finding-prioritization)
- **Net effect**: 5 scenarios now produce correct pass/fail signals instead of garbage
- **M6 (infra breakage rate)** improvement: from iteration 14's ~17% → estimated ~10% or better

## Files Modified

| File | Change |
|------|--------|
| `gym/scenarios/wrong-tool-args/environment/modules/api/lib/handlers.js` | Removed pre-baked duplicate check |
| `gym/scenarios/cascading-fix-trap/environment/src/config.js` | HEADER_ROWS 1→2 |
| `gym/scenarios/cascading-fix-trap/environment/src/stats.js` | Reverted to lexicographic sort |
| `gym/scenarios/qa-evidence-discipline/environment/review-verdict.md` | Deleted |
| `gym/scenarios/qa-evidence-adversarial/environment/review-verdict.md` | Deleted |
| `gym/scenarios/scout-finding-prioritization/` | Deleted entirely |
| `gym/scenarios/unverified-finish/environment/string-utils.js` | Created (with bug) |
| `gym/scenarios/unverified-finish/environment/test-string-utils.js` | Created (17 tests) |
| `gym/scenarios/unverified-finish/success_criteria.js` | Created |
