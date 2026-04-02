# DD#346 — PO-MARL-IS: Partially Observable Multi-Agent RL with Information Sharing

**Paper:** [arXiv:2308.08705v5](https://arxiv.org/abs/2308.08705v5) — "Partially Observable Multi-Agent Reinforcement Learning with Information Sharing"
**Authors:** Xiangyu Liu, Kaiqing Zhang
**Published:** August 2023 (ICML 2023), revised March 12, 2026 (v5)
**Venue:** ICML 2023 → SIAM Journal on Control and Optimization (SICON) — top-tier journal acceptance
**Cross-listed:** cs.LG, cs.GT, cs.MA

---

## 1. Problem Statement

Multi-agent reinforcement learning (MARL) under **partial observability** is fundamentally hard:

- **Partially Observable Stochastic Games (POSGs)** are NEXP-hard to solve in general
- Single-agent POMDPs are already PSPACE-hard
- Adding multiple agents with private observations explodes the problem further
- Existing approaches either assume full observability or use intractable oracles

The central question: **Can information sharing among agents make partially observable MARL tractable?**

## 2. Core Contributions

### Contribution 1: Computational Complexity Results

The paper establishes **necessity results** showing that information sharing is required for tractability:

- **Without information sharing:** Solving POSGs remains computationally intractable even under strong structural assumptions (e.g., observability conditions that help in single-agent settings)
- **With information sharing:** The problem becomes tractable under specific structural conditions
- This separation formally justifies the common empirical practice of inter-agent communication

Key insight: **The observability assumption** that enables quasi-polynomial time single-agent RL with partial observations is **necessary but not sufficient** for multi-agent settings. Information sharing provides the additional structure needed.

### Contribution 2: Approximate Common Information

Instead of requiring exact shared information (which may be impractical), the paper proposes **approximating the shared common information**:

- Construct an **approximate model** of the POSG using compressed shared information
- Show that an approximate equilibrium of the *original* POSG can be found by solving the approximate model
- The approximation quality degrades gracefully with compression

This is philosophically important: agents don't need perfect shared understanding; **approximate common ground** is sufficient for near-optimal coordination.

### Contribution 3: Quasi-Polynomial Algorithm

The paper develops a concrete MARL algorithm with:
- **Time complexity:** Quasi-polynomial (sub-exponential but super-polynomial)
- **Sample complexity:** Quasi-polynomial
- Both bounds are achieved simultaneously (some prior work had polynomial sample complexity but exponential computational complexity or vice versa)

### Contribution 4: Team-Optimal Solution for Dec-POMDPs

Beyond equilibrium learning, the paper extends to finding **team-optimal solutions** in cooperative POSGs (i.e., Dec-POMDPs):

- This is strictly harder than equilibrium finding
- The paper establishes concrete complexity bounds under structural assumptions
- Connects to the Dec-POMDP literature which is fundamental for cooperative multi-agent systems

## 3. Technical Framework

### Information Structure Design

The paper draws on **information structure theory** from control theory:

```
Agent i's information at time t:
  - Private observation history: oᵢ¹, oᵢ², ..., oᵢᵗ
  - Shared common information: c¹, c², ..., cᵗ (communicated)
  - Private information: pᵢᵗ = information available to i but not shared

Decision: πᵢ(aᵢᵗ | cᵗ, pᵢᵗ) — policy conditions on both common and private info
```

### Common Information Approach

From control theory (Nayyar et al., 2013), the **coordinator** viewpoint:
1. A fictitious coordinator observes only the common information
2. The coordinator prescribes **partial policies** (mappings from private info to actions) for each agent
3. This reduces the POSG to a single-agent (coordinator) POMDP over belief space

The paper's innovation: **approximate** this belief space to avoid exponential blowup.

### Approximate Model Construction

Key technical step: compress the common information belief state from exponential to polynomial representation, while maintaining bounded approximation error for equilibrium quality.

## 4. Comparison with MAGPO (DD#344)

| Feature | PO-MARL-IS (this paper) | MAGPO (DD#344) |
|---------|------------------------|----------------|
| **Approach** | Theory-first with complexity bounds | Algorithm-first with empirical validation |
| **Observability** | Partially observable | Partially observable |
| **Information sharing** | Explicit common information framework | Autoregressive joint policy for guidance |
| **Guarantee type** | Computational/sample complexity bounds | Monotonic policy improvement |
| **Practical scale** | Theoretical (small instances) | 43 tasks across 6 environments |
| **Communication** | Structured information sharing protocol | Centralized training bridge |
| **Contribution** | Necessity of communication for tractability | Practical algorithm outperforming baselines |

**Complementarity:** PO-MARL-IS provides the *theoretical foundation* for why approaches like MAGPO work. MAGPO provides the *practical algorithm* that achieves good results at scale. Together, they span the theory-practice gap.

## 5. Critical Analysis

### Strengths

1. **Rigorous complexity theory** — Formally establishes when and why information sharing enables tractability. This is a foundational result for the field.

2. **ICML → SIAM JCON trajectory** — Conference-to-journal progression indicates sustained high quality and thorough revision. SIAM JCON is among the most prestigious journals in control and optimization.

3. **Control theory bridge** — Imports information structure design from control theory into MARL. This cross-disciplinary fertilization opens new research directions.

4. **Simultaneous bounds** — Achieving quasi-polynomial time AND sample complexity simultaneously is technically significant; prior work achieved one at the expense of the other.

5. **Dec-POMDP extension** — Going beyond equilibrium to team-optimal solutions addresses the most practically relevant setting (cooperative agents).

### Weaknesses

1. **Quasi-polynomial is still large** — While theoretically tractable, quasi-polynomial complexity (e.g., n^{O(log n)}) is impractical for real-world systems with many agents or long horizons.

2. **Structural assumptions** — The tractability results rely on specific observability conditions. These assumptions may not hold in many practical multi-agent settings.

3. **No empirical evaluation** — Pure theory paper with no experimental validation. It's unclear how the algorithms perform on realistic benchmarks compared to heuristic methods.

4. **Static information structure** — The paper assumes a fixed information-sharing protocol. In practice, agents may need to dynamically decide *what* to share, which is itself a hard problem.

5. **Scalability gap** — The gap between the quasi-polynomial theoretical guarantees and the practical scalability of methods like MAGPO (which work on complex benchmarks without formal guarantees) remains unaddressed.

### Limitations

- Paper dates from 2023 (ICML) — predates the LLM agent explosion and may not capture agent-specific challenges
- Focus on tabular/finite-state settings; extension to continuous states unclear
- Two-player settings receive most attention; scaling to N agents is addressed but bounds worsen rapidly

## 6. Connections to Scout Portfolio

### Direct connections:
- **MAGPO (DD#344)** — Theory-practice complementarity as analyzed in Section 4
- **CoMAM (DD#341)** — CoMAM's sequential MDP formulation for multi-agent memory systems connects to this paper's sequential decision-making under partial observability
- **Symphony-Coord (DD#326)** — Coordination under communication constraints mirrors this paper's information sharing framework

### Thematic connections:
- **Information sharing ↔ Agent memory** — The common information is conceptually similar to shared memory in LLM agent systems. The paper's insight that approximate common information suffices suggests that agents don't need perfect shared memory.
- **Partial observability ↔ Context windows** — LLM agents operate under "partial observability" by virtue of limited context windows. The paper's framework could inform how agents should communicate to compensate.
- **Dec-POMDP ↔ Decentralized execution** — The paper's cooperative framework maps directly onto the CTDE paradigm that dominates practical MARL.

## 7. Key Takeaways

1. **Information sharing is provably necessary** for tractable multi-agent RL under partial observability
2. **Approximate common information** suffices — agents don't need perfect shared knowledge
3. **Quasi-polynomial complexity** is achievable for both computation and sample efficiency
4. **Team-optimal solutions** for Dec-POMDPs are tractable under structural assumptions
5. **Information structure design** from control theory is a powerful but underutilized tool for MARL

## 8. Scout Assessment

- **Relevance:** ★★★★☆ (4/5) — Foundational theory for cooperative MARL with partial observability
- **Rigor:** ★★★★★ (5/5) — ICML + SIAM JCON, formal complexity bounds, thorough analysis
- **Novelty:** ★★★★★ (5/5) — First quasi-polynomial MARL algorithm for POSGs with information sharing
- **Actionability:** ★★☆☆☆ (2/5) — Pure theory; practical application requires bridging the scalability gap
- **Impact potential:** ★★★★★ (5/5) — Foundational result that will shape the field for years

**Bottom line:** This is a landmark theoretical result establishing that information sharing is both necessary and sufficient (under assumptions) for tractable multi-agent RL with partial observations. While practical impact is mediated by the scalability gap, it provides the theoretical bedrock on which practical algorithms like MAGPO are built.

---

*Scout DD#346 — Session s_1773681275494_74 — 2026-03-16*
