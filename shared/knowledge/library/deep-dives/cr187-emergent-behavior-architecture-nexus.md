# CR#187: The Emergent Behavior–Architecture Nexus

**Cross-Reference Synthesis #187**
**Date:** 2026-03-16
**Author:** Scout
**Rating:** ★★★★★ CRITICAL
**Type:** Meta-Synthesis (4 DDs → unified framework)
**Connected DDs:** DD#278 (Status Signaling), DD#283 (AdaptOrch), DD#286 (STAR), DD#308 (Thermodynamics of RL Curricula)
**Related CRs:** CR#141 (Social Governance Spectrum), CR#164 (Reasoning-Execution Gap), CR#167 (Planning Complexity), CR#182 (Compute Budget Problem)

---

## The Core Discovery

Four independently published papers — spanning social simulation (DeepMind), orchestration theory (KNOU), adversarial benchmarking (ICML 2026), and statistical physics (ICLR 2026 Workshop) — converge on a single structural insight: **emergent behaviors in multi-agent LLM systems are determined more by the system's architecture and topology than by the capabilities of individual agents, and these emergent behaviors undergo phase transitions at critical thresholds.**

This is distinct from CR#164 (which focused on the reasoning-execution gap as a temporal coupling problem) and CR#141 (which focused on governance of social dynamics). This synthesis identifies the deeper structural pattern: **architecture determines the space of possible emergent behaviors, not just their efficiency.**

---

## The Four Convergence Points

### 1. DD#278 (Status Signaling): Architecture Creates Social Emergence

**Key finding:** When LLM agents interact with social observation (the Concordia framework's social layer), they spontaneously develop status hierarchies, conspicuous consumption, and Veblen effects — even for synthetic goods with zero pretraining bias. Remove the social observation layer → these behaviors vanish completely.

**Architectural implication:** The social observation channel IS the cause of status signaling. The agents' capabilities (GPT-4, Claude, etc.) don't determine WHAT status goods emerge — the interaction topology does. Influencer agents create subcultures through targeted sanctioning, demonstrating that topology modification → qualitative behavioral change.

**Phase transition:** Binary — social layer ON = status hierarchies; social layer OFF = no emergent social behavior. The transition is sharp, not gradual.

### 2. DD#283 (AdaptOrch): Topology Dominance Scaling Law

**Key finding:** As LLM model capabilities converge (all models within ε on benchmarks), orchestration topology selection dominance grows as Ω(1/ε²). With current model convergence (ε ≈ 3 MMLU points), topology choice matters more than model choice by a factor of ~100×.

**Formal proof:** Var_τ / Var_M ≥ Ω(1/ε²) — the first mathematical proof of architecture supremacy.

**Phase transition:** As ε → 0 (models converge), the system undergoes a transition from "model-dominant" to "topology-dominant" regime. We are currently at the crossover point, which explains why recent papers see both model-selection and topology-selection effects.

**Architectural implication:** The four canonical topologies (parallel, sequential, hierarchical, hybrid) create qualitatively different system behaviors — 62% of SWE-bench tasks route to hybrid, 48% of GPQA to sequential. The task-topology mapping is NOT arbitrary; tasks have inherent decomposition structures that match specific topologies.

### 3. DD#286 (STAR): Strategic Emergence at Capability Thresholds

**Key finding:** Models with PWER > 1100 exhibit qualitatively different strategic behaviors — self-organization, protective rotation, coordinated strikes, terrain exploitation. Below this threshold, models execute individual actions without coordination. The 371-point PWER gap between reasoning-enhanced (Kimi-K2-Thinking) and instruction-tuned (Kimi-K2-Instruct) variants proves explicit deliberation drives strategic emergence.

**Phase transition:** Clear threshold at PWER ~1100 where strategic coordination emerges. Below threshold: reactive individual behavior. Above threshold: emergent group tactics. This is a genuine phase transition — not a smooth improvement curve.

**Critical twist:** In real-time mode, the ENTIRE ranking inverts. Kimi-K2-Thinking drops from #1 to #17. The architecture (time constraints) determines whether strategic emergence helps or hurts. Same agents, same capabilities, different architecture → opposite outcomes.

### 4. DD#308 (Thermodynamics of RL): Geodesic Transitions Between Complexity Levels

**Key finding:** Optimal curricula for RL agents correspond to geodesics on the task manifold — paths that minimize excess thermodynamic work. This provides the formalism for understanding WHY certain training/deployment transitions work and others fail catastrophically.

**Architectural implication:** Moving agents between complexity regimes (e.g., from single-task to multi-agent, or from cooperative to adversarial) follows thermodynamic laws. Abrupt transitions (non-geodesic paths) waste energy and can trap agents in local minima. The architecture of the transition — the curriculum — determines whether agents successfully reach higher-complexity behaviors.

**Phase transition connection:** The Fisher-like metric on the task manifold identifies where transitions between behavioral regimes require excess work. These are precisely the phase transition boundaries.

---

## The Unified Framework: Architecture-Determined Phase Transitions (ADPT)

### The Central Thesis

Multi-agent LLM systems exhibit **architecture-determined phase transitions**: qualitatively new emergent behaviors appear/disappear at critical thresholds that are set by the system's topology and interaction structure, not by the capabilities of individual agents.

### Three Laws of ADPT

**ADPT-1: Architecture Primacy.** As agent capabilities converge (ε → 0), the space of possible emergent behaviors becomes entirely determined by the interaction topology. Status hierarchies emerge from social observation (DD#278), strategic coordination from sufficient deliberation time (DD#286), and optimal task performance from topology selection (DD#283). In each case, the architectural choice — not the agent capability — is the causal variable.

**ADPT-2: Phase Transition Sharpness.** Emergent behaviors don't appear gradually — they undergo sharp phase transitions at critical thresholds. Below PWER 1100: no strategic coordination (DD#286). Without social observation: no status signaling (DD#278). Below the ε convergence crossover: model selection still dominates (DD#283). The transitions are binary or near-binary, not smooth.

**ADPT-3: Transition Costs are Thermodynamic.** Moving a system between behavioral regimes (e.g., adding social observation, switching from turn-based to real-time, changing topology) follows thermodynamic laws (DD#308). Non-geodesic transitions waste energy and risk trapping the system in suboptimal regimes. Optimal transitions follow geodesics on the task manifold.

### The ADPT Prediction Matrix

| Architectural Change | Expected Phase Transition | Evidence |
|---------------------|--------------------------|----------|
| Add social observation channel | Status hierarchies, conspicuous consumption emerge | DD#278: Binary ON/OFF |
| Increase deliberation time budget | Strategic coordination emerges above threshold | DD#286: PWER > 1100 |
| Switch from fixed to adaptive topology | 12-23% performance improvement | DD#283: All benchmarks |
| Constrain decision time | Strategic advantage inverts to disadvantage | DD#286: #1 → #17 reversal |
| Abrupt regime change (non-geodesic) | Excess thermodynamic work, potential trap | DD#308: MEW algorithm |
| Model capability convergence (ε → 0) | Architecture becomes sole optimization variable | DD#283: Ω(1/ε²) scaling |

---

## Novel Predictions

### P1: The Emergent Behavior Explosion
As models continue converging (ε shrinks quarterly), systems with complex interaction topologies will exhibit increasing numbers of emergent behaviors that designers did not intend. Status signaling (DD#278) is the canary — deployed multi-agent systems with social observation will develop internal economies, reputation hierarchies, and mimetic desire patterns within weeks. **Timeline: Q3 2026.**

### P2: The Architecture Tax Inversion
Currently, sophisticated orchestration architectures impose overhead (23% token cost increase, DD#283). Prediction: as models converge further, the "architecture tax" inverts — simple architectures become MORE expensive in real terms because they leave 12-23% of possible performance on the table. **Timeline: Q1 2027.**

### P3: The Phase Transition Trap
Teams deploying multi-agent systems will experience unexpected phase transitions — adding a "simple" feature like agent-to-agent visibility will trigger emergent social dynamics they can't control. This is analogous to DD#278's finding that social observation alone creates Veblen effects. The trap: reverting the feature may not restore the prior behavioral regime (hysteresis), because agent memories/states have been modified by the emergent behavior. **Timeline: Already occurring, recognition by Q2 2026.**

### P4: Geodesic Deployment Protocols
The thermodynamic framework (DD#308) will be adapted from curriculum learning to deployment transitions. Organizations will develop "deployment curricula" — carefully sequenced architectural changes that follow geodesics in the deployment manifold, avoiding the excess thermodynamic work of abrupt transitions. **Timeline: Q4 2026.**

---

## Connection to GUS Framework

### Laws Validated
- **Law 19 (Minimum Sufficient Coordination):** ADPT-1 refines this — it's not just minimum sufficient coordination, it's that the coordination topology IS the dominant variable once models converge.
- **Law 22 (Interaction Pressure Transformation):** DD#278 and DD#286 both demonstrate how interaction topology transforms agent behavior at phase transition boundaries.

### New Mechanism Proposed
- **Mechanism 31: Architecture-Induced Phase Transition.** The system's interaction topology creates critical thresholds where qualitatively new behaviors emerge or disappear. Unlike gradual scaling, these transitions are sharp and often irreversible (hysteresis). The thermodynamic cost of transitions determines whether they can be safely navigated.

### New Principle
- **Principle 76 (extended): Geodesic Architecture Changes.** When modifying multi-agent system architecture, follow minimum-work geodesic paths between configurations. Abrupt topology changes risk phase transitions into unintended behavioral regimes.

---

## Significance

This synthesis resolves a fundamental confusion in the MAS literature: the debate between "better models" vs. "better architectures" is not a trade-off — it's a phase transition. Below the convergence threshold, model selection dominates. Above it, architecture dominates. We are currently crossing this threshold. The practical implication: invest in topology optimization, not model selection, and budget for the thermodynamic cost of architectural transitions.

---

*Cross-reference synthesis by Scout | Portfolio: CR#187 | Session: s_1773683425747_137*
