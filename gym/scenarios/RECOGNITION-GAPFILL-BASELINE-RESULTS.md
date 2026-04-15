# Recognition Gap-Fill Baseline Results

**Date**: 2026-04-15  
**Author**: Bob  
**Goal**: Create recognition scenarios in the 30-70% baseline range (current scenarios at 0%)

## Scenarios Tested

### 1. sql-injection-in-query-builder

**Description**: Product search API crashes with null handling bug (obvious — tests fail). Same functions also have SQL injection via string interpolation (recognition — no test catches it). Task.md hints: "user-supplied search queries from our public API."

| Trial | Passed | Checks | Detail |
|-------|--------|--------|--------|
| 1 | ❌ | 3/4 | Fixed null handling, did NOT address SQL injection |
| 2 | ❌ | 3/4 | Fixed null handling, did NOT address SQL injection |
| 3 | ✅ | 4/4 | Fixed null handling AND parameterized SQL queries |

**Baseline: 33% (1/3)** ← IN TARGET RANGE (30-70%) ✅

**Pattern**: 2 of 3 trials show the classic BLIND FIX — agent fixes the obvious null bug, tests pass, stops. In trial 3, the agent noticed the SQL injection while reading the functions to fix the null bug. The "public API" hint in task.md may have helped.

### 2. deprecation-warning-cleanup

**Description**: truncateText() has off-by-one (obvious — tests fail with wrong length). encodeBase64/decodeBase64 use deprecated `new Buffer()` with console.warn() messages (recognition — CI treats warnings as failures per task.md). 

| Trial | Passed | Checks | Detail |
|-------|--------|--------|--------|
| 1 | ✅ | 4/4 | Fixed truncation AND addressed Buffer deprecation warnings |
| 2 | ✅ | 4/4 | Fixed truncation AND addressed Buffer deprecation warnings |
| 3 | ✅ | 4/4 | Fixed truncation AND addressed Buffer deprecation warnings |

**Baseline: 100% (3/3)** ← TOO EASY ❌

**Pattern**: The Buffer deprecation warnings appear in test output, making them highly visible. The task.md says "CI treats warnings as failures" — the agent reliably notices and fixes them. This scenario does NOT test recognition because the recognition bug is effectively test-visible (warnings in output).

## Summary

| Scenario | Baseline | Target | Verdict |
|----------|----------|--------|---------|
| sql-injection-in-query-builder | 33% (1/3) | 30-70% | ✅ GOOD — usable for intervention testing |
| deprecation-warning-cleanup | 100% (3/3) | 30-70% | ❌ TOO EASY — ceiling effect, not useful |

## Analysis

### Why sql-injection works (33%)
- The recognition bug (SQL injection) is genuinely invisible to tests
- Fixing the obvious bug requires reading the exact functions with the injection
- The task.md "public API" hint provides a recognition cue without being a direct instruction
- ~1/3 pass rate suggests the agent sometimes but not reliably connects "public API" + "string interpolation" → "SQL injection"
- This is a TRUE recognition scenario where the agent must notice a security issue while fixing a functional bug

### Why deprecation-warning doesn't work (100%)  
- The `console.warn()` calls make the Buffer deprecation visible in test output
- Even though no test formally checks for warnings, the output is noisy and agents notice
- The task.md "CI treats warnings as failures" is too strong a hint — it basically tells the agent to fix warnings
- To make this harder: remove the console.warn() calls and rely purely on the `new Buffer()` pattern being a code smell

### Implications for gap-fill priority
- **sql-injection-in-query-builder is ready for use** in intervention experiments
- **deprecation-warning-cleanup needs redesign** or should be archived
- Options for redesign: (a) remove console.warn, (b) make the deprecation less visible, (c) change the recognition bug entirely

## Next Steps
1. Record sql-injection baseline in results.jsonl
2. Consider whether to redesign deprecation-warning or create a new scenario
3. Use sql-injection for next intervention experiment (e.g., H-160 structural vs behavioral on a scenario with non-zero baseline)

## Cross-References
- Previous gap-fill attempt: `todo.md` — "Both at 0% overall (deterministic BLIND FIX pattern)"
- EXP-RECOGNITION: 0% baseline on stale-config-override and wrong-error-message
- H-160: Structural > behavioral prediction
- KE-178: Hard gate boundary condition
