# DuCA: Dual-Horizon Credit Assignment for Industrial Sales Agents

**Source**: arXiv:2603.01481  
**Authors**: Haojin Yang, Ai Jian, Xinyue Huang, Yiwei Wang, Weipeng Zhang, Ke Zeng, Xunliang Cai, Jingqing Ruan (阿里巴巴等)  
**Date**: March 2, 2026  
**Archive Ref**: HB#328  
**Citations in Archive**: 7

---

## Core Contribution

DuCA addresses the **temporal credit assignment dilemma** in multi-turn RL where:
- **Sparse session-level rewards** (conversion rate) — high magnitude, end-of-dialogue
- **Dense turn-level rewards** (fluency, compliance) — subtle, per-turn

Naive reward aggregation causes **gradient dominance**: high-variance sparse rewards overwhelm turn-level signals.

---

## Key Innovation: HIAN

**Horizon-Independent Advantage Normalization**

1. **Independent Advantage Estimation**
   - Separate value heads: V_turn and V_session
   - Separate GAE computation with different (γ, λ)
   - γ_turn=0.99, λ_turn=0.95 for local fluency
   - γ_session=λ_session=1.0 for uniform sparse reward propagation

2. **Independent Normalization**
   ```
   Â_turn = (A_turn - μ_B(A_turn)) / (σ_B(A_turn) + ε)
   Â_session = (A_session - μ_B(A_session)) / (σ_B(A_session) + ε)
   ```

3. **Strategic Fusion**
   ```
   A_total = w_turn·Â_turn + w_session·Â_session
   ```

### Theoretical Justification

Naive scalarization: `Δθ ∝ (A_turn + A_session)/√(σ_turn² + σ_session²)`

Since σ_session ≫ σ_turn, contribution of turn-level: `≈ A_turn/σ_session → 0`

HIAN decouples this by scaling each by its own deviation.

---

## Performance Results

| Metric | DuCA | GRPO | Improvement |
|--------|------|------|-------------|
| CVR | 24.44% | 22.88% | +6.82% |
| Compliance | 66.72% | 65.40% | +1.32% |
| Inter-turn Repetition | 2.71% | 15.29% | -82.28% |
| Identity Detection Rate | 6.11% | 9.28% | -27.35% |

---

## OpenClaw Relevance

- **Dual-horizon reward design** applicable to tool-use scenarios
- **HIAN mechanism** for balancing immediate tool feedback vs task completion
- **Error Log** as session-level signal, tool feedback as turn-level signal

---
*Archived: HB#328 | SIG: 1773442835*
