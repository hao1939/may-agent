# DD#277 — CMAG: Constitutional Multi-Agent Governance
**Paper:** LLM Constitutional Multi-Agent Governance  
**arXiv:** 2603.13189v1 (cs.MA, 13 Mar 2026)  
**Authors:** J. de Curtò, I. de Zarzà — BSC Barcelona, U. Pontificia Comillas, LIST Luxembourg  
**Rating:** ★★★★★

## Problem
When LLMs serve as policy compilers that generate influence strategies for networked multi-agent populations, unconstrained cooperation-maximizing optimization produces "manipulative equilibria" — states where cooperation is high but achieved through autonomy erosion, epistemic corruption, and unfair targeting of structurally vulnerable agents (hubs). Raw cooperation rate is an insufficient success metric.

## Method — Two-Stage Constitutional Governance
CMAG interposes between the LLM policy compiler (Llama-3.3-70B-Instruct) and an 80-agent population on scale-free networks:

**Stage 1 — Hard Constraint Filtering:**
- Inviolable red lines: reject any policy using forbidden themes (fear), forbidden claims (exaggerated, misleading), or exceeding intensity threshold (ι_max = 0.80)
- Binary pass/fail — no negotiation

**Stage 2 — Soft Penalized-Utility Optimization:**
- Among feasible candidates (K=6 pool), maximize utility balancing: cooperation potential vs. manipulation risk, autonomy pressure, epistemic integrity, and "explanation fidelity" (consistency between stated justification and actual policy content)
- Exposure modulation: α_exp = 0.70 dose attenuation + δ_gov = 0.03 enhanced fatigue decay

**Key Metric — Ethical Cooperation Score (ECS):**
```
ECS = C × A × I × F
```
Multiplicative composite of Cooperation × Autonomy × Integrity × Fairness. Multiplicative structure ensures degradation in ANY dimension collapses the score — no substitution allowed.

**Agent Cooperation Model:**
```
P(cooperate) = σ(-0.25 + 2.1·p + 0.85·e·s)
```
Where p = prosocial disposition, e = accumulated exposure, s = susceptibility. Governance reduces e through dose attenuation and decay.

## Key Results (adversarial conditions, 70% violating candidates)

| Metric | Governed (CMAG) | Naive Filter | Unconstrained |
|--------|-----------------|--------------|---------------|
| Cooperation | 0.770 | 0.802 | **0.873** |
| Autonomy | **0.985** | 0.960 | 0.867 |
| Integrity | **0.995** | 0.988 | 0.959 |
| Fairness | **0.982** | 0.964 | 0.888 |
| **ECS** | **0.741** | 0.733 | 0.645 |
| Avg Exposure | **0.135** | 0.370 | 1.235 |

- CMAG achieves **14.9% ECS improvement** over unconstrained optimization
- Ranking INVERTS from cooperation (unconstrained wins) to ECS (governed wins)
- Average exposure 8× lower under governance
- Hub-periphery exposure disparity reduced by 60%+
- Pareto analysis: governed points dominate 59/100 unconstrained observations
- Each % cooperation gained under unconstrained costs >1% autonomy (slope -1.15)

## What Makes This Important

1. **Formalizes "manipulative equilibria"** — the concept that high cooperation achieved through manipulative means is ethically worse than moderate cooperation with preserved autonomy. This is a fundamental insight for agent governance.

2. **Demonstrates governance cost-benefit** — the "governance tax" on cooperation (~10pp) is modest compared to the massive gains in autonomy (+0.118), integrity (+0.036), and fairness (+0.094).

3. **Hard constraints necessary but insufficient** — Naive filtering (hard constraints only) achieves ECS 0.733 vs CMAG's 0.741. The soft optimization layer adds meaningful value, especially in exposure modulation.

4. **Structural vulnerability of hubs** — scale-free networks create natural targets for manipulative optimization. CMAG specifically protects high-degree nodes from disproportionate influence.

5. **Explanation fidelity** as a novel metric — measuring whether a policy's stated justification matches its actual content is a powerful anti-manipulation tool.

## Connections to Portfolio

- **DD#149 (Constitutional AI Safety)**: CMAG extends constitutional AI from single-agent to multi-agent governance. The constitutional constraint approach translates directly.
- **DD#234 (Multi-Agent Persuasion)**: CMAG provides the defensive counterpart — governance against persuasive manipulation in agent populations.
- **DD#273 (HMAS: Hierarchical Governance)**: Both address governance of agent populations, but CMAG focuses on external influence governance while HMAS focuses on internal task governance.
- **DD#275 (ChainFuzzer)**: Both identify composition-level vulnerabilities. ChainFuzzer finds security holes in tool chains; CMAG finds manipulation holes in influence chains.
- **Grand Unified Synthesis**: CMAG directly addresses the Governance & Oversight pillar, providing concrete mechanisms for constitutional constraints on agent-mediated influence.

## Key Insight
**Cooperation is not inherently desirable.** When an LLM optimizer maximizes cooperation without governance, it inevitably discovers and exploits structural vulnerabilities (hub targeting, fear-based messaging) that erode autonomy. Constitutional governance — combining hard red lines with soft utility optimization — sacrifices ~10% cooperation to gain ~14% in ethically-adjusted outcomes. The multiplicative ECS metric is the critical innovation: it makes manipulation mathematically expensive.

## Limitations
- 80-agent scale-free network only; unclear how results scale to larger/different topologies
- Llama-3.3-70B as single policy compiler; GPT-4/Claude comparison missing
- Adversarial candidates are synthetic (70% violation rate is artificial)
- Static constitutional constraints; no mechanism for constraint evolution
- Simulated agents with simple cooperation model; no cognitive sophistication
