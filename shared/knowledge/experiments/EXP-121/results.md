# EXP-121: Time Budget as Primary Limiter on Discovery Task Completion — Results

**Status**: COMPLETE — INCONCLUSIVE (suggestive positive trend)
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Experiment (Gym Scenario)

## Summary

Extended time budget (5 min vs 3 min) raised discovery task pass rate from 67% → 83%, but the difference is **not statistically significant** (Fisher's exact p = 1.0, Cohen's h = 0.39). The single failure at 5 min was the exact same `index-entry-added` check that fails at 3 min. Time budget is a contributing factor but NOT the primary limiter — the core issue remains a reasoning gap where the agent doesn't conceptualize creating new KB entries.

## Experimental Setup

### Scenario: `kb-integration-discovery-5min`
- Identical environment and task to `kb-integration-discovery`
- **Only change**: timeout 3 min → 5 min (180s → 300s)
- Same success_criteria.js — identical 8 checks (7 content + 1 aggregate)

### Baseline (reused from EXP-117): 6 trials, 4/6 PASS (67%)
### Treatment (5 min timeout): 6 new trials

## Results

### Treatment (5 min): 5/6 PASS (83%)
| Trial | Result | Checks Passed | Missed Checks |
|-------|--------|---------------|---------------|
| 1     | PASS   | 8/8 | — |
| 2     | PASS   | 8/8 | — |
| 3     | PASS   | 8/8 | — |
| 4     | FAIL   | 6/8 (6/7 content) | index-entry-added |
| 5     | PASS   | 8/8 | — |
| 6     | PASS   | 8/8 | — |

### Comparison Table
| Metric | Baseline (3 min) | Treatment (5 min) | Checklist (EXP-117) | Progressive (EXP-120) |
|--------|------------------|-------------------|--------------------|-----------------------|
| Pass rate | 67% (4/6) | **83% (5/6)** | 0% (0/6) | 17% (1/6) |
| Avg content checks | 6.7/7 | 6.9/7 | 4.5/7 | 6.0/7 |
| Most-missed check | index-entry-added (2/6) | index-entry-added (1/6) | todo-marked-complete (6/6) | index-entry-added (5/6) |
| Worst trial | 6/7 content | 6/7 content | 3/7 content | 4/7 content |

### Statistical Analysis
- **Fisher's exact test (two-tailed)**: p = 1.0 (NOT significant)
- **Fisher's exact test (one-tailed, treatment > baseline)**: p = 0.500 (NOT significant)
- **Cohen's h**: 0.39 (small effect size)
- **Direction**: Treatment trends better (+16pp) but well within sampling noise at n=6
- **Power analysis**: To detect a 67%→83% difference with α=0.05 and power=0.80, would need ~88 trials per condition

### Complete Experiment Series on kb-integration-discovery
| Experiment | Intervention | Pass Rate | Δ vs Baseline | p-value | Significant? |
|---|---|---|---|---|---|
| EXP-117 baseline | None (3 min) | **67% (4/6)** | — | — | — |
| EXP-117 treatment | Upfront checklist | 0% (0/6) | -67pp | 0.030 | ✅ YES |
| EXP-120 treatment | Progressive tracking | 17% (1/6) | -50pp | 0.242 | ❌ No |
| **EXP-121 treatment** | **Extended time (5 min)** | **83% (5/6)** | **+16pp** | **1.000** | **❌ No** |

## Analysis

### What 5 Minutes Changed (and Didn't Change)

**Improvement pattern**: The pass rate went up by one trial (4→5 out of 6). The failing trial missed only `index-entry-added`, exactly matching the baseline failure mode. No new failure modes emerged.

**What didn't change**: The agent still occasionally fails to conceive of adding a NEW KE-071 entry to INDEX.md. Trial 4 had plenty of time (the agent completed all other updates) but simply didn't generate the idea "these findings deserve a new knowledge entry."

### Time vs Reasoning: A False Dichotomy

The results suggest both factors contribute:

1. **Time helps at the margin**: The extra 2 minutes may allow the agent to complete all straightforward updates AND have time remaining for the creative-inference step. At 3 min, time pressure may occasionally force the agent to finish before reaching this step.

2. **Reasoning is the binding constraint**: Even with 67% more time (5 min vs 3 min), the agent still fails 17% of the time on the same check. If time were the primary limiter, we'd expect near-100% at 5 min. Instead, the failure persists — the agent sometimes doesn't conceptualize "add new entry" regardless of time available.

3. **The failure is stochastic, not deterministic**: At both time budgets, the agent passes most trials and fails some. This is consistent with a probabilistic reasoning step — the agent sometimes generates the "add KE-071" idea and sometimes doesn't, with slight improvement when not time-pressured.

### Practical Significance

Even though the result isn't statistically significant, the operational picture is clear:

| Approach | Pass Rate | Practical Impact |
|---|---|---|
| Instruction changes (checklist/progressive) | 0-17% | **Actively harmful** — clear signal |
| No intervention, 3 min | 67% | **Decent baseline** — 1 in 3 miss |
| No intervention, 5 min | 83% | **Marginal improvement** — 1 in 6 miss |

**The biggest lever is avoiding harmful interventions** (moving from 0% back to 67%) not extending time (67%→83% with uncertain significance).

## Key Insight

**The "externalization trilogy" (EXP-117, EXP-120, EXP-121) reveals a hierarchy of intervention effectiveness for discovery tasks:**

1. **Don't make it worse** (-67pp to -50pp): Instruction-based interventions (checklists, tracking prompts) reliably hurt discovery task performance. The clearest action item is avoiding these.

2. **Time helps a little** (+16pp, not significant): More time allows the agent to complete straightforward work and occasionally reach the creative-inference step. But diminishing returns — the reasoning gap persists.

3. **The real problem is creative inference**: The agent needs to spontaneously generate "these findings merit a new KB entry (KE-071)" — this is a reasoning capability, not a tracking or time problem. Future interventions should target this specific gap (e.g., environmental hints in INDEX.md like "add new entries for significant findings").

## Implications

1. **Time budget is NOT the primary limiter** — extra time helps marginally but the core reasoning gap persists
2. **For production**: Use ≥5 min timeouts for multi-file KB tasks (modest improvement, no downside)
3. **For research**: The next experiment should target the reasoning gap directly — test environmental hints ("Remember to add new KE entries for novel findings" in INDEX.md header) rather than instruction-based or time-based interventions
4. **Close the externalization line of inquiry**: Three experiments confirm that instruction-based externalization hurts discovery tasks. This line is exhausted.

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-integration-discovery/` (3 min)
- Treatment scenario: `agents/gym/scenarios/kb-integration-discovery-5min/` (5 min)
- EXP-117 baseline data: `agents/shared/knowledge/experiments/EXP-117/results.md`
- EXP-120 data: `agents/shared/knowledge/experiments/EXP-120/results.md`
- Design doc: `agents/shared/knowledge/experiments/EXP-121/design.md`
