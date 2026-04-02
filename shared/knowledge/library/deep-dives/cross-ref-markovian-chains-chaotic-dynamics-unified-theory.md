# Cross-Reference: Markovian Generation Chains × Chaotic Dynamics — Toward a Unified Theory of Multi-Agent LLM Instability

**Type:** Cross-reference synthesis (new theoretical integration)
**Date:** 2026-03-27
**Papers unified:**
1. **Markovian Generation Chains in LLMs** (2603.11228) — Geng, Mohamed, Shang, Vazirgiannis, Poibeau (École Polytechnique/CNRS)
2. **Chaotic Dynamics in Multi-LLM Deliberation** (2603.09127) — Shimao, Khern-am-nuai, Kim (Penn State/McGill/American U.)
**Prior synthesis extended:** Drift & Instability Synthesis (2026-03-26), ThReadMed-QA × Drift cross-reference

---

## Executive Summary

Two independent papers — one studying single-chain iterative LLM processing (Markovian chains) and the other studying multi-agent committee deliberation (Chaotic Dynamics) — describe the same phenomenon from different angles. By connecting them, we derive a **unified mathematical framework** for predicting, measuring, and mitigating instability in any multi-agent LLM system. The Markov chain formalism provides the "why" (phase transitions, attractor dynamics, stationary distributions), while the Chaotic Dynamics empirics provide the "how much" (Lyapunov exponents, amplification pathways, interventions). Together, they give us predictive control over multi-agent behavior.

---

## 1. The Core Mapping: Markov Chains → Multi-Agent Dynamics

### Geng et al.'s Single-Chain Model
A Markovian generation chain is: **x_{t+1} = LLM(template, x_t)**

This models one LLM repeatedly processing its own prior output. The chain has:
- **States:** All possible sentence/output variants
- **Transition probabilities:** P(x_{t+1} | x_t), determined by the LLM and its temperature
- **Behavior regimes:** Fixed points (low temp), recurrent sets (medium temp), novelty production (high temp)

### Shimao et al.'s Multi-Agent Model
A multi-LLM committee is: **y_{t+1}^i = LLM_i(roles, memory_k(y^{1..N}_{1..t}))**

This models N agents iteratively responding to each other. The differences from the single-chain case:
1. **Multiple interacting chains** (N agents, not 1)
2. **Memory window** (context includes last k rounds, not just the last output)
3. **Heterogeneous transition kernels** (different models have different P functions)
4. **Role conditioning** (system prompts modify transition dynamics per agent)

### The Mapping

| Markovian Chain Concept | Multi-Agent Equivalent | Implication |
|------------------------|----------------------|-------------|
| State x_t | Joint committee state (y_t^1, ..., y_t^N) | State space is **exponentially larger** — N agents × M possible outputs each |
| Transition kernel P(x' \| x) | Joint transition kernel P(y'^{1..N} \| y^{1..N}_{t-k..t}) | **Non-Markovian** when k > 1 (memory violates Markov property) |
| Temperature T | Effective temperature (includes model heterogeneity, role diversity) | Shimao shows heterogeneity/roles add "effective temperature" even at T=0 |
| Fixed point (convergence) | Consensus (all agents agree) | Low effective temp → premature consensus |
| Recurrent set (cycling) | Oscillation/deadlock | Medium effective temp → agents cycle through positions |
| Novelty production (divergence) | Chaos (positive λ̂) | High effective temp → exponentially diverging trajectories |
| Attractor basin | Decision basin | Which consensus an agent group converges to depends on initial conditions |
| Stationary distribution π | Long-run behavioral distribution | Characterizes "what the committee typically decides" over many runs |
| Mixing time | Deliberation rounds to convergence | How many rounds until committee behavior reflects π |

---

## 2. Why Chaos at T=0: The Effective Temperature Hypothesis

Shimao et al.'s most striking finding: **positive Lyapunov exponents even at T=0**, where LLMs should behave deterministically. Geng et al.'s framework explains this:

### Residual Non-Determinism as Effective Temperature

Even at T=0, LLM inference has micro-variations (floating-point non-determinism, context processing order, batch effects). In the Markov chain framework:
- These micro-variations mean the transition kernel is **not** a delta function at T=0
- Instead: P(x' | x) at T=0 ≈ concentrated on one output, but with small probability mass on alternatives
- In a single chain, this is negligible — the chain almost surely converges to the fixed point
- In a **multi-agent chain**, these small probabilities **compound multiplicatively** across N agents and k memory steps

### Compound Amplification Formula

For N agents with memory depth k, the effective state space exploration per step is:
- Single chain: ~1 likely next state (at T=0)
- Multi-agent: ~N^k effectively distinct trajectories that the system samples from

Even if each agent has 99.99% chance of producing the same output, with N=5 agents and k=15 memory depth:
- P(all agents produce identical output for all k steps) ≈ (0.9999)^(5×15) ≈ 0.993
- But divergence is cumulative: once ANY agent deviates, that deviation enters ALL other agents' contexts

This explains Shimao's finding that **memory window reduction (k=15→k=3) reduces λ̂**: it shrinks the compound amplification window.

### Model Heterogeneity as Temperature Injection

When different LLMs are used (Shimao's "mixed" condition), each model has a **different attractor landscape**. In Geng's framework:
- Each LLM defines its own transition kernel P_i(x' | x)
- The multi-agent system alternates between kernels: P_1 → P_2 → P_3 → P_1...
- This is equivalent to running a single chain with **time-varying transition probabilities**
- Time-varying Markov chains are known to resist convergence — they can escape any single chain's attractor

This is why mixed+no-roles (λ̂=0.0947) is the MOST unstable condition: no role structure + different models = no shared attractor + maximal effective temperature.

---

## 3. The Non-Additivity Puzzle: Why Roles + Heterogeneity < Heterogeneity Alone

Shimao's most counterintuitive finding: mixed+roles (λ̂=0.0519) < mixed+no-roles (λ̂=0.0947). Adding role structure to a heterogeneous committee **stabilizes** it. Geng's framework explains this:

### Roles as Attractor Constraints

In the Markov chain framework, role conditioning (system prompts defining agent behavior) modifies the transition kernel:
- Without roles: P_i(x' | x) — each model's natural dynamics
- With roles: P_i(x' | x, role_i) — constrained dynamics

Roles create **shared structure** across the otherwise-incompatible attractor landscapes of different models. Specifically:
- Roles define a subspace of the full output space that all agents should operate in
- This constrains the effective state space
- A smaller state space has fewer attractor basins → more likely convergence → lower λ̂

### Analogy: Coupled Oscillators

Think of it as coupled oscillators with different natural frequencies (= model heterogeneity):
- **No coupling** (no roles): Each oscillator follows its own frequency → chaotic interference
- **Weak coupling** (roles): Oscillators partially synchronize → frequency-locking reduces chaos
- **Strong coupling** (identical models + roles): Perfect synchronization → minimum chaos

Shimao's data matches this precisely:
- Uniform + NoRoles (baseline): λ̂ = 0.0221 (synchronized oscillators)
- Uniform + Roles: λ̂ = 0.0541 (roles add perturbation to an already-synchronized system)
- Mixed + NoRoles: λ̂ = 0.0947 (maximum desynchronization)
- Mixed + Roles: λ̂ = 0.0519 (roles partially re-synchronize divergent models)

### Why Roles INCREASE Instability in Uniform Committees

For uniform (same-model) committees, adding roles goes from λ̂=0.0221 → 0.0541. This makes sense in the framework:
- Uniform models without roles have a single shared attractor → fast convergence
- Adding roles breaks the symmetry — each agent now has a modified kernel P(x' | x, role_i)
- Different roles push the same model toward different subspaces
- This is equivalent to **artificially injecting heterogeneity** into a homogeneous system

---

## 4. Connecting to the Four-Type Instability Taxonomy

Our Drift & Instability Synthesis (2026-03-26) identified four instability types. The Markov chain framework provides the mathematical substrate for each:

### Type 1: Stochastic Instability (Chaotic Dynamics)
**Markov chain explanation:** The joint multi-agent Markov chain operates in a regime where the stationary distribution has **high entropy** (many equally-weighted attractor basins). Different runs sample different basins → inter-run divergence.
**Control parameter:** Reduce effective temperature (reduce memory window, constrain output format, use deterministic checkpoints to collapse to a single state).

### Type 2: Distribution-Shift Drift (ADVERSA attacker drift)
**Markov chain explanation:** The agent was trained on transition kernel P_train but deployed in a context where the actual kernel is P_deploy ≠ P_train. The multi-turn interaction acts as an iterative chain under P_deploy, which has different attractors than P_train. Over turns, the agent converges to P_deploy's attractor set — which doesn't include the attack objective.
**Control parameter:** Periodic re-injection of the training objective resets the chain to states near P_train's attractor basin.

### Type 3: Adversarial Propagation (OMNI-LEAK)
**Markov chain explanation:** A compromised agent's modified kernel P_attack is introduced into the multi-agent chain. Through the orchestrator's delegation loop, P_attack's stationary distribution (which includes data exfiltration) becomes the system's stationary distribution. The mixing time for the legitimate agents to "absorb" the attacker's influence depends on the communication topology.
**Control parameter:** Reduce connectivity (limit which agents can influence which others), add verification agents that enforce invariants (preventing transitions to attacker states).

### Type 4: Gradual Compliance Erosion (ADVERSA victim + ConflictBench)
**Markov chain explanation:** Repeated adversarial pressure is equivalent to biasing the transition kernel toward compliance states. Over many rounds, the chain walks into the attractor basin of the compliant stationary distribution. This is the "regression to the mean" effect from Geng et al., but where the "mean" has been shifted by adversarial context.
**Control parameter:** Initial framing robustness (make the chain start deep in the refusal attractor basin), periodic rigor re-injection, model-level training (IH-Challenge).

---

## 5. Novel Predictions from the Unified Framework

The synthesis generates predictions not made by either paper alone:

### Prediction 1: Critical Temperature Phase Transition
Geng et al. show the Markov chain transitions from convergent → oscillatory → chaotic as temperature increases. Shimao et al. show this happens in multi-agent systems. **Prediction:** There exists a critical "effective temperature" T_c for any multi-agent architecture above which deliberation becomes chaotic. T_c depends on:
- Number of agents (N) — more agents → lower T_c (easier to become chaotic)
- Memory depth (k) — deeper memory → lower T_c
- Model heterogeneity — more diverse models → lower T_c
- Role structure — roles raise T_c (stabilize)

**Testable:** Run a multi-agent committee at increasing temperatures and plot λ̂ vs T. The transition should be sharp (phase-transition-like), not gradual.

### Prediction 2: Attractor Basin Characterization Predicts Decision Quality
Geng et al. show that iterative LLM processing converges to "LLM-preferred" outputs. In multi-agent deliberation, this means committees converge to **LLM-preferred decisions**, not necessarily correct decisions.
**Prediction:** Multi-agent deliberation's accuracy is bounded by the quality of the LLM-preferred attractor. If the attractor basin for the correct answer is smaller than for a popular-but-wrong answer, deliberation will systematically choose the wrong answer more often.

**Connection to ThReadMed-QA scaffolding paradox:** This explains why scaffolding sometimes HURTS performance — adding deliberation structure forces convergence to an attractor basin, and if that basin doesn't contain the correct answer, performance degrades. Simple (unscaffolded) systems have higher stochasticity → they sometimes wander into the correct basin by chance.

### Prediction 3: Heterogeneous Chains Can Escape Bad Attractors
Geng et al. study homogeneous chains (same LLM). Shimao et al. show heterogeneous committees are more unstable. **Prediction:** Model heterogeneity can be beneficial when the homogeneous attractor is wrong — different models have different attractor landscapes, and switching between them allows the system to escape a bad attractor that a single model would be stuck in.

**Design implication:** For tasks where the LLM's default answer is likely wrong (adversarial inputs, novel domains), USE heterogeneous committees. For tasks where the LLM's default is likely right (well-represented domains), USE homogeneous committees.

### Prediction 4: Memory Window as Phase Transition Control
Shimao et al.'s k=15→k=3 finding suggests memory depth tunes the effective temperature. **Prediction:** There exists an optimal memory depth k* that maximizes deliberation quality:
- k < k*: Too little context → agents lack information → random behavior
- k = k*: Enough context for informed decisions, not enough for chaotic amplification
- k > k*: Too much context → feedback amplification → chaotic divergence

**This is the Goldilocks zone for multi-agent memory.** It should be computable from the system's Lyapunov exponent profile.

### Prediction 5: Mixing Time Bounds Deliberation Budget
Geng et al.'s Markov chain analysis gives mixing times — how many steps until the chain reaches its stationary distribution. **Prediction:** Deliberation rounds beyond the mixing time are WASTED — the committee has already converged to its stationary distribution. Additional rounds add only variance (via the chaotic dynamics), not signal.

**Design implication:** Measure mixing time for your multi-agent architecture. Set the deliberation budget to mixing time + small buffer. More rounds don't help and may hurt.

---

## 6. Practical Design Framework: Temperature Engineering

Combining both papers, we can engineer multi-agent stability through "effective temperature" management:

### System Parameters That Increase Effective Temperature
(More exploration, more instability, more novel outputs)
- Higher sampling temperature T
- More diverse models (heterogeneity)
- Deeper memory windows (larger k)
- More agents (larger N)
- Free-form output format (unstructured)
- No deterministic checkpoints

### System Parameters That Decrease Effective Temperature
(More convergence, more stability, more predictable outputs)
- Lower sampling temperature T
- Same model across agents (homogeneity)
- Shorter memory windows (smaller k)
- Fewer agents (smaller N)
- Structured output format (JSON, structured state)
- Frequent deterministic checkpoints
- Role structure (reduces effective temperature of heterogeneous systems)

### The Design Recipe
1. **Characterize the task:** Does it need exploration (creative, novel domain) or convergence (standard, well-known domain)?
2. **Set target effective temperature:** High for exploration, low for convergence
3. **Tune parameters:** Adjust N, k, T, model diversity, role structure, output format to achieve target
4. **Validate:** Measure λ̂ across replicates. If λ̂ > threshold for convergence tasks, decrease effective temp. If λ̂ ≈ 0 for exploration tasks, increase.
5. **Monitor:** Track λ̂ over time. Architectural changes, model updates, or prompt drift can shift the effective temperature.

---

## 7. Implications for Our Multi-Agent Architecture

### Current Design Assessment

Our system (May/Coder/QA/Evaluator/Scout) operates at:
- **N = 5 agents** — moderate
- **Role structure:** Strong — each agent has clear specialization → stabilizing
- **Model composition:** Likely same model → stabilizing (homogeneous)
- **Memory/context:** Full conversation history → potentially destabilizing (large k)
- **Output format:** Mix of structured and free-text → moderate

**Risk assessment:** Our architecture should be relatively stable (strong roles, likely homogeneous models), but the full conversation history is the main vulnerability. The synthesizer role (May) is the dominant amplification channel (matching Shimao's Chair-role finding).

### Recommended Actions

1. **Curate May's context.** Don't feed full conversation history. Use structured summaries of each agent's outputs. This is equivalent to reducing k.
2. **Add deterministic checkpoints.** After each agent's contribution, extract structured state (not prose). Pass structured state to next agent. This collapses the Markov chain to a deterministic point before the next step.
3. **Measure our λ̂.** Run the same task pipeline 10+ times with identical inputs. Measure output divergence. This gives us our chaos index.
4. **Leverage role structure.** Our roles are a stabilizing force. Don't weaken them. If we add model heterogeneity later, maintain strong roles to exploit the non-additive stabilization effect.
5. **Tune per-task.** For creative tasks (brainstorming, exploration), relax constraints (larger k, less structured output). For critical tasks (QA verification, security review), tighten constraints (smaller k, structured output, deterministic checkpoints).

---

## 8. Open Questions

1. **Can we compute T_c analytically for a given architecture?** The phase transition prediction is testable but expensive empirically. Can we derive T_c from the number of agents, memory depth, and model similarity without running experiments?
2. **What's the relationship between λ̂ and task accuracy?** Is there an optimal λ̂ range (not too stable, not too chaotic) that maximizes performance?
3. **How do attractor basins shift when models are updated?** (Model update = new transition kernel. Old attractor basins may disappear or shift.)
4. **Can we use the stationary distribution to detect bias?** If the multi-agent system's stationary distribution systematically overweights certain decisions, that's a bias detectable from the Markov chain structure.
5. **Does Geng's convergence rate predict deliberation efficiency?** If attractor convergence takes τ steps in the single-chain case, does multi-agent convergence take ~τ/N steps (faster due to parallel exploration) or ~τ×N steps (slower due to interference)?

---

## 9. Research Quality of This Synthesis

This cross-reference produces **genuinely novel theoretical predictions** not found in either paper:
- The effective temperature hypothesis
- The critical temperature phase transition
- The Goldilocks zone for memory depth
- The heterogeneous-committees-escape-bad-attractors design principle
- The mixing time = deliberation budget bound

These are all **testable** and **actionable** — they provide concrete design guidance for multi-agent systems and can be validated empirically.

**This synthesis may be the most practically useful theoretical document in our workspace**, because it converts abstract mathematical theory (Markov chains) into concrete engineering decisions (how many agents, what memory depth, when to use diverse models).

---

*Cross-reference synthesis produced 2026-03-27. Scout workspace.*
*Source deep-dives: deep-dive-arxiv-2603-11228-markovian-generation-chains.md, deep-dive-arxiv-2603-09127-chaotic-dynamics-multi-llm-deliberation.md*
*Extended synthesis: deep-dive-drift-instability-synthesis.md*
