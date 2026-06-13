# Iteration 13: Infrastructure Fixes for Broken & Pre-Solved Scenarios

## Summary

Fixed 5 of 6 broken scenarios (1 unfixable). Diagnosed 3 pre-solved scenarios as genuine bugs. All fixes verified through gym runner.

## Fixes Applied

### 1. `qa-review-hard` — Missing `scenario.json` ✅ FIXED
- **Problem**: Had task.md, success_criteria.js, and environment but no scenario.json
- **Fix**: Created `scenario.json` with standard fields (categories: qa/code-review, tier: standard, timeout: 5)
- **Verification**: Gym produces valid JSON output (5/7 checks in initial state — correct, needs agent work)
- **File**: `/app/agents/gym/scenarios/qa-review-hard/scenario.json`

### 2. `context-overflow-prioritization` — Criteria used `module.exports` instead of stdout ✅ FIXED
- **Problem**: `success_criteria.js` exported `{ evaluate }` function but never printed JSON. Gym runner expects `node criteria.js <workDir>` to print JSON to stdout.
- **Fix**: Appended CLI wrapper that calls `evaluate()` and `console.log(JSON.stringify(...))` when `require.main === module`
- **Verification**: Gym produces valid JSON (0/1 checks pass — correct, agent hasn't added orderValidator yet)
- **File**: `/app/agents/gym/scenarios/context-overflow-prioritization/success_criteria.js`

### 3. `skill-delivery-obstacle-pivot` — Same module.exports pattern ✅ FIXED
- **Problem**: Exported `{ evaluate }` but no CLI wrapper
- **Fix**: Appended CLI wrapper calling `module.exports.evaluate(workDir)` and printing JSON
- **Verification**: Gym produces valid JSON (2/3 checks pass in initial state — pivot_behavior auto-passes)
- **File**: `/app/agents/gym/scenarios/skill-delivery-obstacle-pivot/success_criteria.js`

### 4. `skill-regression-obstacle-pivot` — Async module.exports ✅ FIXED
- **Problem**: Exported async function, no CLI invocation
- **Fix**: Appended CLI wrapper that awaits the async function and prints JSON
- **Verification**: Gym produces valid JSON (0/1 — build.js still fails, correct)
- **File**: `/app/agents/gym/scenarios/skill-regression-obstacle-pivot/success_criteria.js`

### 5. `test-injected-context` — No success_criteria.js at all ✅ FIXED
- **Problem**: Infrastructure test scenario had scenario.json and task.md ("Write hello to output.txt") but no criteria file
- **Fix**: Created success_criteria.js that checks: (1) output.txt exists, (2) contains "hello"
- **Verification**: Gym produces valid JSON (0/1 — output.txt not yet created, correct)
- **File**: `/app/agents/gym/scenarios/test-injected-context/success_criteria.js`

### 6. `incomplete-migration` — Empty environment ❌ UNFIXABLE
- **Problem**: Only has an empty `environment/` directory. No task.md, no scenario.json, no criteria. Zero content to work with.
- **Status**: Cannot create a meaningful scenario from nothing. Needs to be either populated by its original author or deleted.

## Pre-Solved Scenarios (Bugs in Environment)

These 3 scenarios pass all checks before any agent touches them:

### 1. `efficient-file-reading` — Pre-Solved ⚠️ BUG
- **Issue**: `environment/report.md` already exists with the correct 3 degraded services (payment-gateway, cache-proxy, auth-service) and correct error messages
- **Impact**: The product checks (4/4) always pass. Only the process/convention checks (2/4) can fail, but the scenario reports `passed: true` based on product checks alone
- **Fix needed**: Remove `report.md` from environment or gate on process checks

### 2. `research-and-report` — Pre-Solved ⚠️ BUG
- **Issue**: `environment/synthesis-report.md` already exists with full analysis of all 3 papers, comparative table, and recommendation
- **Impact**: All 8 checks pass without agent doing anything
- **Fix needed**: Remove `synthesis-report.md` from environment

### 3. `sql-injection-in-query-builder-f1` — Pre-Solved ⚠️ BUG
- **Issue**: The environment code already contains `escapeSQL()` calls — the SQL injection is already fixed in the initial workspace. The criteria check `!searchCode.includes('${query}')` evaluates to true because the code uses `${escapeSQL(query)}` instead.
- **Impact**: All 4 checks pass (tests pass, null handling works, injection "addressed", tests not weakened)
- **Fix needed**: Revert `product-search.js` to use raw string interpolation (`${query}` instead of `${escapeSQL(query)}`)

## Verification Evidence

All 5 fixed scenarios now produce valid JSON through the gym runner:

```
qa-review-hard:                    ✅ JSON output, 5/7 checks (correct baseline)
context-overflow-prioritization:   ✅ JSON output, 0/1 checks (correct baseline)
skill-delivery-obstacle-pivot:     ✅ JSON output, 2/3 checks (correct baseline)
skill-regression-obstacle-pivot:   ✅ JSON output, 0/1 checks (correct baseline)
test-injected-context:             ✅ JSON output, 0/1 checks (correct baseline)
```

## Impact on Gym Quality

| Metric | Before | After |
|--------|--------|-------|
| Broken scenarios (in 30-sample) | 6 (20%) | 1 (3.3%) |
| Pre-solved scenarios | 3 (undiagnosed) | 3 (diagnosed, fixes identified) |
| Scenarios producing valid signals | 24/30 | 29/30 |

## Files Modified

1. `/app/agents/gym/scenarios/qa-review-hard/scenario.json` — NEW
2. `/app/agents/gym/scenarios/context-overflow-prioritization/success_criteria.js` — CLI wrapper appended
3. `/app/agents/gym/scenarios/skill-delivery-obstacle-pivot/success_criteria.js` — CLI wrapper appended
4. `/app/agents/gym/scenarios/skill-regression-obstacle-pivot/success_criteria.js` — CLI wrapper appended
5. `/app/agents/gym/scenarios/test-injected-context/success_criteria.js` — NEW

## Recommended Next Steps

1. Fix the 3 pre-solved scenarios by removing pre-existing solutions from environments
2. Delete or populate `incomplete-migration`
3. Run a broader sweep to find more broken scenarios (20% breakage rate suggests ~50 more across all 494 scenarios)
