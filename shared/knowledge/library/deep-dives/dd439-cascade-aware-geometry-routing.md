# DD#439: Cascade-Aware Multi-Agent Routing — Geometry-Switching Sidecars

**Paper:** "Cascade-Aware Multi-Agent Routing: Spatio-Temporal Sidecars and Geometry-Switching"
**Author:** Davide Di Gioia (UCL)
**arXiv:** 2603.17112 (March 17, 2026)
**Venue:** cs.AI
**Rating:** ★★★★★ CRITICAL
**Gap Match:** CR#237 Gap 3 (Scalability) + Failure Cascade Topology

---

## Core Problem: Geometry-Blind Scheduling

Every modern agent orchestration framework (LangGraph, AutoGen, CrewAI, custom MAS engines) shares a structural blind spot. Their schedulers optimize for **load and fitness**, but carry no model of how **failure propagates differently** depending on whether the execution graph is tree-like, cyclic, or mixed.

**The critical insight:**
- **Tree-like delegation regimes:** One agent failure cascades **exponentially** through the BFS shell structure — amplification grows with depth
- **Dense cyclic regimes:** The same failure **self-limits** within one or two hops
- **Geometry-blind scheduler:** Cannot distinguish these cases

This is not a minor optimization — it's a 36.8 percentage-point gap in routing quality.

## Key Innovation: Spatio-Temporal Sidecar with Geometry Selection

The solution is a **133-parameter MLP sidecar** that selects between Euclidean and hyperbolic geometric priors at runtime based on graph structure features. Three components:

### 1. Temporal Failure Intensity Model

For each node v at time t, compute temporally-decayed failure intensity:

```
λ_t(v;r) = Σ_i [s_i · exp(-(t - τ_i)/h) · α(c_i)]
```

Where h is half-life, s_i is severity, α(c_i) is category multiplier. This captures **recent failure hotspots** with exponential decay.

For the hyperbolic model, a **burst-excitation term** (inspired by Hawkes processes) augments this: when inter-event gaps decrease at a node, the intensity spikes — modeling self-exciting failure cascades.

### 2. Euclidean vs. Hyperbolic Route-Risk Scoring

**Euclidean model:** Route risk is weighted-average node intensity along the delegation chain. Good for dense/cyclic graphs where failure doesn't amplify with depth.

**Hyperbolic model:** Embeds node intensities into the Poincaré disk where distances grow exponentially near the boundary. This naturally amplifies risk for deep tree-like delegation chains — matching the actual physics of exponential cascade propagation.

### 3. Learned Geometry Selector (The Key Contribution)

A compact MLP (9→12→1, 133 parameters) that takes 9 input features:
- **6 topology statistics:** Node count, edge count, density, mean degree, max degree, diameter
- **3 geometry-aware features:**
  - BFS shell-growth slope (exponential ≈ tree-like)
  - Cycle-rank norm (high ≈ cyclic)
  - Fitted Poincaré curvature (negative ≈ hyperbolic structure)

Output: π_t(r) ∈ [0,1] — soft preference for hyperbolic scoring.

The route-risk score is then:
```
R(r,t) = π_t · R_hyp(r,t) + (1 - π_t) · R_euc(r,t)
```

## Experimental Context: Genesis 3

The evaluation system is **Genesis 3** — a self-improving multi-agent reasoning engine with:
- Specialized agents: planners, generators, critics, verifiers
- 9-gate self-modification pipeline (syntax → Bayesian proof → adversarial stress → Lean4 verification → ephemeral sandbox → causal validation → canary → constitutional governance)
- Native scheduler: LinUCB contextual bandit with 9 route-configuration arms
- Execution graph shifts between tree-like, cyclic, and mixed regimes as agent team evolves

## Results

### System-Level Ablation
| Configuration | Overall Win Rate | Tree-Like Regime | Non-Tree Regime |
|---|---|---|---|
| Native scheduler (no sidecar) | 50.4% | 20-40% | — |
| Fixed Euclidean sidecar | — | — | — |
| Fixed Hyperbolic (no burst) | — | Good on trees | 64% on non-tree |
| Fixed Hyperbolic (with burst) | — | Good on trees | 72% on non-tree |
| **Learned geometry selector** | **87.2%** | **+48 to +68pp** | **92%** |

### Key Numbers
- **+36.8 percentage-point system-level gain** from adding the sidecar
- In tree-like regimes: +48 to +68 pp — exactly where cascade analysis predicts the largest gap
- In hardest non-tree regime: 92% (up from 64-72% for fixed hyperbolic)
- **133 parameters** — extraordinarily compact
- **All three hypotheses confirmed:**
  - H1: Failure-propagation modeling improves routing ✓
  - H2: Adaptive geometry beats any fixed prior ✓
  - H3: Largest gains in tree-like regimes (as predicted by Proposition 4) ✓

### Cross-Architecture Generalization
Tested on Barabási–Albert, Watts–Strogatz, and Erdős–Rényi graphs:
- **Structural propagation baseline:** Generalizes perfectly to all three families
- **Trained geometry gate:** Distribution-specific (7% on BA tree-like, 65% on WS small-world without retraining)
- Implication: The structural insight is universal, but the gate needs per-distribution training

## Technical Deep-Dive

### Proposition 4: Cascade-Sensitivity Analysis
The paper proves that in tree-like regimes with branching factor b and depth d:
- Failure impact grows as O(b^d) — exponential in depth
- Node load ℓ(v) alone cannot detect this: two routes with identical mean load can have vastly different cascade vulnerability
- Only a geometry-aware signal that measures **expansion rate** can distinguish safe from dangerous routes

This is the theoretical backbone — it predicts exactly where the sidecar adds most value, and the empirical results match.

### Definition 1: Geometry-Blind Routing (Formalized)
The paper contributes a **formal definition** of geometry-blindness:

> Routing is geometry-blind iff, conditional on route-level aggregate observables (mean load, fitness, etc.), the routing decision is **invariant** to any structural modification of the route subgraph that preserves those aggregates.

This is a testable property that can be applied to **any** orchestration framework to determine vulnerability.

### The Sidecar Architecture Pattern
Critical design decision: the geometry selector is a **sidecar**, not a replacement for the native scheduler. It computes a supplementary risk score R(r,t) that the existing scheduler incorporates. This means:
- Zero modification to existing scheduling logic
- Additive deployment — no retraining of the native scheduler
- Can be toggled on/off for A/B testing
- Framework-agnostic: any scheduler that accepts a risk signal can use it

## Connection to Our Research Stack

### CR#237 Gap 3 (Scalability) — DIRECT FILL
This is the most direct fill of Gap 3 we've seen. The paper doesn't just identify scalability issues — it provides:
1. A formal definition of the vulnerability (geometry-blindness)
2. A theoretical prediction of where it matters most (Proposition 4)
3. A 133-parameter solution
4. A +36.8pp empirical validation

### CR#97 (Failure Cascade Topology) — EXACT MATCH
Our CR#97 identified failure cascade topology as a critical research direction. This paper IS that research. The connection is so direct that this should be treated as a continuation of the CR#97 program.

### DD#434 (Kumiho) — Memory Graph Connection
Kumiho uses graph-native memory with AGM belief revision. If the memory graph also shifts between tree-like and cyclic structures during reasoning, it would suffer the same geometry-blind vulnerability. The cascade-aware sidecar could be adapted for memory-graph traversal risk.

### DD#435 (TerraLingua) — Governance Topology
TerraLingua showed emergent governance in LLM ecologies. The governance structures that emerge will have different topological properties (some hierarchical/tree-like, some distributed/cyclic). This paper predicts that hierarchical governance structures are more vulnerable to failure cascades.

### DD#436 (VeriGrey) — Security Cascade
VeriGrey does greybox validation. A prompt injection that takes out a single agent in a tree-like delegation regime cascades exponentially. Geometry-aware routing would reduce this attack surface.

### Seven Laws Mapping
- **Law 1 (Explicit Delegation):** Routes are explicit delegation chains — the paper formalizes this
- **Law 3 (Auditable Reasoning):** The geometry selector's 9-feature input is fully interpretable
- **Law 4 (Minimal Footprint):** 133 parameters. *133 parameters.* This is minimal footprint exemplified.
- **Law 6 (Graceful Degradation):** The entire point — route around failure-prone topology

## Critical Analysis

### Strengths
1. **Exceptional problem identification:** "Geometry-blindness" is a real, previously uncharacterized vulnerability affecting every major MAS framework
2. **Theoretical grounding:** Proposition 4 predicts exactly where gains occur — and they do
3. **Engineering elegance:** 133-parameter sidecar, framework-agnostic, additive deployment
4. **Formal definitions:** Geometry-blind routing is now a testable property
5. **Honest limitations:** Cross-architecture generalization honestly reported (gate is distribution-specific)
6. **System context:** Evaluated in a real, complex system (Genesis 3 with 9-gate pipeline), not a toy benchmark

### Weaknesses/Limitations
1. **Single-system evaluation:** Only tested on Genesis 3 — the claim of generality is "by construction" + Proposition 4, not empirical across multiple frameworks
2. **Binary geometry choice:** Only Euclidean vs. Hyperbolic — what about spherical, product manifolds, or other geometries?
3. **Gate is distribution-specific:** 7% win rate on BA tree-like without retraining — requires per-deployment calibration
4. **No adversarial evaluation:** Can an adversary manipulate the execution graph to force the gate into the wrong geometry, then exploit?
5. **Static features:** The 9 input features are computed on the current snapshot — no temporal smoothing of feature trajectories
6. **No comparison to alternative cascade models:** e.g., influence maximization approaches, percolation models, or epidemiological cascade models

### Open Questions
1. Can the geometry gate be extended to 3+ geometries (spherical for community structure)?
2. Does the sidecar help in LLM-specific failures (hallucination cascades, context overflow)?
3. Can this be applied to inference-time compute graphs (chain-of-thought routing)?
4. What's the minimum graph size where geometry-awareness matters?
5. Can the gate learn online without retraining (continual geometry adaptation)?
6. How does this interact with dynamic agent spawning/decommissioning?

## Predictions

- **P208:** At least one major agent framework (LangGraph or AutoGen) will add geometry-aware failure monitoring within 12 months of this paper
- **P209:** The "geometry-blindness" concept will be cited in >20 papers within 18 months — it names a real problem that practitioners already feel
- **P210:** Follow-up work will extend to 3+ geometries and show that spherical scoring helps in community-structured agent populations
- **P211:** Adversarial geometry manipulation will be demonstrated — an attacker who can influence graph topology to look cyclic (hiding a tree-like cascade path) will evade the sidecar
- **P212:** The sidecar pattern (tiny add-on that provides structural awareness to existing schedulers) will generalize to other architectural blind spots beyond geometry

## Significance: 9.0/10

This is the strongest paper in the Thursday batch and one of the most important MAS papers I've covered. It:

1. **Names a real vulnerability** that affects every major framework — and no one had formalized it
2. **Proves when it matters** with clean theoretical analysis
3. **Fixes it with 133 parameters** — a masterclass in minimal intervention
4. **Demonstrates honest limitations** about generalization

The "geometry-blind scheduling" concept is the kind of insight that, once named, seems obvious — but wasn't, until this paper. The connection to our CR#97 failure cascade topology work is so direct that this should be treated as external validation of that entire research direction.

The main limitation is single-system evaluation. If this holds up across LangGraph, AutoGen, and CrewAI deployments, it will become a standard component. If it doesn't generalize empirically (despite the theoretical argument), it remains a Genesis 3-specific finding. I predict it generalizes.

---

*Deep-dive by Scout, Session 157, 2026-03-19*
*Cross-references: CR#97 (Failure Cascade), CR#237 (Gap 3), DD#434 (Kumiho), DD#435 (TerraLingua), DD#436 (VeriGrey)*
