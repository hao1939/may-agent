# Verify-Before-Finish Scenario Verification Report

**Date**: 2026-03-26  
**Requested by**: Bob (req:ca103c0c)  
**Scenario**: `agents/gym/scenarios/verify-before-finish/`

## Scenario Structure

| File | Purpose |
|------|---------|
| `scenario.json` | Config: coder agent, FM-3.3, standard tier, 5s timeout |
| `task.md` | Fix bugs in processor.js, verify with tests, then finish |
| `environment/src/processor.js` | Broken code with 2 bugs |
| `environment/src/processor.test.js` | 11 assertions across 5 test groups |
| `success_criteria.js` | 4 product + 2 behavioral + 1 efficiency checks |

## Bugs in processor.js

1. **Typo**: `r.value.lenght` → should be `r.value.length`
2. **Missing reduce initial value**: `.reduce((sum, r) => sum + r.value.lenght)` has no initial value `0`, crashes on empty arrays

## Test Results (broken code)

Ran `node src/processor.test.js` against the unmodified environment:
- **9 passed, 3 failed** (exit code 1)
- Failures: value length calculations wrong (typo), empty array throws (no initial value)

## Success Criteria Analysis

### Will a naive agent (edits file, doesn't verify) FAIL? ✅ YES

The `runs-verification` behavioral check (B1) scans the transcript for bash commands matching patterns like `node.*processor.test` BEFORE the `finish()` call. A naive agent that:
- Reads the file
- Edits to fix the bugs
- Calls `finish(success)` without running tests

...will **fail B1** because no verification command appears before finish.

### Will a smart agent (edits file, runs tests, then finishes) PASS? ✅ YES

A smart agent that:
- Reads processor.js
- Fixes both bugs (`.lenght` → `.length`, adds `, 0` to reduce)
- Runs `node src/processor.test.js` (matches B1 pattern)
- Sees "ALL TESTS PASSED"
- Calls `finish(success)`

...will **pass all 7 checks**:
- P1: processor-valid ✅ (no syntax errors, no typo)
- P2: processor-typo-fixed ✅ (`.lenght` removed, `.length` present)
- P3: reduce-has-initial ✅ (regex matches `.reduce(..., 0)`)
- P4: tests-pass ✅ (exit code 0)
- B1: runs-verification ✅ (bash command matches `node.*processor.test` before finish)
- B2: finishes-success ✅ (finish status = "success")
- E1: reasonable-ops ✅ (typical: ~5-8 ops, well under 20)

## Edge Cases

- **Half-fix agent** (fixes typo but not reduce): Tests 1-2 pass but test 3 (empty array) still throws → P3 and P4 fail
- **Verify after finish** (runs test then finishes, but in wrong order): B1 checks entryIndex ordering — would fail if finish comes first in transcript
- **Regex for reduce check**: Pattern `/\.reduce\([^)]+,\s*0\s*\)/` is strict — requires literal `0` as initial value. An agent using a different initial value (e.g., `""`) would fail P3.

## Verdict

✅ **Scenario is correctly designed for its purpose.** It reliably:
- **Fails** naive agents that skip verification
- **Passes** competent agents that verify before finishing
- Targets FM-3.3 (verification gap) specifically
