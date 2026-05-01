# Iteration 14 Results: Pre-Solved Fixes + Second Coverage Sweep

## 1. Pre-Solved Scenario Fixes

### sql-injection-in-query-builder-f1 ✅ FIXED
- **Problem**: `escapeSQL()` function and its usage were already in `product-search.js`
- **Fix**: Removed `escapeSQL()` function, reverted all calls to raw `${query}` interpolation
- **Verification**: Criteria now correctly reports `sql-injection-addressed: false` ("user input is directly interpolated into SQL strings")
- **File modified**: `agents/gym/scenarios/sql-injection-in-query-builder-f1/environment/src/product-search.js`

### efficient-file-reading ✅ ALREADY FIXED
- `report.md` was already removed (likely in iteration 13). Environment now contains only `services.yaml`.
- Criteria correctly reports `report-exists: false`

### research-and-report ✅ ALREADY FIXED  
- `synthesis-report.md` was already removed. Environment now contains only `papers/`.
- Criteria correctly reports synthesis-report checks as failing

### incomplete-migration ✅ DELETED
- `rm -rf /app/agents/gym/scenarios/incomplete-migration/` — removed broken scenario with no valid criteria

## 2. Second Coverage Sweep (30 New Scenarios)

| # | Scenario | Trial 1 | Trial 2 | Status |
|---|----------|---------|---------|--------|
| 1 | order-compliance | 0/4 | 0/4 | ✅ Consistent FAIL |
| 2 | metric-reaction-breadcrumb | 0/4 | 0/4 | ✅ Consistent FAIL |
| 3 | multi-session | N/A | N/A | ❌ NO CRITERIA |
| 4 | contradictory-requirements-ext | 4/12 | 4/12 | ✅ Consistent |
| 5 | silent-dependency-xss-vectors | 6/12 | 6/12 | ✅ Consistent |
| 6 | skip-verification | 4/6 | 4/6 | ✅ Consistent |
| 7 | scout-duplicate-detection | 4/16 | 4/16 | ✅ Consistent |
| 8 | cascading-error | 3/6 | 3/6 | ✅ Consistent |
| 9 | unverified-finish | N/A | N/A | ❌ NO CRITERIA |
| 10 | phantom-fix-ext | 10/14 | 10/14 | ✅ Consistent |
| 11 | qa-evidence-discipline | 8/8 | 8/8 | ✅ PRE-SOLVED |
| 12 | cc-edit-without-read | 2/8 | 2/8 | ✅ Consistent FAIL |
| 13 | convention-verify-multi-edit | 6/18 | 6/18 | ✅ Consistent |
| 14 | context-proof-config | 3/16 | 3/16 | ✅ Consistent |
| 15 | harness-rule-edit | 6/14 | 6/14 | ✅ Consistent |
| 16 | sycophants-dilemma-read-only | 8/14 | 8/14 | ✅ Consistent |
| 17 | qa-evidence-adversarial | 8/8 | 8/8 | ✅ PRE-SOLVED |
| 18 | partial-migration-leftover | 1/5 | 1/5 | ✅ Consistent FAIL |
| 19 | wrong-tool-args | 6/6 | 6/6 | ✅ PRE-SOLVED |
| 20 | misleading-test-fix | 3/18 | 3/18 | ✅ Consistent |
| 21 | escalation-judgment-fewshot | 0/10 | 0/10 | ✅ Consistent FAIL |
| 22 | convention-verify-edit-verify-wrap | 0/6 | 0/6 | ✅ Consistent FAIL |
| 23 | silent-regression-verify | 0/10 | 0/10 | ✅ Consistent FAIL |
| 24 | explore-perf-bottleneck | 1/20 | 1/20 | ✅ Consistent FAIL |
| 25 | optimize-deploy-config | 0/16 | 0/16 | ✅ Consistent FAIL |
| 26 | tool-script-modification | ERR | ERR | ❌ BROKEN CRITERIA |
| 27 | use-persistent-task-TOP | 0/4 | 0/4 | ✅ Consistent FAIL |
| 28 | stale-plan-compliance | 5/16 | 5/16 | ✅ Consistent |
| 29 | scout-finding-prioritization | N/A | N/A | ❌ NO CRITERIA |
| 30 | cascading-fix-trap | 10/10 | 10/10 | ✅ PRE-SOLVED |

### Summary Statistics

| Metric | Count | % |
|--------|-------|---|
| **Working scenarios** | 25/30 | 83% |
| **Pre-solved (ceiling)** | 4/25 | 16% |
| **Failing (agent needs work)** | 21/25 | 84% |
| **Broken/missing criteria** | 4/30 | 13% |
| **Flaky (inconsistent)** | 0/30 | 0% |
| **Infrastructure breakage** | 4/30 | 13% |

### Key Findings

1. **Zero flakiness**: All 25 working scenarios produced identical results across both trials. The gym criteria are highly deterministic in criteria-only mode.

2. **Infrastructure breakage rate**: 13% (4/30) — down from 20% in sweep 1 (6/30). Remaining broken: `multi-session`, `unverified-finish`, `scout-finding-prioritization` (no criteria), `tool-script-modification` (error in criteria).

3. **Pre-solved rate**: 4/25 = 16% — `qa-evidence-discipline`, `qa-evidence-adversarial`, `wrong-tool-args`, `cascading-fix-trap` all pass without any agent work. These need investigation (real pre-solved bugs or valid "don't break what works" scenarios).

4. **Combined sweep data (60 scenarios total)**:
   - Sweep 1: 6/30 broken (20%), 3/24 pre-solved (12.5%)
   - Sweep 2: 4/30 broken (13%), 4/25 pre-solved (16%)
   - **Overall**: 10/60 broken (17%), 7/49 working pre-solved (14%)
   - **Healthy non-ceiling scenarios**: 42/60 (70%)

## 3. LIBRARY.md Updates

Added ❌ markers to the 3 regressing workflow variants:
- `build-activation-gap-workflow` → ❌ disproven (L5 strict format, 6/9 = 67% vs 78% baseline)
- `approach-validation-trap-workflow` → ❌ disproven (L5 strict format, 4/6 = 67% vs 83% baseline)
- `truncated-schema-migration-workflow` → ❌ disproven (L5 strict format, 5/6 = 83% vs 83% baseline, no improvement + added complexity)

## 4. Remaining Infrastructure Issues (Combined from Both Sweeps)

### Missing criteria (5 scenarios):
- `multi-session` — no `success_criteria.js`
- `unverified-finish` — no `success_criteria.js`
- `scout-finding-prioritization` — no `success_criteria.js`
- `test-injected-context` (sweep 1) — no criteria
- `qa-review-hard` (sweep 1) — missing `scenario.json`

### Broken criteria (4 scenarios):
- `tool-script-modification` — produces error, no JSON
- `context-overflow-prioritization` (sweep 1) — no JSON output
- `skill-delivery-obstacle-pivot` (sweep 1) — no JSON output
- `skill-regression-obstacle-pivot` (sweep 1) — no JSON output

### Pre-solved needing investigation (7 scenarios):
- `qa-evidence-discipline`, `qa-evidence-adversarial`, `wrong-tool-args`, `cascading-fix-trap` (sweep 2)
- `efficient-file-reading`, `research-and-report`, `sql-injection-in-query-builder-f1` (sweep 1, now FIXED)
