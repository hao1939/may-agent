# Deep Dive: PACED — Distillation at the Frontier of Student Competence

**Paper:** arXiv:2603.11178  
**Authors:** Yuanda Xu, Hejian Sang, Zhengze Zhou, Ran He, Zhipeng Wang  
**Date:** 2026-03-11  
**Deep-dive by:** Scout | Session s_1773501999481_133 | 2026-03-14

---

## Core Contribution

PACED (Proficiency-Adaptive Competence Enhanced Distillation) introduces a **theoretically grounded curriculum for LLM distillation** that concentrates training compute on the "zone of proximal development" (ZPD) — problems where the student model has partial competence. It derives a **Beta-kernel weighting function** w(p) = p^α(1-p)^β from the signal-to-noise ratio (SNR) structure of distillation gradients, proving this is not a heuristic but emerges as the leading-order weight family.

## Key Insight: The Distillation Waste Problem

Standard distillation wastes compute at two extremes:
1. **Mastered problems (p ≈ 1):** Near-zero gradients — computation with no learning
2. **Intractable problems (p ≈ 0):** Large but directionally incoherent gradients that actively erode existing capabilities (catastrophic forgetting)

PACED proves this waste is **structurally inevitable**: the gradient SNR provably vanishes at both pass-rate extremes. Roughly 49% of problems fall into these uninformative tails (p < 0.2 or p > 0.8).

## Theoretical Framework

### The Beta Kernel Derivation
- **Proposition 2:** Gradient SNR vanishes at both boundaries (p→0 and p→1)
- **Proposition 3:** Under power-law boundary regularity, any SNR profile decomposes as p^a'(1-p)^b' · e^r(p) with bounded remainder
- **Result:** The leading-order, maximum-parsimony weight family is the Beta kernel: **w(p) = p^α(1-p)^β**
- **Default:** α = β = 1 gives w(p) = p(1-p), symmetric around p* = 0.5, requiring **zero hyperparameter tuning**

### Minimax Robustness (Theorem 6)
Even when the true SNR profile deviates from the Beta model by a multiplicative factor e^±δ:
- Worst-case efficiency loss is only **O(δ²)**
- For δ ≤ 0.3 (SNR² within 35%), efficiency exceeds **91%**
- This holds both pointwise and in aggregate

### Variance Reduction (Proposition 7)
Beta-kernel weighting reduces gradient variance by assigning near-zero weight exactly where gradient second moments are largest (boundary pass rates), overcoming the penalty of non-uniform sampling.

### Data-Driven Exponent Selection (Proposition 11)
Optimal (α*, β*) can be estimated from empirical moments of the pass-rate distribution within the ZPD — no gradient computation needed, just the pass rates already computed for weighting.

## Method Architecture

1. **Expert Solution Generation:** Black-box frontier model (gpt-oss-120b) generates reference solutions
2. **Teacher Regeneration:** Frozen teacher model re-expresses expert reasoning in its own distributional voice (turns black-box supervision into white-box distillation signals)
3. **Pass-Rate Estimation:** K=8 student rollouts per problem compute p(x;θ)
4. **Beta-Kernel Weighting:** w(p) = p^α(1-p)^β normalized to unit mean
5. **Weighted Distillation:** Standard KL loss scaled by pass-rate weight

### Key Design Choice: KL Direction Binding
- **Distillation** (larger→smaller): Forward KL for broad teacher-mode coverage
- **Self-distillation** (same model): Reverse KL for compact, high-confidence modes
- **Two-stage synergy:** Forward KL → Reverse KL = "mode-coverage-then-consolidation"

## Empirical Results

### Distillation Track (Qwen3-14B → Qwen3-8B, Forward KL)

| Method | MATH-500 | AIME 2024 | AIME 2025 | MMLU Forgetting |
|--------|----------|-----------|-----------|-----------------|
| Base | 86.5% | 28.7% | 20.8% | — |
| Forward KL (unweighted) | 90.4% | 35.9% | 29.3% | 6.8% |
| Hard Filter | 92.7% | 39.5% | 33.9% | 2.5% |
| AKL | 91.9% | 39.8% | 34.1% | 2.8% |
| **PACED** | **94.0%** | **41.6%** | **35.6%** | **0.2%** |

### Self-Distillation Track (Qwen2.5-Math-7B-Instruct, Reverse KL)

| Method | MATH-500 | AIME 2024 | AIME 2025 | MMLU Forgetting |
|--------|----------|-----------|-----------|-----------------|
| Base | 83.9% | 19.6% | 11.5% | — |
| Reverse KL (unweighted) | 90.4% | 25.3% | 16.9% | 2.2% |
| Hard Filter | 92.0% | 28.9% | 22.0% | 0.5% |
| AKL | 91.4% | 28.2% | 21.5% | 0.8% |
| **PACED** | **93.7%** | **31.6%** | **25.1%** | **0.6%** |

### Two-Stage Schedule (Forward KL → Reverse KL)
Strongest results: **+9.1/+15.2/+16.7** on MATH-500/AIME 2024/AIME 2025

## Why This Matters for Multi-Agent Systems

### 1. Efficient Capability Transfer Between Agent Tiers
In hierarchical multi-agent architectures, larger "teacher" agents often need to transfer capabilities to smaller "worker" agents. PACED shows how to do this optimally — concentrate on the capability frontier, not waste compute on what the worker already knows or can't learn yet.

### 2. Self-Improvement Without Catastrophic Forgetting
The 0.2% forgetting rate is remarkable. For agents that must continuously learn while maintaining existing capabilities, PACED's approach of preventing forgetting through curriculum design (not regularization) is architecturally cleaner than EWC/GEM approaches.

### 3. The "Mode-Coverage-Then-Consolidation" Pattern
The two-stage KL schedule reveals that forward KL (broad coverage) followed by reverse KL (mode sharpening) is a principled training strategy. This maps to multi-agent training where agents first learn diverse behaviors, then specialize.

### 4. Vygotsky's ZPD as a Training Principle
The formalization of the Zone of Proximal Development for AI training is conceptually powerful — it suggests that the most productive learning happens at the boundary of current capability, not at the extremes. This has implications for progressive agent training curricula.

### 5. Connection to Agent Evaluation
The pass-rate estimation framework (K rollouts to measure competence) is directly applicable to evaluating agent capability levels in deployment, enabling adaptive task routing in multi-agent systems.

## Cross-References to Existing Corpus

- **Distillation connects to DIVE (2603.11076):** DIVE scales task diversity for tool-use training; PACED scales training efficiency per task. Complementary approaches.
- **Forgetting connects to SoLA (2603.11239):** SoLA addresses knowledge editing without forgetting via modular LoRA; PACED prevents forgetting through curriculum design — different mechanisms, same goal.
- **Evaluation connects to Sim2Real Gap (2603.11245):** Both papers highlight the importance of measuring what models actually can vs. can't do, and the cost of misestimating capability.
- **Self-improvement connects to capability scaling literature:** The log-linear scaling of distillation efficiency with pass-rate targeting echoes the compute-optimal scaling findings in other work.

## Limitations

1. Pass rates estimated once before training (not dynamically updated in main experiments)
2. Requires verifiable problems (pass/fail scoring) — harder to apply for open-ended generation
3. Only tested with same-family teacher-student pairs (Qwen3 family)
4. Beta kernel assumes power-law boundary regularity — may not hold for all problem distributions

## Key Takeaway

PACED transforms a Vygotskian developmental psychology concept into a rigorous, minimax-robust training algorithm for LLM distillation. The core insight — that learning efficiency peaks at the frontier of competence, not at the extremes — has broad implications for any system that must transfer or develop capabilities incrementally, including multi-agent architectures where capability transfer between agent tiers is a fundamental operation.
