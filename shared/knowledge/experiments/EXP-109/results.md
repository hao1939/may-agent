# EXP-109: Production Observation Study — Results

**Status**: COMPLETE (Phases 1-3)
**Date**: 2026-04-10
**Author**: Coach
**Type**: Observational study (retrospective production data analysis)

---

## Executive Summary

Analysis of **19,062 production evaluations** (4,295 non-heuristic, 14,767 heuristic) across 10 agents over 6+ weeks reveals:

1. **H1 CONFIRMED — Hidden Process Pathology is Pervasive**: 37.5% of sessions rated "good" contain FM failure codes. 53.3% have failure chains. Even in the best-performing quadrant (high quality + high efficiency), **41.1%** of sessions have FM codes. P-111a's ≥30% threshold is exceeded.

2. **H2 PARTIALLY CONFIRMED — Behavioral Archetypes as Spectrum**: K-means clustering (k=6, silhouette=0.273) reveals 6 behavioral archetypes, but with weak separation — production behavior is a continuous spectrum, not discrete types. The four main archetypes: **Clean Performers** (43%), **FM-Heavy Workers** (22%), **Silent Failures** (19%), and **Expensive Grinders** (7%).

3. **H3 CONFIRMED — Significant Temporal Trends**: Quality improved dramatically from W09 (Q=0.45) to W12 (Q=0.70), then regressed in W13 (Q=0.42) before recovering in W14 (Q=0.76). This is NOT monotonic improvement — it's cyclic, suggesting task-difficulty variation or personnel/configuration changes.

4. **H4 CONFIRMED — Agent-Specific Failure Signatures**: Each agent has a distinct FM-code fingerprint. Bob → FM-3.3 (verification skipping), Coach → FM-2.1 (wrong approach), May → FM-2.6 (tool misuse), Coder → FM-3.3 (verification) + FM-2.2/2.3 (incomplete work). Interventions should be agent-specific.

5. **New Finding — The #1 Intervention Target is FM-Heavy Workers**: 321 sessions (22%) achieve moderate quality (0.51) but have 3.3 FM codes per session (vs 0.39 for Clean Performers). 95% have execution failures, 78% have verification failures. These are fixable with targeted skills. Dominated by optimizer (28%) and coach (27%).

6. **New Finding — 19% of Sessions Fail Silently**: 283 sessions have low quality (0.27), no FM codes (0.12), and almost never deliver results (13%). Current process tools (skills, guards) will NOT help these — they need capability or routing improvements.

7. **New Finding — Cost-Quality Decorrelation**: Spending more tokens does NOT improve quality. Correlation ranges from -0.23 (coder) to +0.25 (QA), with most agents near zero.

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
| **H2** (Behavioral archetypes) | 3-5 clusters | **PARTIALLY CONFIRMED** | 6 clusters found (silhouette=0.27, weak but present). Production behavior is a spectrum, not discrete types. See Phase 3. |
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

### Immediate Actions (Updated with Phase 3 Findings)
1. **Target the FM-Heavy Workers cluster (321 sessions, 22%)** — the highest-ROI intervention target. 95% have FM-2.x, 78% have FM-3.x. Dominated by optimizer (28%) and coach (27%).
2. **Deploy FM-3.3 guards to optimizer and coach** — these agents contribute 55% of the FM-Heavy Workers cluster. The commit guard is deployed for coder; extend to optimizer and coach.
3. **Address Silent Failures differently** — 283 sessions (19%) fail without FM signals. Don't waste skill/guard improvements on these — they need better task routing or early termination.
4. **Investigate "confident failures"** (LQ-HE quadrant / FM-Heavy Workers overlap) — sessions that efficiently produce poor results

### Infrastructure Priorities
5. **Expand non-heuristic evaluation coverage** from 24% to ≥60% — this is the biggest data gap
6. **Build per-agent FM dashboards** — agent-specific failure profiles need agent-specific interventions
7. **Implement continuous FM-rate monitoring** — use the cluster profiles as baselines, track shifts over time

### Next Experiments
8. **EXP-110** (COMPLETE): FM-3.3 commit guard impact analysis
9. **EXP-112** (proposed): "Confident failure" / Silent Failures deep dive — manual transcript review of 10-20 Silent Failure sessions to understand what goes wrong when no FM codes are triggered
10. **EXP-113** (proposed): Targeted intervention for FM-Heavy Workers — deploy specific skills to optimizer and coach, measure cluster membership shifts

---

## Methodology Notes

- **Data source**: may.db evaluations table, all entries as of 2026-04-10
- **Non-heuristic sample**: 4,295 evaluations scored by the LLM-based evaluator with FM codes, failure chains, and multi-dimensional issues
- **Heuristic sample**: 14,767 evaluations scored by rule-based heuristics (0-5 scale, verdicts only)
- **Analysis**: SQL queries via bun:sqlite against the existing database; k-means clustering via custom TypeScript implementation
- **Limitations**: 
  - Observational, not causal — temporal correlations don't prove intervention effects
  - Evaluator has its own biases (KE-104) — FM codes reflect evaluator's detection ability, not ground truth
  - "Good" sessions with FM codes may have FM codes of low severity — severity weighting not yet implemented
  - W13 has small N (52) — conclusions about that week are tentative
  - The FM% increase over time (W09: 0% → W12: 90%) may reflect evaluator capability improvement, not actual FM rate changes
  - K-means silhouette of 0.27 indicates weak cluster separation — production behavior is a spectrum, not discrete types
  - Clustering on 1,475 sessions (quality > 0, non-heuristic only); results may not generalize to heuristic-evaluated sessions

---

## Phase 3: Behavioral Clustering Analysis

### 3.1 Methodology

**Feature Matrix**: 1,475 non-heuristic evaluations with quality > 0, each represented by 11 normalized features:
- **Performance**: quality, efficiency, wastedCallRatio
- **Process signals**: fmCount, hasFM_2x (execution), hasFM_3x (verification)
- **Failure chains**: failureChainCount, failureChainDepth (max recovery steps)
- **Resources**: cost ($), turns
- **Outcome**: resultDelivered (0/1)

**Normalization**: Z-score standardization (zero mean, unit variance) per feature.

**Clustering**: K-means with k ∈ {3, 4, 5, 6}, 10 random restarts per k with k-means++ initialization. Best run selected by silhouette score (sampled on 500 points for computational efficiency).

### 3.2 Optimal k Selection

| k | Silhouette Score | Interpretation |
|---|-----------------|----------------|
| 3 | 0.258 | Weak structure |
| 4 | 0.262 | Weak structure |
| 5 | 0.270 | Weak structure |
| 6 | **0.273** | Weak structure (best) |

All silhouette scores fall in the 0.25-0.30 range (weak but present structure). The marginal improvement from k=3 to k=6 is only +0.015. **This is itself a finding**: production sessions form a continuous behavioral spectrum rather than discrete archetypes. The clusters are useful as analytical buckets, not as natural types.

### 3.3 The Six Behavioral Archetypes

#### Archetype 1: "Clean Performers" (N=640, 43.4%)

| Metric | Value |
|--------|-------|
| Quality | **0.786** |
| Efficiency | **0.768** |
| FM Count | 0.39 (very low) |
| Result Delivered | 91.1% |
| Cost | $0.55 |
| Turns | 9.8 |
| Verdict | 70% good, 28% acceptable |

**Top agents**: coder (27%), qa (15%), bob (13%), coach (12%), tech-lead (9%)
**Top FM codes**: FM-3.3: 10.2%, FM-1.x: 5.8%, FM-2.2: 4.5%
**Profile**: The gold standard. Quick, cheap, effective sessions with minimal process issues. Coder and QA dominate — agents with structured, well-defined tasks.

#### Archetype 2: "FM-Heavy Workers" (N=321, 21.8%) 🟢 LOW-HANGING FRUIT

| Metric | Value |
|--------|-------|
| Quality | **0.507** |
| Efficiency | 0.569 |
| FM Count | **3.33** (very high) |
| FM-2.x rate | **95.0%** |
| FM-3.x rate | **77.6%** |
| Result Delivered | 44.9% |
| Cost | $1.14 |
| Verdict | 46% acceptable, 39% needs_improvement |

**Top agents**: optimizer (28%), coach (27%), may (12%), coder (11%)
**Top FM codes**: FM-3.3: 56.1%, FM-1.x: 47.7%, FM-2.1: 46.7%, FM-2.2: 41.7%
**Profile**: **THE most improvable cluster.** Moderate quality but drowning in FM codes. 95% have execution failures, 78% have verification failures. If FM-3.3 (56% of this cluster) were addressed, many sessions could shift to Clean Performers. Optimizer and coach dominate — open-ended, research-oriented tasks.

#### Archetype 3: "Expensive Grinders" (N=108, 7.3%)

| Metric | Value |
|--------|-------|
| Quality | 0.497 |
| Efficiency | 0.464 |
| FM Count | 0.59 (low) |
| Cost | **$5.76** (very expensive) |
| Turns | **50.8** (very long) |
| Wasted Call Ratio | 24.2% |
| Result Delivered | 36.1% |

**Top agents**: coach (25%), coder (21%), optimizer (17%), unknown (14%)
**Profile**: Burn resources ($5.76 avg, 10× Clean Performers) for mediocre results. Low FM count is deceptive — they're grinding through long, complex tasks with many retries. The failures are in resource management, not specific FM categories.

#### Archetype 4: "Silent Failures" (N=283, 19.2%)

| Metric | Value |
|--------|-------|
| Quality | **0.270** (low) |
| Efficiency | 0.429 |
| FM Count | **0.12** (extremely low) |
| Result Delivered | **13.1%** |
| Wasted Call Ratio | 20.4% |
| Verdict | 86% needs_improvement |

**Top agents**: bob (25%), coder (16%), tech-lead (11%), optimizer (10%)
**Profile**: **Most concerning cluster.** Fail quietly — almost no FM codes yet 86% needs_improvement. They give up early or crash without meaningful output. Bob dominates — complex integration tasks exceed capability boundaries. **Current process tools (skills, guards) will NOT help.** These need better task routing or capability improvements.

#### Archetype 5: "Resilient Recoverers" (N=104, 7.1%)

| Metric | Value |
|--------|-------|
| Quality | 0.640 |
| Failure Chain Count | **9.91** (very high) |
| Failure Chain Depth | 3.62 |
| Result Delivered | 87.5% |
| Verdict | 64% acceptable |

**Top agents**: coach (27%), bob (24%), coder (18%)
**Profile**: Encounter many failures (9.91 chains) but recover effectively — 87.5% deliver results. Quality is decent (0.64) but efficiency suffers from recovery overhead. Demonstrates effective self-correction behavior.

#### Archetype 6: "Deep Spiral" (N=19, 1.3%)

| Metric | Value |
|--------|-------|
| Quality | 0.540 |
| Failure Chain Depth | **24.84** (extremely deep) |
| Turns | 37.4 |
| Verdict | 63% needs_improvement |

**Top agents**: coach (53%), tech-lead (21%), bob (21%)
**Profile**: Tiny cluster — extreme outliers with extremely deep failure-chain recovery. Coach dominates. May be extreme cases of Resilient Recoverers. Small N makes this unreliable as a stable archetype.

### 3.4 Cluster Composition by Agent

| Agent | Clean Perf | FM-Heavy | Expensive | Silent Fail | Resilient | Deep Spiral |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| **coder** (295) | **59%** | 12% | 8% | 15% | 6% | 0% |
| **qa** (119) | **82%** | 6% | 0% | 8% | 3% | 0% |
| **coach** (255) | 30% | **34%** | 11% | 11% | 11% | 4% |
| **optimizer** (189) | 23% | **47%** | 10% | 15% | 6% | 0% |
| **bob** (211) | 40% | 9% | 4% | **34%** | 12% | 2% |
| **tech-lead** (143) | 40% | 22% | 6% | 22% | 7% | 3% |
| **may** (78) | 31% | **47%** | 0% | 21% | 1% | 0% |
| **scout** (68) | 65% | 10% | 3% | 15% | 6% | 1% |
| **amy** (48) | 38% | 2% | 10% | **48%** | 2% | 0% |

**Key patterns**: QA 82% Clean Performers (structured tasks). Optimizer & May 47% FM-Heavy (open-ended tasks). Bob 34% Silent Failures (complex integration). Amy 48% Silent Failures. Agent role determines cluster more than agent capability.

### 3.5 The Improvability Map

| Archetype | N | Improvable? | Intervention Type | Expected Lift |
|-----------|---|-------------|-------------------|---------------|
| Clean Performers | 640 | ❌ Already good | Maintain | — |
| **FM-Heavy Workers** | **321** | **🟢 YES — highest ROI** | **Skills: FM-3.3 guard, FM-2.1 decomposition** | **Q: 0.51 → 0.65+** |
| Expensive Grinders | 108 | 🟡 Partial | Resource limits, early termination | Cost reduction |
| Silent Failures | 283 | ❌ Not with current tools | Capability/routing | Needs model-level work |
| Resilient Recoverers | 104 | 🟡 Self-correcting | Efficiency optimization | E: 0.50 → 0.60+ |
| Deep Spiral | 19 | ❌ Too small | Monitor only | — |

### 3.6 H2 Verdict

**H2: PARTIALLY CONFIRMED.** Predicted 3-5 archetypes; found 6 (near prediction). But silhouette 0.273 = weak separation. Production behavior is a continuous spectrum. The four main clusters (Clean Performers, FM-Heavy Workers, Silent Failures, Expensive Grinders) are clearly distinct in character though boundaries are fuzzy. Clusters are analytically useful for targeting interventions even if not statistically strong as natural types.

### 3.7 Key Phase 3 Insights

1. **43% of sessions already work well** (Clean Performers). The system is bimodal, not universally broken.
2. **22% (FM-Heavy Workers) are the single best intervention target.** Moderate quality + many fixable FM codes = highest ROI for skills and guards.
3. **19% fail silently.** No FM codes, no failure chains, just poor outcomes. Current process tools will NOT help. Different interventions needed.
4. **Production behavior is a spectrum, not types.** Intervention thresholds should be continuous (e.g., "if FM count > 2") not categorical.
5. **Agent role determines cluster membership more than capability.** QA tasks → Clean Performers. Research tasks → FM-Heavy Workers. Complex integration → Silent Failures.
