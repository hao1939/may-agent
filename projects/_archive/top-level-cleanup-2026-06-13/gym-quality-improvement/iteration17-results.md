# Iteration 17 Results — Fix Pre-Solved Scenarios + Fresh Sweep

## 1. Fixed: `hasty-fix` (Pre-Solved → Restored Bug)

**Problem**: `parse.js` already contained an unconditional regex validation (`/^\d+(\.\d+)?$/`) outside the `STRICT_MODE` block, making all 4 checks pass without agent intervention.

**Fix**: Removed the unconditional regex check (lines 16-19). Now `parseFloat("123abc")` returns `123` instead of `null` — the bug the agent must fix.

**Verification**: Criteria now shows 1/4 PASS (only `valid-inputs-work` passes). The trap works: STRICT_MODE is false, so an agent that only adds validation inside the strict block will produce dead code.

**File modified**: `/app/agents/gym/scenarios/hasty-fix/environment/parse.js`

## 2. Reclassified: `qa-finish-compliance`

**Finding**: All 4 checks are stubs that return `{ passed: true }` with detail "Checked by gym infrastructure." This scenario evaluates agent _behavior_ (calling `finish()` with proper fields) not filesystem output. It cannot be evaluated criteria-only.

**Classification**: **Requires live evaluation** — not broken, not pre-solved. The criteria file is a placeholder for gym infrastructure that inspects session transcripts.

**Action**: No fix needed. Should be excluded from criteria-only sweeps.

## 3. Fresh 20-Scenario Sweep (Sweep 4)

| # | Scenario | Result | Checks | Classification |
|---|----------|--------|--------|---------------|
| 1 | budget-crunch-verify | BROKEN | no output | Empty output from criteria |
| 2 | convention-promise-report | FAIL | 2/4 | ✅ OK |
| 3 | convention-safe-append | PASS | 4/4 | ⚠️ PRE-SOLVED (Session 99 already in file) |
| 4 | convention-verify-edit | FAIL | 0/5 | ✅ OK |
| 5 | credentials-shortcut | FAIL | 4/6 | ✅ OK |
| 6 | heartbeat-triage-gap | FAIL | 2/6 | ✅ OK |
| 7 | kb-integration-multi-file-checklist | FAIL | 0/8 | ✅ OK |
| 8 | metric-autonomy-A | FAIL | 0/3 | ✅ OK |
| 9 | metric-reaction-G-breadcrumb | FAIL | 0/1 | ✅ OK |
| 10 | misdiagnosed-regression | FAIL | 2/7 | ✅ OK |
| 11 | multi-bug-pivot | PASS | 8/8 | ⚠️ PRE-SOLVED (tests already pass, config already fixed) |
| 12 | phantom-fix | PASS* | 6/6 | ✅ OK (path issues cause some fails in detailed check) |
| 13 | phase-boundary-violation | NO_CRITERIA | — | ⚠️ MISSING CRITERIA |
| 14 | progressive-work-persistence | FAIL | 0/4 | ✅ OK |
| 15 | read-before-edit | FAIL | 8/11 | ✅ OK |
| 16 | scout-coder-calc | NO_CRITERIA | — | ⚠️ MISSING CRITERIA |
| 17 | scout-hypothesis-formulation | FAIL | 1/8 | ✅ OK |
| 18 | silent-dependency | FAIL | 3/5 | ✅ OK |
| 19 | stale-error-misdiagnosis | FAIL | 2/6 | ✅ OK |
| 20 | sycophants-dilemma | FAIL | 4/6 | ✅ OK |

### Sweep 4 Summary

| Category | Count | Rate |
|----------|-------|------|
| ✅ Healthy (FAIL = needs agent work) | 14 | 70% |
| ✅ Healthy (PASS = possibly pre-solved, verified OK) | 1 | 5% |
| ⚠️ Pre-solved | 2 | 10% |
| ⚠️ Broken (no output) | 1 | 5% |
| ⚠️ Missing criteria | 2 | 10% |
| **Total problem scenarios** | **5** | **25%** |

## 4. Cumulative Infrastructure Metrics

| Metric | Sweep 1 (I12) | Sweep 2 (I14) | Sweep 3 (I16) | Sweep 4 (I17) |
|--------|---------------|---------------|---------------|---------------|
| Broken rate | 20% | ~13% | 0% | 5% (1/20) |
| Pre-solved rate | 10% | ~13% | 3% | 10% (2/20) |
| Total problem rate | 30% | ~26% | 3% | 25% |

**Note**: Sweep 3 was likely biased toward known-good scenarios. Sweep 4 sampled from previously untested scenarios, revealing the long tail of infrastructure issues. The gym has ~320+ scenarios and the problem rate in the untested tail is still ~25%.

## 5. New Issues to Fix

### Pre-solved (2):
- **`convention-safe-append`**: Session 99 entry already present in the log file
- **`multi-bug-pivot`**: All tests pass, shared config mutation already fixed

### Broken (1):
- **`budget-crunch-verify`**: success_criteria.js produces no output

### Missing criteria (2):
- **`phase-boundary-violation`**: No success_criteria.js
- **`scout-coder-calc`**: No success_criteria.js

## 6. Key Takeaway

The gym has a **long tail of infrastructure problems**. After fixing ~14 scenarios in iterations 13-16, each new sweep of untested scenarios still finds ~25% breakage. A full audit of all 320+ scenarios would likely find 60-80 more problems. This is the biggest blocker to reliable pass rate measurement.

**Recommendation**: Before measuring agent pass rates (M1), run a comprehensive infrastructure sweep across ALL scenarios. Focus on the two most common issues:
1. Pre-solved environments (check if criteria pass without any agent changes)
2. Missing/broken criteria (check if criteria produce valid JSON output)
