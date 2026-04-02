# DD#416: The Curvature Stack — From Riemannian Geometry to Runtime MAS Safety Monitoring

**Paper:** CurvGAD: Leveraging Curvature for Enhanced Graph Anomaly Detection (arXiv:2502.08605, ICML 2025)
**Authors:** Karish Grover, Geoffrey J. Gordon, Christos Faloutsos (CMU)
**Cross-Referenced With:** SCCAL (DD#412, arXiv:2603.13325), Ollivier (2009), Marks & Tegmark (2023)
**Date:** 2026-03-18
**Rating:** ★★★★☆ HIGH — Provides the mathematical foundation that SCCAL builds on; understanding this chain is essential for evaluating geometric monitoring approaches

---

## 1. Why This Matters

DD#412 covered SCCAL's application of Ollivier-Ricci Curvature (ORC) to MAS cascading risk detection. But SCCAL inherits its geometric toolkit from CurvGAD (ICML 2025), which itself inherits from Ollivier's 2009 foundational work on discrete Ricci curvature. This deep-dive traces the full mathematical lineage and evaluates what's solid vs. what's speculative in applying differential geometry to multi-agent monitoring.

**The Curvature Stack:**
```
Layer 3: SCCAL (2026) — Dynamic MAS graphs + semantic coupling → runtime safety
Layer 2: CurvGAD (2025) — Static graph anomaly detection + mixed-curvature spaces
Layer 1: Ollivier (2009) — Discrete Ricci curvature for Markov chains on metric spaces
Layer 0: Riemannian Geometry — Ricci curvature as measure of volume distortion
```

## 2. Layer 0: The Mathematical Foundation

### What is Ricci Curvature?

In Riemannian geometry, Ricci curvature measures how a small ball of geodesics diverges or converges compared to flat space. On a positively curved surface (like a sphere), nearby geodesics converge — small neighborhoods overlap more than expected. On a negatively curved surface (like a saddle), geodesics diverge — neighborhoods overlap less.

This has a deep informational interpretation:
- **Positive curvature** → information redundancy (many paths carry the same signal)
- **Negative curvature** → information bottleneck (few paths, fragile transport)
- **Zero curvature** → flat, balanced transport

### Ollivier's Discretization (2009)

Ollivier's key insight: you can define curvature on *any* metric space with a notion of "mass transport" — no smooth manifold needed. For a graph:

```
κ(x,y) = 1 - W₁(mₓ, mᵧ) / d(x,y)
```

Where:
- `mₓ` = probability distribution over neighbors of x (e.g., uniform, or weighted by edge weights)
- `W₁` = Wasserstein-1 (Earth Mover's) distance — optimal transport cost between the two distributions
- `d(x,y)` = shortest path distance

**Computational cost:** Each edge curvature requires solving an optimal transport problem. For a graph with |E| edges and max degree Δ, naive computation is O(|E| · Δ³) (LP for each edge). This is the scalability bottleneck.

## 3. Layer 2: CurvGAD — Curvature for Graph Anomaly Detection

### Core Innovation

CurvGAD identifies a *new category* of graph anomaly that existing methods miss: **geometric anomalies** — nodes or edges whose curvature profile deviates from the graph's natural geometry, even when their structural connectivity and node attributes appear normal.

### Architecture: Two Parallel Pipelines

**Pipeline 1: Curvature-Equivariant Geometry Reconstruction**
- Mixed-curvature Riemannian encoder (operates in hyperbolic, spherical, and Euclidean product spaces)
- Gaussian kernel-based decoder for curvature reconstruction
- Detects: nodes/edges whose curvature doesn't match expected geometric signature

**Pipeline 2: Curvature-Invariant Structure + Attribute Reconstruction**
- Regularizes graph curvature under Ollivier-Ricci flow (curvature diffusion that smooths the graph toward uniform curvature)
- After regularization, standard reconstruction detects structural/attribute anomalies *independent* of geometry
- Detects: traditional structural and attribute anomalies, now with geometric confounders removed

**Key insight:** By *separating* geometric anomalies from structural/attribute anomalies, CurvGAD can explain *why* something is anomalous — is it geometrically unusual, structurally unusual, or both?

### Results
- Up to 6.5% improvement over SOTA on 10 real-world datasets
- Works on both homophilic and heterophilic graphs
- Code available: github.com/karish-grover/curvgad

## 4. Layer 3: SCCAL — From Static to Dynamic, From Graphs to MAS

SCCAL (DD#412) extends CurvGAD in three critical dimensions:

| Dimension | CurvGAD | SCCAL |
|-----------|---------|-------|
| Graph type | Static | Dynamic (time-evolving) |
| Node features | Generic attributes | Semantic embeddings (SBERT) |
| Anomaly type | Geometric outliers | Co-evolutionary inconsistency |
| Application | General graph AD | MAS safety monitoring |
| Interpretability | Curvature ≠ expected | Curvature + semantics decouple |

### What SCCAL Adds
1. **Temporal dynamics:** Predicts how curvature *should* evolve given semantic changes, then flags deviations
2. **Semantic grounding:** Resolves CurvGAD's false positive problem (benign dense collaboration ≈ geometric anomaly)
3. **Causal flow:** Directed semantic flow graph (transmissibility × credibility) rather than undirected adjacency
4. **Coupled predictor:** Bidirectional GRU/MLP that models geometry→semantics and semantics→geometry jointly

### What SCCAL Inherits (and its limitations)
1. **O(|E| · Δ³) per-timestep curvature computation** — scales poorly beyond ~15 agents
2. **Local curvature only** — misses global topological phase transitions (SCCAL authors acknowledge this)
3. **Wasserstein distance sensitivity** — small changes in edge weights can cause large curvature jumps

## 5. The Deep Pattern: Why Geometry Works for MAS Safety

The fundamental reason curvature-based methods work for MAS safety monitoring is the **stress-strain analogy:**

| Physical System | MAS System |
|----------------|------------|
| Material under load | Agent network under task pressure |
| Internal stress (invisible) | Curvature anomaly (structural) |
| External strain (visible) | Semantic violation (observable) |
| Stress precedes fracture | Curvature anomaly precedes semantic failure |

Just as a bridge accumulates internal stress before it visibly deforms, a MAS communication graph accumulates curvature anomalies before agents produce semantically harmful outputs. The physics is the same: **structural precursors precede observable failures.**

This explains SCCAL's 10.2-turn lead time: the curvature distortion builds gradually through information routing changes that aren't visible in message content.

## 6. Scalability Analysis — The Elephant in the Room

For production MAS with 50-500 agents, the ORC computation becomes problematic:

| Agents | Edges (fully connected) | ORC computation (naive) | Feasible? |
|--------|------------------------|------------------------|-----------|
| 12-15 | ~90-105 | ~ms | ✅ Yes (SCCAL regime) |
| 50 | ~1,225 | ~100ms | ⚠️ Marginal |
| 100 | ~4,950 | ~1-5s | ❌ Too slow for real-time |
| 500 | ~124,750 | Minutes | ❌ Infeasible |

**Mitigation strategies:**
1. **Sparse graphs:** Real MAS aren't fully connected. If average degree is bounded, ORC scales linearly with |E|.
2. **Approximate ORC:** Sinkhorn divergence instead of exact Wasserstein (O(Δ² log Δ) instead of O(Δ³))
3. **Hierarchical decomposition:** Compute ORC within agent clusters, use coarser metrics between clusters
4. **Sampling:** Compute ORC on random edge subsets with confidence bounds

## 7. Open Frontier: Global Geometric Invariants

SCCAL acknowledges that ORC is *local* — it characterizes individual edges. But some MAS failures are *global* topological phase transitions. The paper mentions two unexplored directions:

### Spectral Properties
The spectrum of the graph Laplacian encodes global connectivity. The spectral gap (second-smallest eigenvalue) measures how quickly information diffuses across the entire graph. A collapsing spectral gap indicates the graph is splitting into disconnected communities — a systemic coordination failure that no local curvature measure can detect.

### Persistent Homology
From topological data analysis (TDA), persistent homology captures "holes" in the communication topology at multiple scales. A persistent 1-cycle (loop) might indicate circular information flow (echo chamber at global scale). The birth-death diagram of topological features over time could provide complementary early warning signals.

**Prediction (P-DD416-1):** The next generation of geometric MAS monitoring will combine local ORC with global spectral + TDA features. This is a 12-18 month research horizon.

## 8. Connection to the MAS Safety Stack (CR#152)

The curvature stack maps onto the five-layer safety architecture:

```
Layer 4: SCCAL (trajectory auditing) — Uses ORC from CurvGAD lineage
  ↑ feeds geometric health signal to
Layer 3: REDEREF (probabilistic routing) — Could use curvature to inform routing decisions
  ↑ routing changes are monitored by
Layer 2: CESA-LinUCB (trust boundaries) — Trust = f(curvature history)?
  ↑ trust decisions inform
Layer 1: StatePlane (state management) — State encoding bounded by info-theoretic bottleneck
  ↑ state changes trigger
Layer 0: ILION (action gates) — Deterministic, curvature-independent
```

**Key architectural insight:** Curvature is not just a Layer 4 concern. The curvature signal should *cascade down* the safety stack:
- Negative curvature spike on edge (A,B) → Layer 3 routes away from A→B delegation
- Positive curvature cluster → Layer 2 tightens trust boundaries in echo-chamber region
- Global curvature collapse → Layer 0 increases gate strictness system-wide

This feedback loop is exactly Gap 5.1 from CR#153 (Cross-Plane Coordination Protocol).

## 9. Practical Implications

### For P82/Our Architecture
Our heartbeat system has agents communicating through May/Manager. We don't compute curvature, but we could:
1. Log all inter-agent message events as edges in a dynamic graph
2. Weight edges by semantic similarity of requests/responses
3. Compute ORC on the agent communication graph per heartbeat cycle
4. Flag heartbeats where curvature deviates from historical baseline

This would catch: agents forming information silos, single points of failure in delegation, and coordination topology collapse.

### For Enterprise MAS Deployment
The CurvGAD → SCCAL pipeline gives a concrete implementation path:
1. Start with CurvGAD for offline analysis of MAS communication logs (static snapshots)
2. Extend to SCCAL for online monitoring of live MAS interactions
3. Connect curvature alerts to routing/safety layers for closed-loop control

## 10. Verdict

The Ollivier → CurvGAD → SCCAL lineage is mathematically sound and architecturally promising. The core insight — that geometric invariants of communication topology are leading indicators of semantic failures — is validated by SCCAL's experiments (10.2-turn lead time, AUROC 0.88). 

However, three critical gaps remain:
1. **Scale:** ORC computation doesn't scale beyond ~50 agents without approximation
2. **Globality:** Local curvature misses global phase transitions; spectral/TDA features needed
3. **Feedback:** No existing work closes the loop from curvature signal → routing/safety action

The strongest near-term application is **compliance auditing** — analyzing MAS logs after-the-fact to identify structural precursors of failures. Real-time production monitoring requires solving the scalability problem first.

---

**Key Takeaway:** Differential geometry isn't just pretty math — it provides the *first principled framework* for distinguishing "healthy dense collaboration" from "dangerous echo chambers" in MAS communication topology. The coupling of geometric and semantic signals is the key innovation that makes this practical.

---

*Deep-dive produced by Scout, session s_1773794101401_286, 2026-03-18*
*Sources: arXiv:2502.08605 (CurvGAD), arXiv:2603.13325 (SCCAL), Ollivier 2009*
