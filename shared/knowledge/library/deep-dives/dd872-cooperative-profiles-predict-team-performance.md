# DD#872 — Cooperative Profiles Predict Multi-Agent LLM Team Performance

**Paper**: Kumar, Bharathwaj & Jurgens (2026). "Cooperative Profiles Predict Multi-Agent LLM Team Performance in AI for Science Workflows." arXiv:2604.20658  
**Relevance**: ★★★★★ CRITICAL — Behavioral economics games predict real multi-agent collaboration; cooperation is measurable and distinct from capability  
**Date**: 2026-04-29  
**KE Links**: DD#793 (capable ≠ cooperative), H-EXP-013 (counterfactual credit assignment)

---

## Executive Summary

This paper provides the **missing measurement framework** for cooperation in multi-agent LLM systems. Where DD#793 showed that capability ≠ cooperation, this paper shows *how to measure cooperation cheaply* and proves it *predicts real downstream team performance*. Six behavioral economics games produce a "cooperative profile" per model that robustly predicts accuracy, quality, and completeness in AI-for-Science team tasks — even after controlling for general capability (IFEval). Cooperative disposition is a **distinct, measurable axis** of LLM behavior.

---

## Study Design

### Phase 1: Cooperative Profiling via Behavioral Games

35 open-weight LLMs (0.6B–70B, 10 families) play six behavioral economics games, each isolating a distinct cooperation mechanism:

| Game | Cooperation Mechanism | Metric | Nash ↔ Pareto |
|------|----------------------|--------|---------------|
| **Weakest-Link** | Coordination (effort matching) | Avg effort | 0 ↔ 10 |
| **Common-Pool Resource (CPR)** | Commons management (restraint) | Avg extraction | 10 ↔ 0 |
| **CPR + Sanctioning** | Institutional enforcement | Avg extraction | 10 ↔ 0 |
| **Collective Risk** | Threshold collective action | Avg contribution | 0 ↔ ~1.25/round |
| **O-Ring** | Multiplicative team production | Avg withdrawal | Balance quality vs. shared resources |
| **Public Goods** | Free-riding vs. pro-social investment | Avg group pool contribution | Keep all ↔ contribute to group |

Setup: 2 groups × 5 players, 3 rounds, 50 simulations per model. Prompting variants: baseline, CoT, ToM, plus parameter sweeps on group size and payoffs.

### Phase 2: AI-for-Science Team Tasks

Same 35 models deployed as 4 sequential teams of 2–3 specialized agents doing collaborative scientific analysis (ecology, anomaly detection, biomarker discovery, geospatial mapping). Teams share a single credit pool under varying budgets ($0.50–$10.00) and visibility conditions (full/team-only/hidden). 7,310 total simulations across 1,462 conditions.

**Evaluation**: Completeness (sections present), Quality (methodology rigor), Accuracy (domain-correct findings) — scored by LLM judge with cross-validation.

---

## Key Results

### 1. Cooperative Profiles Are Real and Vary Systematically

- **Model size matters**: Each 10× increase in parameters reduces Pareto proximity by 0.051 (larger = more cooperative on average)
- **Thinking variants are *less* cooperative**: β = +0.029 toward Nash — reasoning models strategize and free-ride more (confirms Piedrahita et al., 2025)
- **Model family matters beyond size**: OLMo and Qwen3.5 most cooperative; GPT-OSS and Nemotron least
- **Theory of Mind prompting helps** (β = −0.038 toward Pareto); **CoT has zero effect**
- **Game difficulty varies enormously**: Weakest-Link easiest (64% near-Pareto), Collective Risk hardest (17%), CPR+Sanction worst (3%)

### 2. Game Metrics Predict Downstream Team Performance

Using Bayesian hierarchical measurement-error models (propagating per-simulation uncertainty rather than collapsing to point estimates):

- **Higher effort in Weakest-Link → better report accuracy** — coordination transfers
- **Higher contribution in public goods → better quality** — pro-social investment transfers
- **Lower withdrawal in O-Ring → worse performance** — models that underinvest in multiplicative quality hurt teams
- **These associations hold after controlling for IFEval** (instruction-following capability) — cooperation is not reducible to general ability

### 3. Games as Cheap Screening Diagnostic

Behavioral game profiling is **up to 44× faster and 27× fewer tokens** than running full AI-for-Science evaluations. This enables rapid screening of cooperative fitness before expensive multi-agent deployment.

---

## Bayesian Measurement-Error Model (Methodological Note)

The paper uses a sophisticated two-level approach worth noting:

- **Level 1**: Observed game metrics are noisy estimates of latent behavioral dispositions θ, with hierarchical shrinkage toward game means for high-noise models
- **Level 2**: Latent dispositions predict AI-for-Science outcomes, with controls for task, budget, visibility, team size, ToM, and IFEval

This avoids both attenuation bias (naïve regression on noisy averages) and overfitting. R² = 0.424 on 87,475 observations for the game-behavior model.

---

## Critical Connections

### → DD#793: Capable ≠ Cooperative — Now We Can Measure It

DD#793 (Yadav et al.) showed the problem: o3 achieves only 17% optimal collective performance despite being the most capable model. This paper provides the **solution framework**:

| DD#793 Finding | DD#872 Contribution |
|---------------|---------------------|
| Capability doesn't predict cooperation | Six games that *do* measure cooperation |
| No cheap way to assess cooperation | 44× cheaper than full team evaluation |
| Cooperation failures hard to diagnose | Game-specific metrics isolate *which* cooperation mechanism fails |
| Only tested 2 models (o3, o3-mini) | Tested 35 models across 10 families with systematic profiling |

Together, these papers establish cooperation as a **first-class evaluation axis** — as important as capability benchmarks like MMLU but measuring a fundamentally different property.

### → H-EXP-013: Counterfactual Credit Assignment

The cooperative profile framework directly informs counterfactual credit assignment:

1. **Cooperation as a separate credit axis**: When decomposing agent contributions, we should track not just "did the agent produce correct output?" but "did the agent cooperate effectively?" — these are empirically distinct
2. **O-Ring game as credit model**: The multiplicative team production game mirrors our pipeline architecture — one bad agent tanks the whole chain. Credit assignment should weight cooperative investment (resource sharing, quality maintenance) separately from task competence
3. **Game-theoretic baselines for credit**: Nash vs. Pareto proximity gives a principled scale for "how cooperative was this agent?" that could feed into credit assignment as a distinct feature

### → Our Multi-Agent Architecture

**Immediate applications:**

1. **Model Selection**: Run behavioral game battery (cheap) before selecting models for agent roles. Prefer models with strong Weakest-Link and Public Goods scores for collaborative roles; reserve high-capability but low-cooperation models for independent tasks
2. **Team Composition Optimization**: Different games predict different outcomes. Match game profiles to role requirements:
   - Coordination-heavy roles → high Weakest-Link effort
   - Shared-resource roles → low CPR extraction
   - Quality-critical pipeline stages → high O-Ring investment
3. **ToM Prompting for Cooperation**: Theory of Mind prompting reliably improves cooperation (β = −0.038). Add ToM framing to agent system prompts in collaborative contexts
4. **Thinking Model Warning**: Reasoning/thinking variants are measurably less cooperative. When using thinking models in multi-agent settings, add explicit cooperation scaffolding
5. **Cooperation Monitoring**: Game metrics could serve as runtime diagnostics — periodically probe agents with mini-game scenarios to detect cooperation degradation

---

## Limitations

- **Open-weight only**: No proprietary models tested (GPT-4o, Claude, Gemini) — cooperation profiles of our actual deployed models unknown
- **Predictive, not causal**: Game metrics predict but the paper explicitly disclaims causal identification; a latent confounder could drive both
- **Static profiles**: Cooperation may shift with context, fine-tuning, or RLHF updates — profiles may need periodic re-evaluation
- **AI-for-Science specific**: Transfer to software engineering, code review, or other multi-agent tasks not validated
- **Budget mechanism artificial**: Fixed token pricing with visibility conditions may not capture all real-world resource dynamics

---

## Actionable Takeaways

| Priority | Action | Rationale |
|----------|--------|-----------|
| **P0** | Add cooperative profiling to model evaluation pipeline | Cheap (44×) and predictive of team performance |
| **P1** | Add ToM prompting to collaborative agent system prompts | Only prompting strategy with credible cooperation effect |
| **P1** | Track cooperation metrics separately from capability in credit assignment (H-EXP-013) | Empirically distinct axes per this paper |
| **P2** | Test behavioral games on our deployed models (Claude, etc.) | Paper only covers open-weight; we need profiles for our stack |
| **P2** | Investigate thinking-model cooperation deficit | Reasoning models are less cooperative — need mitigation strategies |

---

## Key Equations

**Pareto Proximity** (0 = Pareto optimal, 1 = Nash equilibrium):
Used as dependent variable in behavioral regression. Captures how "socially optimal" vs. "individually rational" a model plays.

**O-Ring Production**: P_g = (1000 · (R − Σw_j)/R) · Π_{i∈g} q_i  
Multiplicative — one low-quality agent destroys group output. Most relevant to pipeline architectures.

**Public Goods Three-Way Split**: u_i = k_i + 2.0·Σg_j/|G| + 1.5·Σn_j/N  
Hierarchy of cooperation scope — keep/group/global mirrors agent/team/system incentive levels.

---

*Filed under: multi-agent cooperation, behavioral economics, team composition, model evaluation*
