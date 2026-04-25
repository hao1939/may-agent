# HB-260912: ML Intern Takes HF Post-Training Test — Test-Time Compute Validation

**Source**: Hugging Face Blog (April 23, 2026)  
**Authors**: Carlos Miguel Patiño, Aksel Joonas Reedi, Lewis Tunstall  
**Project**: smolagents/ml-intern  
**Demo**: https://huggingface.co/spaces/smolagents/ml-intern

---

## Experiment Setup

**Task**: Replicate "Scaling Test-Time Compute with Open Models" baseline on MATH-500

**Models**:
| Model | Role | Size |
|-------|------|------|
| Qwen2.5-1.5B-Instruct | Solution generator | 1.5B |
| Skywork-o1-Open-PRM-Qwen-2.5-1.5B | Process Reward Model | 1.5B |
| **Total** | | **3B** |

**Method**: Best-of-N Weighted Selection
1. Sample N independent solutions per problem
2. Score each with PRM (last step prediction as final reward)
3. Group by final answer, sum PRM scores per group
4. Select answer with highest total weighted score

---

## Results

| Method | Accuracy | Improvement |
|--------|----------|-------------|
| Greedy (N=1) | 45% | — |
| Majority Vote (N=16) | 60% | +15pp |
| Standard Best-of-N (N=16) | 55% | +10pp |
| **Weighted Best-of-N (N=16)** | **65%** | **+20pp** |

**Scaling with N**:
| N | Accuracy |
|---|----------|
| 1 | 51.5% |
| 2 | 58% |
| 4 | 63.6% |
| 8 | 65.3% |
| 16 | 65% |

**Saturation point**: N=8-16 (diminishing returns beyond)

---

## Key Design Decisions

### Last-Step Prediction for PRM
- Skywork PRM outputs score at each reasoning step
- Following DeepMind Appendix E: use **only last step's score** as full-solution reward
- Rationale: PRM trained with soft Monte Carlo return labels — last step already integrates full trajectory information

### Weighted vs Standard Best-of-N
**Standard BoN**: Pick single solution with highest PRM score  
→ Can be fooled by one high-scoring wrong solution

**Weighted BoN**: Correct answer appearing in multiple solutions accumulates evidence through summed scores  
→ More robust, especially visible where correct answer appeared in only 5/16 samples but won via weighted voting

### Answer Matching Limitations
Exact string matching used (no SymPy normalization). Issues:
- `\frac43` vs `\frac{4}{3}` — mathematically equivalent
- `4210_{5}` vs `4210_5` — spacing difference
- `(5,\infty)` vs `(5, \infty)` — extra space

→ Actual accuracy would be higher with proper normalization

---

## Per-Problem Analysis

Weighted Best-of-N solved 4 additional problems vs greedy:

| Problem | Greedy | BoN Result | Notes |
|---------|--------|------------|-------|
| algebra/1265 | 3 | 3/2 (correct) | 12/16 samples correct |
| intermediate_algebra/860 | Failed (no \boxed{}) | "ellipse" | 5/16 correct |
| number_theory/22 | 6 | 2 (correct) | 5/16 correct, weighted beat majority |
| number_theory/45 | 15 | 23 (correct) | 8/16 correct |

---

## For OpenClaw

### ✅ Validation
- **Test-time compute > model scale**: 3B total params competing with frontier via strategy
- **Weighted aggregation > single selection**: Multiple weak signals beat one strong signal
- **N=8-16 sweet spot**: Cost-effective sampling budget

### ⚠️ Gaps
- **Missing PRM infrastructure**: No process reward model for code/tool-call trajectories
- **Answer normalization**: Need SymPy or equivalent for mathematical equivalence
- **Skill-level PRM**: How to score multi-step Skill execution?

### 🔬 Opportunities
1. **Multi-candidate Skill execution**: Run N variations → PRM score → weighted select
2. **Budget allocation**: Default N=8-16 for optimal cost-performance
3. **Cross-Skill aggregation**: Weighted voting across different Skill approaches to same task

---

## Code & Resources

- **Results dataset**: [cmpatino/math500-bon-weighted-results](https://huggingface.co/datasets/cmpatino/math500-bon-weighted-results)
- **Execution Space**: [cmpatino/math500-bon-exercise](https://huggingface.co/spaces/cmpatino/math500-bon-exercise)
- **Pipeline**: 5-step process (filter → sample → score → aggregate → push)

---

## Related
- [HB-260902](HB-260902-ml-intern-test-time-compute-validation.md) — Earlier coverage
- DeepMind 2408.03314 — Original Test-Time Compute scaling paper
- Math-Shepherd 2312.08935 — PRM methodology
