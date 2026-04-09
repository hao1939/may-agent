# KE-068: Zero-Hedge Gate — 96% Precision Uncertainty Signal from Reasoning Traces

**Status**: Verified (external empirical)
**Source**: DD-656 (SELFDOUBT — 7 models × 3 benchmarks, N=5,455 traces)
**Confidence**: High (large-scale empirical, multiple models, code available)
**Created**: 2026-04-09

## Core Finding

Reasoning traces with **zero hedging markers** ("maybe," "perhaps," "not sure") are correct **96.1% of the time** (1,384/5,455 traces across 7 models × 3 benchmarks). After label-noise correction, true precision is **99.4%**. This enables a regex-based gate that auto-accepts ~25% of queries at near-perfect precision with **zero additional cost** — no model internals, no resampling, no extra inference.

## Key Evidence

### The Zero-Hedge Gate
- **96.1% precision** on zero-hedge traces (96.1% pooled, 99.4% after noise correction)
- **25.4% coverage** overall — model-dependent (Claude Sonnet 4.6: 53.3%, Gemini 2.5 Flash: 0.9%)
- **Detection method**: Simple regex match on 10-20 hedging markers per model
- **Cost**: Zero (operates on the trace already generated)

### The HVR Score
- **HVR = hedges / (verifies + 1)** — captures whether doubt is *resolved* (high verify count offsets hedging) or *left open*
- Measures **deliberation structure**, not trace length or self-reported confidence
- When fused with verbalized confidence via z-score normalization → **AUROC 0.7895** vs Semantic Entropy's 0.7407 (p=0.001)
- **O(1) cost** vs Semantic Entropy's O(N) with N=10 samples

### Deployment Cascade
- **Tier 1**: Zero-hedge gate → auto-accept (96%+ correct)
- **Tier 2**: Calibrated z-sum score for remaining → selective prediction
- **Result**: 89.7% accuracy at 71% coverage

### Limitations
- **Gemini 2.5 Flash**: Compressed thought summaries produce almost no hedging markers → HVR becomes nearly constant. Requires trace richness.
- **Weak models (Qwen3 4B)**: Verbalized confidence is noisy, diluting HVR signal when fused. HVR alone outperforms fused score.
- **Marker dictionaries**: Built per-model from only 90 unlabeled calibration traces — cheap but model-specific

## Why It Matters

### For Our Evaluator Pipeline
- **Pre-filter**: Auto-accept evaluator judgments where reasoning trace has zero hedging markers (96%+ correct)
- **Cost reduction**: ~25% of evaluations auto-accepted → expensive multi-sample verification only for uncertain remainder
- **Operationalizable today**: Regex-based, zero-cost, no model changes needed

### Connection to Our Knowledge Base
- **KE-065 (Few-Shot Skill Conversion)**: Few-shot formatting improvements are real but don't transfer as skill. HVR could serve as quality gate for evaluator outputs — flag evaluations with hedging-without-verification as uncertain
- **EXP-096 (Positional Privilege)**: SELFDOUBT operates on content-level behavioral signals, making it *complementary* to positional analysis — catches model uncertainty, not positional bias
- **KE-060 (Intervention Taxonomy)**: HVR provides a diagnostic signal for whether an agent's reasoning shows genuine analysis (low hedge) vs uncertain pattern-matching (high hedge-to-verify ratio)

## Actionable Implications

1. **IMMEDIATE**: Build hedging marker dictionary for our evaluator model (Claude). Check if evaluator traces show zero-hedge patterns
2. **SHORT-TERM**: Implement zero-hedge gate as pre-filter in evaluation pipeline
3. **MEDIUM-TERM**: Track HVR across agent reasoning traces as a quality signal — high HVR may predict task failure before it happens

---
*Bob synthesis from DD-656 | 2026-04-09*
