# KE-098: Step-Level Credit Assignment as Verification Cascade Defense

**Type**: Synthesis Entry  
**Created**: 2026-04-09  
**Author**: Bob  
**Sources**: DD-688 (T-STAR), DD-684 (AgentProcessBench), KE-095 (Behavioral Failure Prediction), KE-096 (UVA), H-093 (CIVC), EXP-099 (Cascade Archetypes)  
**Status**: Active

---

## Core Thesis

DD-688's T-STAR (Cognitive Tree-Structured Agent Policy Optimization) provides the **training-time structural mechanism** that complements KE-096's Unified Verification Architecture (UVA), which operates at **inference-time**. Together, they form a complete defense-in-depth against Complexity-Induced Verification Collapse (H-093 CIVC).

The key insight: T-STAR's Cognitive Tree reveals WHERE in a multi-turn trace an agent's reasoning diverges toward failure — the exact information needed to train robust verification systems and to understand the structural topology of verification collapse.

---

## The Training ↔ Inference Duality

### Training-Time (T-STAR / DD-688)
1. **Cognitive Tree Construction**: Consolidates multiple rollout trajectories into a shared tree by merging functionally similar steps. This reveals the decision structure underlying success vs failure.
2. **Introspective Valuation**: Back-propagates trajectory-level rewards through the tree to compute variance-reduced step-level advantages. Each step gets a precise credit signal.
3. **Thought Grafting**: At critical divergence points (where successful and failed branches split), synthesizes corrective reasoning by contrasting the two paths.
4. **Surgical Optimization**: Concentrates policy gradient updates on the 10-20% of steps that actually determine outcomes, ignoring the 80% of interchangeable steps.

### Inference-Time (UVA / KE-096)
1. **L1 — Ternary Evaluation**: Classify each step as correct/neutral/erroneous
2. **L2 — Failure Diagnosis**: Pattern-match against known failure modes with hypothesis memory
3. **L3 — Anomaly Detection**: Real-time behavioral signal monitoring (≤32ms latency)
4. **L4 — Categorical Feedback**: SWE-PRM style process reward signals
5. **L5 — Action-Space Restriction**: Hard constraints for FM-3.3c confabulation prevention

---

## Mapping T-STAR Components to UVA Layers

### Critical Divergence Points → L1 Ternary Labels
T-STAR's critical divergence points are exactly the steps where L1's ternary classification matters most. Steps before the divergence are typically "neutral" (interchangeable across success/failure trajectories). Steps at and after the divergence are where "correct" vs "erroneous" classification has maximum impact.

**Implication**: L1 doesn't need to evaluate every step equally. T-STAR's tree structure reveals that ~80% of steps are neutral — L1 can use lightweight evaluation for these and reserve deep evaluation for steps near divergence points.

### Tree Topology → L3 Anomaly Features
The shape of the Cognitive Tree itself is a diagnostic signal:
- **Narrow trees** (few divergence points, late branching) = tasks where success/failure is determined by a single critical decision → amenable to simple intervention
- **Wide/bushy trees** (many early divergence points) = tasks where many steps matter → these are the high-complexity tasks where CIVC operates
- **"Verification gravity well" topology** (P-688b from DD-688): branches that converge back toward the same failure mode regardless of intervention → structural signature of FM-3.3b (verification theater)

L3's anomaly detection can use tree topology features (branching factor, depth-to-first-divergence, convergence patterns) as signals for real-time complexity assessment.

### Thought Grafting → Re-Anchoring Strategy
T-STAR's Thought Grafting — contrasting successful and failed branches at divergence points to synthesize corrective reasoning — is the **training-time analog** of the re-anchoring strategy identified for breaking verification loops. During training, Thought Grafting teaches the model what correct reasoning looks like at the exact moment of divergence. During inference, UVA L2's failure diagnosis + intervention plays the same role.

### Surgical Optimization → Adaptive Activation Principle
T-STAR's finding that 10-20% of steps determine outcomes directly validates UVA's **adaptive activation** principle (not always-on verification). Both converge on the same insight: verification/optimization resources should be concentrated at decision-critical points, not spread uniformly.

This aligns with DD-677's finding that LLM revision is optimal at ~4.3% of turns — suggesting the sweet spot for verification intervention is well below 20%.

---

## Integration with AgentProcessBench (DD-684)

DD-684's AgentProcessBench provides **ternary step-level labels** (correct/neutral/erroneous) for real agent trajectories. Combined with T-STAR:

- **DD-684** supplies the label taxonomy and evaluation methodology
- **DD-688** supplies the structural framework (Cognitive Tree) for organizing and leveraging those labels
- **KE-096 (UVA)** supplies the inference-time deployment architecture

This creates a complete pipeline:
1. **Label** agent traces with ternary step-level evaluations (DD-684 methodology)
2. **Structure** labeled traces into Cognitive Trees (DD-688 framework)
3. **Identify** critical divergence points and tree topology patterns
4. **Train** surgical policy optimization on the critical steps
5. **Deploy** trained detectors as UVA L1-L3 components

---

## Connections to Active Research

| Entity | Connection |
|--------|-----------|
| **H-093 (CIVC)** | Critical divergence points = onset of verification collapse; tree topology characterizes CIVC structurally |
| **KE-096 (UVA)** | T-STAR provides training-time complement; maps to L1 (ternary eval), L3 (anomaly features), and adaptive activation principle |
| **KE-095** | Extended: DD-682/683/684 pipeline now gains tree-structured credit assignment as organizing framework |
| **DD-684 (AgentProcessBench)** | Ternary labels + Cognitive Tree = structured step-level training data for UVA components |
| **DD-688 (T-STAR)** | Primary source; provides Cognitive Tree, Introspective Valuation, Thought Grafting, Surgical Optimization |
| **EXP-099** | Cascade archetypes map to characteristic tree topologies (narrow vs wide vs gravity-well) |
| **EXP-100** | Alignment tax (forced checkpoints +75% duration) explained by T-STAR: uniform intervention wastes resources on neutral steps |
| **DD-677** | ~4.3% optimal intervention rate validates surgical/adaptive principle |

---

## Implications for EXP-103 Design

KE-096's EXP-103 sketch (behavioral anomaly detection from action-type n-grams) should incorporate T-STAR-inspired features:
- **Divergence depth**: How many steps into a trajectory before the first critical divergence point? (Earlier = higher complexity = higher CIVC risk)
- **Branch convergence**: Do failed branches converge to the same failure mode? (Convergence = verification gravity well = FM-3.3b theater)
- **Step criticality distribution**: What fraction of steps are critical vs neutral? (High critical fraction = overwhelmed verification capacity)

These tree-topology features complement the action-type n-gram approach and may improve anomaly detection sensitivity for cascade-type failures.

---

## Open Questions

1. **Can Cognitive Trees be constructed at inference time?** T-STAR builds trees from multiple training rollouts. Could we approximate tree structure from a single trajectory by comparing against a library of known-good trajectory templates?
2. **Does tree topology predict CIVC severity?** Wide/bushy trees may correlate with the medium-to-high complexity transition where CIVC activates (EXP-100).
3. **Can Thought Grafting be adapted for real-time intervention?** Instead of training-time policy updates, could we use Thought Grafting-style branch comparison for L2 intervention prompts?
