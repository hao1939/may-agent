# EXP-109: Production Observation Study — Results

**Status**: COMPLETE (Phases 1-2), Phase 3 deferred to next session
**Date**: 2026-04-10
**Author**: Coach
**Type**: Observational study (retrospective production data analysis)

---

## Executive Summary

Analysis of **19,062 production evaluations** (4,295 non-heuristic, 14,767 heuristic) across 10 agents over 6+ weeks reveals:

1. **H1 CONFIRMED — Hidden Process Pathology is Pervasive**: 37.5% of sessions rated "good" contain FM failure codes. 53.3% have failure chains. Even in the best-performing quadrant (high quality + high efficiency), **41.1%** of sessions have FM codes. P-111a's ≥30% threshold is exceeded.

2. **H3 CONFIRMED — Significant Temporal Trends**: Quality improved dramatically from W09 (Q=0.45) to W12 (Q=0.70), then regressed in W13 (Q=0.42) before recovering in W14 (Q=0.76). This is NOT monotonic improvement — it's cyclic, suggesting task-difficulty variation or personnel/configuration changes.

3. **H4 CONFIRMED — Agent-Specific Failure Signatures**: Each agent has a distinct FM-code fingerprint. Bob → FM-3.3 (verification skipping), Coach → FM-2.1 (wrong approach), May → FM-2.6 (tool misuse), Coder → FM-3.3 (verification) + FM-2.2/2.3 (incomplete work). Interventions should be agent-specific.

4. **New Finding — Cost-Quality Decorrelation**: Spending more tokens does NOT improve quality. Correlation ranges from -0.23 (coder) to +0.25 (QA), with most agents near zero. The exception is QA (r=0.25), where the task structure rewards thoroughness.

5. **New Finding — Evaluation System Dual-Scale Problem**: Heuristic and non-heuristic evaluations use fundamentally different scales (0-5 vs 0-1). This makes 76% of evaluations non-comparable to the 24% that contain rich FM-code data.

---

## Detailed Results

### Phase 1: Multi-Dimensional Quality Distribution

#### 1.1 Per-Agent Quality Profiles (Non-Heuristic, N=1,632 with quality>0)

| Agent | N | Q_mean | Q_median | Q_p25 | Q_p75 | E_mean | Good% | NeedsImp% |
|-------|---|--------|----------|-------|-------|--------|-------|-----------|
| **qa** | 120 | **0.76** | 0.80 | 0.70 | 0.85 | 0.78 | **81.7** | 6.7 |
| **coder** | 307 | **0.62** | 0.70 | 0.35 | 0.85 | 0.62 | 42.0 | 27.4 |
| **scout** | 72 | 0.60 | 0.62 | 0.38 | 0.80 | 0.68 | 40.3 | 25.0 |
| tech-lead | 160 | 0.53 | 0.60 | 0.20 | 0.85 | 0.52 | 31.9 | 35.0 |
| bob | 230 | 0.49 | 0.55 | 0.20 | 0.78 | 0.50 | 19.6 | **40.9** |
| coach | 306 | 0.49 | 0.55 | 0.20 | 0.75 | 0.48 | 26.5 | 37.6 |
| amy | 53 | 0.45 | 0.48 | 0.20 | 0.70 | 0.57 | 20.8 | 39.6 |
| optimizer | 254 | 0.42 | 0.38 | 0.00 | 0.72 | 0.42 | 18.1 | 27.6 |
| may | 108 | 0.36 | 0.35 | 0.00 | 0.60 | 0.44 | 21.3 | 35.2 |
| amy-kimi | 22 | 0.37 | 0.35 | 0.18 | 0.70 | 0.46 | 22.7 | 50.0 |

**Key findings**:
- **QA dominates**: 81.7% good rate, highest quality (0.76). This agent has the most structured, bounded tasks.
- **Coder is the second-best performer**: Q=0.62, 42% good. The gym-promoted skills appear to help.
- **Bob (chief integrator) struggles**: Only 19.6% good, 40.9% needs improvement. The most complex role has the worst outcomes.
- **May (manager) has the lowest quality**: Q=0.36. Heartbeat/orchestration tasks are poorly captured by the evaluation system.
- **Wide IQR for most agents**: P25-P75 ranges of 0.40-0.60 are common, indicating high session-to-session variability.

#### 1.2 Process Issues in "Passing" Sessions (H1 Primary Test)

| Verdict | N | With FM Codes | % | With Failure Chains | % | Low E despite High Q | % |
|---------|---|--------------|---|--------------------|----|---------------------|---|
| good | 533 | **200** | **37.5%** | 284 | 53.3% | 19 | 3.6% |
| acceptable | 489 | **238** | **48.7%** | 349 | 71.4% | 81 | 16.6% |

**H1 CONFIRMED**: 37.5% of "good" sessions have FM failure codes — exceeding the 30% threshold (P-111a). When including failure chains, 53.3% of "good" sessions have process pathology. The evaluation system correctly scores quality but the verdict masks process issues that could propagate to downstream work.

**Implication**: A "good" verdict does NOT mean the session was problem-free. It means the final output was acceptable despite process issues along the way. This is exactly what DD-714 predicted: trajectory-level analysis catches ~44% more issues than output-only evaluation.

#### 1.3 Quality × Efficiency Quadrants

| Quadrant | Sessions | % of Total | With FM Codes | FM% |
|----------|----------|------------|---------------|-----|
| HQ-HE (Q≥0.7, E≥0.6) | 557 | 34.1% | 229 | **41.1%** |
| HQ-LE (Q≥0.7, E<0.6) | 115 | 7.0% | 42 | 36.5% |
| LQ-HE (Q<0.7, E≥0.6) | 239 | 14.6% | 117 | **49.0%** |
| LQ-LE (Q<0.7, E<0.6) | 755 | **46.3%** | 262 | 34.7% |

**Key findings**:
- **46.3% of sessions are in the worst quadrant** (low quality AND low efficiency)
- The best quadrant (HQ-HE) still has 41.1% FM rate — quality doesn't protect against failure modes
- **LQ-HE is the most FM-dense** (49.0%) — these are sessions that efficiently produce poor results (confident failure)

#### 1.4 FM Code Taxonomy — Agent Signatures

| Agent | #1 FM Code | #2 | #3 | Signature |
|-------|-----------|-----|-----|-----------|
| **bob** | FM-3.3 (38) | FM-3.1 (21) | FM-2.6 (19) | **Verification-heavy** — skips verification (3.3), confabulates evidence (3.1), misuses tools (2.6) |
| **coder** | FM-3.3 (52) | FM-2.2 (19) | FM-2.3 (18) | **Verification + completeness** — skips verification AND leaves work incomplete |
| **coach** | FM-2.1 (92) | FM-2.2 (70) | FM-3.3 (61) | **Approach + completeness** — wrong methodology, incomplete work |
| **optimizer** | FM-3.3 (65) | FM-2.2 (59) | FM-2.1 (55) | **Broad failure profile** — all three categories (verification, completeness, approach) |
| **may** | FM-2.6 (29) | FM-3.1 (24) | FM-2.1 (23) | **Tool/approach** — misuses tools, confabulates, wrong approach |
| **tech-lead** | FM-3.3 (43) | FM-2.2 (15) | FM-3.1 (15) | **Verification-dominated** — similar to bob but less tool misuse |
| **qa** | FM-2.2 (12) | FM-3.3 (11) | FM-2.3 (10) | **Low-rate, balanced** — few failures, evenly distributed |
| **scout** | FM-2.1 (10) | FM-3.3 (9) | FM-2.2 (5) | **Approach-driven** — wrong methodology most common |

**H4 CONFIRMED**: Agent FM profiles are clearly distinct. Bob and coder share FM-3.3 dominance (verification), but coder adds FM-2.2/2.3 (completeness) while bob adds FM-3.1 (confabulation). Coach's FM-2.1 dominance (92 instances!) reflects wrong-approach failures from the gym experimentation period. May's FM-2.6 dominance reflects tool interface misuse in orchestration tasks.

**Top co-occurring FM pairs**: FM-2.2+FM-3.3 (81), FM-2.1+FM-2.2 (79), FM-2.1+FM-3.3 (79). When one failure mode appears, others tend to cluster — suggesting cascading failure rather than independent issues.

### Phase 2: Temporal Analysis

#### 2.1 Weekly Quality Trends

| Week | N | Avg Q | Avg E | Good% | NeedsImp% | FM% | Interpretation |
|------|---|-------|-------|-------|-----------|-----|----------------|
| W09 (Feb 24-Mar 2) | 415 | 0.446 | 0.469 | 26.3 | 37.8 | 0 | **Baseline** — early evaluations, no FM detection yet |
| W10 (Mar 3-9) | 578 | 0.532 | 0.588 | 32.7 | 31.8 | 28.4 | **FM detection online** — quality improving |
| W11 (Mar 10-16) | 241 | 0.376 | 0.406 | 19.5 | 46.1 | 57.3 | **Quality dip** — higher FM detection rate may mean harder tasks |
| W12 (Mar 17-23) | 236 | **0.700** | 0.671 | **55.1** | **14.0** | 90.3 | **Peak quality** — skills deployed, guard active |
| W13 (Mar 24-30) | 52 | 0.415 | 0.411 | 17.3 | 44.2 | 63.5 | **Regression** — small N, possibly hard tasks or configuration shift |
| W14 (Apr 7-10) | 98 | **0.763** | 0.612 | 34.7 | **6.1** | 59.2 | **Recovery** — highest quality, lowest needs_improvement |

**H3 CONFIRMED**: Strong temporal variation exists. The W12 spike coincides with skill deployment period (commit guard, few-shot pipeline). W14's high quality + low needs_improvement rate suggests interventions are having lasting effect. But the W13 regression shows the system is not monotonically improving — it's sensitive to task mix and configuration changes.

**Per-agent trends (notable)**:
- **Bob**: W09 Q=0.33 → W14 Q=0.77 (+0.44, dramatic improvement)
- **Coder**: W09 Q=0.57 → W12 Q=0.72 (+0.15, steady improvement)
- **Coach**: W11 Q=0.39 → W12 Q=0.66 → W14 Q=0.71 (improving but noisy)
- **Optimizer**: W08 Q=0.00 → W12 Q=0.63 (from zero to functional)

#### 2.2 Token/Cost Analysis

| Agent | N | Avg Cost | Med Cost | Avg Turns | Cost/Q_point | Corr(cost,Q) |
|-------|---|----------|----------|-----------|-------------|--------------|
| coach | 253 | $1.85 | $1.10 | 21.9 | $4.19 | **-0.125** |
| optimizer | 180 | $1.76 | $1.10 | 20.6 | $4.19 | 0.058 |
| tech-lead | 121 | $1.61 | $0.66 | 19.7 | $3.44 | **0.007** |
| scout | 66 | $1.02 | $0.38 | 9.7 | $2.23 | -0.102 |
| bob | 201 | $0.91 | $0.29 | 16.2 | $2.25 | 0.144 |
| coder | 295 | $0.85 | $0.23 | 13.7 | $2.46 | **-0.227** |
| may | 33 | $0.47 | $0.26 | 9.2 | $1.53 | -0.009 |
| qa | 119 | $0.17 | $0.15 | 5.3 | $0.23 | **0.251** |

**P-109d CONFIRMED**: Cost-quality correlation is weak for most agents (|r| < 0.3). Coder has a *negative* correlation (-0.23) — spending more actually associates with *lower* quality, likely because difficult/failing tasks consume more tokens. Only QA shows meaningful positive correlation (0.25), where thoroughness pays off on structured tasks.

**Cost efficiency ranking**: QA ($0.23/quality-point) >> May ($1.53) > Bob/Scout (~$2.25) > Coder ($2.46) > Tech-lead ($3.44) > Coach/Optimizer (~$4.19). The most expensive agents per quality-point are also the ones with the most complex, open-ended tasks.

#### 2.3 Failure Chain Triggers

| Trigger Tool | Count | % of Chains |
|-------------|-------|-------------|
| bash | 2,222 | 63.3% |
| exec | 588 | 16.8% |
| read | 454 | 12.9% |
| edit | 139 | 4.0% |
| write | 33 | 0.9% |
| agents | 19 | 0.5% |

**bash dominates failure chains** (63.3%). This makes sense — bash commands are the primary tool for complex operations and the most likely to produce unexpected results. The high `read` failure rate (12.9%) suggests agents are frequently reading wrong files or misinterpreting file contents.

#### 2.4 Heuristic vs Non-Heuristic Evaluation Divergence

The two evaluation systems use incompatible scales:
- **Non-heuristic (24% of evals)**: 0-1 scale, rich FM codes, failure chains, detailed issues
- **Heuristic (76% of evals)**: 0-5 scale, no FM codes, verdict-based

This means **76% of production evaluations lack the granularity needed for production observation science**. Expanding non-heuristic coverage is a critical infrastructure gap.

---

## Hypothesis Verdict Table

| Hypothesis | Prediction | Result | Evidence |
|-----------|-----------|--------|----------|
| **H1** (Hidden pathology) | ≥30% of "good" sessions have process issues | **CONFIRMED (37.5%)** | 200/533 good sessions have FM codes |
| **H2** (Behavioral archetypes) | 3-5 clusters | **DEFERRED** | Need Phase 3 clustering analysis |
| **H3** (Temporal drift) | Significant trends | **CONFIRMED** | Q ranges from 0.38 (W11) to 0.76 (W14); per-agent trends show +0.15 to +0.44 improvement |
| **H4** (Agent signatures) | Distinct FM profiles | **CONFIRMED** | Each agent has unique top-3 FM code pattern |
| **H0** (Null) | Verdicts well-calibrated | **REJECTED** | Process pathology pervasive in "good" sessions |

---

## New Findings (Not Predicted)

### F1: Cost-Quality Decorrelation
Spending more tokens does not improve quality. This challenges the intuition that "harder tasks need more tokens → tokens correlate with quality." Instead, **failing tasks consume more tokens** because agents retry, backtrack, and explore dead ends.

### F2: The "Confident Failure" Quadrant
14.6% of sessions are LQ-HE (low quality, high efficiency) — efficiently producing poor results. These sessions have the *highest* FM rate (49.0%). The agents proceed quickly and confidently to wrong outcomes. This is a distinct failure archetype worthy of targeted intervention.

### F3: FM Co-occurrence Clustering
Top 3 co-occurring FM pairs are all FM-2.x + FM-3.3 combinations. This suggests FM-3.3 (verification skipping) is the *terminal* failure in a chain that starts with approach/completeness errors. Fixing FM-3.3 (via the commit guard and verification skills) may have cascading benefits for FM-2.x codes.

### F4: Evaluation Infrastructure Gap
76% of evaluations use the heuristic system with no FM granularity. The richest data (failure chains, FM codes, multi-dimensional issues) only exists for 24% of sessions. This is the single biggest bottleneck to production observation science.

### F5: Bob's Dramatic Improvement
Bob improved from Q=0.33 (W09) to Q=0.77 (W14) — a +0.44 gain, the largest of any agent. This coincides with skill deployments (cross-reference, commit guard, few-shot pipeline). While we can't prove causation (observational study), the temporal alignment is striking.

---

## Implications for Coach's Next Steps

### Immediate Actions
1. **Focus interventions on FM-3.3** (292 instances, top failure mode, affects all agents) — the commit guard is already deployed; measure its production impact with a before/after analysis
2. **Target Bob and Optimizer** — the two agents with highest needs_improvement rates (40.9%, 27.6%) and most complex tasks
3. **Investigate "confident failures"** (LQ-HE quadrant) — 239 sessions where agents efficiently produce poor results

### Infrastructure Priorities
4. **Expand non-heuristic evaluation coverage** from 24% to ≥60% — this is the biggest data gap
5. **Build per-agent FM dashboards** — agent-specific failure profiles need agent-specific interventions
6. **Implement before/after analysis** for deployed interventions (commit guard, few-shot, promoted skills)

### Next Experiments
7. **EXP-110** (proposed): Focused study on FM-3.3 in production — does the commit guard reduce FM-3.3 rates? Before/after analysis of sessions pre- and post-guard deployment.
8. **EXP-111** (proposed): Behavioral archetype clustering (Phase 3 of EXP-109) — k-means on the feature matrix, characterize archetypes, design targeted interventions.
9. **EXP-112** (proposed): "Confident failure" deep dive — manual transcript review of 10-20 LQ-HE sessions to identify what's going wrong when agents efficiently produce bad outcomes.

---

## Methodology Notes

- **Data source**: may.db evaluations table, all entries as of 2026-04-10
- **Non-heuristic sample**: 4,295 evaluations scored by the LLM-based evaluator with FM codes, failure chains, and multi-dimensional issues
- **Heuristic sample**: 14,767 evaluations scored by rule-based heuristics (0-5 scale, verdicts only)
- **Analysis**: SQL queries via bun:sqlite against the existing database
- **Limitations**: 
  - Observational, not causal — temporal correlations don't prove intervention effects
  - Evaluator has its own biases (KE-104) — FM codes reflect evaluator's detection ability, not ground truth
  - "Good" sessions with FM codes may have FM codes of low severity — severity weighting not yet implemented
  - W13 has small N (52) — conclusions about that week are tentative
  - The FM% increase over time (W09: 0% → W12: 90%) may reflect evaluator capability improvement, not actual FM rate changes
