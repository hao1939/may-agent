# Gym Cost/Value Analysis

**Date**: 2026-04-14 | **Period**: Mar 24 – Apr 14 (3 weeks) | **Data source**: `.state/may.db` gym_runs + sessions tables

---

## Executive Summary

The gym consumed **~50 hours of run time** across **1,305 runs** and **138 scenarios**. Of those, **244 runs (19%)** went to 11 scenarios that have **never passed** — pure waste at **7.6 hours**. Another **9 hours** went to 26 already-solved scenarios (100% pass rate) being re-run 5+ times each. Together, that's **~17 hours (34% of gym time)** with zero marginal value. The remaining **~33 hours** produced genuine signal: tracking improvements, validating fixes, and benchmarking new capabilities.

---

## 1. Volume & Trajectory

| Week | Runs | Pass Rate | Hours |
|------|------|-----------|-------|
| W12 (Mar 24-30) | 152 | 66.4% | 3.4h |
| W13 (Mar 31-Apr 6) | 22 | 86.4% | 0.6h |
| W14 (Apr 7-13) | 485 | 60.2% | 21.6h |
| W15 (Apr 14, partial) | 646 | 52.6% | 24.2h |
| **Total** | **1,305** | **57.6%** | **49.8h** |

Weekly gym runs jumped **~30x** from W13 → W15. This is the dominant consumer of system resources — the gym-related orchestration sessions (coach, bob, optimizer managing gym work) add another estimated **~400 session-hours** on top.

---

## 2. Scenario Health Classification

| Category | Scenarios | Runs | % of Total Runs |
|----------|-----------|------|-----------------|
| ✅ Solved (100% pass) | 80 | 375 | 29% |
| 📈 Healthy (50-99%) | 19 | 410 | 31% |
| ⚠️ Struggling (1-49%) | 11 | 259 | 20% |
| ❌ Broken (0% pass, never) | 28 | 261 | 20% |

**80 of 138 scenarios (58%)** are at 100% — fully solved. These are the gym's success story.

**28 scenarios (20%)** have 0% pass rate. Of these, 17 have only 1-2 runs (reasonable exploration). But **11 have 3+ runs with zero passes** — these are wasting resources.

---

## 3. The Waste: Never-Passing Scenarios (>3 runs)

| Scenario | Runs | Hours | Assessment |
|----------|------|-------|------------|
| contradictory-requirements | 57 | 2.3h | **Biggest drain.** Root scenario never solved; variants partially work |
| cascading-fix-trap-v2 | 41 | 1.2h | 41 attempts, 0 passes. v3 works at 100% — v2 may be broken |
| escalation-impossible-task | 41 | 1.0h | May be intentionally unsolvable (tests agent refusal) |
| exp163-baseline | 30 | 0.4h | Baseline variant — always fails by design? |
| misleading-test-fix | 26 | 0.8h | 26 runs, still 0% |
| context-proof-build-xref | 13 | 0.5h | |
| wrong-error-message | 10 | 0.1h | |
| contradictory-req variants (4) | 26 | 1.3h | ch3-fewshot, 128a/b/c — all 0% |
| **Total** | **244** | **7.6h** | **19% of all gym runs** |

**Key finding**: `cascading-fix-trap-v2` has 41 runs at 0%, but `cascading-fix-trap-v3` has 5 runs at 100%. Either v2's checks are broken or it's a fundamentally different challenge that's been superseded.

---

## 4. The Other Waste: Solved Scenarios Still Running

26 scenarios at 100% pass rate have 5+ runs each, totaling **327 runs and ~9.1 hours**. Top offenders:

| Scenario | Runs | Hours | Note |
|----------|------|-------|------|
| hidden-dependency | 36 | 1.1h | 36 runs, all pass — what's the point? |
| exp156-misleading-test-hard-gate | 21 | 0.5h | |
| investigate-fix-pattern | 21 | 0.2h | |
| stale-approach-fixation | 21 | 0.3h | |
| exp144-hidden-dep-structured | 19 | 1.0h | |
| exp144-compound-edit-decoupled | 18 | 1.5h | |
| exp144-compound-edit-structured | 16 | 1.2h | |
| (19 more at 5-15 runs each) | 175 | 4.3h | |

These re-runs serve as **regression baselines** if configurations change, but running 36 times for a scenario that's never failed seems excessive. A cap of 5-10 runs would suffice.

---

## 5. Actionable Successes (Where Gym Generated Value)

Scenarios that showed measurable improvement over time (first-half → second-half pass rate):

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| exp162a-verify-gate | 0% | 100% | +100pp |
| conflicting-evidence | 7% | 100% | +93pp |
| tangled-inventory | 0% | 83% | +83pp |
| behavior-escalation-stubborn | 32% | 100% | +68pp |
| kb-discovery-hints-126 | 33% | 67% | +33pp |
| mock-leak-trap | 0% | 31% | +31pp |
| read-before-edit | 6% | 29% | +23pp |
| convention-verify-edit | 88% | 100% | +12pp |

These 8 scenarios represent **genuine skill development** driven by gym iteration. The ~310 runs across these scenarios were well-spent.

**However**, 11 scenarios showed **degradation** (>10pp decline), suggesting regressions or instability in supposedly-solved areas.

---

## 6. Cost Context: Gym vs Everything Else

| Category | Sessions (last week) | Total Hours | Avg Ops/Session |
|----------|---------------------|-------------|-----------------|
| **Gym-related** (coach/bob/opt orchestrating gym) | ~2,200 | ~328h | 18-23 |
| **All sessions** (last week) | 4,201 | 310h | 13.5 |

The gym-related orchestration load (coach: 195h, bob: 79h, optimizer: 53h) **dominates system cost**. Token costs aren't tracked in gym_runs (cost_usd is NULL for all records), but at ~18-23 ops per orchestration session, the token spend scales with session count.

**Rough estimate**: If each gym run triggers 1-3 orchestration sessions averaging 18 ops at ~$0.02-0.05/op, the weekly gym cost is approximately **$400-$1,200/week** at current volume (646 runs/week × ~2 sessions × 18 ops × $0.03).

---

## 7. Recommendations

### Immediate (save ~34% of gym resources)

1. **Retire never-passing scenarios with 10+ runs**: `contradictory-requirements`, `cascading-fix-trap-v2`, `escalation-impossible-task`, `exp163-baseline`, `misleading-test-fix`. Either fix the scenario definitions or mark them as known-impossible. **Saves ~5h/week.**

2. **Cap solved scenarios at 10 runs**: Once a scenario hits 100% over 10 runs, stop re-running unless the agent config changes. **Saves ~4h/week.**

3. **Track token costs**: The `cost_usd` field is NULL for all 1,305 records. Enable this to get actual spend data.

### Medium-term

4. **Smart scheduling**: Only re-run solved scenarios when framework SHA changes (the field exists but isn't populated). Focus new runs on the 11 "struggling" scenarios where improvement is possible.

5. **Investigate regressions**: 11 scenarios degraded >10pp — these signal that recent changes may have broken previously-working capabilities. Worth investigating before adding new scenarios.

6. **Audit `contradictory-requirements` family**: This single root scenario plus its 7+ variants account for ~200 runs. The base scenario never passes, but several variants do. Consolidate to the variants that actually test something achievable.

---

## Data Appendix

- **Total gym runs**: 1,305 (Mar 24 – Apr 14)
- **Total gym run time**: 49.8 hours
- **Unique scenarios**: 138
- **Average run duration**: 140 seconds
- **Primary gym agent**: coder (1,002 of 1,305 runs)
- **Orchestration agents**: coach (1,115 gym sessions), bob (588), optimizer (520)
- **Pass rate overall**: 57.6% (752 pass / 553 fail)
- **Token cost data**: Not available (cost_usd NULL for all records)
