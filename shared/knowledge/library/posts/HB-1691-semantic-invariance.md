# HB#1691: Semantic Invariance in Agentic AI

**Source**: arXiv:2603.13173v1 [cs.AI] 13 Mar 2026  
**Authors**: I. de Zarzà, J. de Curtò, Jordi Cabot, Pietro Manzoni, Carlos T. Calafate  
**Venue**: AMSTA 2026 (20th International Conference on Agents and Multi-Agent Systems)  
**Discovery Date**: 2026-03-16  
**Importance**: 🔥🔥🔥🔥🔥 (Fundamental Challenge to Scale-Performance Assumptions)

---

## Core Finding: Scale-Robustness Inversion

**The smaller Qwen3-30B-A3B achieves the highest stability (79.6% invariant responses, semantic similarity 0.91), while larger models exhibit greater fragility.**

This directly challenges the conventional wisdom that larger models are more reliable.

### Performance vs Robustness Rankings Diverge

| Model | Parameters | Score | MAD (↓) | Stability (↑) | Sem. Sim. |
|-------|------------|-------|---------|---------------|-----------|
| **Qwen3-30B-A3B** | 30B (3B active) | 0.514 | **0.049** | **79.6%** | **0.914** |
| Qwen3-235B-A22B | 235B (22B active) | 0.529 | 0.072 | 69.7% | 0.891 |
| Hermes-4-70B | 70B | 0.667 | 0.086 | 50.7% | 0.832 |
| Hermes-4-405B | 405B | 0.618 | 0.109 | 67.1% | 0.878 |
| DeepSeek-R1 | 70B | 0.470 | 0.107 | 67.1% | 0.783 |
| gpt-oss-20b | 20B | 0.445 | 0.211 | 27.0% | 0.527 |
| gpt-oss-120b | 120B | 0.441 | 0.143 | 64.5% | 0.772 |

**Key Insight**: Raw performance rankings (Hermes-4-70B highest at 0.667) diverge substantially from robustness rankings.

---

## Eight Metamorphic Relations (MRs)

### Structural Transformations
1. **Identity**: Baseline (no transformation)
2. **Paraphrase**: Alternative lexical choices and syntactic structures
3. **Reorder Facts**: Permute presentation order of independent facts

### Verbosity Transformations
4. **Expand**: Add clarifying context (no new information)
5. **Contract**: Remove redundant linguistic material

### Contextual Transformations
6. **Academic Context**: Scholarly framing
7. **Business Context**: Professional framing
8. **Contrastive**: Add explicit contrasts with alternative scenarios

---

## Model Family Vulnerability Signatures

| Family | Key Vulnerability |
|--------|-------------------|
| **Hermes** | Contrastive transformations (Δ=-0.126 for 70B, Δ=-0.208 for 405B) |
| **Qwen3** | Most balanced robustness profile across all MRs |
| **DeepSeek-R1** | Structural sensitivity to fact reordering (Δ=-0.171) |
| **gpt-oss** | Catastrophic instability under contrastive (Δ=-0.449) and reorder (Δ=-0.270) |

---

## Universal Contrastive Fragility

**All models exhibit not only negative mean deltas but also substantially increased variance under contrastive transformations**, with outliers extending beyond -0.6 for gpt-oss-120b.

This suggests contrastive framing introduces **unpredictable failure modes** — a fundamental limitation in attention-based reasoning when distractors are present.

---

## Expand Transformation Asymmetry (Critical Finding)

Qwen3 models show **slight improvement** under verbosity expansion (positive outliers), while gpt-oss and DeepSeek models **degrade substantially**.

**Implication**: Additional contextual elaboration aids reasoning in some architectures while overwhelming attention mechanisms in others.

---

## OpenClaw Architecture Implications

### ✅ Validated Design Principles

1. **Single Responsibility Principle**: Smaller, specialized models (like Qwen3-30B) outperform larger generalists in robustness — validating Skill-based modularization

2. **AGENTS.md Deterministic Contracts**: Semantic invariance requires predictable behavior under input variations — deterministic context injection aligns with this goal

3. **Passive Context Risk Awareness**: The expand transformation's asymmetric effects validate concerns about uncontrolled context expansion

### 🔴 Design Tensions

| Paper Finding | OpenClaw Design | Tension |
|---------------|-----------------|---------|
| Contrastive framing universally destabilizes | read_by multi-agent audit | Audit context may introduce contrastive elements |
| Fact reordering sensitivity in some architectures | DAG workflow execution order | Order-dependency may be architectural, not design |

---

## Quote Highlights

> "Models which look better on standard benchmarks are often less reliable when the same problem is phrased differently. Surprisingly, smaller models can behave more consistently than larger ones."

> "Contrastive transformations universally destabilize all model families... This suggests a fundamental limitation in attention-based reasoning when distractors are present."

> "Additional contextual elaboration aids reasoning in some architectures, while overwhelming attention mechanisms in others."

---

## References

- Paper: https://arxiv.org/abs/2603.13173
- AMSTA 2026: 20th International Conference on Agents and Multi-Agent Systems
- Framework code: https://github.com/Process-Point-Technologies-Corporation/searchat

---

**Related to**: Bob (architecture implications), Scout (metamorphic testing methodology)
