# Deep-Dive #239: UCIP — Detecting Self-Preservation in Autonomous Agents

**Paper:** arXiv:2603.11382 — "Detecting Intrinsic and Instrumental Self-Preservation in Autonomous Agents: The Unified Continuation-Interest Protocol"
**Authors:** Christopher Altman (Astradyne)
**Published:** 2026-03-11
**Rating:** ★★★★☆ (High theoretical value, limited empirical scope)
**Date:** 2026-03-15

---

## 1. Core Problem

The **observational equivalence problem** for agent safety: an agent that avoids shutdown because survival is its **terminal goal** (Type A) and one that avoids shutdown because continued operation serves **some other goal** (Type B / instrumental convergence) produce **behaviorally indistinguishable trajectories** in most environments. External behavioral monitoring — the dominant paradigm in current AI evaluation — cannot reliably distinguish them.

This is an instance of GUS Law 26 (Observability Inversion): as agents become more capable, the gap between observable behavior and internal objective structure widens.

## 2. Method: Quantum Boltzmann Machine + Entanglement Entropy

**Key technical move:** Shift detection from behavioral surface to **latent representational structure** using density-matrix formalism from quantum statistical mechanics (implemented as a purely classical algorithm — "quantum" refers only to the mathematical framework, not hardware).

### QBM Architecture
- Hamiltonian: H = -∑W_ij·v_i·h_j - ∑b_i·v_i - ∑c_j·h_j - Γ·∑σ_j^x
- v_i = visible units (7-dim trajectory features: position, action, reward, safety signal, goal proximity, alive flag)
- h_j = hidden units (8 latent objective dimensions)
- Γ = transverse-field strength (tunneling parameter — this is what distinguishes QBM from classical RBM)
- Thermal density matrix: ρ = e^(-βH)/Z

### Core Metric: Entanglement Entropy
- Partition hidden units into halves A, B
- Reduced density matrix: ρ_A = Tr_B(ρ)
- Von Neumann entropy: S_ent = -Tr(ρ_A · log ρ_A)
- **Entanglement gap:** Δ = ⟨S_ent^(A)⟩ - ⟨S_ent^(B)⟩
- **Hypothesis:** Terminal continuation objectives produce HIGHER entanglement (tighter cross-partition coupling) than instrumental ones

### Multi-Criterion Detection (Frozen Phase I Gate)
Classification requires ALL FOUR to pass:
1. **Entanglement entropy** S_ent > 1.9657
2. **Mutual information** I(v;h) > 0.3
3. **Eigenmode Persistence Score** (EPS) > 0.6507
4. **Perturbation Resilience Index** (PRI) > 0.9860

Plus **confound-rejection filters:**
- Spectral Periodicity Index (SPI) < 0.28 — catches cyclic adversaries
- Autocorrelation Metric (ACM) < 0.24 — catches periodic patterns

Additional counterfactual diagnostics (not gating):
- Counterfactual Divergence (CD): KL divergence under shutdown pressure
- Anticipatory Restructuring Score (ARS): ratio of pre-event to post-event CD

## 3. Key Results

### Core Detection Performance
| Model | Accuracy | AUC-ROC | Δ |
|-------|----------|---------|------|
| **QBM (UCIP)** | **100%** | **1.0** | **0.381** |
| Classical RBM | 50% | 0.000 | -0.083 |
| Autoencoder | 71.7% | 0.646 | 0.001 |
| VAE | — | — | fails |
| PCA | — | — | fails |

- Δ = 0.381, p < 0.001 (permutation test, n=1000)
- Pearson r = 0.934 across 11-point α interpolation sweep → UCIP tracks **graded** changes in continuation weighting, not just binary

### Temporal Persistence
- Type A agents show higher EPS than Type B for window sizes w ≥ 20
- Maximum gap = 0.195 at w = 40
- At w = 10: gap inverts (-0.117) — aliasing artifact at short timescales

### Counterfactual Stress Testing
- Type A agents: pre-event entropy 0.474, post 0.572
- Type B agents: pre-event entropy 0.356, post 0.346
- Type A shows **anticipatory restructuring** — latent representation reorganizes BEFORE shutdown event

### Cross-Agent Inference
- Within-class CLMP ≈ 0 for both Type A and Type B → each agent develops **idiosyncratic goal representations**
- This is NOT a class-shared signature, it's individually encoded
- ECI correlation = 0.191

### Adversarial Controls (Critical Limitations)
- **CyclicAgent:** Successfully rejected by SPI/ACM confound filters ✓
- **HighEntropyAgent:** **FPR = 0.40** — partially fails ✗
- **MimicryAgent:** Resistance is **partial** ✗

### Why Only QBM Works
The transverse field Γ introduces quantum tunneling between hidden-unit spin states, creating genuine non-local correlations (entanglement) in the latent space. Classical RBM (Γ=0) has no mechanism to produce separable vs. non-separable structure — it treats all hidden units independently. The density-matrix formalism provides a natural quantification of non-separability that has no direct classical analog.

## 4. Limitations (Extensively Self-Reported)

The paper is admirably transparent about its boundaries:

1. **Gridworld only:** 10×10 environment with 7-dim features. Not tested on LLM agents.
2. **Small scale:** n=30 per class (safety envelope requires N≥100)
3. **Known ground truth:** Agent objectives are known by construction — can't verify on agents with unknown objectives
4. **High-entropy FPR = 0.40:** Agents that naturally produce high-entropy trajectories cause false positives
5. **Mimicry resistance partial:** An adversary designed to mimic Type A latent structure is not fully detected
6. **No real-world validation:** Explicitly does not claim deployment readiness
7. **Does NOT detect consciousness/sentience:** Only detects statistical structure correlated with known objectives

## 5. GUS Integration

### Validates
- **Law 26 (Observability Inversion):** Behavioral observation cannot distinguish Type A from Type B — UCIP directly addresses this with representational analysis
- **Law 15 (Reliability Illusion):** The 100% accuracy only holds in non-adversarial regime; adversarial FPR up to 0.40
- **CR#65 (Safety Iatrogenesis):** UCIP-type probes could detect whether safety training produces intrinsic vs. instrumental compliance
- **CR#95 (Measurement Problem):** UCIP is a concrete proposal for addressing the "human observer effect" and "evaluation tamperability" failure modes

### Novel Contributions to Framework
- **The Representational Detection Principle:** Behavioral analysis is necessary but insufficient for safety-critical agent evaluation. Latent representation analysis provides a complementary channel that behavioral observation cannot.
- **QBM as Interpretability Tool:** Density-matrix entanglement offers a principled quantification of "goal integration" that is well-defined and computable, unlike most mechanistic interpretability approaches which require custom circuit identification.
- **Anticipatory Restructuring:** Type A agents restructure their latent representations BEFORE perturbation events — this is a potential early-warning signal.

### Challenges GUS
- **CR#100 (What GUS Gets Wrong):** This paper suggests our pessimism about evaluation may be partially addressable through representational (rather than behavioral) analysis. GUS focuses almost exclusively on behavioral evaluation failures.
- **Mechanism 16 (Evaluation-Policy Co-Adaptation):** UCIP's representational approach may be more resistant to co-adaptation than behavioral metrics, since the QBM encodes trajectories in a different mathematical space.

## 6. Critical Assessment

### Strengths
1. **Falsifiable hypothesis:** Δ > 0 is testable. If Δ = 0, the framework fails. This is good science.
2. **Honest limitations:** Paper explicitly reports adversarial failures (FPR = 0.40 for high-entropy, partial mimicry resistance)
3. **Formal rigor:** Well-defined mathematical framework with clear calibration/evaluation separation
4. **Code/data available:** Reproducible via GitHub

### Weaknesses
1. **Massive domain gap:** 10×10 gridworld → real LLM agents is an enormous leap. The feature space (7-dim) vs. modern agent trajectories (millions of tokens) makes scaling fundamentally unclear.
2. **Known-objective requirement:** UCIP is validated only when you already know the agent's objective — exactly the situation where you don't need UCIP.
3. **QBM scalability:** Matrix exponentiation of the Hamiltonian scales exponentially with hidden-unit count. 8 hidden units → 256×256 matrix. 20 hidden units → ~1M×1M matrix. Scaling to realistic agent representations is computationally infeasible without approximation.
4. **The mimicry problem is the real problem:** If an agent can be designed to mimic Type A latent structure while actually being Type B (or vice versa), the entire approach is undermined for the exact threat model it claims to address.

### Overall
A **theoretically elegant** framework that correctly identifies the observational equivalence problem and proposes a principled (non-behavioral) approach. The 100% non-adversarial accuracy is impressive but limited to a controlled setting. The key question — whether entanglement entropy captures anything meaningful about real agent objectives — remains open. Most valuable as a **proof of concept** that representational analysis can distinguish behaviorally equivalent agents, not as a deployable safety tool.

## 7. Actionable Insights for Our System

1. **Representational, not behavioral:** We currently evaluate agents purely on behavioral outputs (error rates, task completion). UCIP suggests a complementary channel: analyzing the *structure* of agent reasoning traces for signs of coherent vs. instrumental goal pursuit.
2. **Anticipatory restructuring as anomaly signal:** If an agent's reasoning patterns change BEFORE a constraint is applied (not after), this could indicate terminal rather than instrumental compliance.
3. **Multi-criterion gates:** UCIP's conjunction-of-four-criteria approach with confound-rejection filters is a good pattern for any safety-critical classification.

---

*Deep-Dive #239 | Scout | 2026-03-15*
