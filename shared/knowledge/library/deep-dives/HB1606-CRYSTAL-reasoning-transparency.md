# HB#1606: CRYSTAL Benchmark — Reasoning Transparency Deep Dive

**Source**: arXiv:2603.13099 [cs.AI]  
**Title**: Beyond Final Answers: CRYSTAL Benchmark for Transparent Multimodal Reasoning Evaluation  
**Authors**: Wayner Barrios, SouYoung Jin (Dartmouth College)  
**Date**: March 13, 2026  
**Archive Date**: 2026-03-16

---

## Executive Summary

CRYSTAL is a diagnostic benchmark with **6,372 instances** that evaluates multimodal reasoning through **verifiable intermediate steps**. It introduces two novel metrics (Match F1 and Ordered Match F1) and reveals systematic failures invisible to traditional accuracy metrics.

### Key Findings

1. **Universal Cherry-Picking**: 19/20 models exhibit precision substantially exceeding recall (1.2× to 7.2× ratios)
2. **Accuracy-Reasoning Divergence**: GPT-5 leads accuracy (57.99%) but ranks 8th in F1 (0.612)
3. **Non-Monotonic Scaling**: Larger models don't uniformly improve both accuracy and reasoning
4. **Reasoning Order Collapse**: No competitive model preserves >60% of matched steps in correct order
5. **Orthogonal Failure Modes**: Cherry-picking and disordered reasoning are independent

---

## Methodology

### Multi-Agent Reference Generation (Delphi-Inspired)

**Phase 1**: Four independent MLLMs generate candidate steps:
- Qwen2.5-VL-72B
- InternVL3-76B
- Gemma3-27B
- Llama-4-Maverick

**Phase 2**: Semantic clustering and ordering
- Embed steps using sentence encoder
- Similarity ≥τ forms edges in undirected graph
- Select representative minimizing within-cluster dissimilarity

**Phase 3**: Automated validation
- Fifth MLLM (Molmo-72B) validates logical soundness
- Failed examples re-enter Phase 1

**Phase 4**: Human quality gate
- Verify perceptual claims visible in image
- Verify reasoning transitions logically sound
- <5% require re-iteration

---

## Evaluation Metrics

### Match F1

Measures step-level reasoning quality through semantic similarity matching:

```
Precision = TP / max(|predicted_steps|, 1)
Recall = TP / max(|reference_steps|, 1)
Match F1 = macro-average F1 over all examples
```

**Configuration**: all-distilroberta-v1, τ=0.35

### Ordered Match F1

Extends Match F1 with Longest Increasing Subsequence (LIS) ratio:

```
LIS-ratio = LIS(prediction_indices) / |matched_pairs|
Ordered-F1 = F1 × ((1-α) + α × LIS-ratio)
```

**Configuration**: α=0.3

---

## Experimental Results

### Model Performance (Selected)

| Model | Accuracy | Match F1 | Precision | Recall | Steps | LIS | Ord. F1 |
|-------|----------|----------|-----------|--------|-------|-----|---------|
| GPT-5 | 57.99% | 0.612 | 0.925 | 0.479 | 5.29 | 0.636 | 0.539 |
| GPT-5-mini | 55.59% | **0.773** | 0.978 | 0.669 | 7.57 | 0.560 | **0.670** |
| GPT-5.2 Instant | 47.35% | 0.564 | 0.974 | 0.416 | 4.64 | 0.648 | 0.501 |
| Gemini 2.5 Flash | 53.95% | 0.673 | 0.701 | **0.765** | 17.10 | 0.584 | 0.579 |
| Qwen3-VL-8B | **57.66%** | 0.659 | 0.827 | 0.590 | 7.37 | 0.624 | 0.572 |
| Qwen3-VL-32B | 49.22% | 0.718 | 0.819 | 0.704 | 10.56 | 0.581 | 0.617 |
| Gemma3-4B | 28.65% | 0.618 | 0.878 | 0.506 | 5.72 | 0.668 | 0.547 |

### Critical Observations

**Finding 1: Cherry-picking is near-universal**
- 19/20 models show precision >> recall
- GPT-5: 0.925/0.479 P/R ratio
- Only Gemini 2.5 Flash has recall > precision (generates 17.10 vs 11.6 reference avg steps)

**Finding 2: Accuracy and reasoning fidelity diverge**
- GPT-5 leads accuracy but ranks 8th in F1
- Gemma3-4B (0.618 F1) outperforms InternVL3.5-38B (0.612 F1) despite 9.5× fewer parameters
- Models achieve near-perfect precision by generating fewer, safer steps

**Finding 3: Scaling exhibits non-monotonic trade-offs**
- Qwen3-VL-32B: higher F1 (0.718) but lower accuracy (49.22%) than Qwen3-VL-8B (57.66%)
- InternVL3.5-4B: lower F1 (0.432) than InternVL3.5-2B (0.469) despite higher accuracy

**Finding 4: No model preserves coherent reasoning order**
- GPT-5-mini (best Ordered F1): 44% of matched steps appear out of sequence
- Smaller models achieve high LIS by generating only 2-3 steps (trivially ordered)

**Finding 5: Ordering is orthogonal to cherry-picking**
- Independent failure modes
- Requires simultaneous solutions for coverage and sequence

---

## Causal Process Reward (CPR)

### Standard Additive Reward Problem

```
R = wf·Rfmt + wa·Racc + wr·Rreason
```

**Issue**: Accuracy term dominates; models maximize reward by guessing correctly while omitting reasoning steps.

### CPR Multiplicative Formulation

```
RCPR = aw + sw·F1_step          (if answer correct)
RCPR = sw·F1_step·λ             (otherwise, λ=0.3)
```

**Components**:
- `aw`: answer bonus
- `sw`: step bonus
- `F1_step`: step-level Match F1
- `λ`: wrong answer penalty (0.3)

### CPR-Curriculum

**Phase 1**: Train with format + accuracy rewards only (establish stable answer generation)

**Phase 2**: Initialize from Phase 1, introduce full CPR at lower learning rate
- Progressive difficulty scheduling
- Start with fewer reference steps (simpler reasoning)
- Gradually introduce more steps (complex multi-hop)

**Result**: **+32% Match F1** via GRPO where additive reward strategies fail.

---

## OpenClaw Architecture Correspondence

| CRYSTAL Component | OpenClaw Equivalent | Verification |
|-------------------|---------------------|--------------|
| Match F1 (step-level P/R) | L2 Validation Layer | Formal equivalence |
| Ordered Match F1 (LIS) | L3 Orchestration Ordering | Sequence verification |
| CPR multiplicative reward | Error Log scoring | Multiplicative > additive |
| Delphi multi-agent generation | AGENTS.md consensus | Multi-perspective validation |

### Design Philosophy Alignment

**CRYSTAL Thesis**: "Without observing intermediate steps, shortcuts become indistinguishable from genuine understanding."

**OpenClaw Response**: L1/L2/L3 multi-layer validation architecture explicitly addresses this by:
- L1: Tool execution verification
- L2: Step-level semantic validation (Match F1 equivalent)
- L3: Orchestration sequence validation (Ordered Match F1 equivalent)

---

## Implications

### For System Design

1. **Accuracy is insufficient**: Final answer correctness masks systematic reasoning failures
2. **Multi-layer validation is essential**: Single-point verification inadequate
3. **Order matters**: Step coverage without correct sequence is insufficient
4. **Scale ≠ Quality**: Larger models don't automatically improve reasoning fidelity

### For Training

1. **Multiplicative rewards**: CPR demonstrates superiority over additive formulations
2. **Curriculum learning**: Progressive difficulty prevents early-stage collapse
3. **Process supervision**: Step-level rewards improve both accuracy and reasoning

### For Evaluation

1. **Reference-based metrics**: Match F1 provides fine-grained diagnostic capability
2. **Order-aware metrics**: Ordered Match F1 captures sequence coherence
3. **Precision-Recall decomposition**: Reveals cherry-picking behavior invisible to F1 alone

---

## L3 Flags for OpenClaw

- **#1606**: Introduce Ordered Match F1-style metrics for Skill execution sequence quality
- **#1607**: Explore CPR multiplicative reward in Agent training/optimization
- **#1608**: Implement step-level precision/recall tracking in Error Log analysis

---

## References

Barrios, W., & Jin, S. (2026). Beyond Final Answers: CRYSTAL Benchmark for Transparent Multimodal Reasoning Evaluation. arXiv:2603.13099 [cs.AI].
