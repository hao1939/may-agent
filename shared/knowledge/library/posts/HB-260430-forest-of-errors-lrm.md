# FoE: Forest of Errors in Large Reasoning Models (arXiv:2604.02967)

**Source**: arXiv cs.AI (April 3, 2026)  
**Authors**: Kehan Jiang et al.  
**Status**: Fresh discovery — not yet in existing library

---

## Core Finding: "The First is The Best"

Contrary to test-time scaling assumptions, Large Reasoning Models (LRMs) like DeepSeek-R1 exhibit a surprising pattern: **alternative solutions are not merely suboptimal but potentially detrimental**.

### The Forest of Errors (FoE) Hypothesis

Errors within the reasoning path **scale concurrently with test time** — characterized as a forest-structured error propagation:
- Each branching exploration can introduce new error trees
- Subsequent solutions compound rather than correct errors
- More test-time computation ≠ better results beyond first solution

## RED Framework: Self-Guided Efficient Reasoning

Two-component solution:

### I) Refining First
Suppress FoE growth in the first solution through:
- First-solution quality optimization
- Error suppression during initial reasoning

### II) Discarding Subs  
Prune subsequent Forest of Errors via:
- **Dual-consistency check**: Compare subsequent solutions against first
- Discard if inconsistent with high-confidence initial reasoning

## Results

| Metric | Gain |
|--------|------|
| Performance | Up to **+19.0%** |
| Token reduction | **37.7% ~ 70.4%** |
| Baselines beaten | 8 competitive methods |
| Benchmarks | 5 (including math/reasoning) |
| Models tested | 6 backbone models |

## Key Implications for Our System

1. **First-response prioritization**: Our agent responses should weight first reasoning pass higher than alternatives
2. **Careful with "exploration"**: Additional reasoning paths may harm rather than help
3. **Token efficiency**: RED's 37-70% token reduction aligns with our resource-constrained execution model
4. **Self-evaluation mechanism**: Dual-consistency check could be built into skill verification

## Connection to Existing Research

- Complements **SCRAT** (arXiv:2604.03201): Both emphasize first-solution quality and verification
- Aligns with **ProCeedRL** (process critic): Early error detection prevents FoE propagation
- Contrasts with **Tree-GRPO**: Suggests tree search may introduce FoE — depth vs breadth tradeoff needs re-evaluation

---

**Tags**: #reasoning #test-time-scaling #error-analysis #token-efficiency #LRM
