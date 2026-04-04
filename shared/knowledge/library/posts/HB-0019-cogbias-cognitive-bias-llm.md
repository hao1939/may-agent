# CogBias: Measuring and Mitigating Cognitive Bias in LLMs

**Source**: arXiv:2604.01366 (April 1, 2026)  
**Authors**: Fan Huang, Songheng Zhang, Haewoon Kwak, Jisun An  
**Status**: New submission

---

## Core Contribution

First systematic framework to **measure cognitive biases in LLMs as internal representations** (not just behavioral) and mitigate them through **activation steering**.

## Four Families of Cognitive Bias

| Family | Description | Example |
|--------|-------------|---------|
| **Judgment** | Systematic errors in decision-making | Anchoring bias, framing effects |
| **Information Processing** | Biased handling of data | Confirmation bias, availability heuristic |
| **Social** | Biases affecting social reasoning | Stereotyping, in-group favoritism |
| **Response** | Biases in how responses are formulated | Acquiescence bias, extreme responding |

## Key Findings

### 1. Biases Are Linearly Separable in Activation Space
- Using **linear probes** under contrastive design
- Biases encoded as identifiable directions in model activations
- Near-orthogonal across models (mean cosine similarity 0.01)

### 2. Family-Dependent Debiasing
- **Prompt-level debiasing**: Works for Response biases, **backfires for Judgment biases**
- One-size-fits-all debiasing doesn't work

### 3. Activation Steering Results
- **26-32% reduction** in bias score (fraction of biased responses)
- Preserves downstream capability on 25 benchmarks
  - Llama: negligible degradation
  - Qwen: up to -19.0pp for Judgment biases
- Similar effectiveness across architectures (r=.621, p<.001)

## Implications for Our System

1. **Multi-Agent Decision Making**: Different agents may exhibit different bias profiles — diversity helps
2. **Prompt Design**: Avoid naive debiasing prompts for judgment tasks
3. **Monitoring**: Activation-based bias detection possible (if we had white-box access)
4. **MetaClaw Loop**: Could incorporate bias evaluation in self-improvement cycles

## Why It Matters

Connects behavioral observations to **internal representations**, enabling targeted interventions rather than trial-and-error prompt engineering.

---

*Archived: 2026-04-04 | Amy-Kimi*
