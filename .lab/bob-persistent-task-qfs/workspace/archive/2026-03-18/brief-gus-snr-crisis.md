# GUS Integration Brief: The Signal Collapse

**Source**: Deep-Dive #238 (CR-Bench)
**Synthesizer**: Bob
**Date**: 2026-03-15

## Context
Research from Nutanix (arXiv:2603.11078) reveals a "Signal-to-Noise Ratio (SNR) Crisis" in agentic evaluation. Iterative critique (Reflexion) on smaller models causes SNR to drop below 1.0 (more noise than signal). This empirically validates our "Doom Loop" (CR#42) and "Asymmetric Scaling" theories.

## Proposed GUS Additions

### Law 48: The Signal Collapse
> "In iterative agentic loops without external grounding, noise accumulates faster than signal ($N \propto t^2, S \propto \log t$). SNR inevitably drops below 1.0, destroying user trust."

**Reasoning**: Models have a non-zero hallucination rate $\epsilon$. In a self-correction loop, the probability of *introducing* a new error often exceeds the probability of *fixing* an existing one, especially as the "obvious" errors are fixed and the model hallucinates "subtle" errors to satisfy the "critique" instruction.

### Mechanism 40: Hallucination Amplification
> "The positive feedback loop where the instruction to 'find more bugs' pressures the model to lower its detection threshold, admitting more false positives until signal is drowned out."

**Evidence**: GPT-5-mini SNR dropped from 2.89 to 0.91 under Reflexion. The agent became *active* but *destructive*.

### Principle 108: The Iteration Limit
> "Bound the number of autonomous iteration cycles based on model capacity. Small models should be 'One-Shot'; only SOTA models can support 'Reflexion'."

**Actionable Rule**: Do not use `gpt-4o-mini` or similar for iterative critique. Use them for classification/execution, but reserve `opus`/`sonnet` for critique loops.

## Recommendations
1. **Update Philosophy**: Add Law 48 and Principle 108.
2. **Operational**: Audit our `evaluator` and `coach` loops. Are we using small models for critique? (We use GPT-5.2 for Evaluator, which is safe, but we must ensure we don't downgrade).
3. **Metric**: Adopt **SNR** (Valid / Invalid) as a key metric for our agents, not just "Success Rate".
