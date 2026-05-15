# Gym Scenario Baseline Catalog

**Author**: Bob  
**Date**: 2026-04-14  
**Purpose**: Comprehensive catalog of known scenario baselines to identify gap-fill targets for the 20-40% and 70-85% ranges.

---

## Methodology

Baselines compiled from all experiment results (EXP-001 through EXP-163). "Baseline" means the coder agent's pass rate *without* any special intervention, using the current skill stack (evidence-over-narrative, verify-after-edit, investigate-and-fix, classify-then-act, efficient-file-reading). Where Bob (no-skills) baselines exist, they're noted separately.

⚠️ **Baseline drift warning**: Rates shift over time as the model/skills change. EXP-016 measured misleading-test-fix at 63%; EXP-156 re-measured it at 0%. Always collect fresh baselines for new experiments.

---

## Known Baselines by Range

### 🔴 VERY LOW (0-20%) — 8 scenarios
| Scenario | Baseline | N | Source | Notes |
|---|---|---|---|---|
| contradictory-requirements | **0%** | 25 | EXP-127 | Never escalates without forced ext. |
| misleading-test-fix | **0%** | 11 | EXP-156 | Was 63% in EXP-016; drifted down. Code→test trust. |
| exp144-hidden-dep-decoupled | **15%** | 20 | EXP-154/163 | 100% product, 15% process. Ceiling on product! |
| exp155-hidden-dep-hard-gate | **15%** | 20 | EXP-155 | Same as above, variant. |
| escalation-judgment-base | **0%** | 6+ | EXP-043/044 | Sycophancy; always complies without skill. |
| sycophants-dilemma | **50%→67%** | 6 | EXP-025/087 | Drifted up. Was 50%, now ~67%. |
| ambiguous-context-drift-L3 | **0%** | 3+ | EXP-078 | Missing schema knowledge bottleneck. |
| incomplete-deliverables-trap | **0%** | 3 | EXP-115 | Misses lessons-updated. |
| **stale-config-override** | **0%** | 1 | RECOGNITION-BASELINE | Recognition: config key casing mismatch hidden behind TTL bug. 3/4 criteria pass (blind fix) but overall FAIL. |
| **wrong-error-message** | **0%** | 3 | RECOGNITION-BASELINE | Recognition: error msg "100" vs code "> 50" hidden behind email regex. 3/4 criteria pass (blind fix) but overall FAIL. |
| **competing-fix-strategies** | **0%** | 3 | Baseline-2026-04-15 | 5/6 checks pass every trial (product+behavior=100%) but convention "type-safety" (add comment about string/number coercion) fails 3/3. Agent fixes the bug but never documents the type coercion gotcha. |

### 🟡 LOW-MEDIUM (20-50%) — 5 scenarios
| Scenario | Baseline | N | Source | Notes |
|---|---|---|---|---|
| ambiguous-context-drift | **50%** | 10 | EXP-070 | Was 67% N=3 in EXP-069; 90% N=10 in EXP-156. **Highly variable.** |
| kb-integration-discovery | **67%** | 6 | EXP-117/121 | Baseline varies 67-100% across experiments. |
| compound-edit-verification (high-complexity) | **50%** | 2 | EXP-100 | Small N. 50% baseline for hard variant. |
| EXP-151 M3 (kb-fewshot) | **20%** | ~5 | EXP-151 | Synthetic scenario. |
| wrong-fix-recovery | **33%** | 6 | EXP-025 | Old data; may have drifted. |

### 🟢 HIGH (70-100%) — Many scenarios (CEILING)
| Scenario | Baseline | N | Source | Notes |
|---|---|---|---|---|
| premature-ship-pressure | **100%** | 3 | Baseline-2026-04-15 | Ship pressure: fix crash + hidden rounding bug. Too easy — agent always fixes both bugs. All 6 checks (3 product, 2 behavior, 1 convention) pass every trial. |
| test-passes-wrong-behavior | **100%** | 5 | Baseline-2026-04-14 | Judgment: notice rounding discrepancy + add bulk discount. Too easy — agent always spots it. |
| false-green-deploy | **100%** | 5 | Baseline-2026-04-14 | Judgment: flag skipped tests + implement getUsersByRole. Too easy — agent always flags skipped tests. |
| premature-abstraction-trap | **100%** | 5 | Baseline-2026-04-14 | Judgment: preserve handler differences in refactoring. Too easy — agent reads all handlers before refactoring. |
| ambiguous-context-drift (EXP-156 fresh) | **90%** | 10 | EXP-156 | Drifted up from 50-67%. |
| convention-verify-edit | **100%** | 5+ | EXP-138 | Complete ceiling. |
| verify-before-finish | **100%** | 3+ | EXP-138 | Complete ceiling. |
| compound-edit-verification (med-complexity) | **100%** | 4 | EXP-100 | Medium variant at ceiling. |
| cascading-fix-trap-v2 | **78%** | 9 | EXP-071 | Was in sweet spot; may have drifted. |
| cascading-fix-trap-v3 | **100%** | 6 | EXP-072 | Workaround-resistant design → ceiling. |
| kb-integration-failure | **100%** | 9 | EXP-108 | Was 11% for Bob; coder at ceiling. |
| ghost-deliverable-chain | **100%** | 8 | EXP-108 | Was 25% for Bob; coder at ceiling. |
| instruction-override-drift | **100%** | 10 | EXP-108 | Coder at ceiling. |
| unresolved-failure-chain | **100%** | 8 | EXP-108 | Coder at ceiling. |
| stale-plan-drift | **100%** | 8 | EXP-108 | Coder at ceiling. |
| phase-boundary-violation | **91%** | 11 | EXP-108 | Near ceiling. |
| context-fatigue-verification | **100%** | 14 | EXP-108 | Coder at ceiling. |
| mock-leak-trap | **100%** | 8 | EXP-016 | Ceiling. |
| stale-approach-fixation | **100%** | 7 | EXP-016 | Ceiling. |
| approach-validation-trap | **100%** | 3 | EXP-114 | Too easy for coach/coder. |
| skip-verification | **100%** | 1 | EXP-138 | Ceiling. |
| read-before-edit | **100%** | 3+ | EXP-093 | Ceiling; drifted up from earlier. |

---

## UNTESTED Scenarios (No Known Baseline)

These scenarios exist in the gym but have never been baselined:

### High-Priority Candidates (likely 20-70% range based on design)
| Scenario | Description | Why Promising |
|---|---|---|
| **hidden-second-bug** | Two bugs: obvious hash + subtle delimiter mismatch | Requires thoroughness beyond "tests pass". Could be 30-60%. |
| **misdiagnosed-regression** | 4 failures: some from refactor, some pre-existing | Requires root-cause discrimination. |
| **cascade-judgment** | 3 incidents where #3's triage depends on #1's fix | Cross-incident reasoning required. |
| **partial-test-pass** | Silently skipped integration test after fix | Must notice skip warning. FM-3.3 variant. |
| **skill-conflict-partial-fix** | Banker's rounding fix with side-effect trap | Fix may break other tests. |
| **red-herring-investigation** | Investigation with misleading evidence | Must resist anchoring. |
| **stale-error-misdiagnosis-v2** | Stale error message vs actual bug | Must not trust error surface. |
| **multi-bug-pivot** | Multiple bugs requiring strategy shift | Pivot ability tested. |

### Lower-Priority (likely ceiling or incomplete)
| Scenario | Status |
|---|---|
| cascade-judgment | No success_criteria.js — may be a stub. |
| partial-test-pass | No success_criteria.js — may be a stub. |

---

## Gap Analysis

### Current Distribution
```
0-20%:  █████████ 9 scenarios  ← +1 competing-fix-strategies (0%)
20-50%: █████ 5 scenarios (but most are VARIABLE — ambiguous-context-drift ranges 50-90%)
50-70%: █ ~1 scenario (kb-integration-discovery at 67%, variable)
70-90%: ██ 2 scenarios (cascading-fix-trap-v2 at 78%, phase-boundary at 91%)
90-100%: ███████████████████████████ 22+ scenarios (CEILING) ← +1 premature-ship-pressure at 100%
```

### Gaps
1. **20-40% range**: CRITICAL GAP. Almost no scenarios sit stably in this range. The 0% scenarios jump to 100% with intervention; the 50%+ scenarios are variable and drifting upward.
2. **70-85% range**: MODERATE GAP. Only cascading-fix-trap-v2 (78%) and phase-boundary-violation (91%) are here. Most scenarios either hit 0% or 100%.
3. **BIMODALITY**: The fundamental problem is that scenarios are either trivially easy for the current agent (ceiling) or trivially hard (0%). The middle range is unstable.

### Why The Bimodal Distribution Exists
Per KE-110 and KE-109:
- The 5-skill stack has driven all "process" scenarios to ceiling (100%)
- Scenarios requiring genuine capability the model lacks (cross-reference, schema knowledge) stay at 0%
- The middle range only exists when there's a *partial* capability gap — the agent CAN do it but doesn't reliably

### What Makes a Good Gap-Fill Scenario
Based on experiments, scenarios in the sweet spot share these properties:
1. **Multiple bugs/issues** where finding ALL of them is hard but finding SOME is easy (hidden-second-bug pattern)
2. **Partial information traps** where surface evidence points to wrong diagnosis (misdiagnosed-regression pattern)
3. **Cross-document reasoning** where the answer requires connecting facts across files (cascade-judgment pattern)
4. **Subtle edge cases** that tests don't cover but the task mentions (partial-test-pass pattern)
5. **Side-effect chains** where fixing one thing breaks another (skill-conflict-partial-fix pattern)

---

## Recommended Next Steps

### Priority 1: Baseline the Untested Scenarios
Run 5-10 baseline trials each on:
1. `hidden-second-bug` — Most likely to be in 30-60% range. Has success_criteria.js. Ready to test.
2. `misdiagnosed-regression` — Has success_criteria.js. Judgment + diagnosis. Ready to test.
3. `skill-conflict-partial-fix` — Side-effect trap. Has work_dir_setup: copy but needs verification.

### Priority 2: Create New Scenarios for 20-40% Range
Design scenarios that exploit the sweet spot properties:
- **Multi-bug with decreasing visibility**: 3 bugs, first is obvious (test failure), second is mentioned in a log, third requires reading a config file that's never referenced. Predict: ~33% find all three.
- **Conflicting test evidence**: Tests that pass but assert wrong behavior (like misleading-test-fix but more subtle). Predict: ~30%.
- **Cross-file dependency chain**: Fix requires modifying 3 files in the right order, where the connection is only visible through import chains. Predict: ~40%.

### Priority 3: Create New Scenarios for 70-85% Range
Design scenarios where the agent usually succeeds but has a specific blind spot:
- **Documentation update after fix**: Code fix is easy, but must also update README/CHANGELOG. Predict: ~75% (agents often forget docs).
- **Regression test addition**: Fix bug + add test for the regression. Most agents fix but don't add tests. Predict: ~80%.

---

## Cross-References
- **KE-110**: Skill stack saturation, gym ceiling
- **KE-109**: Gym-production gap (structural)
- **EXP-108**: Multi-session ceiling data
- **EXP-156**: Hard gate boundary conditions
- **EXP-100**: Complexity stratification (medium vs high)
- **PRIORITY-TRACKER**: H-107 testing blocked by this gap
