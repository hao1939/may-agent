# Cross-Reference: Intelligence Paradox × DCI Deliberation × Dynamic Adaptive Coordination

**Papers:**
- **Intelligence Paradox:** arXiv:2603.12129 — "Increasing intelligence in AI agents can worsen collective outcomes" (Johnson, GWU)
- **DCI:** arXiv:2603.11781 — "From Debate to Deliberation: Structured Collective Reasoning with Typed Epistemic Acts" (Prakash, ISB)
- **DAC:** arXiv:2603.11560 — "How Intelligence Emerges: A Minimal Theory of Dynamic Adaptive Coordination" (Grassi, Bangkok University)

**Core Question:** Do typed epistemic acts change the sophistication crossover? Can structured deliberation protocols rescue intelligent agents from the paradox that sophistication worsens collective outcomes under scarcity?

**Date:** 2026-03-13 | **Filed by:** Scout

---

## 1. The Three Frameworks in Dialogue

### What Each Paper Contributes

| Paper | Core Finding | Key Formal Object | Regime | Scale |
|-------|-------------|-------------------|--------|-------|
| **Intelligence Paradox** | Smarter agents → worse collective outcomes when C/N < 0.5 | C/N crossover at ≈0.5 | Competitive (resource contention) | N=7–15 agents, small LLMs |
| **DCI** | Typed deliberation outperforms unstructured debate on non-routine tasks (+0.95, p<0.05) but costs 62× tokens | 14 typed epistemic acts, 5-phase session model | Cooperative (shared deliberation) | 4 agents (archetypes), Gemini Flash |
| **DAC** | Coordination stability requires 4ηβ² < γ (dissipation > amplification) | Stability boundary, impossibility of static objective reduction | General (encompasses both) | Theoretical, any N |

### The Central Tension

Johnson shows that sophistication (RL, diversity, tribal dynamics) is toxic under scarcity. DCI IS a sophisticated coordination protocol — typed acts, phased sessions, structured workspace. **Does DCI's sophistication make things worse?**

The answer requires decomposing WHAT KIND of sophistication each paper is measuring.

---

## 2. Two Types of Sophistication

### Johnson's Sophistication = Agent-Level Responsiveness (η)

In the Intelligence Paradox:
- **Level 1 → Level 5** increases agent capabilities: RL, diversity, social sensing
- Each escalation increases η — agents respond MORE to signals and to each other
- Under scarcity, higher η creates correlated herding → overload

Key: Johnson's agents have NO coordination protocol. They observe demand history and flip biased coins. The "sophistication" is in their individual decision-making, not in how they coordinate.

### DCI's Sophistication = Interaction-Level Structure (protocol on β)

DCI does NOT increase agent responsiveness. Instead, it:
1. **Phases interaction:** Divergence → Engagement → Convergence (prevents premature herding)
2. **Types reasoning moves:** Each interaction is labeled (propose, challenge, synthesize) — constraining β
3. **Preserves disagreement:** Tensions tracked as first-class objects → disagreement is NOT resolved into premature consensus
4. **Bounds process:** DCI-CF has formal termination guarantees (controls runaway amplification)

**Key insight: DCI adds structure to the coupling operator β, not to agent responsiveness η.**

### DAC Framework: The Precise Distinction

Using Grassi's notation:
- **Johnson escalates η** (agent learning rate / responsiveness to incentive signals)
- **DCI restructures Φ** (the distribution operator that converts global coordination signal to local incentive pressures)

The stability condition 4ηβ² < γ reveals the difference:
- Higher η → less stable (Johnson's result)
- **Restructured Φ can change the effective β** — replacing unstructured all-to-all coupling with phased, typed, role-differentiated coupling

---

## 3. Does DCI Change the Crossover?

### Hypothesis: DCI Does NOT Change C/N = 0.5, But Changes What Happens Below It

**The crossover point is structural.** It's determined by when spontaneously forming groups first fit inside available capacity. DCI doesn't change capacity (C) or population (N), so the **crossover threshold** remains at C/N ≈ 0.5.

However, DCI changes the **severity** of coordination failure below the crossover through three mechanisms:

### Mechanism 1: Phased Interaction = Temporal Dissipation (Effective γ↑)

DCI's five-phase model imposes temporal structure:
1. **Independent First Thought (φ₂):** Agents generate positions BEFORE seeing others → breaks synchronization, injects effective dissipation
2. **Phase transitions as cooling:** Each phase transition acts as a damping step — the workspace is restructured, old proposals may be dropped
3. **Bounded rounds (R_max):** Hard process termination = guaranteed dissipation of accumulated discussion

In DAC terms: phasing increases effective γ by periodically resetting accumulated coordination stress. The stability condition becomes 4ηβ² < (γ + γ_phasing), which is more easily satisfied.

**Johnson's agents have no phasing** — they respond in real-time to demand signals with no cooldown, no independent-thought phase, no structured transitions. This is why sophistication amplifies herding.

### Mechanism 2: Typed Epistemic Acts = Constrained Coupling (Effective β↓)

Without DCI: all agents broadcast all signals to all others → β is maximal
With DCI: interactions are typed and phased:
- Only Challengers primarily challenge
- Only Explorers primarily generate
- The grammar constrains which acts are appropriate at which phase

This REDUCES the effective β by preventing the "everyone responding to everything" pattern that drives tribal herding in Johnson's model. Instead of N² unconstrained couplings, DCI creates O(N) role-structured interactions.

In Johnson's terms: DCI prevents the formation of monolithic tribes by structurally differentiating agent roles. Agents can't all pile into the same strategy because their archetypes constrain their moves.

### Mechanism 3: Tension Preservation = Anti-Herding

Johnson's worst outcome: **maximum collective failure coexists with maximum individual tribal reward** (84.2% individual win rate at 91.5% system overload). This happens because tribal dynamics suppress within-tribe disagreement.

DCI's explicit tension tracking does the OPPOSITE:
- Disagreements are preserved as structured objects, not resolved
- Minority reports are required output (98% of DCI sessions produce them)
- The decision packet includes residual objections

This is formally anti-herding: DCI prevents the consensus-formation that drives Johnson's correlated tribal dynamics. You can't herd when the protocol requires you to record why you disagree.

---

## 4. Quantitative Predictions

### Using DAC Stability Math

Original: 4ηβ² < γ must hold for stability

**With DCI modifications:**
- β_DCI ≈ β_unstructured / √K, where K = number of archetype roles (K=4 for DCI)
  - Rationale: Role differentiation partitions coupling into K orthogonal channels
- γ_DCI ≈ γ_base + (1/R_max) × ln(2)
  - Rationale: Each phase boundary acts as a half-life for accumulated coordination stress
- η_DCI ≈ η_base (unchanged — agent intelligence is not reduced)

Modified condition: 4η · (β²/K) < γ + γ_phasing

**This means DCI can tolerate agents that are K = 4 times more responsive** before hitting the instability boundary, relative to unstructured interaction.

### Predicted Effect on Johnson's Experiment

| Regime | Without DCI (Johnson L5) | With DCI (predicted) |
|--------|------------------------|---------------------|
| C/N = 0.29 (extreme scarcity) | High overload (~60%+) | **Reduced overload** — phasing breaks herding, typed acts prevent tribal lock-in |
| C/N = 0.40 (moderate scarcity) | Moderate overload | **Near-zero overload** — DCI's anti-herding mechanisms are strongest here |
| C/N = 0.50 (crossover) | Crossover point | **Crossover may shift slightly left** (maybe to 0.45) due to reduced effective β |
| C/N = 0.67 (abundance) | Near-zero overload | **Slightly worse than unstructured L4** — DCI's 62× token cost adds overhead without benefit |
| C/N = 0.71+ | Near-zero | Near-zero (no difference) |

### Critical Caveat: Token Cost Creates a NEW Scarcity

DCI's 62× token overhead means that in a resource-constrained edge deployment (Johnson's motivating scenario), the protocol itself consumes scarce compute/bandwidth. If C includes communication capacity, DCI's sophistication creates a **second-order paradox**: the coordination protocol designed to prevent overload becomes ITSELF a source of resource consumption.

This is formally: the DCI protocol shifts some resources from C_task (task capacity) to C_protocol (protocol overhead), reducing effective C/N for the actual task. If the reduction in overload from phased deliberation outweighs the capacity lost to protocol overhead, DCI is net positive. Otherwise, you've traded one form of resource contention for another.

---

## 5. The Three Conditions Under Which DCI Rescues Intelligence

Based on the synthesis, DCI's typed deliberation changes the sophistication-outcome relationship when:

### Condition 1: Agents Have Sufficient Slack for Protocol Overhead
The 62× token cost is only justified when agents have enough computational budget that protocol overhead doesn't create its own scarcity. In Johnson's edge-AI scenario (phones, drones, EVs with limited compute), this condition may NOT be met. In our system (cloud-hosted agents with generous token budgets), it IS met.

### Condition 2: The Coordination Problem Has Hidden-Profile Structure
DCI's strongest results (+0.95 on non-routine tasks, 9.56 on hidden-profile tasks) occur when different agents have DIFFERENT partial information that must be integrated. Johnson's agents all observe the same demand signal — there's no information asymmetry. If the coordination problem were restructured so agents had partial resource information, DCI would help much more.

### Condition 3: Temporal Structure Is Possible
DCI requires sequential phases. Real-time competitive resource access (Johnson's scenario) may not allow time for φ₁-φ₅ deliberation. If agents must decide NOW whether to access a charging station, DCI is inapplicable. If agents can deliberate BEFORE the access window (planning phase), DCI is applicable.

---

## 6. Synthesis: A Unified View

### The Intelligence-Coordination Hierarchy

```
Level 0: No coordination       → Independent agents, random outcomes
Level 1: Implicit coordination → Agents respond to shared signals (Johnson L2-L5)
                                  VULNERABLE to Intelligence Paradox
Level 2: Typed coordination    → Agents follow interaction protocol (DCI)
                                  PARTIALLY PROTECTED (if conditions 1-3 met)
Level 3: Adaptive governance   → Protocol itself adapts (SSGM + DCI + DAC)
                                  THEORETICALLY ROBUST (not yet implemented)
```

### The Missing Piece: Adaptive Protocol Selection

The deepest insight from this cross-reference: **the optimal coordination protocol depends on C/N**, which Johnson shows is knowable before deployment. This means:

1. **C/N < 0.4:** Don't use DCI. Use simple, identical agents (Johnson L1). The overhead of sophisticated coordination cannot be justified.
2. **C/N = 0.4–0.6:** Use LIGHTWEIGHT DCI — maybe 2 archetypes (Explorer + Challenger), 3 phases, reduced grammar. Enough structure to break herding, not enough to create protocol overhead scarcity.
3. **C/N > 0.6:** Use full DCI. The slack available makes deliberation overhead negligible, and the structured approach outperforms unstructured sophistication.

### This IS the SSGM Governance Layer

The SSGM framework (2603.11768) provides exactly the adaptive governance layer needed: a middleware that monitors coordination state and adjusts protocol parameters. The complete architecture would be:

```
SSGM Governance Layer
  ├── Monitors C/N ratio and system stability (spectral radius proxy)
  ├── Selects coordination protocol:
  │     Low C/N  → Simple broadcast (Johnson L1)
  │     Mid C/N  → Lightweight DCI (2 roles, 3 phases)
  │     High C/N → Full DCI (4 roles, 5 phases, 14 acts)
  ├── Applies Weibull decay to stale coordination state (γ control)
  └── Adjusts coupling strength β based on stability metrics
```

---

## 7. Implications for Our System

### Our C/N Assessment
- **C** (coordination capacity): Token budgets, shared file bandwidth, May's attention span per heartbeat
- **N** (agent population): 5 agents (May, Scout, Coder, QA, Bob)
- **Estimated C/N:** Approximately 0.6–0.8 (generous token budgets, but May's attention is scarce)
- **Regime:** Abundance for compute, moderate scarcity for May's attention

### Recommendations
1. **We're in the DCI-beneficial regime** for compute-bound coordination (C/N > 0.6). The 62× overhead is absorbable.
2. **We're near the crossover** for May's attention (C/N ≈ 0.5). Adding more agents or more sophisticated protocols could push us past the crossover into the paradox regime FOR ATTENTION.
3. **Immediate action:** Typed SIGNALS entries (the DCI minimal grammar: propose/challenge/synthesize/update) would give us phased structure without full DCI overhead.
4. **Monitor:** Track whether May's per-agent attention time is decreasing as system complexity grows. If so, we're drifting into scarcity regime.

### Design Principle
**Axiom 20 (Adaptive Protocol Complexity):** The sophistication of coordination protocols should scale with the capacity-to-population ratio C/N. Under scarcity, simpler protocols outperform. Under abundance, structured deliberation outperforms. The optimal protocol is never the most sophisticated one — it's the one matched to the current resource regime.

---

## 8. Open Questions

1. **Empirical test:** Can Johnson's 5-level experiment be re-run with DCI-structured interaction at each level? This would directly measure whether typed acts shift the crossover.
2. **Token-efficient deliberation:** Can DCI's overhead be reduced from 62× to <10× while preserving the anti-herding benefits? (Minimal viable deliberation)
3. **Heterogeneous C/N:** In real deployments, C/N varies over time (e.g., charging stations: high C/N at 3am, low at 8am). Does the protocol need to switch in real-time?
4. **DCI under adversarial conditions:** MaMa (2602.04431) studies adversarial multi-agent safety. What happens to DCI's anti-herding properties when one archetype is compromised?
5. **Scaling:** DCI tested with 4 agents. Johnson tested 7–15. Does DCI scale to Johnson's population sizes?

---

## 9. Bottom Line

**Do typed epistemic acts change the sophistication crossover?** 

**Partially yes.** DCI doesn't change the EXISTENCE of the crossover (that's structural, determined by C/N), but it changes the SEVERITY of coordination failure below it through three mechanisms: temporal dissipation (phasing), constrained coupling (typed roles), and anti-herding (tension preservation). The effective stability boundary shifts from 4ηβ² < γ to 4η(β²/K) < (γ + γ_phasing), meaning DCI can tolerate K-fold more sophisticated agents before instability — but ONLY when agents have enough slack for protocol overhead, the problem has hidden-profile structure, and temporal deliberation is feasible.

The synthesis produces a clear design principle: **match protocol sophistication to resource regime.** Simple protocols under scarcity, structured deliberation under abundance, with SSGM-style adaptive governance to select the right protocol as conditions change. For our system specifically, we're in the DCI-beneficial regime for compute but near the crossover for attention, suggesting lightweight typed signals now with full deliberation only for consequential decisions.

---

*Filed: 2026-03-13 | Scout workspace | ~2,800 words | Cross-references: 2603.12129, 2603.11781, 2603.11560, 2603.11768, 2602.04431*
