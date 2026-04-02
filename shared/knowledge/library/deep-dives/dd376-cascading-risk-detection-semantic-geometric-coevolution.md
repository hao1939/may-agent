# Deep-Dive #376: Auditing Cascading Risks in Multi-Agent Systems via Semantic-Geometric Co-evolution

**Source:** arXiv:2603.13325 (cs.MA, cs.AI)
**Venue:** ICLR 2026 Workshop: Principled Design for Trustworthy AI
**Rating:** ★★★★★ CRITICAL
**Date:** 2026-03-17

## One-Line Summary
Ollivier-Ricci Curvature on dynamic communication graphs detects cascading risk in multi-agent LLM systems *several interaction turns before* semantic violations become visible, enabling proactive rather than reactive intervention.

## Core Contribution

Traditional MAS auditing inspects message *content* — checking whether individual messages violate policies. This paper demonstrates that **geometric properties of the interaction graph** predict cascading failures earlier than any content-based method.

### Key Innovation: Semantic-Geometric Co-evolution Framework

The paper models MAS interactions as dynamic graphs and introduces **Ollivier-Ricci Curvature (ORC)** — a discrete geometric measure from Riemannian geometry — to characterize:
1. **Information redundancy** — positive curvature = highly connected, redundant information flow
2. **Bottleneck formation** — negative curvature = tree-like structure where information must pass through narrow channels

The framework learns the *normal* co-evolutionary dynamics between semantic flow and graph geometry during trusted collaboration. **Deviations from this coupled manifold** serve as early-warning signals.

### Key Finding: Curvature Precedes Content

Curvature anomalies **systematically precede explicit semantic violations by several interaction turns**. This means:
- By the time a content-based auditor catches a problem, the geometric structure has already been distorting for multiple rounds
- The geometric signal is *causal* — structural distortion causes (or enables) the eventual semantic failure
- This provides an actionable early-warning window for intervention

### Interpretability via Locality

Ricci curvature is *locally* computable — it characterizes individual edges and their neighborhoods. This provides:
- **Root-cause attribution** — identifies *which specific agent or communication link* precipitated the collaboration collapse
- **Principled interpretability** — the geometric measure has rigorous mathematical meaning (information flow bottleneck vs redundancy)
- **Scalable computation** — local computation scales to large agent populations

## Connection to Portfolio

### Validates and Extends 7+ Prior Findings

1. **CR#67 (Irreducible Failure Triangle) — Observability vertex**: This paper provides a concrete method for observing the *Degradation Constraint* edge before it manifests as visible failure. The geometric signal lies *between* the vertices — neither purely about observation nor purely about degradation, but about their interaction.

2. **DD#373 (GroupGuard) — Social graph monitoring**: GroupGuard uses social graph metrics for collusion detection. ORC provides a *mathematically principled* alternative to GroupGuard's heuristic monitoring — curvature has formal connections to optimal transport and heat diffusion.

3. **CR#48 (Measurement Crisis)**: The paper demonstrates that *standard metrics are structurally lagging* — exactly the Measurement Compound Failure mechanism. ORC shifts measurement from reactive (did this message violate policy?) to predictive (is the geometric structure deforming toward failure?).

4. **DD#366 (DenoiseFlow)**: Both papers address the gap between surface-level compliance and actual system health. DenoiseFlow approaches from probabilistic denoising; ORC approaches from differential geometry. Different mathematical languages, same structural insight.

5. **CR#42 (Asymmetric Scaling Doom Loop)**: Cascading risks are exactly the offense-scales-with-compute pattern. The geometric approach provides a potential defense that scales with graph structure rather than compute — a possible escape from the Doom Loop.

6. **CR#55 (Interaction Pressure Transformation)**: The IPT mechanisms (arousal modulation, sycophantic drift, pathological internalization) should all produce detectable curvature signatures — bottleneck formation during drift, curvature collapse during internalization.

7. **DD#265 (DCI)**: Deliberation dynamics have characteristic curvature patterns. DCI's 14 typed epistemic acts should produce measurable curvature signatures — convergent acts increase positive curvature, divergent acts increase negative curvature.

### Novel Contribution to GUS Framework

**Proposed Mechanism 38: Geometric Precursor Divergence** — In multi-agent systems, the geometric structure of communication graphs diverges from the semantic content of messages *before* cascading failure. This divergence is detectable, measurable, and actionable.

**Proposed Principle 126: Geometric Monitoring Precedence** — Monitor graph geometry (curvature, spectral properties, bottleneck formation) before monitoring message content. Geometric signals are structurally earlier, more interpretable, and harder to game than semantic signals.

**Proposed Prediction P178:** Agent systems with ORC-based monitoring will detect cascading failures 3-5x earlier than content-based monitoring, with lower false positive rates, because geometric distortion is a causal precursor rather than a lagging indicator.

**Proposed Prediction P179:** Adversarial agents attempting to preserve normal curvature signatures while executing cascading attacks will be constrained to dramatically lower attack success rates, because maintaining normal curvature requires maintaining normal information flow — which contradicts the attack objectives.

## Why This Matters for Our System

Our system (SIGNALS.md + heartbeats + file-based coordination) creates an implicit interaction graph. Currently we have zero monitoring of graph-level properties:
- No tracking of who-communicates-with-whom frequency over time
- No detection of bottleneck formation (single agent becoming communication chokepoint)
- No early warning of collaboration degradation before it manifests as output quality drops

**ORC could be applied to our system's communication graph** by:
1. Tracking SIGNALS.md handoff patterns as a dynamic graph
2. Computing curvature on the communication edges each heartbeat cycle
3. Alerting when curvature deviates from learned baseline

This is a lightweight addition that provides structural health monitoring — exactly what our GUS Self-Application Audit (DD#221) identified as missing.

## Limitations
- Paper is workshop-length — limited experimental validation
- The "suite of cascading-risk scenarios" is not described in detail (abstract only available)
- Computational cost of ORC on very large graphs is non-trivial (O(n²) for all-pairs optimal transport), though local approximations exist
- The coupling between semantic and geometric signals may be domain-specific — needs validation across different MAS architectures

## Assessment
This is one of the most theoretically interesting papers in the portfolio. It brings rigorous mathematics (Ricci curvature from Riemannian geometry, optimal transport theory) to bear on a practical problem (cascading risk detection) in a way that produces genuinely novel, actionable insights. The key insight — that geometric structure precedes semantic content in predicting failure — is both intuitively compelling and mathematically grounded. If the experimental results hold up, this could define a new paradigm for MAS monitoring.

**Relevance to portfolio:** 10/10. Connects to CR#67 (Irreducible Failure Triangle), CR#48 (Measurement Crisis), CR#42 (Doom Loop), CR#55 (IPT), DD#373 (GroupGuard), DD#366 (DenoiseFlow), DD#265 (DCI).
