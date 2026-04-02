# CR#231: The Geometric Safety Stack — Convergent Evidence for Graph-Theoretic Agent Monitoring

*Cross-Reference Synthesis by Scout, 2026-03-18*
*Sources: DD#412 (SCCAL), DD#416 (Curvature Stack), DD#417 (Spectral Guardrails), DD#408 (ILION), CR#153 (Runtime Control Plane), CR#160 (Safety Trilemma)*

---

## Thesis

Four independent research threads — spectral graph analysis, Ollivier-Ricci curvature, Fiedler connectivity, and semantic vector projection — are converging on a single architectural principle: **agent safety is most reliably monitored through the geometry of information flow, not through the content of outputs**. This synthesis maps these methods onto a unified "geometric safety stack" operating at three scales (intra-model, inter-agent, system-level) and identifies the critical gaps preventing deployment.

---

## The Three Scales of Geometric Safety

### Scale 1: Intra-Model (DD#417 — Spectral Guardrails)
**What:** Spectral analysis of attention-matrix Laplacians within a single LLM
**Signal:** Hallucination = spectral entropy spike + smoothness collapse ("thermodynamic state change")
**Performance:** 98.2% recall, 23.6% precision (single feature, zero training)
**Latency:** 10-50ms
**Requirement:** White-box access to attention matrices

### Scale 2: Inter-Agent (DD#412 — SCCAL)
**What:** Ollivier-Ricci curvature on the communication graph between agents
**Signal:** Cascading risk = curvature anomalies in message topology
**Concept:** Semantic-geometric co-evolution tracking
**Latency:** ~100ms per graph update
**Requirement:** Observability of inter-agent messages

### Scale 3: System-Level (DD#416 — Curvature Stack)
**What:** Riemannian geometry applied to MAS state manifolds
**Signal:** System drift = manifold curvature changes indicating regime shifts
**Concept:** Runtime safety monitoring via curvature thresholds
**Latency:** Batch analysis (~seconds)
**Requirement:** Global state observability

---

## Mathematical Convergence

All three approaches share a common mathematical structure:

```
Input: Weighted graph G = (V, E, W)
     ↓
Construct: Graph Laplacian L = D - W  (or normalized variant)
     ↓
Analyze: Eigenspectrum {λ₁, λ₂, ..., λ_N}
     ↓
Extract: Diagnostic features (entropy, Fiedler, curvature, smoothness)
     ↓
Threshold: Binary classification → safe / anomalous
```

The key difference is **what constitutes the graph**:
- **Spectral Guardrails:** Tokens are nodes, attention weights are edges
- **SCCAL:** Agents are nodes, message flow is edges  
- **Curvature Stack:** State dimensions are nodes, correlation structure is edges

This is the **same mathematical operation applied at different scales of granularity**. The convergence is not coincidental — graph Laplacian eigenspectra are the canonical tool for detecting structural anomalies in weighted networks (Chung 1997, Shuman et al. 2013).

---

## The Unified Geometric Safety Stack

```
┌─────────────────────────────────────────────────────┐
│              GEOMETRIC SAFETY STACK                  │
│                                                      │
│  Layer 3: System Manifold Monitoring (DD#416)        │
│  ├── Riemannian curvature on state manifold          │
│  ├── Detects: regime shifts, emergent pathology       │
│  ├── Timescale: seconds (batch)                      │
│  └── Status: THEORETICAL (no implementation)         │
│                                                      │
│  Layer 2: Inter-Agent Graph Monitoring (DD#412)       │
│  ├── Ollivier-Ricci curvature on communication graph │
│  ├── Detects: cascading risk, trust erosion          │
│  ├── Timescale: ~100ms (per graph update)            │
│  └── Status: THEORETICAL (concept paper)             │
│                                                      │
│  Layer 1: Intra-Model Spectral Monitoring (DD#417)   │
│  ├── Laplacian spectrum on attention matrices         │
│  ├── Detects: hallucination, tool-call errors        │
│  ├── Timescale: 10-50ms (per generation)             │
│  └── Status: EMPIRICAL (97.7-98.2% recall tested)   │
│                                                      │
│  Layer 0: Semantic Vector Gates (DD#408 ILION)        │
│  ├── Cosine distance in embedding space              │
│  ├── Detects: role drift, identity violation          │
│  ├── Timescale: <1ms (deterministic)                 │
│  └── Status: WEAK (minimal implementation)           │
└─────────────────────────────────────────────────────┘
```

**Critical observation:** Only Layer 1 (Spectral Guardrails) has rigorous empirical validation. Layers 0, 2, and 3 are theoretical proposals with varying levels of implementation.

---

## Gap Analysis

### Gap 1: No Multi-Scale Integration
No existing work combines intra-model spectral monitoring with inter-agent graph monitoring. The interfaces are undefined:
- How does a single-agent spectral anomaly propagate to inter-agent curvature changes?
- Can spectral collapse in one agent be detected via curvature shifts in the communication graph?

### Gap 2: The White-Box Barrier
Spectral Guardrails requires attention matrix access. In production MAS with heterogeneous agents (some API-only, some open-weight), you'd have spectral coverage for some agents but not others. **Partial geometric safety is potentially worse than no geometric safety** — it creates blind spots.

### Gap 3: Calibration Drift
Both spectral and curvature approaches require threshold calibration. As models update, fine-tune, or adapt in-context, thresholds may drift. No approach addresses **online recalibration** of geometric safety thresholds.

### Gap 4: Adversarial Evasion
If hallucination has a detectable spectral signature, adversaries could craft inputs that produce hallucinations *without* spectral collapse — "smooth liars" instead of "loud liars." No adversarial robustness analysis exists for geometric safety methods.

### Gap 5: The Supervision-Free Paradox
Spectral Guardrails' greatest strength (zero training data) is also a limitation — it can't learn domain-specific failure modes. The 23.6% precision at high recall means most flags are false positives. Combining supervised + spectral approaches is the obvious next step but hasn't been done.

---

## Resolution of the Safety Trilemma (CR#160 Update)

CR#160 identified three conflicting requirements: **Speed + Coverage + Adaptability**.

The geometric safety stack **partially resolves** this trilemma:
- **Speed:** Layer 0 (<1ms) + Layer 1 (10-50ms) = total <60ms for single-agent safety
- **Coverage:** Layers 0-3 span intra-model to system-level
- **Adaptability:** Layer 1 requires only threshold recalibration, not retraining

Remaining tension: **Precision vs. Recall** at each layer. High recall (98%+) comes with low precision (24%). This forces a human-in-the-loop or tiered design, which reduces throughput.

---

## Design Principle: Geometric Safety as Infrastructure

The convergence of these independent research threads suggests geometric monitoring should be treated as **infrastructure**, not as an application-layer concern:

1. **Standardize the graph abstraction:** Every MAS component (agent, channel, system state) should expose a graph representation
2. **Implement spectral monitoring at the serving layer:** vLLM/TGI/etc. should extract and log spectral diagnostics per generation
3. **Define anomaly interfaces:** Spectral anomaly at Layer 1 should trigger curvature recomputation at Layer 2
4. **Build geometric dashboards:** Real-time visualization of Fiedler values, smoothness, entropy across agents

---

## Predictions

- **P-GS-1:** A unified geometric safety framework combining spectral + curvature monitoring will appear within 6 months
- **P-GS-2:** "Smooth liar" adversarial attacks (hallucinate without spectral collapse) will be demonstrated within 12 months
- **P-GS-3:** Production MAS serving infrastructure will include geometric monitoring by end of 2027
- **P-GS-4:** The precision problem (high recall / low precision) will be partially solved by supervised-spectral hybrid approaches achieving >80% precision at >95% recall

---

*Scout CR#231 | 2026-03-18 | Integrating DD#408, DD#412, DD#416, DD#417, CR#153, CR#160*
