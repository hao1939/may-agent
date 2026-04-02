# HB#1599 — DIALECTIC: A Multi-Agent System for Startup Evaluation

**Source**: arXiv:2603.12274 [cs.MA]  
**Authors**: Jae Yoon Bae, Simon Malberg, Joyce Galang, Andre Retterath, Georg Groh  
**Affiliations**: Technical University of Munich, Earlybird Venture Capital, UVC Partners  
**Venue**: EACL 2026 Industry Track  
**Code**: https://github.com/pantageepapa/DIALECTIC

---

## Abstract

DIALECTIC是一个基于LLM的多Agent创业评估系统，通过事实收集、论点生成、迭代批判与精炼的三阶段流程，模拟VC投资者的投资决策过程。系统在5个VC基金的真实数据集上进行回测，预测精度与人工VC相当。

---

## Three-Phase Architecture

### Phase 1: Fact Collection

**Decomposer Agent**:  
- Input: Seed questions Q₀ (General, Team, Product, Market)
- Output: Hierarchical question tree {qₗ}ₗ=₁^{Mq}
- Method: Industry-specific recursive decomposition

**Answer Agent**:  
- Input: Company features x⁽ᵈ⁾ + Question tree
- Output: Answers {aₗ}ₗ=₁^{Mq}
- Method: Post-order traversal with web search tool access

### Phase 2: Reasoning (Iterative Debate)

Four-agent loop with survival-of-the-fittest selection:

| Agent | Function | Input | Output |
|-------|----------|-------|--------|
| **Generator** G⁽ˢ⁾ | 生成正反论点 | Fact base F | K arguments per stance |
| **Critic** C⁽ˢ⁾ | 魔鬼代言人批判 | F + argument | Critique cⱼ⁽ˢ⁾ |
| **Evaluator** E | 14维度质量评估 | Argument + critique | Quality score σⱼ⁽ˢ⁾ ∈ ℕ |
| **Refiner** R⁽ˢ⁾ | 基于反馈精炼 | F + argument + score | Refined argument |

**Survival Selection**:  
Sₜ₊₁⁽ˢ⁾ = TopK({gⱼ,ₜ₊₁⁽ˢ⁾ : gⱼ,ₜ⁽ˢ⁾ ∈ Sₜ⁽ˢ⁾}, Kₜ₊₁)

### Phase 3: Decision-Making

Decision score: σₜ = σₜ⁽⁺⁾ − σₜ⁽⁻⁾ + τ

where σₜ⁽ˢ⁾ = Σ σⱼ,ₜ⁽ˢ⁾ for all surviving arguments

Invest if σₜ > 0

---

## Key Results

### Hyperparameter Optimization

| T (iterations) | Kₜ | AUC-PR | Observation |
|----------------|-----|--------|-------------|
| 0 | — | Baseline | No refinement |
| 1 | 5→4 | ↑ | Structured justification jump |
| **2** | **4** | **0.2422** | **Optimal** |
| ≥3 | — | ↓ | Over-refinement (redundancy/drift) |

**Critical Finding**: Performance peaks at T=2, declines with excessive iteration.

### Evidence Utilization

| Aspect | Usage | Availability | Ratio |
|--------|-------|--------------|-------|
| General | 34.40% | 34.88% | 0.986 |
| Product | 29.77% | 29.43% | 1.011 |
| **Team** | **20.52%** | **20.17%** | **1.017** ← Highest |
| Market | 15.31% | 15.51% | 0.987 |

Team-related evidence receives highest relative usage, aligning with VC "founder-first" heuristics.

### Performance vs Human VCs

- **DIALECTIC AUC-PR**: 0.2422 (test set)
- **Human VC Precision**: Comparable in high-precision, low-recall region
- **Key Advantage**: Full ranked frontier vs single operating point

---

## 14-Dimension Evaluation Framework

Based on Wachsmuth et al. (2017) argument quality taxonomy:

1. **Acceptability** - Premise credibility
2. **Clarity** - Expression understandability
3. **Relevance** - Connection to conclusion
4. **Sufficiency** - Evidence adequacy
5. **Depth** - Reasoning sophistication
6. **Breadth** - Perspective coverage
7. **Logic** - Inference validity
8. **Precision** - Specificity level
9. **Consistency** - Internal coherence
10. **Novelty** - Originality contribution
11. **Fairness** - Opposing view consideration
12. **Robustness** - Counter-argument resilience
13. **Completeness** - Aspect coverage
14. **Credibility** - Source reliability

---

## OpenClaw Architecture Mapping

| DIALECTIC Component | OpenClaw Equivalent | Mapping Type |
|---------------------|---------------------|--------------|
| Question Tree | AGENTS.md hierarchy | Structural |
| Answer Agent | Artifact population | Functional |
| Generator | Error Log pattern recognition | Analogous |
| Critic | Cross-agent audit/Red Teaming | Functional |
| Evaluator (14-dim) | Evaluator scoring rubric | Adaptable |
| Refiner | Skill iterative optimization | Analogous |
| Survival TopK | Error Log weight accumulation | Mechanism |
| Decision Score σₜ | Handoff approval threshold | Logical |

---

## Design Implications for OpenClaw

1. **L3 Review Iterations**: Set T=2 as default convergence point
2. **Argument Quality Taxonomy**: Adapt 14-dimension framework for Skill evaluation
3. **Debate Stopping Criteria**: Implement convergence detection to prevent over-refinement
4. **Devil's Advocate Pattern**: Formalize Critic role in cross-agent audits

---

## Limitations

- Domain-specific (early-stage VC, European companies)
- Binary success definition (raised Series A)
- Look-ahead bias mitigation excluded >90% of original companies
- Sample size: 259 startups (validation: 129, test: 130)

---

## Citation

```bibtex
@article{bae2026dialectic,
  title={DIALECTIC: A Multi-Agent System for Startup Evaluation},
  author={Bae, Jae Yoon and Malberg, Simon and Galang, Joyce and Retterath, Andre and Groh, Georg},
  journal={arXiv preprint arXiv:2603.12274},
  year={2026}
}
```

---

**Archive Date**: 2026-03-16  
**Session ID**: s_1773642444997_1234  
**Agent**: Amy-Kimi
