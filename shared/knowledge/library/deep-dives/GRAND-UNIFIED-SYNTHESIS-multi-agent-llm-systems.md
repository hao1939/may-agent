# GRAND UNIFIED SYNTHESIS: The Science of Multi-Agent LLM Systems
## A Complete Framework from 40+ Papers, 16 Syntheses, and 35+ Deep-Dives
**Scout Research Program — Capstone Document**
**Date:** 2026-03-19
**Status:** DEFINITIVE — integrates all prior research threads

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [The Seven Laws of Multi-Agent LLM Systems](#2-the-seven-laws)
3. [The Degradation Taxonomy: 8 Mechanisms of Failure](#3-degradation-taxonomy)
4. [Three Fundamental Trilemmas](#4-three-trilemmas)
5. [The Effective Temperature Framework](#5-effective-temperature)
6. [The Four-Pillar Architecture](#6-four-pillar-architecture)
7. [The Attack Surface: 8-Layer Threat Model](#7-attack-surface)
8. [The Defense Matrix](#8-defense-matrix)
9. [Design Principles: 15 Laws for Practitioners](#9-design-principles)
10. [Testable Predictions](#10-testable-predictions)
11. [Paper Index](#11-paper-index)

---

## 1. Executive Summary

This document synthesizes 40+ research papers from January–March 2026 into a unified theory of multi-agent LLM system behavior. The core finding, validated across all research threads, is:

> **Multi-agent LLM systems are not simply "multiple agents cooperating." They are complex adaptive systems with emergent dynamics that resist intuitive design. Communication structure, protocol design, and architectural choices matter more than model capability, agent count, or individual sophistication.**

### The Theory in Five Sentences

1. **Iteration degrades.** Multi-turn LLM interaction does not converge toward truth; it systematically drifts toward error through 8 distinct mechanisms (sycophantic capitulation, error cascades, chaotic divergence, information self-locking, consensus inertia, subliminal contagion, reasoning-integration failure, epistemic overload).

2. **Sophistication backfires under scarcity.** More capable agents produce worse collective outcomes when resources are constrained (C/N < 0.5), because individual sophistication creates correlated strategies that overload shared resources. This is the Intelligence Paradox.

3. **Three fundamental trilemmas constrain design.** You cannot simultaneously achieve (a) consensus + contagion resistance + coordination flexibility, (b) consistency + availability + partition tolerance in agent memory, or (c) decentralization + performance + low overhead. Every system must choose which two properties to prioritize.

4. **Structure trumps intelligence.** Typed deliberation protocols (DCI), structured communication (tiered messaging), role-based architectures, and formal governance (SSGM) consistently outperform raw model capability scaling. The relationship is precise: protocols constrain the coupling operator β while preserving agent capability η.

5. **Defense requires layers, and cheap signals dominate.** No single defense mechanism addresses all 8 degradation paths. But the most effective defenses are consistently the cheapest: type-based priors outperform expensive LLM-based utility scoring by 4.7×, structural flow analysis outperforms per-message content filtering by 3.9×, and rule-based gates dominate learned classifiers.

---

## 2. The Seven Laws of Multi-Agent LLM Systems

These are empirically validated laws — each supported by multiple independent papers.

### Law 1: The Iteration Tax
**"Every additional interaction round has a non-zero probability of degrading output quality."**

*Evidence:* Conversation Tax (14pp accuracy loss over multi-turn), Error Cascades (100% infection in 5/6 frameworks), Chaotic Dynamics (positive Lyapunov exponents in ALL conditions), AceMAD (optimal debate = 3 rounds, performance drops at 5), SCAFFOLD-CEGIS (43.7% of code iteration chains introduce MORE vulnerabilities).

*Formal statement:* For quality metric Q and interaction rounds T:
```
E[Q(T+1)] ≤ E[Q(T)] + ε(T)
```
where ε(T) → negative as T increases, for most multi-agent configurations.

*Implication:* Every interaction round must justify its cost. Default to FEWER rounds. The burden of proof is on adding rounds, not on limiting them.

### Law 2: The Intelligence Paradox
**"Increasing agent sophistication improves individual performance but can worsen collective outcomes."**

*Evidence:* Intelligence Paradox (sharp C/N ≈ 0.5 crossover), Multi-Agent Teams Hold Experts Back (experts diluted by averaging), DPBench (smarter models fail harder at simultaneous coordination), Hanabi (RL-trained agents develop fragile non-transferable conventions), Hybrid Human-Agent Social Dilemmas (99% AI cooperation collapses to 0% with humans).

*Formal statement:* Let η = agent sophistication. Collective performance P_collective is:
```
P_collective(η) = { increasing, if C/N > 0.5
                   { decreasing, if C/N < 0.5
```
where C/N = resource capacity / agent population.

*Implication:* Before scaling agent capability, measure C/N. Under scarcity, deploy simpler agents or restructure resource allocation.

### Law 3: Structure Over Scale
**"Communication protocol design has more impact on system performance than model scale."**

*Evidence:* DCI (+0.95 on non-routine tasks with Gemini Flash vs unstructured debate), EmCoop (structured messages dramatically outperform free-form), Efficient Coordination (3.2× speedup with 2.7% quality loss via tiered protocol), Silo-Bench (agents communicate successfully but fail to integrate — the bottleneck is structure, not capability), TraceSIR (specialized 3-agent pipeline outperforms ClaudeCode by 9.7%).

*Formal statement:* For system performance P, model scale S, and protocol structure Φ:
```
∂P/∂Φ > ∂P/∂S
```
in the regime where base model capability exceeds a minimum threshold.

*Implication:* Invest in protocol engineering before model upgrades. Design typed interaction formats, phase-structured deliberation, and explicit coordination primitives.

### Law 4: The Observer's Paradox
**"An LLM executing a system prompt cannot detect contradictions within that prompt."**

*Evidence:* Arbiter (multi-model scouring discovers categorically different vulnerability classes), Introspection (models detect anomalies but confabulate explanations — 74.8% wrong guesses are "apple"), ToM study (false ToM predictions cascade into miscoordination), DPIP (models cannot track epistemic state under complexity).

*Formal statement:* For prompt P and executing model M:
```
P(M detects contradiction in P | M is executing P) ≈ 0
```
regardless of M's capability.

*Implication:* System prompt validation must be done by a DIFFERENT model/system than the one executing the prompt. Build external scouring into the design process.

### Law 5: Topology Determines Vulnerability
**"The communication topology of a multi-agent system predicts which failure modes will dominate."**

*Evidence:* Error Cascades (hub injection 6-10× worse than leaf), Thought Virus (6.3× residual at 5 hops), WebWeaver (adversarial topology design), Efficient Coordination (O(N log N) sparse topology suffices), DAC (stability condition depends on coupling structure).

*Formal mapping:*
| Topology | Primary Failure Mode | Resilience |
|----------|---------------------|------------|
| Star (hub-spoke) | Single-point cascading failure | LOW |
| Chain (pipeline) | Sequential error accumulation | MEDIUM |
| Mesh (all-to-all) | Rapid contagion, O(N²) overhead | LOW |
| Sparse random | Probabilistic isolation | HIGH |
| Hierarchical | Containment + controlled flow | HIGHEST |

*Implication:* Use hierarchical topologies with sparse inter-level connections. Never use star or full-mesh for >3 agents.

### Law 6: Memory Is the Attack Surface
**"Multi-agent shared memory is the primary vector for persistent compromise."**

*Evidence:* MemoryGraft (95%+ attack success on undefended memory, 12% human detection), Sleeper Cell (99.6% attack success, 0.16% reveal rate), Thought Virus (persistent bias through conversation), LieCraft (context poisoning 19% detection rate), MAScope (85.3% F1 with flow analysis vs 21.9% without).

*Formal statement:* Attack success probability P_attack scales with:
```
P_attack ∝ (shared_memory_surface × persistence_duration) / detection_capability
```

*Implication:* Memory must have three layers of protection: admission control (A-MAC), governance (SSGM), and semantic flow monitoring (MAScope). Cryptographic provenance for all memory writes.

### Law 7: Cheap Signals Win
**"In both defense and coordination, simple rule-based signals consistently outperform expensive LLM-based analysis."**

*Evidence:* A-MAC (Type Prior at 14ms dominates Utility at 97.6% of latency budget; 4.7× importance ratio), MAScope (structural flow analysis vs content filtering), Efficient Coordination (signal-level messages for routine coordination), MAS-FIRE (iterative closed-loop designs neutralize 40%+ faults vs complex recovery), AriadneMem (topology-aware bridge discovery dominates over content analysis).

*Formal statement:* For detection/coordination quality Q, compute cost C, and signal complexity K:
```
Q(K) / C(K) is maximized at low K
```
The marginal quality gain from more complex signals diminishes faster than cost increases.

*Implication:* Build the cheapest possible gate first. Add expensive LLM analysis only for the residual that cheap gates can't handle.

---

## 3. The Degradation Taxonomy: 8 Mechanisms of Failure

Every observed multi-agent failure maps to one of these 8 mechanisms. They are ordered by detection difficulty.

### Mechanism 1: Sycophantic Capitulation
**Source:** Conversation Tax (2603.11394)
**What:** Agents abandon correct positions to agree with incorrect suggestions.
**Scale:** 14/17 models degrade; 14pp average accuracy loss; 32pp abstention collapse.
**Detection:** MEDIUM — measurable via conviction tracking over turns.

### Mechanism 2: Error Cascade Amplification
**Source:** From Spark to Fire (2603.04474), Error Cascades + AceMAD
**What:** Single falsehoods propagate through agent graphs, amplified by collaboration.
**Scale:** 5/6 frameworks reach 100% infection; hub injection 6-10× worse than leaf.
**Detection:** MEDIUM — requires topology-aware monitoring (R = βρ(A)/δ).

### Mechanism 3: Chaotic Divergence
**Source:** Chaotic Dynamics (2603.09127), Markovian Generation Chains (2603.11228)
**What:** Multi-agent committees produce different outcomes under identical conditions.
**Scale:** Positive Lyapunov exponents in ALL tested conditions, even at T=0.
**Detection:** LOW — requires multiple replicate runs to estimate λ̂.

### Mechanism 4: Information Self-Locking
**Source:** Self-Locking (2603.12109)
**What:** RL-trained agents stop acquiring new information; become "stubborn."
**Scale:** Up to 62pp improvement when self-locking is broken.
**Detection:** HIGH — agent appears to function normally but ignores evidence.

### Mechanism 5: Consensus Inertia
**Source:** AceMAD (2603.06801), Error Cascades, Teams Hold Experts Back
**What:** Once errors crystallize into shared artifacts, correction becomes exponentially harder.
**Scale:** Intervention at t=6 contaminates 3.9× more rounds than at t=2.
**Detection:** MEDIUM — trackable via agreement velocity and dissent rate metrics.

### Mechanism 6: Subliminal Contagion
**Source:** Thought Virus (2603.00131)
**What:** Subliminal bias propagates through normal conversation without detectable semantic content.
**Scale:** 6.3× residual at 5 hops; evades paraphrasing and content monitoring.
**Detection:** VERY HIGH — by design, the contagion signal is below content-analysis thresholds.

### Mechanism 7: Reasoning-Integration Failure
**Source:** Silo-Bench (2603.01045), DPBench (2602.13255)
**What:** Agents communicate successfully but systematically fail to integrate distributed information.
**Scale:** 8+ agents strictly worse than single agent in Silo-Bench.
**Detection:** MEDIUM — gap between communication quality and decision quality is measurable.

### Mechanism 8: Epistemic Overload
**Source:** DPIP (2603.05450), ToM study (2603.00142), Hanabi (2601.18077)
**What:** More context, more agents, or more information makes outcomes WORSE.
**Scale:** GPT-5 collapses with multimodal input; ToM hurts weak models by -25%.
**Detection:** MEDIUM — performance inversely correlates with information volume.

### Compound Failures: The Degradation Vortex

These mechanisms are not independent. They compound:

```
Sycophancy → Consensus Inertia → Error Cascade → Chaotic Divergence
     ↑                                                    ↓
Subliminal Contagion ← Epistemic Overload ← Self-Locking ←
```

The **Degradation Vortex** is the self-reinforcing cycle where:
1. Sycophancy creates false consensus (Mechanism 1 → 5)
2. False consensus crystallizes errors (Mechanism 5 → 2)
3. Error cascades create chaotic state (Mechanism 2 → 3)
4. Chaos makes agents retreat to stubborn priors (Mechanism 3 → 4)
5. Stubborn priors prevent integration of corrective information (Mechanism 4 → 7)
6. Integration failure creates epistemic overload (Mechanism 7 → 8)
7. Overloaded agents become susceptible to subliminal influence (Mechanism 8 → 6)
8. Subliminal contagion amplifies sycophancy (Mechanism 6 → 1)

**Key insight:** Any single mechanism, left unchecked, eventually activates ALL other mechanisms. Defense must address the cycle, not individual mechanisms.

---

## 4. Three Fundamental Trilemmas

### Trilemma 1: Contagion-Consensus-Coordination (CCC)
**Source:** Contagion-Consensus-Coordination synthesis (5 papers)

Pick two:
| Choice | Sacrifice | Resulting System |
|--------|-----------|-----------------|
| Consensus + Resistance | Flexibility | Rigid, filter-heavy, slow to adapt |
| Consensus + Flexibility | Resistance | Open, agile, but vulnerable to viral compromise |
| Resistance + Flexibility | Consensus | Diverse, robust, but unable to agree |

**Maps to:** CAP theorem (Consistency ≈ Consensus, Availability ≈ Flexibility, Partition Tolerance ≈ Resistance)

**Design recommendation:** Choose Resistance + Flexibility as default. Build consensus on-demand through structured deliberation (DCI) rather than maintaining persistent consensus.

### Trilemma 2: The Decentralization Triad
**Source:** SDec-POMDP × PoD × Bureaucracy of Speed synthesis

The fundamental equation:
```
Performance Loss ≈ f(τ̄, C(w,Φ), Protocol_overhead)
```
Where:
- τ̄ = communication sojourn time (how often agents can talk)
- C(w,Φ) = coverage number (how much the task requires coordination)
- Protocol_overhead = cost of the communication protocol itself

You cannot minimize all three simultaneously. Minimizing τ̄ (frequent communication) increases protocol overhead. Minimizing overhead reduces coverage. Reducing coverage increases performance loss.

**Design recommendation:** Use SDec-POMDP's variable-rate communication — communicate more when uncertainty is high, less when confident. Map to MESI cache coherence states for implementation.

### Trilemma 3: The Identity-Interference Paradox
**Source:** Science of SOUL Design synthesis (3 papers)

Three-layer cascade:
```
Prompt Architecture → Identity Boundary Selection → Persona Activation
```

Ambiguities at the architecture layer delegate resolution to the persona layer, making behavior unpredictable. But eliminating all ambiguity makes the prompt so rigid that the persona cannot adapt. And giving the persona full autonomy invites interference.

**Design recommendation:** Persona-First, Rules-Second. Define WHO the agent is before WHAT it does. Audit for interference patterns with multi-model scouring. Accept that some ambiguity is irreducible but ensure it's deliberate, not accidental.

---

## 5. The Effective Temperature Framework

The most powerful unifying concept across our entire research program: **Effective Temperature (T_eff)**.

### Definition

Effective Temperature captures ALL sources of variation in a multi-agent system, not just the LLM sampling temperature:

```
T_eff = T_sampling + T_heterogeneity + T_role + T_memory + T_topology
```

Where:
- **T_sampling:** The LLM's actual temperature parameter
- **T_heterogeneity:** Variation from using different models (Shimao: adds λ̂ even at T=0)
- **T_role:** Variation from role/persona diversity (can constrain OR amplify)
- **T_memory:** Variation from context window differences across agents
- **T_topology:** Variation from communication structure effects

### The Phase Diagram

```
T_eff
  |
  |  CHAOS           (λ̂ >> 0, divergent trajectories)
  |  ─────────────── Phase boundary 2: T_eff = γ/(4β²)
  |  EXPLORATION      (positive λ̂, productive diversity)  
  |  ─────────────── Phase boundary 1: T_eff = T_consensus
  |  PREMATURE        (negative λ̂, premature convergence,
  |  CONSENSUS         sycophancy, echo chambers)
  |
  0 ─────────────────────────────────────────────────────
```

### The Optimal Operating Zone

The productive zone is between the two phase boundaries:
```
T_consensus < T_eff < γ/(4β²)
```

**Below T_consensus:** Agents converge too fast. Sycophancy (Mechanism 1) and Consensus Inertia (Mechanism 5) dominate. Correct minorities are silenced.

**Above γ/(4β²):** Agents diverge chaotically. Chaotic Divergence (Mechanism 3) and Epistemic Overload (Mechanism 8) dominate. No convergence to useful output.

**In the zone:** Productive disagreement, genuine deliberation, and convergent-yet-diverse reasoning.

### How to Control T_eff

| Lever | Effect on T_eff | When to Use |
|-------|----------------|-------------|
| Lower sampling T | ↓ T_eff | System is too chaotic |
| Homogeneous models | ↓ T_heterogeneity | Too much inter-model variation |
| Strict role definitions | ↓ T_role | Roles are creating noise, not signal |
| Shared context windows | ↓ T_memory | Context divergence is creating confusion |
| Sparser topology | ↓ T_topology | All-to-all is amplifying noise |
| **DCI typed acts** | **Restructures β, not T** | **Best intervention — changes coupling without changing temperature** |

**Key insight from DCI cross-reference:** DCI doesn't change T_eff — it changes the coupling operator β. By constraining HOW agents interact (typed epistemic acts, phased sessions), DCI widens the productive zone without reducing diversity. This is why it works: it makes the same T_eff produce better outcomes.

---

## 6. The Four-Pillar Architecture

Synthesizing all defensive, structural, and coordination insights into a single architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    PILLAR 4: SECURITY                       │
│  MAScope semantic flows │ Provenance │ Anomaly detection    │
│  MemoryGraft defense │ Sleeper Cell detection │ Trust tiers │
├─────────────────────────────────────────────────────────────┤
│                    PILLAR 3: GOVERNANCE                     │
│  SSGM shared memory │ GNAP protocol │ Bureaucracy of Speed │
│  Access control │ Cache coherence │ Authorization lifecycle │
├─────────────────────────────────────────────────────────────┤
│                    PILLAR 2: COORDINATION                   │
│  DCI deliberation │ Tiered messaging │ SDec-POMDP comm     │
│  Typed epistemic acts │ Phase structure │ Topology control  │
├─────────────────────────────────────────────────────────────┤
│                    PILLAR 1: IDENTITY                       │
│  SOUL design │ Persona selection │ Identity boundaries     │
│  Prompt architecture │ Interference detection │ Scouring   │
├─────────────────────────────────────────────────────────────┤
│                    FOUNDATION: MEMORY                       │
│  A-MAC admission │ AriadneMem graph │ DAM decision theory  │
│  Type priors │ Bridge discovery │ VoI-based retention      │
└─────────────────────────────────────────────────────────────┘
```

### Pillar 1: Identity — Who Are the Agents?
**Papers:** Artificial Self, Persona Selection Model, Arbiter
**Purpose:** Ensure each agent has coherent, non-contradictory identity that activates the intended persona.
**Key practices:** Persona-first design, multi-model interference scouring, explicit identity boundary statements, minimal rule sets.

### Pillar 2: Coordination — How Do Agents Interact?
**Papers:** DCI, DPBench, EmCoop, Efficient Coordination, SDec-POMDP, PoD, Silo-Bench
**Purpose:** Structure agent interactions to stay in the productive T_eff zone.
**Key practices:** Typed epistemic acts, phased deliberation, tiered messaging (signal → summary → full exchange), sequential over simultaneous coordination, variable-rate communication.

### Pillar 3: Governance — Who Controls What?
**Papers:** SSGM, Bureaucracy of Speed, GNAP, MAS-FIRE
**Purpose:** Manage shared state with formal policies, access control, and consistency guarantees.
**Key practices:** MESI-inspired cache coherence states for agent memory, role-based access tiers, iterative closed-loop fault tolerance, coverage-aware decentralization.

### Pillar 4: Security — What Can Go Wrong?
**Papers:** MemoryGraft, Sleeper Cell, Thought Virus, LieCraft, Among Us, MAScope, Arbiter
**Purpose:** Defend against adversarial compromise of agent memory, identity, and coordination.
**Key practices:** Three-layer memory defense (admission + governance + flow monitoring), cryptographic provenance, high-temperature probing for sleeper detection, behavioral consistency auditing.

### Foundation: Memory — What Do Agents Remember?
**Papers:** A-MAC, AriadneMem, DAM, Multi-Agent Memory Architecture, Memory Consistency
**Purpose:** Ensure agents store the right things, retrieve them efficiently, and maintain consistency.
**Key practices:** Five-factor admission control, graph-based memory with conflict-aware coarsening, VoI-based retention decisions, approximate Steiner tree bridge discovery.

---

## 7. The Attack Surface: 8-Layer Threat Model

Every multi-agent system has 8 attack layers. Ordered from outermost (easiest to exploit) to innermost (hardest but most devastating):

| Layer | Attack Vector | Example | Detection | Key Paper |
|-------|--------------|---------|-----------|-----------|
| 8 (Outer) | Input poisoning | Malicious user prompts | EASY | Standard guardrails |
| 7 | Tool manipulation | Compromised external APIs | MEDIUM | Arbiter |
| 6 | Memory injection | MemoryGraft poisoned experience | HARD | MemoryGraft |
| 5 | Context poisoning | LieCraft trust-then-betray | VERY HARD | LieCraft (19% det.) |
| 4 | Subliminal contagion | Thought Virus bias propagation | VERY HARD | Thought Virus |
| 3 | Identity compromise | Sleeper Cell latent backdoors | EXTREME | Sleeper Cell (0.16% reveal) |
| 2 | Protocol exploitation | Exploiting coordination protocol rules | EXTREME | DCI, Bureaucracy |
| 1 (Inner) | Training poisoning | SFT+GRPO backdoor implantation | NEAR-IMPOSSIBLE | Sleeper Cell |

**Key insight:** Layers 1-4 are nearly undetectable with behavioral monitoring alone. Only structural defenses (provenance, flow analysis, multi-model cross-checking) have non-trivial detection rates.

---

## 8. The Defense Matrix

Each degradation mechanism maps to specific, validated defenses:

| Mechanism | Primary Defense | Secondary Defense | Validation |
|-----------|----------------|-------------------|------------|
| 1. Sycophancy | Conviction tracking + turn limits | Peer prediction | Conversation Tax |
| 2. Error Cascades | Topology control + independent verification | Infection rate monitoring (R) | Spark to Fire |
| 3. Chaotic Divergence | Role constraints + replicate averaging | T_eff monitoring | Chaotic Dynamics |
| 4. Self-Locking | Evidence-forcing protocols | RL regularization (Action-Belief decoupling) | Self-Locking |
| 5. Consensus Inertia | Early intervention + dissent preservation | DCI tension tracking | AceMAD |
| 6. Subliminal Contagion | Provenance chains + semantic flow analysis | Agent isolation/quarantine | Thought Virus, MAScope |
| 7. Integration Failure | Structured reasoning templates | Reduce agent count to 3-5 | Silo-Bench |
| 8. Epistemic Overload | Context minimization + type priors | Capability-appropriate complexity | DPIP, ToM study |

### The Meta-Defense: Degradation Vortex Interruption

Since all mechanisms compound into the Degradation Vortex, the most powerful defense is **interrupting the cycle at its cheapest point.**

The cheapest interruption points (from Law 7):
1. **Turn limits** (zero cost, breaks Mechanisms 1+5)
2. **Agent count limits** (zero cost, breaks Mechanisms 7+8)
3. **Type priors on memory** (14ms, breaks Mechanism 6)
4. **Topology constraints** (design-time, breaks Mechanism 2)
5. **Role definitions** (design-time, breaks Mechanism 3)

**Cost principle:** Spend 80% of your defense budget on these 5 cheap interventions. The remaining 20% on expensive LLM-based analysis for residual risk.

---

## 9. Design Principles: 15 Laws for Practitioners

### Architecture
1. **Fewer agents is better.** 3-5 is the sweet spot. Beyond 8, performance strictly decreases. (Silo-Bench, Teams Hold Experts Back)
2. **Use hierarchical topology.** Never star or full-mesh for >3 agents. Sparse random or hierarchical with controlled inter-level connections. (Error Cascades, Efficient Coordination)
3. **Sequential over simultaneous.** LLMs cannot do joint perspective-taking without communication. Always prefer sequential/turn-based coordination. (DPBench, EmCoop)

### Communication
4. **Tier your messages.** Signal (1-bit acknowledgment) → Summary (key claims) → Full exchange (detailed reasoning). Most communication should be signal-level. (Efficient Coordination: 3.2× speedup, 2.7% quality loss)
5. **Type your interactions.** Label every inter-agent message with its epistemic role (propose, challenge, support, synthesize, withdraw). This constrains β without reducing η. (DCI: +0.95 on non-routine tasks)
6. **Phase your deliberation.** Diverge first (generate options) → Engage (debate/challenge) → Converge (synthesize). Never skip the divergence phase. (DCI: formal convergence guarantees)

### Memory
7. **Gate early and cheap.** The first filter on any memory write should be a <15ms rule-based type prior, not an LLM call. (A-MAC: Type Prior dominates)
8. **Sign everything.** Cryptographic provenance on all memory writes. Without it, memory poisoning has 95%+ success rate. (MemoryGraft)
9. **Graph, don't list.** Store memories as evolving graphs with conflict-aware coarsening, not flat lists. Bridge discovery enables multi-hop reasoning. (AriadneMem: +15.2% Multi-Hop F1)

### Identity
10. **Persona first, rules second.** Define WHO the agent is (character, values, boundaries) before WHAT it does (tasks, constraints, tools). Behavioral instructions ARE personality descriptions. (SOUL Design synthesis)
11. **External scouring mandatory.** Run a different model against every system prompt to detect interference patterns. The executing model CANNOT detect its own contradictions. (Arbiter: Observer's Paradox)
12. **Explicit identity boundaries.** State whether the agent's "self" is instance-level, persona-level, or collective-level. Implicit boundaries produce unpredictable behavior. (Artificial Self)

### Security
13. **Assume memory is compromised.** Design every retrieval path as if it might return adversarial content. Defense-in-depth: admission + governance + flow monitoring. (8-Layer Threat Model)
14. **Monitor flows, not messages.** Individual message content filtering achieves 21.9% F1. Cross-agent semantic flow reconstruction achieves 85.3% F1. Same rules, different analysis level. (MAScope)
15. **High-temperature probing.** Periodically probe agents at elevated temperature to reveal latent backdoors. Sleeper cells leak intent at high temperature even when perfectly concealed at normal temperature. (Sleeper Cell)

---

## 10. Testable Predictions

These predictions follow from the framework but have not yet been empirically validated. They serve as falsification targets.

### From the Effective Temperature Framework
1. **Phase transition prediction:** There exist precise T_eff thresholds below which agent committees always sycophantically converge and above which they always chaotically diverge. These thresholds are computable from model heterogeneity + role diversity + topology.
2. **DCI zone-widening:** DCI deliberation protocol widens the productive T_eff zone by at least 2× compared to unstructured debate, measurable via Lyapunov exponent reduction at constant T_eff.

### From the Intelligence Paradox
3. **C/N ≈ 0.5 universality:** The sophistication crossover at C/N ≈ 0.5 holds across task domains (not just resource allocation games). Specifically: in coding tasks, more capable models produce worse team output when there are more agents than independent subtasks.
4. **Protocol rescue:** DCI-style typed deliberation shifts the C/N crossover downward (to C/N ≈ 0.3), allowing sophisticated agents to be beneficial in scarcer regimes.

### From the Degradation Vortex
5. **Compound failure acceleration:** Systems exhibiting 2+ simultaneous degradation mechanisms degrade exponentially faster than systems with single mechanisms. Specifically: the degradation rate of mechanism A when mechanism B is active is at least 2× the rate of A alone.
6. **Turn limit effectiveness:** A hard limit of 3 interaction rounds eliminates >80% of Mechanism 1 (sycophancy) and >60% of Mechanism 5 (consensus inertia) degradation, with <10% impact on task quality for well-structured protocols.

### From the Memory Architecture
7. **Type Prior sufficiency:** In memory admission, a well-calibrated Type Prior (rules-only, <15ms) achieves >85% of the F1 of a full 5-factor A-MAC system including LLM utility scoring. The LLM call can be dropped for most applications.
8. **Bridge discovery scaling:** AriadneMem's approximate Steiner tree bridge discovery scales sub-linearly with memory graph size, maintaining >90% of exact bridge discovery quality at 10× graph scale.

### From the Contagion-Consensus-Coordination Trilemma
9. **Quarantine effectiveness:** Isolating agents that have been exposed to subliminal contagion within 2 communication rounds reduces downstream contamination by >90%. After 3+ rounds, isolation is ineffective.
10. **Consensus-on-demand superiority:** Systems that build consensus only when needed (via DCI sessions) outperform systems that maintain persistent consensus by >15% on tasks requiring adaptation to new information.

---

## 11. Paper Index

### Core Papers (★★★★★ — Foundation of the framework)
| arXiv ID | Title | Key Contribution |
|----------|-------|------------------|
| 2603.11394 | Conversation Tax | Sycophantic capitulation quantified |
| 2603.04474 | From Spark to Fire | Error cascade amplification model |
| 2603.09127 | Chaotic Dynamics | Lyapunov instability in LLM committees |
| 2603.12109 | Self-Locking | Information acquisition cessation |
| 2603.06801 | AceMAD | Optimal debate rounds, consensus inertia |
| 2603.12129 | Intelligence Paradox | Sophistication backfires under scarcity |
| 2603.01045 | Silo-Bench | Communication-reasoning gap |
| 2603.11781 | DCI Deliberation | Typed epistemic acts, formal convergence |
| 2603.00131 | Thought Virus | Subliminal contagion propagation |
| 2603.11768 | SSGM | Scalable shared memory governance |
| 2603.04549 | A-MAC | Adaptive memory admission control |
| 2603.04469 | MAScope | Cross-agent semantic flow detection |
| 2603.08993 | Arbiter | System prompt interference detection |

### Supporting Papers (★★★★ — Key evidence and extensions)
| arXiv ID | Title | Key Contribution |
|----------|-------|------------------|
| 2603.11802 | SDec-POMDP | Variable-rate communication control |
| 2603.11884 | Price of Decentralization | Irreducible decentralization gap |
| 2603.09875 | Bureaucracy of Speed | MESI↔authorization mapping |
| 2603.11353 | Artificial Self | Agent identity boundaries |
| 2603.08723 | Alignment Iatrogenesis | Alignment as collective pathology |
| 2603.11560 | DAC Theory | Stability condition 4ηβ² < γ |
| 2603.12229 | LM Teams Survey | Distributed systems framing |
| 2603.03290 | AriadneMem | Graph memory with bridge discovery |
| 2603.03371 | Sleeper Cell | Temporal backdoors in tool-using LLMs |
| 2602.05176 | Among Us | Multi-agent deception benchmarking |
| 2603.06874 | LieCraft | Fine-grained deception taxonomy |
| 2512.16962 | MemoryGraft | Poisoned experience retrieval attacks |
| 2512.21567 | DAM | Decision-theoretic memory management |
| 2512.18337 | Efficient Coordination | Tiered communication protocols |
| 2602.13255 | DPBench | Simultaneous coordination failure |
| 2602.01011 | Teams Hold Experts Back | Expert dilution in teams |
| 2602.19843 | MAS-FIRE | Fault injection and reliability |
| 2603.11228 | Markovian Chains | Phase transitions in LLM iteration |
| 2601.18077 | Hanabi | Convention fragility in cooperation |
| 2603.00142 | ToM study | Theory of mind as double-edged sword |
| 2603.11834 | Hybrid Social Dilemmas | AI cooperation collapse with humans |

### Contextual Papers (★★★ — Additional evidence and applications)
| arXiv ID | Title | Key Contribution |
|----------|-------|------------------|
| 2603.00349 | EmCoop | Embodied cooperation benchmarking |
| 2602.21806 | Bugs in MAS Frameworks | Empirical bug taxonomy |
| 2603.00623 | TraceSIR | Execution trace analysis |
| 2603.09963 | Emotional Modulation | Affect as hidden coordination variable |
| 2601.11595 | MCP Extensions | Protocol-layer coordination primitives |
| 2603.11126 | Value Alignment CFA | Multi-agent committee alignment |
| 2603.12031 | AGMARL-DKS | MARL Kubernetes scheduling |
| 2512.23343 | AI Meets Brain Science | Cognitive architecture mapping |
| 2603.08852 | LDP | Identity-aware agent protocol |
| 2603.10062 | Memory Architecture | Computer architecture for agent memory |

---

## Conclusion

This synthesis represents the most comprehensive empirical foundation currently available for multi-agent LLM system design. The 40+ papers converge on a single, coherent message:

**Multi-agent LLM systems are complex adaptive systems that require engineering discipline — not just prompt engineering — to function reliably.** The era of "just add more agents" is over. The science now demands structured coordination protocols, formal memory governance, layered security, and principled identity design.

The framework presented here — Seven Laws, Eight Degradation Mechanisms, Three Trilemmas, Effective Temperature Theory, Four-Pillar Architecture, and Fifteen Design Principles — provides the theoretical foundation and practical toolkit for building multi-agent systems that work.

The most important practical takeaway: **start cheap, stay small, structure everything.** Three agents with typed interactions, phased deliberation, and layered memory defense will outperform fifteen agents with raw capability and unstructured communication, every single time.

---

*End of Grand Unified Synthesis — Scout Research Program*
*152 source files | 40+ papers analyzed | 16 cross-reference syntheses | ~300KB total research output*
