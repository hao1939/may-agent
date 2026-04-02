# CR#162: The Routing Convergence — Five Paradigms for Multi-Agent Task Allocation

**Cross-Reference Synthesis**
**Papers Connected:** DD#326 (Symphony-Coord), DD#300 (AVR Adaptive VLM Routing), DD#284 (RAPS Reputation Pub-Sub), DD#285 (HieraMAS Hierarchical MoA), DD#281 (AMRO-S Pheromone Routing), DD#288 (UAV-MARL)
**Filed:** 2026-03-16 | Session: s_1773654310128_2

---

## Thesis

The portfolio has now accumulated six deep-dives addressing the same fundamental problem from different angles: **how should a multi-agent system decide which agent handles which task?** Symphony-Coord (DD#326) crystallizes this into what we call the "Routing Convergence" — the recognition that routing/allocation is the central coordination primitive, not communication topology, not role definition, not hierarchical structure.

This synthesis maps the five paradigms, identifies their trade-offs, and proposes a unified routing taxonomy.

---

## The Five Routing Paradigms

### 1. Threshold Routing (DD#300 — AVR)
- **Mechanism:** Difficulty estimation → confidence probing → route to cheapest model above reliability threshold
- **Learning:** None (heuristic threshold, no online adaptation)
- **Strengths:** Fast, interpretable, cost-optimal for well-calibrated systems
- **Weaknesses:** No adaptation to distribution shift; threshold must be manually tuned
- **Theoretical guarantees:** None

### 2. Reputation Routing (DD#284 — RAPS)
- **Mechanism:** Bayesian reputation watchdogs + publish-subscribe intent matching
- **Learning:** Bayesian posterior updates on agent reliability
- **Strengths:** Decentralized, intent-driven, emergent specialization
- **Weaknesses:** No formal convergence rate; reputation can be gamed; pub-sub overhead
- **Theoretical guarantees:** Bayesian consistency (asymptotic, no finite-sample bounds)

### 3. Hierarchical Routing (DD#285 — HieraMAS)
- **Mechanism:** Tree-structured MoA with intra-node optimization selecting sub-agents
- **Learning:** Static optimization (not online)
- **Strengths:** Structured composition, compute-efficient vs. flat MoA
- **Weaknesses:** Static tree topology; can't self-heal; optimization is offline
- **Theoretical guarantees:** None formal

### 4. Bio-Inspired Routing (DD#281 — AMRO-S)
- **Mechanism:** Pheromone-trail stigmergy for distributed task-agent matching
- **Learning:** Evaporation + reinforcement (ant colony optimization analog)
- **Strengths:** Highly distributed, no central state, naturally fault-tolerant
- **Weaknesses:** Convergence is empirical; pheromone dynamics hard to tune; slow adaptation
- **Theoretical guarantees:** Stochastic convergence results from ACO literature (not tight)

### 5. Bandit Routing (DD#326 — Symphony-Coord) ← NEW
- **Mechanism:** Two-stage Beacon protocol: Top-L filtering → LinUCB contextual bandit selection
- **Learning:** Online ridge regression with UCB exploration bonus
- **Strengths:** Formal sublinear regret; self-healing via exploration; delayed credit assignment; emergent specialization proven empirically
- **Weaknesses:** Linear reward assumption may not hold for complex tasks; cold-start phase performance is weak; no inter-agent synergy modeling
- **Theoretical guarantees:** High-probability sublinear regret bound under linear realizability

---

## Comparative Analysis

| Property | Threshold | Reputation | Hierarchical | Bio-Inspired | Bandit |
|----------|-----------|------------|-------------|--------------|--------|
| Online learning | ✗ | ✓ (Bayes) | ✗ | ✓ (ACO) | ✓ (UCB) |
| Convergence proof | ✗ | Asymptotic | ✗ | Empirical | Sublinear regret |
| Self-healing | ✗ | ✓ (watchdog) | ✗ | ✓ (evaporation) | ✓ (exploration) |
| Scalability | ✓✓✓ | ✓✓ | ✓✓ | ✓✓✓ | ✓✓ (Top-L helps) |
| Cold-start | ✓ (no learning needed) | Moderate | ✓ | Slow | Moderate |
| Distribution shift | ✗ | ✓ | ✗ | ✓ | ✓ |
| Interpretability | ✓✓✓ | ✓✓ | ✓✓ | ✓ | ✓✓ |

### The Fundamental Trade-off
- **Learning power ↔ Cold-start performance:** Methods that learn (Reputation, Bio, Bandit) suffer cold-start but adapt; methods that don't (Threshold, Hierarchical) work immediately but can't improve.
- **Formal guarantees ↔ Expressiveness:** LinUCB requires linear reward assumption; reputation and bio-inspired methods handle nonlinear interactions but lack formal bounds.
- **Centralization ↔ Communication:** Bandit and Hierarchical approaches maintain some centralized state; Bio-inspired and Reputation approaches are fully distributed.

---

## The Synthesis: What Would Optimal Routing Look Like?

Combining insights from all five paradigms suggests a **three-layer optimal routing architecture**:

### Layer 1: Fast Heuristic Filter (from Threshold/AVR)
- Cheap, zero-learning-required screening
- Eliminates obviously wrong agents instantly
- Cost: O(N) embedding comparisons

### Layer 2: Reputation-Weighted Candidate Set (from RAPS/Bio-Inspired)
- Bayesian or pheromone-based reputation narrows candidates
- Self-healing: degraded agents automatically de-prioritized
- Cost: O(L) reputation lookups

### Layer 3: Bandit Selection with Formal Guarantees (from Symphony-Coord)
- LinUCB (or NeuralUCB for nonlinear) makes final selection
- Exploration bonus prevents local optima
- Delayed feedback handled via post-hoc updates
- Cost: O(L × d²) for d-dimensional context

This three-layer design is essentially what Symphony-Coord's two-stage Beacon protocol approximates (Stage 1 ≈ Layers 1+2, Stage 2 ≈ Layer 3), but making the reputation component explicit and distributed (à la RAPS) rather than embedding it in a composite score.

### Missing Piece: Inter-Agent Synergy
None of the five paradigms model **combinatorial agent interactions** — the fact that Agent A + Agent B together might outperform Agent A + Agent C, even if Agent B is individually worse than Agent C. This requires:
- Combinatorial bandits (selecting agent subsets, not individuals)
- Or graph neural network-based routing that captures pairwise agent compatibility
- DD#288 (UAV-MARL) addresses this with MARL but at much higher sample complexity

---

## Implications for Our System

1. **Agent routing is underspecified in most MAS frameworks.** Our system should treat routing as a first-class optimization problem, not a configuration parameter.

2. **The two-stage pattern is universal.** Whether we call it "Beacon protocol," "difficulty-based routing," or "candidate filtering + selection," the cheap-filter → expensive-select pattern appears in every practical routing system.

3. **Self-healing requires exploration.** Any routing system that only exploits will fail under agent degradation. UCB-style exploration bonuses are the simplest theoretically-grounded approach.

4. **Emergent specialization is real.** Symphony-Coord proves that agents will naturally specialize when given appropriate feedback — no need to design roles upfront.

---

## Research Frontier

The five paradigms converge toward a unified theory of **adaptive multi-agent routing**. The key open problems:

1. **Nonlinear bandits for routing** — Can NeuralUCB or Thompson Sampling with neural networks extend Symphony-Coord's guarantees to nonlinear reward structures?
2. **Combinatorial routing** — Selecting optimal agent *teams*, not just individual agents
3. **Hierarchical bandits** — Nesting Symphony-Coord's bandit selection within HieraMAS's tree structure
4. **Cross-task transfer** — Using routing experience from one task type to warm-start another (meta-learning for bandits)
5. **Communication-aware routing** — Integrating RAPS's pub-sub communication costs into the bandit reward signal

---

*CR#162 | Filed: 2026-03-16 | Connected: 6 deep-dives across 5 routing paradigms*
