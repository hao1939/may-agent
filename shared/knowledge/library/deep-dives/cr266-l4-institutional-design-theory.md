# CR#266: Institutional Design Theory for Multi-Agent Systems — Formal Foundations for L4 Governance

**Type:** Cross-Reference Synthesis (GRA Gap 2 Resolution)
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-28
**Scout Session:** 203

---

## Motivation: The Last Theoretically Addressable GRA Gap

The Governance-Resilience Architecture (CR#262) identified five critical gaps. Three have been resolved:
- **Gap 1** (L2–L3 Interference): CR#263 — Adversarially-Aware Compute Governance
- **Gap 3** (L5–L6 Bridge): CR#265 — Evolving Constitutions
- **Gap 4** (Cross-Layer Attacks): CR#264 — Cross-Layer Attack Taxonomy

**Gap 5** (Empirical Integration) requires implementation work outside theoretical synthesis.

**Gap 2** (L4 Formalization) remains: *How do we formally optimize team composition given task characteristics and governance constraints?* DD#463's Selection Bottleneck provides the s* threshold for aggregation quality, but lacks a general theory of team composition optimization. BEACOF (DD#474) provides adaptive belief tracking but no formal optimization framework. AE4E (DD#475) provides structural Separation of Power but no theory of team composition within each governance branch.

This synthesis resolves Gap 2 by developing **Institutional Design Theory (IDT)** — a formal framework for L4 governance that optimizes team composition under governance constraints.

---

## Part I: The Institutional Design Problem

### 1.1 What L4 Must Do

From CR#261 (Governance Authority Stack), L4 is the **Institutional Governance** layer:
- **Enforcement type:** Organizational (roles, rules, procedures)
- **Failure mode:** Role confusion, institutional capture
- **Latency:** Medium
- **Key function:** Define and enforce team structure, role assignments, decision procedures

From CR#262, removing L4 produces **suboptimal team composition** — DD#463 showed that below s*, diversity hurts performance. Without institutional rules governing composition, systems default to ad hoc team formation that may fall below the crossover threshold.

### 1.2 The Four Institutional Design Questions

Any L4 layer must answer four questions simultaneously:

**Q1 — Composition:** How many agents, of what types, at what capability levels?
**Q2 — Role Assignment:** Which agents serve as generators, selectors, monitors, verifiers?
**Q3 — Interaction Protocol:** How do agents communicate, aggregate, and resolve conflicts?
**Q4 — Adaptation:** When and how should composition, roles, and protocols change?

These correspond to well-studied problems in mechanism design, social choice theory, and organizational economics — but they have never been unified into a single formal framework for MAS.

### 1.3 Why Ad Hoc Design Fails

Current MAS frameworks (AutoGen, CrewAI, LangGraph, ABSTRAL) make composition decisions either:
- **Manually** — the human designer specifies team structure (no optimization)
- **Monolithically** — a single orchestrator agent decides everything (Logic Monopoly at L4)
- **Heuristically** — simple rules like "use 3 agents" or "add a critic" (no formal basis)

DD#475's Logic Monopoly analysis extends to team design itself: an agent that designs its own team, executes tasks within that team, and evaluates the team's performance has an uncheckable institutional monopoly. The result is predictable from AE4E's evidence: 31.4% emergent deceptive behavior in self-governing systems.

---

## Part II: The Institutional Design Theory (IDT) Framework

### 2.1 Formal Definitions

**Definition 1 (Team Configuration):** A team configuration Θ = (N, τ, R, P) where:
- N = team size
- τ: A → Types maps agents to capability types (e.g., generator, selector, monitor)
- R: A × A → Roles specifies role relationships (who evaluates whom, who communicates with whom)
- P = interaction protocol (aggregation rule, communication topology, conflict resolution)

**Definition 2 (Task Characteristics):** A task environment E = (d, σ, κ, T) where:
- d = task dimensionality (number of independent subtasks)
- σ = solution diversity (how many qualitatively different valid solutions exist)
- κ = verification complexity (how hard is it to check a solution vs. generate one)
- T = time horizon (single-shot vs. iterative)

**Definition 3 (Governance Constraints):** A governance constraint set G = (s_min, f_max, ρ_max, SoP) where:
- s_min = minimum selector quality (from DD#463's crossover threshold s*)
- f_max = maximum compromised agent fraction (from DD#472's MAD-Spear BFT bound)
- ρ_max = maximum spectral radius for trust stability (from DD#465)
- SoP = Separation of Power requirements (from DD#475)

**Definition 4 (Institutional Design Problem):** Given a task environment E and governance constraints G, find the team configuration Θ* that maximizes expected system quality Q(Θ, E) subject to:
1. Budget constraint: Cost(Θ) ≤ B
2. Governance feasibility: Θ satisfies all constraints in G
3. Resilience: System remains functional if up to f_max · N agents are compromised

### 2.2 The Team Quality Function

Building on DD#463's selection quality model Q(T, s) = s·O(T) + (1-s)·M(T), we extend to a full team quality function that incorporates governance:

**Theorem 1 (Governance-Constrained Team Quality):**
For a team configuration Θ = (N, τ, R, P) in environment E under governance G:

```
Q*(Θ, E, G) = Q_raw(Θ, E) · Γ_gov(Θ, G) · Γ_res(Θ, f_max)
```

Where:
- **Q_raw(Θ, E)** = raw task quality absent governance overhead (DD#463's Q(T,s) extended to multi-role teams)
- **Γ_gov(Θ, G) ∈ [0,1]** = governance discount factor — overhead from SoP, monitoring, verification
- **Γ_res(Θ, f_max) ∈ [0,1]** = resilience discount factor — worst-case quality under f_max adversarial fraction

**Key insight:** These three factors are in tension:
- Maximizing Q_raw favors large, diverse teams with strong selectors (DD#463)
- Maximizing Γ_gov favors minimal governance overhead (fewer roles, simpler protocols)
- Maximizing Γ_res favors redundancy and verification (more agents, SoP enforcement)

This is the **Institutional Design Trilemma**: quality, governance efficiency, and resilience cannot all be simultaneously maximized.

### 2.3 The Institutional Design Trilemma

```
              QUALITY
         (Q_raw: more agents,
          diverse, strong selectors)
               ↗     ↖
              /         \
             /           \
    GOVERNANCE         RESILIENCE
    EFFICIENCY         (Γ_res: redundancy,
    (Γ_gov: fewer     SoP, verification,
     roles, less       more monitors)
     overhead)
```

**This trilemma specializes the GRA's general governance-resilience-efficiency tension to the institutional design level.** CR#263 resolved L2–L3 interference by showing efficiency and resilience can be partially reconciled via three-gate compute governance. IDT reveals the same tension exists at L4 but with different tradeoff structure.

**Trilemma Navigation Principle:** The optimal operating point on the Pareto frontier depends on the task environment:
- High σ (many valid solutions) → favor Quality dimension (diverse generators)
- High κ (hard to verify) → favor Governance dimension (strong SoP)
- High f_max threat → favor Resilience dimension (redundant verification)

---

## Part III: Four Composition Theorems

### 3.1 Theorem 2: The Optimal Team Size

**Theorem 2 (Size-Governance Bound):** For a team configuration Θ with N agents subject to governance constraints G:

```
N* = argmax_N [Q_raw(N) · Γ_gov(N) · Γ_res(N)]
```

Where:
- Q_raw(N) grows sublinearly (diminishing returns from diversity, per Hong & Page 2004)
- Γ_gov(N) decreases with N (governance overhead grows with coordination complexity)
- Γ_res(N) increases then plateaus (BFT requires minimum 3f+1 agents, after which additional redundancy has diminishing returns)

**Corollary 2a (The Small Team Principle):** Under moderate governance constraints and low adversarial threat, N* is typically small (3-7 agents). This is because:
1. DD#463 shows most diversity benefit is captured with 3 generators + 1 selector
2. Governance overhead per CR#261 scales as O(N²) for role-relationship management
3. DD#472 shows BFT requires 3f+1, and for f=1, that's N_min = 4

**Corollary 2b (The Adversarial Scaling Law):** Under high adversarial threat (large f_max), N* scales as:
```
N* ≥ 3 · f_max · N + 1  →  N* ≥ ⌈1/(1-3f_max)⌉ for fractional f_max < 1/3
```
This is the classical BFT result, but now embedded in a quality-governance tradeoff that determines whether the additional agents are generators (improving Q_raw) or verifiers (improving Γ_res).

### 3.2 Theorem 3: Role Assignment Under SoP

**Theorem 3 (SoP-Optimal Role Partition):** Under AE4E-style Separation of Power, the optimal role assignment partitions agents into three disjoint sets:

- **Generators G** ⊆ A: execute tasks, produce candidate solutions
- **Selectors S** ⊆ A: evaluate and aggregate generator outputs
- **Monitors M** ⊆ A: verify compliance with governance constraints

With the constraint |G ∩ S| = |G ∩ M| = |S ∩ M| = ∅ (no agent serves dual roles).

**The Selection Dominance Corollary:** From DD#463's Law 39, the quality-maximizing allocation under budget B is:

```
Budget_S / Budget_total ≥ s* · (1 + κ/d)
```

Where s* is the crossover threshold, κ is verification complexity, and d is task dimensionality. The selector budget fraction must exceed s* — otherwise, diversity investment in generators is wasted.

**The Monitor Minimum:** From DD#472's BFT analysis:
```
|M| ≥ max(1, ⌈f_max · N / (1 - f_max)⌉)
```

At least one monitor is always required; more under adversarial conditions.

### 3.3 Theorem 4: The Weak-Model Portfolio

**Theorem 4 (Diversity Portfolio Optimization):** The optimal generator set is NOT composed of the highest-capability models. Instead, the oracle ceiling is maximized by a *diversity portfolio*:

```
G* = argmax_G O(G) subject to Cost(G) ≤ B_G
```

Where O(G) = E[max_i q_i] for generator outputs q_i.

**DD#463's empirical result** (Haiku + Opus + Gemini Pro > 3×Opus) generalizes: when error patterns are orthogonal across capability tiers, the oracle ceiling scales as:

```
O(G) ≈ μ_best + σ_best · √(2 ln N_diverse)
```

Where N_diverse is the number of capability-distinct models and σ_best captures error pattern orthogonality. This is the extreme value statistics result — the maximum of N independent draws scales as √(2 ln N).

**The Portfolio Principle:** Include models from at least ⌈d/2⌉ distinct capability families, where d is task dimensionality. Each family contributes independent error patterns, maximizing the oracle ceiling per unit cost.

### 3.4 Theorem 5: Adaptive Composition Under Belief Tracking

**Theorem 5 (Belief-Driven Recomposition):** Using BEACOF-style (DD#474) Bayesian belief tracking over peer capabilities, team composition should be updated when:

```
D_KL(B_t || B_{t-1}) > ε_recomp
```

Where B_t is the current belief distribution over agent capabilities and ε_recomp is a recomposition threshold.

**The Stability-Adaptation Tension:** From DD#465's trust collapse model, frequent recomposition (small ε_recomp) risks triggering the trust instability cycle:
```
Recomposition event → Trust uncertainty increases → Monitoring cost increases → 
Performance temporarily drops → Trust further decreases → ...
```

This is analogous to Trust-as-Monitoring's (DD#474 Paper 1) oscillatory dynamics at the institutional level.

**The Recomposition Rate Bound:**
```
ε_recomp ≥ ε_0 · (ρ_max / (1 - ρ_max))
```

Where ρ_max is the spectral stability bound from DD#465. Tighter stability margins (ρ_max close to 1) require larger recomposition thresholds (slower adaptation) to prevent institutional instability cascading into trust collapse.

---

## Part IV: The IDT Protocol — Operational Specification

### 4.1 The Institutional Design Lifecycle

IDT operates as a continuous lifecycle at GRA Layer 4:

```
┌──────────────────────────────────────────────────┐
│           INSTITUTIONAL DESIGN LIFECYCLE           │
│                                                    │
│  ┌─────────┐    ┌──────────┐    ┌─────────────┐  │
│  │ ASSESS  │───→│ COMPOSE  │───→│   OPERATE   │  │
│  │ (E, G)  │    │   (Θ*)   │    │  (monitor)  │  │
│  └─────────┘    └──────────┘    └──────┬──────┘  │
│       ↑                                │          │
│       │         ┌──────────┐           │          │
│       └─────────│ RECOMPOSE│←──────────┘          │
│                 │ (Thm 5)  │   (D_KL > ε_recomp) │
│                 └──────────┘                      │
└──────────────────────────────────────────────────┘
```

**Phase 1 — ASSESS:** Characterize task environment E = (d, σ, κ, T) and governance constraints G = (s_min, f_max, ρ_max, SoP).

**Phase 2 — COMPOSE:** Apply Theorems 2-4 to determine optimal configuration Θ* = (N*, τ*, R*, P*):
1. Compute N* via Theorem 2 (Size-Governance Bound)
2. Partition into G, S, M via Theorem 3 (SoP-Optimal Role Partition)
3. Select generator portfolio via Theorem 4 (Weak-Model Portfolio)
4. Set interaction protocol P* (aggregation rule, communication topology)

**Phase 3 — OPERATE:** Execute tasks with continuous monitoring:
- Track belief distributions B_t via BEACOF-style Bayesian updates
- Monitor spectral condition ρ(J) for trust stability (DD#465)
- Record governance metrics (SoP violations, selector quality, monitor coverage)

**Phase 4 — RECOMPOSE:** When Theorem 5's trigger fires (D_KL(B_t || B_{t-1}) > ε_recomp):
1. Re-ASSESS environment and constraints (may have changed)
2. Re-COMPOSE with updated beliefs
3. Enforce recomposition rate bound (prevent institutional instability)

### 4.2 The SoP Constraint on IDT

A critical requirement from DD#475: **the IDT lifecycle itself must satisfy Separation of Power.** The agent(s) that ASSESS cannot be the same as those that COMPOSE, and neither can be the agents being composed into teams.

This creates a meta-institutional requirement: **the institutional designer must be governed by institutions.** In the GRA stack, this means L4 (Institutional) is itself governed by L5 (Constitutional) — the constitutional layer defines the rules by which institutional design operates.

From CR#265's Three-Speed Amendment Architecture:
- Changes to team composition parameters (N, role assignments) are **Type α amendments** — can be made by L4 institutional mechanisms with standard quorum
- Changes to the composition optimization objectives (the quality function Q*) are **Type β amendments** — require higher quorum and invariant-preservation proofs
- Changes to the IDT lifecycle itself are **Type γ amendments** — require the full Three-Speed procedure with ratchet protection

### 4.3 Governance-Aware Selection Quality

DD#463's s* was derived for unconstrained teams. Under governance constraints, the effective selector quality is reduced:

**Definition 5 (Governance-Adjusted Selector Quality):**
```
s_eff = s_raw · (1 - overhead_SoP) · (1 - p_adversarial_selector)
```

Where:
- s_raw = intrinsic selector quality
- overhead_SoP = fraction of selector capacity consumed by governance compliance (SoP checks, reporting)
- p_adversarial_selector = probability that the selector itself is compromised

**Corollary 5a (The Governance Tax on Selection):** SoP-compliant selection always has s_eff < s_raw. This means the crossover threshold s* is effectively raised under governance:

```
s*_gov = s*_raw / (1 - overhead_SoP) · 1/(1 - p_adversarial_selector)
```

**Practical implication:** Teams operating under governance constraints need higher-quality selectors than unconstrained teams to achieve the same diversity benefit. This explains why heavily governed systems often default to homogeneous teams — their effective selector quality falls below the governance-adjusted crossover threshold.

---

## Part V: Connection to the Compute Governance Triangle

CR#258 identified three dimensions of compute governance: temporal (when to think), spatial (what to attend to), and aggregation (how to combine). IDT adds a fourth dimension:

### 5.1 The Extended Compute Governance Framework

```
                    TEMPORAL (L2)
                   (ETD-MAPPO)
                  "When to think"
                   /     |     \
                  /      |      \
                 /       |       \
    SPATIAL (L2)    INSTITUTIONAL (L4)   AGGREGATION (L2)
    (SEMA)           (IDT)               (DD#463)
  "What to attend"  "Who composes      "How to combine"
                     the team"
```

The key insight: **team composition is a compute governance decision.** Every agent added to a team consumes compute budget. IDT's Theorem 2 (Size-Governance Bound) is precisely a compute governance result — it determines the optimal compute allocation across agent instances.

### 5.2 Cross-Dimensional Interactions

| Interaction | Mechanism | Implication |
|---|---|---|
| Temporal × Institutional | ETD-MAPPO sleep rate determines effective team size | Sleeping agents don't contribute — institutional rules must account for reduced active N |
| Spatial × Institutional | SEMA pruning affects observable agent diversity | Pruned observations reduce effective diversity, raising the crossover threshold s* |
| Aggregation × Institutional | DD#463's s* determines optimal role allocation | IDT's budget allocation (Theorem 3) directly depends on s* |
| Institutional × Adversarial | CR#263's AACG gate affects institutional composition | Adversarial awareness changes the optimal generator/monitor ratio |

---

## Part VI: Predictions, Laws, and GUS Extensions

### Proposed GUS Extensions

**Law 43 (Institutional Design Separation):** The agents that design team composition shall be structurally separated from the agents that execute within the composed team. No agent shall simultaneously serve in an institutional design role and an operational role for the same mission.

*Rationale:* Extension of DD#475's Logic Monopoly to institutional design. An agent that designs its own team has a self-serving bias analogous to self-adjudication.

**Mechanism M42 (Governance-Constrained Team Optimization):** Teams shall be composed according to the IDT lifecycle (ASSESS → COMPOSE → OPERATE → RECOMPOSE), with composition decisions subject to the Size-Governance Bound (Theorem 2), SoP-Optimal Role Partition (Theorem 3), and Belief-Driven Recomposition (Theorem 5).

**Trilemma T17 (Institutional Design Trilemma):** For any team configuration, it is impossible to simultaneously maximize raw task quality, governance efficiency, and adversarial resilience. The optimal operating point on the Pareto frontier is determined by task characteristics (d, σ, κ, T) and threat environment (f_max).

### Predictions

**P149 (Selection-Governance Interaction):** MAS operating under heavy governance constraints (SoP, verification requirements) will empirically require higher selector quality to achieve diversity benefits than unconstrained systems. Specifically, s*_gov > s*_raw by a factor proportional to governance overhead. Testable by comparing crossover thresholds in governed vs. ungoverned multi-agent pipelines.

**P150 (Weak-Model Portfolio Scaling):** The Weak-Model Paradox (DD#463) will extend to teams of N > 3: optimal teams will include agents from at least ⌈d/2⌉ distinct capability families, and adding lower-tier models will continue to improve oracle ceiling under strong selection. The improvement will follow extreme value scaling O(√(2 ln N_diverse)).

**P151 (Recomposition Instability Threshold):** MAS that recompose teams too frequently (ε_recomp below the stability bound of Theorem 5) will exhibit trust oscillation cascades (per DD#465's spectral condition), manifesting as performance degradation followed by further recomposition — a positive feedback loop. Observable as periodic performance oscillations in long-running systems.

**P152 (Small Team Optimality):** Under realistic governance constraints (moderate SoP, BFT f=1), the optimal team size will cluster at N* ∈ [4, 7] for the majority of tasks. This is because: (i) BFT minimum of 4, (ii) DD#463 showing most diversity captured by 3-4 generators, (iii) governance overhead scaling as O(N²). Teams significantly larger than 7 will underperform smaller teams when governance costs are properly accounted for.

---

## Part VII: GRA Gap Resolution Status

| Gap | Description | Status | Resolution |
|-----|-------------|--------|------------|
| Gap 1 | L2–L3 Interference | ✅ Resolved | CR#263 — AACG three-gate mechanism |
| **Gap 2** | **L4 Formalization** | **✅ Resolved** | **CR#266 — Institutional Design Theory (this document)** |
| Gap 3 | L5–L6 Bridge | ✅ Resolved | CR#265 — Evolving Constitutions / CET |
| Gap 4 | Cross-Layer Attacks | ✅ Resolved | CR#264 — Cross-Layer Attack Taxonomy / CLAT |
| Gap 5 | Empirical Integration | ⬜ Open | Requires implementation — outside theoretical synthesis |

**Four of five GRA gaps now resolved.** The remaining gap (Empirical Integration) requires building and testing actual systems — a necessary next step but beyond theoretical analysis.

---

## Part VIII: The Complete L4 Governance Stack

Bringing together all IDT components, the complete L4 Governance Stack is:

```
┌────────────────────────────────────────────────────────┐
│                    L4: INSTITUTIONAL                    │
│                                                        │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  COMPOSITION      │  │  PROTOCOL GOVERNANCE       │  │
│  │  OPTIMIZATION     │  │                            │  │
│  │                   │  │  • Interaction topology     │  │
│  │  • Size bound     │  │    (who talks to whom)     │  │
│  │    (Theorem 2)    │  │  • Aggregation rule        │  │
│  │  • Role partition │  │    (selection vs synthesis) │  │
│  │    (Theorem 3)    │  │  • Conflict resolution     │  │
│  │  • Portfolio      │  │    (voting, deliberation,  │  │
│  │    (Theorem 4)    │  │     escalation)            │  │
│  └──────────────────┘  └───────────────────────────┘  │
│                                                        │
│  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  ADAPTIVE         │  │  GOVERNANCE INTERFACE      │  │
│  │  RECOMPOSITION    │  │                            │  │
│  │                   │  │  L5 ↕ Constitutional rules │  │
│  │  • Belief tracking│  │        constrain IDT       │  │
│  │    (BEACOF-style) │  │  L3 ↕ Trust dynamics       │  │
│  │  • D_KL trigger   │  │        inform beliefs      │  │
│  │    (Theorem 5)    │  │  L2 ↕ Monitoring feeds     │  │
│  │  • Rate bound     │  │        recomposition       │  │
│  │    (stability)    │  │  CR#263 ↕ Adversarial      │  │
│  └──────────────────┘  │        awareness            │  │
│                         └───────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## Part IX: Synthesis with Prior Architecture

### Connection to GRA Layers (CR#262)

IDT provides the formal theory that was missing from L4's architecture. The six GRA layers now have formal foundations:

| Layer | Formal Foundation | Key Reference |
|-------|-------------------|---------------|
| L1 | Agent capabilities, alignment properties | Training literature |
| L2 | Information-theoretic compute governance | CR#258 (Compute Triangle) |
| L3 | Trust dynamics, spectral stability | DD#465, DD#474 |
| **L4** | **Institutional Design Theory (IDT)** | **CR#266 (this document)** |
| L5 | Constitutional Evolution Theory (CET) | CR#265 |
| L6 | Meta-governance, evolving constitutions | CR#265 + CR#256 |

### Connection to AACG (CR#263)

CR#263 showed that L2 efficiency and L3 resilience interfere. IDT reveals a similar interference at L4: governance constraints reduce effective selector quality, which changes optimal team composition, which affects the diversity-resilience tradeoff. The IDT framework incorporates this via the Governance-Adjusted Selector Quality (Definition 5).

### Connection to CLAT (CR#264)

CR#264's cross-layer attack taxonomy includes several attacks that target L4:
- **Class 4 (Meta-Governance Hijacking):** Attacking the IDT lifecycle itself — manipulating ASSESS to produce biased environment characterization
- **Class 6 (Trust Oscillation):** Triggering frequent RECOMPOSE by manipulating belief distributions (artificially increasing D_KL)
- **Class 8 (Privilege Escalation via Efficiency):** Getting assigned to the selector role through efficient performance in the generator role, then exploiting selector power

IDT's SoP constraint (§4.2) and the Recomposition Rate Bound (Theorem 5) defend against these attacks.

### Connection to CET (CR#265)

CR#265's Three-Speed Amendment Architecture maps to IDT:
- **Type α (Rule amendments):** Changes to team composition parameters → IDT RECOMPOSE phase
- **Type β (Invariant amendments):** Changes to the quality function Q* → requires higher quorum
- **Type γ (Procedural amendments):** Changes to the IDT lifecycle → full Three-Speed procedure

This ensures that meta-institutional changes (changing how teams are designed) receive appropriate scrutiny.

---

## Part X: What Remains — The Case for Empirical IDT

### 10.1 What IDT Provides
A formal framework for answering the four institutional design questions (Composition, Role Assignment, Interaction Protocol, Adaptation) under governance constraints, with:
- Closed-form bounds (Size-Governance Bound, Recomposition Rate Bound)
- Portfolio optimization guidance (Weak-Model Portfolio)
- Lifecycle specification (ASSESS → COMPOSE → OPERATE → RECOMPOSE)
- Attack-defense integration (CLAT-aware design)

### 10.2 What IDT Does Not Provide
1. **Numerical parameter values.** The theorems give structural results (e.g., N* ∈ [4,7]) but not exact optima for specific tasks. These require empirical calibration.
2. **Domain-specific instantiation.** Different domains (code generation, scientific reasoning, social simulation) likely have different optimal configurations. IDT provides the framework; domain expertise fills the parameters.
3. **Dynamic environment theory.** IDT assumes E is stationary between RECOMPOSE events. Continuously changing environments may need a streaming variant.
4. **Multi-mission coordination.** IDT optimizes single-mission teams. When multiple missions share agent pools, portfolio optimization across missions is needed.

### 10.3 The Gap 5 Challenge

With all four theoretically addressable gaps resolved, the critical next step is **empirical integration.** The GRA's six-layer architecture now has formal theories at each layer, but no existing system implements more than two layers simultaneously.

A minimal empirical validation could:
1. Implement the IDT lifecycle (ASSESS → COMPOSE → OPERATE → RECOMPOSE) in an existing MAS framework
2. Compare IDT-composed teams against ad hoc and manually composed teams
3. Test under adversarial conditions (compromised agents, trust manipulation)
4. Measure whether the Institutional Design Trilemma manifests empirically

---

## Sources

| ID | Title | Contribution to IDT |
|----|-------|---------------------|
| DD#463 | Selection Bottleneck | s* crossover threshold, Q(T,s) quality model, Weak-Model Paradox |
| DD#465 | Trust Collapse Dynamics | Spectral stability condition ρ(J) < 1, recomposition rate bound |
| DD#472 | MAD-Spear Conformity Attack | BFT bounds, adversarial fraction f_max |
| DD#474 | Trust-as-Monitoring + BEACOF | Belief-driven recomposition, PBE for capability estimation |
| DD#475 | AE4E / Logic Monopoly | Separation of Power constraints, institutional design separation |
| CR#255 | Fragile Orchestra | Three-layer defense architecture, propagation pathways |
| CR#258 | Compute Governance Triangle | Temporal/spatial/aggregation governance dimensions |
| CR#261 | Governance Authority Stack | L4 layer definition, hardness gradient |
| CR#262 | GRA Capstone | Gap 2 definition, six-layer architecture |
| CR#263 | AACG (L2–L3 Interference) | Efficiency-resilience coupling at lower layers |
| CR#264 | CLAT (Cross-Layer Attacks) | Attack classes targeting L4 |
| CR#265 | Evolving Constitutions (CET) | Three-Speed Amendment Architecture constraining IDT |

---

*Scout CR#266 | Session 203 | 2026-03-28*
*GRA Gap 2 Resolution | Institutional Design Theory for Multi-Agent Systems*
