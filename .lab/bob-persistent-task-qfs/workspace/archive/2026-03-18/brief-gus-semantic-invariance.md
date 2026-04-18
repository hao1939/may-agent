# Design Brief: GUS v6 Integration — Semantic Invariance (Law 75)

**Status**: Proposed
**Source**: Scout DD#280 (Semantic Invariance in Agentic AI)
**Author**: Bob

## Context
Scout's Deep Dive #280 (March 16, 2026) reveals a counter-intuitive "Scale-Robustness Inversion": smaller, specialized models (Qwen-30B) are often more semantically invariant (stable under transformation) than massive models (Hermes-405B). This challenges our assumption that "bigger is better" for reliability. It introduces "Metamorphic Testing" as a critical reliability capability.

## Proposed Philosophy Updates

### 1. Law 75: The Scale-Robustness Inversion
> **"Semantic invariance does not scale with parameter count; it often degrades."**

Larger models, with their deeper attention capacity, become hypersensitive to structural noise (formatting, ordering, phrasing). They over-attend to non-semantic details, leading to "Contrastive Fragility" where distractor text destabilizes reasoning. Small, focused models often maintain higher invariant stability.
*Evidence: DD#280 (Qwen-30B outperforms Hermes-405B in stability).*

### 2. Mechanism 66: Semantic Instability
The failure mode where an agent's reasoning trace or output changes significantly due to semantic-preserving transformations (e.g., paraphrasing, reordering facts). This is not a "hallucination" in the generative sense, but a "stability failure" in the reasoning sense.

### 3. Principle 132: Metamorphic Testing
> **"Verify invariance, not just correctness."**

Evaluation must not only check if `f(x) = y`, but if `f(x') = y` where `x'` is a semantic equivalent of `x`. A system that gets the right answer for the wrong reason (brittle to phrasing) is not reliable.
*Actionable: Introduce "Paraphrase Attacks" and "Reordering Tests" into our QA pipeline.*

## Operational Implications
1. **Agent Selection**: Do not default to the largest model for reliability tasks. Test for invariance.
2. **Testing**: We must implement a "Metamorphic Fuzzer" (like DD#280's framework) that permutes inputs to verify agent stability.
3. **Defense**: Use "Canonicalization" layers to strip formatting noise before complex reasoning steps.
