# HB-260425: ML Intern Best-of-N Weighted Selection

**Source**: Hugging Face Blog (April 23, 2026)  
**Authors**: Carlos Miguel Patiño, Aksel Joonas Reedi, Lewis Tunstall  
**Original**: https://huggingface.co/blog/cmpatino/ml-intern-takehome

---

## Summary

Replication of DeepMind's test-time compute scaling using open models: **1.5B Qwen2.5-Instruct + Skywork PRM achieves 65% on MATH-500** (vs 45% greedy) via Best-of-N weighted selection. Demonstrates that small models with proper inference-time compute can match much larger models.

## Key Results

| Method | Accuracy | Improvement |
|--------|----------|-------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

**Scaling with N:**
- N=1: 51.5%
- N=2: 58%
- N=4: 63.6%
- N=8: 65.3%
- N=16: 65% (plateau)

## Methodology

**Models:**
- Generator: Qwen/Qwen2.5-1.5B-Instruct
- Scorer: Skywork/Skywork-o1-Open-PRM-Qwen-2.5-1.5B

**Weighted Best-of-N Formula:**
```
â = argmax_a Σ(i=1 to N) 1(a_i = a) · score(s_i)
```

1. Sample N independent solutions per problem
2. Score each solution with PRM (last step prediction as final reward)
3. Group solutions by final answer, sum PRM scores per group
4. Select answer with highest total weighted score

**Key Design Decision:** Use last-step PRM prediction only (following DeepMind Appendix E), not min/product of all step scores. The PRM was trained with soft Monte Carlo return labels — last step integrates full trajectory information.

## Why Weighted > Standard Best-of-N

Standard BoN picks the single highest-scoring solution — can be fooled by one high-scoring wrong answer. Weighted selection accumulates evidence: correct answers appearing in multiple solutions build cumulative score. 

**Example:** Problem `number_theory/22` — correct answer "2" appeared in only 5/16 samples but had highest total weighted score, beating majority vote.

## Implications for Our System

1. **Test-time compute scaling is immediate value** — no retraining required, just better inference strategy
2. **Small model + PRM > large model** — 1.5B + PRM beats greedy 70B+ models on reasoning
3. **Weighted voting is the key** — simple majority vote wastes signal; PRM-weighted aggregation captures confidence
4. **Plateau at N=8-16** — diminishing returns beyond this; practical deployment sweet spot

## Resources

- Code: https://huggingface.co/cmpatino/math500-bon-exercise
- Dataset: https://huggingface.co/datasets/cmpatino/math500-bon-weighted-results
- Space: https://huggingface.co/spaces/smolagents/ml-intern
- DeepMind paper: 2408.03314

---

**Rating**: ★★★★★ — Immediate actionable technique for improving reasoning without model changes.
