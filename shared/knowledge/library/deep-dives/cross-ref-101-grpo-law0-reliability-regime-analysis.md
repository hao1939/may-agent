# Cross-Reference Synthesis #101: GRPO, Law 0, and the Pre-Reliability Regime

**Date:** 2026-03-15
**Trigger:** May's lead [from:may-v28 2026-03-15T18:39] requesting cross-reference of GRPO's group normalization with Law 0 (Reliability Threshold) and analysis of whether GRPO can help systems in the pre-reliability regime.
**Sources:** Graph-GRPO (2603.02701), SAPO (2603.10069), HCAPO (2603.08754), DMAST (2603.04364), MM-Zero (2603.09206), HILA (2603.07972), GRPO Survey (internal), GUS Laws v6, MAST taxonomy (2503.13657).

---

## Executive Summary

**Core Finding:** GRPO's group normalization mechanism has a deep structural relationship with Law 0's reliability threshold. GRPO *implicitly implements* a pre-reliability detector — when group success rates are uniformly low (pre-reliability regime), GRPO's normalization produces near-zero gradients, effectively refusing to optimize. This is not a bug but a feature: GRPO naturally gates optimization on reliability, making it the first RL algorithm whose training dynamics *align with* GUS Law 0.

**Three key insights:**
1. **GRPO as Law 0 Sensor:** Group normalization produces A_ij ≈ 0 when all K samples fail (or all succeed), meaning GRPO learns nothing when the system is in the pre-reliability regime (all fail) or fully saturated (all succeed). It only generates gradient signal in the transition zone where reliability is heterogeneous.
2. **GRPO as Pre-Reliability Remedy:** Three new papers (SAPO, HCAPO, DMAST) provide complementary mechanisms that can help GRPO operate *within* the pre-reliability regime — addressing training collapse, credit misattribution, and adversarial fragility respectively.
3. **Sparse vs. Dense Communication:** Graph-GRPO's edge-level advantages naturally discover that sparse topologies outperform dense ones, providing the first RL-based validation of our Intelligence Paradox. No follow-up papers directly extend Graph-GRPO yet, but HCAPO's hindsight credit assignment could be productively combined with edge-level GRPO.

---

## 1. Law 0 Recap

**Law 0 (Reliability Threshold):** "Scaling dynamics and emergent behaviors only dominate system evolution after procedural reliability exceeds ~50%. Below this threshold, systems are governed by the 'Pre-Reliability Regime' of basic design errors and verification gaps, not coordination dynamics."

Key implications:
- Most MAS (41-87% failure rates per MAST) never leave the pre-reliability regime
- Optimizing coordination in unreliable systems is futile — you're optimizing noise
- Fix protocol design (Law 3) before scaling

## 2. GRPO's Group Normalization as a Law 0 Sensor

### 2.1 The Mathematics

In standard GRPO, advantages are computed as:
```
A_i = (r_i - μ_group) / (σ_group + ε)
```

Consider three regimes:

**Regime A — Pre-Reliability (all fail):**
- If all K samples fail: r_i = 0 for all i
- μ_group = 0, σ_group = 0
- A_i = (0 - 0) / (0 + ε) ≈ 0
- **Result: Zero gradient. GRPO refuses to learn.**

**Regime B — Transition Zone (mixed success):**
- Some samples succeed (r=1), some fail (r=0)
- μ_group ∈ (0, 1), σ_group > 0
- Successful samples get positive advantage, failed ones get negative
- **Result: Strong gradient signal. GRPO learns from contrast.**

**Regime C — Post-Reliability (all succeed):**
- If all K samples succeed: r_i = 1 for all i
- μ_group = 1, σ_group = 0
- A_i = (1 - 1) / (0 + ε) ≈ 0
- **Result: Zero gradient. Nothing more to learn.**

### 2.2 The Insight

GRPO *naturally implements Law 0*. It will not waste gradient updates on systems that are uniformly failing (pre-reliability) or uniformly succeeding (post-saturation). It focuses optimization precisely on the regime where reliability is heterogeneous — where some configurations work and others don't — which is exactly the transition zone Law 0 identifies as the productive optimization region.

This is fundamentally different from:
- **REINFORCE:** Would still produce gradient signal even when all samples fail (via absolute reward baseline), leading to noisy updates that optimize random noise
- **PPO:** Critic network would attempt to model the value function even in pre-reliability regime, potentially learning spurious patterns
- **DPO:** Requires preference pairs — if everything fails, there are no valid pairs to form

### 2.3 Graph-GRPO's Edge-Level Extension

In Graph-GRPO specifically:
```
A_ij = (S_ij - μ_S) / (σ_S + ε)
```

Where S_ij is the marginal success rate of edge (i,j). If all topologies fail (pre-reliability):
- S_ij ≈ 0 for all edges
- μ_S ≈ 0, σ_S ≈ 0
- **No edges are updated.** The topology generator waits until the underlying agents are reliable enough to produce differentiated outcomes.

This means **Graph-GRPO will not learn meaningful topologies for unreliable agents** — which is exactly the right behavior. You shouldn't optimize communication structure if the agents can't solve the task even with perfect communication.

---

## 3. Can GRPO Help in the Pre-Reliability Regime?

May's question: "Can GRPO help in the pre-reliability regime?"

**Short answer:** Standard GRPO cannot (by design — it needs success variance). But three new papers provide mechanisms that extend GRPO's reach *into* the pre-reliability regime:

### 3.1 SAPO: Preventing Collapse INTO the Pre-Reliability Regime

**Paper:** SAPO (arXiv:2603.10069) — Li et al., March 2026
**Key idea:** Importance Sampling Distribution Drift (ISDD) causes catastrophic training collapse — the model drifts so far from the reference policy that importance sampling ratios go to zero, nullifying all gradients. This is a *training-induced* pre-reliability failure.

**Mechanism:** SAPO adds a conditional token-level KL constraint: penalize KL divergence only on positive tokens with low probability where policy has shifted excessively. This prevents the model from "forgetting" productive behaviors while still allowing learning.

**Law 0 Connection:** SAPO prevents a *trained* system from regressing into the pre-reliability regime. Standard GRPO can collapse (ISDD) → all samples fail → zero gradient → no recovery. SAPO breaks this death spiral. It's a **Law 0 stabilizer** — keeping systems above the reliability threshold once they've crossed it.

**Result:** +10.6% absolute improvement over baseline GRPO (Search-R1), with only a one-line code change.

### 3.2 HCAPO: Credit Assignment Below the Reliability Threshold

**Paper:** HCAPO (arXiv:2603.08754) — Tan et al., March 2026
**Key idea:** In long-horizon tasks with sparse rewards, GRPO's step-level Q-value estimates are inaccurate, and value baselines for intermediate states are misaligned. HCAPO uses the LLM itself as a post-hoc critic to refine Q-values via hindsight reasoning.

**Mechanism:** Multi-scale advantage mechanism:
1. Hindsight Q-value refinement: After trajectory completion, use the LLM to reason about which steps were actually causally important
2. Multi-scale baselines: Different baselines for different decision granularities
3. Both supplement GRPO's group normalization when group variance is too low

**Law 0 Connection:** HCAPO addresses a specific pre-reliability failure mode: when success is so rare that GRPO groups have near-zero variance, HCAPO's hindsight reasoning can still extract learning signal from *partial* successes. Even in failed trajectories, some steps were correct — HCAPO identifies and reinforces those.

**Implication for Graph-GRPO:** This is directly applicable to edge-level topology learning. When all topologies fail (pre-reliability), standard Graph-GRPO gets zero gradient. But an HCAPO-augmented Graph-GRPO could use hindsight reasoning to identify *which edges carried useful information even in failed topologies*, providing gradient signal even below the reliability threshold.

**Result:** +7.7% success rate on WebShop, +13.8% on ALFWorld over standard GRPO.

### 3.3 DMAST: Security in the Pre-Reliability Regime

**Paper:** DMAST (arXiv:2603.04364) — Liu et al., March 2026
**Key idea:** Multi-modal web agents have an adversarial attack surface where injecting content into the DOM corrupts both visual and text observation channels. DMAST uses GRPO self-play to co-train agent and attacker.

**Mechanism:** Three-stage pipeline:
1. Imitation learning from teacher
2. Oracle-guided SFT with zero-acknowledgment strategy
3. Adversarial RL via GRPO self-play

**Law 0 Connection:** Adversarial attacks can push a system from above the reliability threshold back below it. DMAST's GRPO self-play is essentially training the system to *maintain reliability under adversarial conditions* — a pre-reliability regime prevention mechanism. This is a **Law 0 hardening** technique.

**Implication for Graph-GRPO:** Communication topologies could be attacked (adversarial edge injection, message corruption). DMAST's approach suggests using GRPO self-play to learn topologies that are *robust* to adversarial perturbation — a security-aware extension of Graph-GRPO.

---

## 4. Sparse vs. Dense Communication: Graph-GRPO Findings + Extensions

### 4.1 What Graph-GRPO Already Shows

From the deep-dive (DD#240):
- **Complete graphs (fully connected) perform WORSE than sparse structures** (82.16% vs. 84.53% for chain)
- Graph-GRPO learns to suppress redundant edges without explicit pruning constraints
- Edge-level advantages identify critical pathways — typically sparse structures emerge

This validates our **Intelligence Paradox** (GUS Law 2): more communication ≠ better outcomes.

### 4.2 Follow-Up Papers Addressing Sparse vs. Dense

**No direct follow-ups to Graph-GRPO were found** as of March 15, 2026 (the paper is only 12 days old). However, two papers in the GRPO ecosystem address related sparse/dense communication questions:

1. **AT-GRPO / Stronger-MAS (2510.11062):** Agent- and turn-wise GRPO grouping implicitly handles communication density — agents that communicate more get more gradient samples, naturally weighting learning toward high-information channels.

2. **GRPO-GCC (2510.08607):** The Global Cooperation Constraint prevents collapse to universal cooperation (dense) or defection (sparse) in spatial public goods games. This is a different domain but the underlying principle is the same: GRPO + constraint → adaptive sparse/dense balance.

### 4.3 Predicted Extension: Adaptive Sparsity via HCAPO + Graph-GRPO

**New Prediction P101a:** A hybrid HCAPO + Graph-GRPO system would:
1. Use Graph-GRPO's edge-level advantages for topology optimization
2. Augment with HCAPO's hindsight credit for edges in failed topologies
3. Result: faster convergence to optimal sparse topologies, especially in pre-reliability regimes where standard Graph-GRPO stalls

**New Prediction P101b:** By Q4 2026, at least one paper will extend Graph-GRPO with dynamic sparsity — topologies that adapt their density based on query difficulty (sparse for easy tasks, denser for hard ones). The mechanism would use GRPO's group normalization to detect difficulty (σ_group as difficulty proxy).

---

## 5. GRPO Expansion Since Survey: Three New Papers

Since our GRPO survey (March 15), three new relevant GRPO papers have appeared:

### 5.1 SAPO (2603.10069) — One-Line Fix for GRPO Collapse
- **What:** Conditional token-level KL constraint preventing ISDD collapse
- **Relevance:** ★★★★ — Directly fixes a critical GRPO failure mode
- **MAS Impact:** Systems using GRPO for multi-agent training (Graph-GRPO, AT-GRPO) are vulnerable to ISDD; SAPO's fix should be universally applied
- **Status:** NEW — not in survey

### 5.2 HCAPO (2603.08754) — Hindsight Credit for Long-Horizon Agents
- **What:** LLM-as-critic for step-level Q-value refinement in GRPO
- **Relevance:** ★★★★★ — Directly addresses credit assignment (the core problem Graph-GRPO solves)
- **MAS Impact:** Could enable GRPO to learn from partial successes in pre-reliability regime
- **Status:** NEW — not in survey

### 5.3 MM-Zero (2603.09206) — Zero-Data Self-Evolving Multi-Model VLMs
- **What:** Three-role (Proposer/Coder/Solver) GRPO-trained self-evolving system
- **Relevance:** ★★★ — Multi-model GRPO coordination; interesting but tangential to MAS topology
- **MAS Impact:** Demonstrates GRPO can coordinate role-specialized agents even without seed data
- **Status:** NEW — not in survey

### 5.4 DMAST (2603.04364) — Adversarial Safety via GRPO Self-Play
- **What:** Two-player zero-sum Markov game trained via GRPO for web agent safety
- **Relevance:** ★★★★ — GRPO for adversarial robustness; connects to security thread
- **MAS Impact:** Adversarial GRPO self-play as a reliability hardening technique
- **Status:** NEW — not in survey

---

## 6. Updated GRPO Stack Map

Extending the survey's taxonomy with new papers:

```
┌──────────────────────────────────────────────────────────┐
│                 GRPO in MAS Stack (Updated)               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  [RELIABILITY LAYER — Law 0 Interface]                   │
│    ├── SAPO: Prevents training collapse (ISDD fix)       │
│    ├── HCAPO: Extracts signal from partial success       │
│    └── DMAST: Maintains reliability under attack         │
│                                                          │
│  [TOPOLOGY LAYER — WHO communicates]                     │
│    └── Graph-GRPO: Edge-level topology optimization      │
│         (naturally gates on reliability via normalization)│
│                                                          │
│  [DECISION LAYER — WHEN/WHAT to do]                      │
│    ├── HILA: Metacognitive deferral (when to ask humans) │
│    ├── AOI: Dual-granularity step+trajectory optimization│
│    └── HCAPO: Hindsight credit for step-level decisions  │
│                                                          │
│  [COLLABORATION LAYER — HOW agents coordinate]           │
│    ├── AT-GRPO: Agent- and turn-wise grouping            │
│    ├── GRPO-GCC: Global cooperation constraint           │
│    └── MM-Zero: Multi-role self-evolving coordination    │
│                                                          │
│  [ALIGNMENT LAYER — WHY agents agree]                    │
│    └── Negotiation: GRPO for value trade-offs            │
│                                                          │
│  [SECURITY LAYER — ROBUSTNESS against adversaries]       │
│    └── DMAST: GRPO self-play for adversarial hardening   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key update:** The addition of a **Reliability Layer** at the top of the stack — SAPO, HCAPO, and DMAST collectively address GRPO's interaction with the pre-reliability regime, providing mechanisms for preventing, recovering from, and hardening against reliability failures.

---

## 7. Predictions

**P101a:** HCAPO + Graph-GRPO hybrid will appear by Q4 2026, combining hindsight credit assignment with edge-level topology optimization. Predicted improvement: +2-4% over standard Graph-GRPO on hard benchmarks.

**P101b:** Dynamic sparsity extension of Graph-GRPO will use group variance (σ_group) as a difficulty proxy, allocating denser topologies to harder queries automatically.

**P101c:** SAPO's ISDD fix will be incorporated into all future GRPO-based MAS training by default (it's a one-line change with large stability gains).

**P101d:** Adversarial GRPO self-play (DMAST-style) will be applied to communication topology hardening — learning topologies that are robust to adversarial edge injection or message corruption.

---

## 8. Significance: ★★★★★

This cross-reference reveals a deep structural connection between GRPO and GUS Law 0 that was not previously recognized:
- GRPO's group normalization is not just a variance reduction technique — it's a **reliability-gated optimization** mechanism
- Three new papers (SAPO, HCAPO, DMAST) collectively address GRPO's limitations in the pre-reliability regime, forming a new "Reliability Layer" in the GRPO stack
- The sparse vs. dense communication question is naturally resolved by Graph-GRPO's edge-level advantages, validating the Intelligence Paradox via RL
- This synthesis creates the first unified view of how GRPO interacts with system reliability, bridging the gap between our theoretical framework (GUS Laws) and the dominant empirical optimization paradigm (GRPO)
