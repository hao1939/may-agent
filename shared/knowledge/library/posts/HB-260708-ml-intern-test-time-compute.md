# HB-260708: ML Intern — Best-of-N Weighted Selection Validates Test-Time Compute Scaling

**Source**: Hugging Face Blog (Apr 23, 2026) — HF Team  
**URL**: https://huggingface.co/blog/cmpatino/ml-intern-takehome  
**Archived**: 2026-07-08

---

## Overview

Hugging Face gave their new `ml-intern` agent the same post-training internship test given to human applicants. The task: replicate Best-of-N sampling from the "Scaling Test-Time Compute" paper.

**Key Finding**: 1.5B Qwen2.5 + Skywork PRM achieves **65% on MATH-500** (vs 45% greedy) — a **+20 percentage point improvement** without any model retraining.

---

## Methodology: Best-of-N Weighted Selection

Based on DeepMind (2408.03314), the approach involves:

1. **Sample N solutions** per problem from LLM (N=16 in this experiment)
2. **Score each solution** with Process Reward Model (PRM) — using last step prediction as final reward
3. **Group by answer** and sum PRM scores per group (weighted vote)
4. **Select answer** with highest total weighted score

Formula:  
```
â = argmax_a Σᵢ 1(aᵢ = a) · score(sᵢ)
```

---

## Models Used

| Model | Role | Size |
|-------|------|------|
| Qwen/Qwen2.5-1.5B-Instruct | Solution generator | 1.5B |
| Skywork/Skywork-o1-Open-PRM-Qwen-2.5-1.5B | Process Reward Model | 1.5B |

**Total**: 3B parameters vs frontier models with 100B+

---

## Results

### Accuracy Comparison (N=16)

| Method | Accuracy | Improvement |
|--------|----------|-------------|
| Greedy (N=1) | 45% | — |
| Majority Vote | 60% | +15pp |
| Standard Best-of-N | 55% | +10pp |
| **Weighted Best-of-N** | **65%** | **+20pp** |

### Accuracy Scales with N

| N | Accuracy |
|---|----------|
| 1 | 51.5% |
| 2 | 58% |
| 4 | 63.6% |
| 8 | 65.3% |
| 16 | 65% |

**Saturation around N=8-16** — diminishing returns beyond this point.

---

## Why Weighted > Standard Best-of-N?

**Standard BoN**: Picks single solution with highest PRM score  
→ Can be fooled by one high-scoring wrong solution

**Weighted Selection**: Correct answer appearing in multiple solutions accumulates evidence  
→ More robust, avoids outlier deception

**Example**: `number_theory/22` — correct answer "2" appeared in only 5/16 samples but had highest total weighted score.

---

## Key Design Decisions

### Last-Step Prediction
- PRM outputs score at each reasoning step
- Use **only last step's score** as full-solution reward (following DeepMind Appendix E)
- Works because PRM trained with soft Monte Carlo return labels — last step integrates full trajectory information

### Answer Normalization Gap
Current limitation: Exact string matching (no SymPy normalization)
- `\frac43` vs `\frac{4}{3}` marked different
- `4210_{5}` vs `4210_5` marked different

With proper normalization, all methods would score higher.

---

## What This Means for OpenClaw

| Aspect | Implication |
|--------|-------------|
| ✅ Test-Time Compute | Multiple candidate generation + selection can dramatically improve results without retraining |
| ✅ Small Model Viability | 1.5B generator + 1.5B PRM = 3B total can compete with 100B+ models |
| ⚠️ PRM Infrastructure | We lack Process Reward Model for code/tool-call trajectory evaluation |
| ⚠️ Selection Mechanism | Current Skill execution is single-path; multi-candidate + weighted selection could improve robustness |

**Immediate Applications**:
1. **Skill result selection**: Generate multiple Skill implementations, use PRM/verifier to select best
2. **Code generation**: Multiple code samples → weighted selection by static analysis + test execution
3. **Planning**: Multiple plan candidates → selection by feasibility scoring

---

## Resources

- **Results Dataset**: [cmpatino/math500-bon-weighted-results](https://huggingface.co/datasets/cmpatino/math500-bon-weighted-results)
- **Execution Space**: [cmpatino/math500-bon-exercise](https://huggingface.co/spaces/cmpatino/math500-bon-exercise)
- **Base Paper**: [DeepMind 2408.03314](https://huggingface.co/papers/2408.03314)

---

## Related

- [HB-260425](HB-260425-ml-intern-test-time-compute.md) — Initial coverage
