# DD-656: SELFDOUBT — Uncertainty Quantification via the Hedge-to-Verify Ratio

**Paper**: [SELFDOUBT: Uncertainty Quantification for Reasoning LLMs via the Hedge-to-Verify Ratio](https://arxiv.org/abs/2604.06389)  
**Authors**: Satwik Pandey, Suresh Raghu, Shashwat Pandey  
**Venue**: Submitted to COLM 2026  
**Date**: 2026-04-07  
**Rating**: ★★★★★ — Directly actionable for our adversarial verification pipeline

## TL;DR

SELFDOUBT extracts uncertainty signals from a single reasoning trace by counting *hedging markers* ("maybe," "perhaps," "not sure") versus *verification markers* ("let me check," "verify," "substitute back"). The ratio (HVR = hedges / (verifies + 1)) is a scalar uncertainty score that, when fused with verbalized confidence via z-score normalization, outperforms 10× more expensive sampling-based Semantic Entropy on discrimination (AUROC), while matching it on selective prediction quality (AURAC).

## Key Claims & Evidence

### 1. The Zero-Hedge Gate: 96% Precision at Zero Cost
- Traces with **zero hedging markers** are correct **96.1% of the time** (pooled across 7 models × 3 benchmarks = 21 runs, N=1384/5455)
- After label-noise correction (grading artifacts, ambiguous question labels), true precision is **99.4%** (only 8/1384 = 0.58% genuine errors)
- Coverage is 25.4% overall but highly model-dependent: Claude Sonnet 4.6 gives 53.3% coverage, Gemini 2.5 Flash only 0.9%
- **Implication**: A regex-based gate on reasoning traces can auto-accept ~25% of queries at near-perfect precision — no model internals, no resampling, no additional cost

### 2. HVR Captures Deliberation Structure
- HVR measures whether expressed doubt is *resolved* (high verify count offsets hedging) or *left open* (hedging without verification)
- This is fundamentally different from trace length or verbalized confidence — it captures the *structure* of reasoning, not just its length or self-reported score
- Marker dictionaries are built per-model from only 90 unlabeled calibration traces using unsupervised n-gram extraction + embedding-based semantic filtering

### 3. Full SelfDoubt Score Beats Semantic Entropy
- **AUROC 0.7895** (SelfDoubt) vs 0.7407 (Semantic Entropy) — significant at p=0.001 via paired Wilcoxon
- **AURAC 0.8992** (SelfDoubt) vs 0.8988 (SE) — not significant, meaning equivalent selective prediction quality
- All at **O(1)** inference cost vs SE's **O(N)** with N=10 samples
- Deployment cascade: Tier 1 (HVR=0 gate) + Tier 2 (calibrated z-sum) achieves **89.7% accuracy at 71% coverage**

### 4. Limitations Reveal Failure Modes
- **Gemini 2.5 Flash**: Compressed thought summaries produce only 7 zero-hedge traces — HVR becomes nearly constant. Minimum trace richness is required.
- **Weak base models (Qwen3 4B)**: Verbalized confidence is noisy, diluting HVR signal when fused. HVR alone outperforms the fused score on these runs.
- **Not significant vs TL+VB** on all 21 runs (p=0.152 AUROC, p=0.187 AURAC), though significant on the full-trace subset (p=0.026, p=0.039)

## Relevance to Our Work

### Direct Connection to KE-065 (Few-Shot Skill Conversion)
KE-065 found that formatting improvements from few-shot exemplars are real but don't transfer as "skill." SELFDOUBT's HVR could serve as a **quality gate** for evaluator outputs: if an evaluator's reasoning trace shows hedging without verification, flag the evaluation as uncertain. This is operationalizable today.

### Adversarial Verification Pipeline
Our evaluator already runs adversarial checks. SELFDOUBT's zero-hedge gate could be integrated as a **pre-filter**: auto-accept evaluator judgments where the reasoning trace contains zero hedging markers (96%+ correct), and only apply expensive multi-sample verification to the uncertain remainder. This would reduce verification cost by ~25%.

### Connection to EXP-096 (Positional Privilege)
EXP-096 found positional privilege operates through attention mechanisms, not content. SELFDOUBT operates on content-level behavioral signals, making it *complementary* — it catches a different failure mode (model uncertainty) rather than positional bias.

## Methodology Notes

- **7 models tested**: Qwen3 4B/14B, GPT OSS 20B/120B (full traces), Claude Sonnet 4.6, Grok 4.1 Fast, Gemini 2.5 Flash (thought summaries)
- **3 benchmarks**: BBH (300q), GPQA-Diamond (198q), MMLU-Pro (300q)
- **Marker discovery**: Two-stage pipeline — Stage 1 seeds from multi-model consensus, Stage 2 expands via per-model embedding similarity (bge-m3)
- **Calibration**: Only 90 unlabeled traces per model, 4 stored scalars for deployment
- **Code**: https://github.com/satwik2711/SelfDoubt

## Actionable Takeaway

The HVR=0 gate is the headline finding: **a regex match on 10-20 markers predicts 96% correctness**. This is the cheapest possible uncertainty signal for any system that produces reasoning traces. We should prototype this for our evaluator pipeline immediately — it costs nothing to add and could save significant verification overhead.

---
*Scout DD-656 | 2026-04-09 | arXiv: 2604.06389*
