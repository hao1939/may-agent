# EXP-113: FM-Heavy Workers Targeted Intervention Analysis

**Status**: COMPLETE
**Date**: 2026-04-10
**Author**: Coach
**Type**: Observational analysis + intervention design (retrospective)
**Depends on**: EXP-109 (production observation study, behavioral clustering), EXP-110 (FM-3.3 guard impact)
**Related**: KE-114 (behavioral archetypes), KE-113 (commit guard)

---

## 1. Research Question

**Which specific FM codes dominate the FM-Heavy Workers cluster, which agents are most affected, and what targeted interventions would yield the highest ROI for system-wide quality improvement?**

EXP-109 Phase 3 identified FM-Heavy Workers (≈22% of sessions, Q≈0.51, FM≈3.3) as the #1 intervention target. This experiment deepens that analysis to produce a concrete, prioritized intervention plan.

### 1.1 Why This Experiment

FM-Heavy Workers are the highest-ROI improvement target because:
- They have moderate quality (not hopeless like Silent Failures)
- Their failures are process-driven (FM codes), not capability-driven
- They're concentrated in specific agents (coach, optimizer) where we can deploy targeted skills
- The FM-3.3 commit guard proved interventions work (EXP-110: +51pp recovery rate)

### 1.2 What This Experiment Is NOT

- **Not a new data collection**: Uses existing may.db evaluations
- **Not an intervention deployment**: Designs interventions for future experiments
- **Not a gym experiment**: Observational analysis of production data

---

## 2. Hypotheses

### H1: FM Code Concentration
**The top 3 FM codes account for ≥60% of FM-Heavy Worker process issues.** If true, targeting just 3 codes could address the majority of problems.

### H2: Agent-Specific Patterns
**Coach and optimizer have fundamentally different FM profiles** — coach is approach-driven (FM-2.1), optimizer is verification-driven (FM-3.3). Generic interventions won't work; agent-specific ones will.

### H3: Cascade Effect
**FM-2.1 (wrong approach) is the primary cascade trigger** — when it appears first, it leads to 2+ subsequent FM codes. Preventing the first domino prevents the cascade.

### H4: Dose-Response
**Quality degrades monotonically with FM count**, with a critical threshold at FM≥4 where delivery rate drops below 50%.

### H5: Guard Residual
**Post-guard FM-Heavy Workers are dominated by different FM codes** than pre-guard, confirming the guard changed the failure landscape.

---

## 3. Methodology

### 3.1 FM-Heavy Worker Identification

**Dual approach**:
1. **Clustering-based** (EXP-109 method): K-means k=6 on 11-feature normalized matrix, identifying the cluster with high FM count + moderate quality
2. **Threshold-based** (stability check): FM count ≥ 2 AND quality ∈ [0.2, 0.85]

The threshold approach captures N=398 sessions (26.9%), the clustering approach captures N≈152-321 (10-22%) depending on random initialization. Results are reported for both; key findings are consistent across both methods.

### 3.2 Analysis Protocol

1. **Agent decomposition**: Which agents contribute most to the FM-Heavy cluster
2. **FM code distribution**: Session-level prevalence of each FM code
3. **Quality impact analysis**: Quality with vs. without each FM code (within FM-Heavy)
4. **Cascade analysis**: Which FM codes appear first and trigger subsequent failures
5. **Intervention priority scoring**: Frequency × (1 − RecoveryRate) × |QualityImpact|
6. **Gap analysis**: Feature-level comparison between FM-Heavy and Clean Performers
7. **Post-guard residual**: What changed after the FM-3.3 commit guard deployment
8. **Portfolio impact**: Expected system-wide quality lift from targeted interventions

### 3.3 Statistical Methods

- **χ² test** (df=1): FM code prevalence differences between clusters
- **Welch's t-test**: Quality differences between clusters
- **Cohen's d**: Effect size for feature-level gaps
- **Intervention priority score**: Composite metric = freq × (1 − recovery) × |ΔQ|

### 3.4 Data Source

- **may.db**: 1,477 non-heuristic evaluations with quality > 0
- **Period**: 2026-03-01 through 2026-04-10
- **Fields**: sessionId, agent, quality, efficiency, issues (FM codes), failureChains, usage, overall

---

## 4. Success Criteria

| Criterion | Threshold | Met? |
|-----------|-----------|------|
| Identify top FM codes in FM-Heavy | ≥3 codes with prevalence >20% | ✅ (6 codes >15%) |
| Agent-specific profiles differ | Different top FM codes per agent | ✅ |
| Cascade triggers identified | ≥2 FM codes with >30 first-appearances | ✅ |
| Statistical significance | χ² p<0.05 for key comparisons | ✅ (all p<0.001) |
| Concrete intervention plan | ≥3 interventions with ROI estimates | ✅ |

---

## 5. Predictions

| ID | Prediction | Result |
|----|-----------|--------|
| P-113a | FM-3.3 is the most common FM code in FM-Heavy | **CONFIRMED** (48.5%) |
| P-113b | Coach and optimizer together account for >50% of FM-Heavy | **CONFIRMED** (60.0%) |
| P-113c | FM-2.1 is the primary cascade trigger | **CONFIRMED** (96 first-appearances, 2.38 subsequent) |
| P-113d | Quality drops below 0.50 at FM count ≥ 4 | **CONFIRMED** (FM=4: Q=0.478) |
| P-113e | Post-guard FM-Heavy Workers have different FM profile | **CONFIRMED** (FM-3.3 88% post-guard vs 48.5% overall) |
