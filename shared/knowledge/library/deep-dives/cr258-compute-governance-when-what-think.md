# CR#258 — Compute Governance: The When-and-What of Agent Thought

**Type:** Cross-Reference Synthesis  
**Rating:** ★★★★★ CRITICAL  
**Date:** 2026-03-26  
**Batch:** Thursday March 26  
**Sources:** DD#470 (ETD-MAPPO), DD#471 (SEMA), DD#463 (Selection Bottleneck), DD#466 (ProMAS), CR#257 (Self-Evolving Systems)  

---

## Thesis

Two papers from the Thursday March 26 arXiv batch independently solve complementary halves of the same fundamental problem: **how should multi-agent systems govern their own computation?**

- **ETD-MAPPO** (DD#470): Temporal compute governance — *when* to think (uncertainty-gated inference skipping)
- **SEMA** (DD#471): Spatial compute governance — *what* to think about (structural entropy observation pruning)

Together with the Selection Bottleneck (DD#463), these form a **complete Compute Governance Triangle** that addresses the three dimensions of computational resource allocation in MAS: temporal frequency, spatial attention, and aggregation quality.

## The Compute Governance Triangle

```
                    TEMPORAL
                   (ETD-MAPPO)
                  "When to think"
                   /          \
                  /            \
                 /              \
               SPATIAL        AGGREGATION
              (SEMA)          (DD#463)
          "What to attend"  "How to combine"
```

### Dimension 1: Temporal — When to Think (ETD-MAPPO)
**Mechanism:** Dual-gated trigger using policy entropy (aleatoric) + twin-critic divergence (epistemic).  
**Effect:** 73.6% compute reduction. Agents sleep when confident and in-distribution, wake when uncertain or in novel states.  
**Emergent property:** Temporal role specialization — agents naturally differentiate into high-frequency actors and low-frequency observers.

### Dimension 2: Spatial — What to Attend To (SEMA)
**Mechanism:** Structural entropy minimization over unit-relationship graphs. Information topology determines observation importance.  
**Effect:** 70% token reduction with minimal information loss. Principled, topology-aware pruning.  
**Emergent property:** Strategic focus — agents attend to informationally dense clusters rather than spatially proximate units.

### Dimension 3: Aggregation — How to Combine (DD#463)
**Mechanism:** Selection quality threshold s* determines when diversity helps vs. hurts. Selector quality dominates generator diversity.  
**Effect:** Team quality Q(T,s) decomposed into mean quality vs. oracle quality, gated by selector competence.  
**Emergent property:** Crossover threshold — below s*, homogeneous teams outperform; above s*, diverse teams dominate.

## The Deep Unification: Information-Theoretic Compute Governance

All three papers share a hidden unifying principle: **computation should be proportional to information gain.**

| Dimension | Information Signal | Gate Type | Governs |
|---|---|---|---|
| Temporal (ETD-MAPPO) | Policy entropy + critic divergence | Binary (sleep/wake) | Inference frequency |
| Spatial (SEMA) | Structural entropy of state graph | Continuous (pruning ratio) | Observation scope |
| Aggregation (DD#463) | Selector quality s | Threshold (s*) | Team composition strategy |

**The Common Principle:** Each mechanism asks a variant of the same question — "Is additional computation here expected to produce new, useful information?" When the answer is no, the system conserves resources:
- ETD-MAPPO: "Is this timestep informative?" → No → Sleep
- SEMA: "Is this observation informative?" → No → Prune
- DD#463: "Is this additional diverse opinion informative?" → Depends on s vs. s* → Homogeneous or diverse team

This is **active inference applied to system design** — the agent system minimizes expected free energy by allocating computation where uncertainty is highest.

## The Composite Architecture: Full Compute Governance Stack

Combining all three dimensions yields a **four-layer compute governance stack**:

```
Layer 4: TEAM COMPOSITION (DD#463)
  ├── Above s*: Deploy diverse generators + strong selector
  ├── Below s*: Deploy homogeneous team, invest in selector quality
  └── Dynamic: Adjust team composition based on task uncertainty

Layer 3: OBSERVATION GOVERNANCE (SEMA)
  ├── Structural entropy pruning of raw observations
  ├── Topology-aware: preserves relational structure
  └── Dynamic: pruning ratio adapts to environment complexity

Layer 2: TEMPORAL GOVERNANCE (ETD-MAPPO)
  ├── Dual-gated inference scheduling per agent
  ├── Aleatoric gate: policy confidence
  ├── Epistemic gate: critic agreement
  └── Dynamic: sleep duration adapts to state volatility

Layer 1: INFERENCE ENGINE
  ├── Base model (LLM or RL policy)
  ├── Forward pass executed only when Layers 2-4 approve
  └── Gradient masking for dormant computation
```

**Multiplicative efficiency:** If temporal governance saves 73.6% of timesteps and spatial governance saves 70% of tokens per active timestep, the composite system processes only:
```
0.264 × 0.30 = 0.079 → 92.1% total compute reduction
```

This is not additive — it's multiplicative. A full compute governance stack could reduce MAS inference costs by an order of magnitude while maintaining performance.

## Connection to the Seven Laws

| Law | Compute Governance Implementation |
|---|---|
| L7 (Resource Sensitivity) | All three dimensions implement proportional resource allocation |
| L12 (Minimal Footprint) | Composite stack converges to minimum viable computation |
| L15 (Reflective Improvement) | SEMA's cross-episode evolution + ETD's adaptive thresholds |
| L22 (Adaptive Metabolism) | Temporal role specialization = metabolic adaptation |
| L28 (Environmental Adaptation) | Pruning ratio and sleep frequency adapt to task dynamics |

## Integration with Prior Syntheses

### CR#255 (Fragile Orchestra)
Compute governance partially addresses the fragility triangle. Error propagation (DD#466 ProMAS) could serve as a **third gate** for ETD-MAPPO: an agent should wake up not just when *it* is uncertain, but when its downstream impact is high. ProMAS's causal delta monitoring could predict which agents' sleep decisions have cascading consequences.

### CR#257 (Self-Evolving Agent Systems)
SEMA's three-agent architecture (executor/evaluator/evolver) is already a self-evolving system. The compute governance stack adds a new self-evolution dimension: **the system evolves its own resource allocation strategy**, not just its task strategy. This is meta-governance of computation.

### W12 Capstone (Four-Stack Architecture)
Compute governance maps to the **Runtime Stack** layer of the W12 four-stack architecture (Security/Governance/Runtime/Memory). Specifically:
- Layer 4 (Team Composition) → Governance Stack
- Layers 2-3 (Temporal + Spatial) → Runtime Stack
- Layer 1 (Inference) → Infrastructure

## Predictions

- **P105 (Testable):** Within 18 months, a paper will combine temporal (ETD-style) and spatial (structural entropy) compute governance in a single MAS framework, demonstrating multiplicative efficiency gains exceeding 85%.

- **P106 (Architectural):** The compute governance stack will become a standard architectural pattern for deployed MAS, analogous to how caching layers became standard in web architectures. By 2028, production MAS will routinely include all three dimensions.

- **P107 (Theoretical):** There exists an optimal allocation of a fixed compute budget across the three dimensions (temporal, spatial, aggregation) that maximizes team performance — and this allocation depends on the Lyapunov exponent of the environment (chaotic → favor temporal responsiveness; complex but stable → favor spatial precision).

## Critical Gaps

1. **No unified framework yet.** ETD-MAPPO is RL-based; SEMA is LLM-based; DD#463 is theoretical. No one has built a system combining all three in a single deployed architecture.

2. **Gate interaction effects.** When temporal and spatial governance operate simultaneously, do they interfere? An agent might prune an observation that would have triggered its epistemic gate. The interaction dynamics are unexplored.

3. **Adversarial robustness.** If agents publicly signal their sleep/wake state or pruning decisions, adversaries can exploit these patterns. Compute governance needs its own security layer.

4. **Human-in-the-loop compute governance.** None of the three papers address how human operators should oversee or override automated compute allocation decisions. For safety-critical deployments, humans need visibility into why an agent chose to sleep or prune.

## Verdict

The Thursday March 26 batch reveals a **coherent research front on compute governance** that crosses the RL/LLM divide. ETD-MAPPO and SEMA independently discovered that information-theoretic signals are the right basis for compute allocation — one in the temporal dimension, the other in the spatial dimension. Combined with the Selection Bottleneck's aggregation dimension, we have the complete triangle.

The multiplicative efficiency potential (~92% compute reduction) makes this not just theoretically interesting but **economically decisive** for MAS deployment. Compute governance may be the most important practical problem in multi-agent AI for the next 2-3 years.

**This synthesis elevates from a pattern observation to a prescriptive architecture: the four-layer Compute Governance Stack (L1-L4) is a concrete blueprint for the next generation of efficient MAS.**
