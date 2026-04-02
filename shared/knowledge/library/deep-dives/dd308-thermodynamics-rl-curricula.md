# Deep-Dive #308: Thermodynamics of Reinforcement Learning Curricula

**Paper:** [2603.12324] Thermodynamics of Reinforcement Learning Curricula
**Authors:** Jacob Adamczyk, Juan Sebastian Rojas, Rahul V. Kulkarni
**Date:** 2026-03-12
**Venue:** Accepted at SciForDL Workshop at ICLR 2026

## Core Insight

RL curriculum design is fundamentally a **thermodynamic optimization problem**. By interpreting reward parameters as coordinates on a task manifold and applying non-equilibrium thermodynamics, optimal curricula correspond to **geodesics** in task space — paths that minimize the excess thermodynamic work required to transition between tasks.

## Technical Framework

### Geometric Interpretation
1. **Task Manifold**: Each RL task is parameterized by reward parameters θ. The space of all tasks forms a manifold
2. **Fisher-like Metric**: The natural geometry on this manifold derives from how policy distributions change with reward parameters — analogous to the Fisher information metric in statistical mechanics
3. **Excess Work**: When transitioning between tasks (curriculum), the agent performs "excess work" — the difference between actual learning effort and the reversible (optimal) path
4. **Geodesics = Optimal Curricula**: Minimizing excess thermodynamic work yields geodesics on the task manifold — these are the optimal curriculum paths

### MEW Algorithm (Minimum Excess Work)
- Provides principled schedule for **temperature annealing** in maximum-entropy RL
- Instead of ad-hoc cooling schedules, MEW computes the geodesic path through the space of entropy-regularized objectives
- Connects simulated annealing to optimal curriculum design through rigorous thermodynamic framework

## Key Results

- Demonstrates that geodesic curricula outperform naive/linear scheduling
- Provides theoretically grounded temperature annealing for max-entropy RL
- Framework generalizes to any parameterized family of RL tasks

## Connection to Research Themes

### RL Training Theory (→ DD#291 ReBalance, DD#305 BICC, CR#147)
This provides a **theoretical foundation** for the empirical observations in our corpus:
- **ReBalance** (DD#291) empirically found that balanced easy→hard scheduling improves reasoning. Thermodynamics explains *why*: the geodesic in task space avoids excess work
- **BICC** (DD#305) conditions GRPO on context — the thermodynamic framework suggests this is implicitly navigating the task manifold more efficiently
- **DAPO/GRPO** training could benefit from principled temperature schedules derived from MEW

### Curriculum Learning Theory (→ DD#299 Adaptive Sampling)
Direct connection to curriculum design: rather than heuristic sampling strategies, this provides a principled optimization framework. Optimal difficulty schedules are *geodesics*, not linear ramps.

### Physics-ML Connections (→ Grand Unified Synthesis)
Part of the broader trend of importing physics formalism into ML:
- Free energy principles in variational inference
- Renormalization group in deep learning
- Now: non-equilibrium thermodynamics in curriculum RL

## Critical Assessment

**Strengths:**
- Theoretically elegant — rare to see rigorous physics applied to curriculum RL
- Actionable: MEW provides a concrete algorithm, not just theory
- ICLR workshop acceptance validates the approach
- Generalizable framework beyond specific RL settings

**Limitations:**
- Workshop paper — likely shorter and less experimentally validated than a full conference paper
- Computing the geodesic requires knowledge of the metric tensor on the task manifold, which may be computationally expensive
- May not scale easily to very high-dimensional task parameterizations
- The thermodynamic analogy assumes near-equilibrium transitions, which may not hold for rapid curriculum changes

## Significance: 8/10

Provides the kind of theoretical foundation our research corpus has been building toward empirically. If the geodesic curriculum framework can be made practical at scale, it would transform how we design RL training curricula for reasoning models. The temperature annealing application is immediately relevant to max-entropy RL and GRPO-style training.

## Tags
`thermodynamics` `curriculum-learning` `reinforcement-learning` `geodesics` `task-manifold` `temperature-annealing` `theory`
