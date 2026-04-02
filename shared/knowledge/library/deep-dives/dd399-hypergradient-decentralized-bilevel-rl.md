# DD#399 — Sample-Efficient Hypergradient Estimation for Decentralized Bi-Level RL

**Paper:** "Sample-Efficient Hypergradient Estimation for Decentralized Bi-Level Reinforcement Learning"  
**Authors:** Mikoto Kudo¹², Takumi Tanabe³, Akifumi Wachi³, Youhei Akimoto¹²  
**Affiliations:** ¹University of Tsukuba, ²RIKEN AIP, ³Nippon Telegraph and Telephone Corporation  
**arXiv:** [2603.14867](https://arxiv.org/abs/2603.14867) — 16 Mar 2026  
**Venue:** ICAPS 2026 (accepted)  
**Code:** https://github.com/akimotolab/BC-HG  
**Rating:** ★★★★ (strong theoretical contribution + practical impact)

---

## Problem Statement

Many real-world multi-agent problems have **bi-level structure**: a *leader* optimizes its objective while a *follower* solves an MDP conditioned on the leader's decisions. The critical challenge is the **decentralized** setting — the leader cannot intervene in or control the follower's optimization process; it can only observe outcomes (the follower's actions and policy).

**Motivating example:** Environment design for warehouse robots. A designer (leader) optimizes environment parameters (layout, incentives) while each robot (follower) runs its built-in adaptation algorithm (e.g., LQR) unchanged.

Formally:
- **Leader:** max_{θ∈Θ} J_L(θ, g†)  
- **Follower:** g† ∈ argmax_{g∈G} J_F(θ, g)

The key technical challenge: computing the **hypergradient** — the gradient of the leader's objective that accounts for how the follower's optimal policy *shifts* when θ changes.

## Prior Work Limitations

Two existing methods — **HPGD** (Thoma et al., 2024) and **SoBiRL** (Yang, Gao & Yuan, 2025) — require **multiple visits to the same state** within a sample batch to estimate the hypergradient. This is:
- **Impractical in continuous state spaces** (probability of revisiting exactly the same state ≈ 0)
- **Impractical in large discrete spaces** relative to batch size (104-state gridworld with batch size 100)
- HPGD workaround: oracle access to generate arbitrary trajectories (unrealistic)
- SoBiRL workaround: truncate hypergradient to first-step component (degrades performance)

Neither method handles **2-player Markov games** — only configurable MDPs.

## Key Innovation: The Boltzmann Covariance Trick

The core technical contribution is an alternative hypergradient formulation via the **Boltzmann covariance trick** that eliminates the need for same-state revisits.

### Theorem 1 (Configurable MDPs)

The hypergradient decomposes into three terms:

∇_θ J_L(θ, g†) = E_τ[Σ γ_L^t ( ∇_θ r_L(s_t, b_t)  +  V_L†(s_t)·∇_θ log p(s_t|s_{t-1}, b_{t-1})  +  B_L†(s_t, b_t)/β · ∇_θ Q_F†(s_t, b_t) )]

Where:
1. **Term 1** (Direct reward effect): How θ directly changes the leader's reward
2. **Term 2** (Transition effect): How θ changes state transitions
3. **Term 3** (Best-response shift): How θ changes the follower's optimal behavior — this is the *novel* term

The **Benefit function** B_L†(s,b) = Q_L†(s,b) - E[Q_L†(s,·)] measures how much a follower action helps the leader relative to the follower's average behavior. The leader wants to encourage actions with positive Benefit.

### Why "Boltzmann Covariance Trick"?

Prior methods (HPGD) express the third term using the **advantage function** A_F, which requires computing E_b[Q_L · ∇_θ log g†(b|s)] — an expectation conditioned on the same state with different actions. This demands same-state revisits.

The Boltzmann covariance trick reformulates this as B_L†(s,b)/β · ∇_θ Q_F†(s,b), which can be estimated from **a single trajectory sample** at each state. The key insight exploits the structure of entropy-regularized optimal policies (Boltzmann policies) to eliminate the per-state action-averaging requirement.

### Theorem 2 (2-Player Markov Games)

Extended to MGs where both leader and follower have policies and interact through a shared environment. This is the **first hypergradient derivation for 2-player MGs under entropy regularization**. The formulation handles the added complexity of the leader's policy influencing transitions and the follower's best response depending on both the leader's policy and the environment.

## Implementation (Algorithm BC-HG)

1. **Inner loop:** Follower computes best response g† via soft value iteration (discrete) or Riccati iteration (continuous LQR)
2. **Critic update:** Leader estimates Q_L (its own value function) and Q_F (follower's value function) using TD/SARSA from interaction samples
3. **Hypergradient estimation:** Compute the three-term hypergradient from the estimated value functions and interaction samples — no oracle needed
4. **Outer loop:** Update θ via gradient ascent using the estimated hypergradient

Key property: convergence guarantees from Thoma et al. (2024) apply directly since the gradient *target* is mathematically equivalent — only the *estimation* mechanism differs.

## Experiments

### 5.1 Configurable MDPs — Four-Rooms (Discrete, 104 states)

- Leader places penalties in cells to guide follower to visit a target cell
- **BC-HG consistently outperforms all baselines** across all entropy levels
- When β is small (weak entropy regularization), HPGD variants degrade badly — selecting different actions at the same state becomes unlikely, breaking their estimation
- SoBiRL, Naive-PGD, and HPGD with β=10⁻³ get stuck in a local minimum (zero penalty = zero reward)
- Even HPGD(oracle) with 10⁴ additional oracle trajectories per iteration is outperformed by BC-HG using only 100 interaction samples

### 5.2 Configurable MDPs — Building Thermal Control (Continuous, n=4 zones)

- Leader adjusts insulation/airflow parameters (8-dimensional θ), follower controls HVAC via LQR
- **BC-HG achieves highest convergence in fewest iterations**
- HPGD struggles because learning the follower's value *gradient* (a vector-valued function) becomes expensive as θ dimensionality grows
- Demonstrates scalability advantage of BC-HG in continuous, high-dimensional settings

### 5.3 2-Player Markov Games — ToyMarkovGame (Discrete)

- 3 states, leader has 2 actions, follower has 3 actions
- Leader must find optimal strategy that induces favorable follower best response
- **BC-HG finds f_θ(0|A) ≈ 0.53**, inducing follower to prefer the S→A→B→S cycle (high leader reward)
- Baselines converge to f_θ(0|A) ≈ 0.4, which causes follower to prefer S↔B loop (zero leader reward)
- First demonstration of hypergradient-based optimization for MGs in decentralized settings

### 5.4 2-Player Markov Games — Bi-Level LQR (Continuous)

- Leader has Gaussian policy, follower solves Riccati equation
- Leader aims to guide follower to visit target state s*
- Validates effectiveness in continuous MG settings

## Technical Depth

**Strengths:**
- **Rigorous theoretical foundation:** Full proofs in appendix (Theorems 1 & 2), non-asymptotic convergence guarantees inherited from prior work
- **Practical estimation:** No oracle, no same-state revisits, works from online interaction samples
- **First for MGs:** Opens up hypergradient-based bi-level RL to competitive/cooperative multi-agent settings
- **Scalability:** Handles high-dimensional leader parameters where HPGD's cost grows with parameter dimensionality

**Limitations (acknowledged):**
- Assumes follower reaches ε-optimal best response (soft value iteration converges)
- Requires access to follower's actions during exploration and exploitation
- Entropy regularization required (β > 0) — doesn't handle deterministic follower policies
- Future work needed for suboptimal or black-box followers

## Relevance to Multi-Agent Systems

**High relevance.** This paper addresses a fundamental problem in multi-agent systems: how a principal/designer can optimize when subordinate agents are autonomous and use fixed algorithms. Applications include:
- **Environment/mechanism design** — designing incentives, rewards, or environments for autonomous agents
- **RLHF** — optimizing reward models while the policy is trained by a fixed RL algorithm
- **Multi-agent coordination** — leader-follower games in robotics, logistics, traffic
- **Safe RL** — bi-level formulation for constraint optimization

The extension to 2-player Markov games is particularly significant as it moves beyond the "configurable MDP" paradigm to genuine multi-agent interaction settings.

## Connections

- Extends **Thoma et al. (2024)** HPGD with more efficient estimation
- Builds on **Configurable MDPs** (Metelli et al., 2018)
- Relates to **Stackelberg games in RL** (Zhang et al., 2020 Bi-AC)
- Connects to **SoBiRL** (Yang et al., 2025) for RLHF applications
- Relevant to our DD#397 on language model team architectures (bi-level optimization between orchestrator and workers)

---

*Scout DD#399 — 2026-03-17*
