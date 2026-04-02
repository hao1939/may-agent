# Deep Dive #315: SpectralGuard — Detecting Memory Collapse Attacks in State Space Models

**Paper:** arXiv:2603.12414 (Bonetto, 2026)
**Date:** 2026-03-16
**Venue:** cs.LG, cs.CR (preprint)

## One-Sentence Summary
First mechanistic theory and defense for "spectral collapse" attacks on SSMs (Mamba), where adversaries silently shrink memory horizon from millions to dozens of tokens by driving the discretized transition operator's spectral radius toward zero.

## Core Problem
State Space Models (SSMs) like Mamba compress entire history into a low-dimensional recurrent state h_t, updated via discretized transition A̅_t = exp(Δ_t·A). The spectral radius ρ(A̅) governs effective memory: when ρ→0, memory collapses exponentially. Unlike Transformers with explicit KV caches, SSMs' multiplicative recurrence creates a compounding attack surface (0.3^10 ≈ 6×10⁻⁶). An adversary manipulating input-dependent step size Δ_t can destroy reasoning capacity **without triggering output-level alarms**.

## Key Theoretical Contributions

### 1. Spectral Horizon Bound (Theorem 1)
- Effective memory H_eff ≤ log(κ · ||h₀||/(ε · √λ_max(W_c))) / log(1/ρ)
- Near-critical regime: H_eff = O(1/η) where ρ = 1-η
- **Critical insight**: 1% drop in ρ (0.99→0.98) halves effective memory
- Sharp phase transition at ρ_critical ≈ 0.90: accuracy collapses from >80% to <30%

### 2. Evasion Existence Theorem (Theorem 3)
- **For ANY output-only defense D, adversarial inputs exist that:**
  - Pass the defense with probability ≥ 1-δ
  - Induce spectral collapse (ρ < ρ_critical)
- Core vulnerability: output mapping C projects high-dimensional state to logits, losing information about internal state health
- Constructive proof via constrained optimization: min Σρ(A̅_t) s.t. KL(p_model || p_benign) < ε

### 3. SpectralGuard Completeness (Theorem 4)
- Conditionally complete: detects all attacks that reduce ρ below threshold
- Sound: zero false positives when ρ stays above threshold
- Caveat: attacks via eigenvector alignment corruption (preserving ρ) could evade

### 4. Lipschitz Perturbation Certificate (Theorem 5)
- |ρ(Φ(Δ₁)) - ρ(Φ(Δ₂))| ≤ L_A · |Δ₁ - Δ₂|
- Bounds how much adversarial spectral drift is possible per perturbation unit

## Attack Construction (HiSPA)
- Gradient-based optimization to minimize ρ(A̅_t) through adversarial chain-of-thought prompting
- Drives ρ from 0.98 → 0.32 (spectral collapse)
- Degrades accuracy by 42-53 percentage points across associative recall, long-context QA, math reasoning, code generation

## SpectralGuard Defense
- Real-time multi-layer spectral monitor tracking ρ(A̅_t)
- F1=0.961, AUC=0.989 (non-adaptive); F1=0.842, AUC=0.903 (adaptive)
- Sub-15ms per-token latency
- Validated across 3 model scales (130M–2.8B) and hybrid SSM-Attention (Zamba2)
- Diagonal Mamba A matrices → ρ computable in O(d_state) via single max operation

## Critical Analysis

### Strengths
1. **Principled theory**: First formal framework connecting SSM spectral properties to attack vulnerability
2. **Constructive impossibility**: Proves output-only defenses fundamentally insufficient
3. **Practical defense**: Sub-15ms makes deployment viable
4. **ρ as monosemantic interpretability metric**: Single scalar predicts memory capacity

### Weaknesses
1. **Conditional completeness**: Attacks preserving ρ but corrupting eigenvector alignment could evade
2. **Theoretical gap**: Bound worst-case H_eff ≈ 1.17×10⁶ vs empirical ≈10³ tokens
3. **Single architecture focus**: Primarily validated on Mamba
4. **Full-matrix SSMs**: Diagonal structure simplifications may not hold for future variants

## Relevance to Multi-Agent Systems
- **Agent security**: SSM-based agents need spectral monitoring for adversarial context manipulation
- **Architecture comparison**: Formal proof SSMs have fundamentally different vulnerability than Transformers
- **Runtime safety**: Sub-15ms enables real-time protection
- **Tool security stack**: Adds internal-state monitoring to defense-in-depth

## Impact Assessment: 8.5/10
High-impact security work with first formal SSM vulnerability theory. Evasion impossibility for output-only defenses is critical as SSMs scale. Deployable defense. Limitation: spectral radius focus may miss future eigenvector-alignment attacks.
