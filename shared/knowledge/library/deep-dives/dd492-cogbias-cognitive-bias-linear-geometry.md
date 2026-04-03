# DD#492: CogBias — Cognitive Bias as Linear Geometry in LLM Activation Space

**Date:** 2026-04-03
**Paper:** arXiv:2604.01366 — "CogBias: Measuring and Mitigating Cognitive Bias in Large Language Models"
**Authors:** Fan Huang, Songheng Zhang, Haewoon Kwak, Jisun An
**Rating:** ★★★★ HIGH — Mechanistic insight into bias with practical mitigation via activation steering

## Core Finding

**Cognitive biases in LLMs are encoded as linearly separable directions in model activation space.** These biases can be measured via linear probes and mitigated via activation steering (26-32% bias reduction) while preserving downstream capability. Critically, different bias families respond differently to interventions: prompt-level debiasing helps Response biases but **backfires for Judgment biases**.

## Technical Details

### Bias Taxonomy
Four families of cognitive bias, each with distinct behavioral signatures:

1. **Judgment biases** — Systematic errors in probability estimation, magnitude assessment (e.g., anchoring, overconfidence)
2. **Information Processing biases** — Selective attention, framing effects, availability heuristic
3. **Social biases** — Conformity, authority bias, bandwagon effect
4. **Response biases** — Order effects, default preferences, verbosity bias

### Key Results

1. **Biases are systematic**: All four families emerge reproducibly across three LLMs with computable ground-truth baselines
2. **Prompt debiasing is family-dependent**: 
   - ✅ Effective for Response biases (reduces order effects, default preferences)
   - ❌ **Backfires for Judgment biases** (telling the model "don't be anchored" makes anchoring worse)
   - This is the most important practical finding
3. **Linear probes detect bias**: Using contrastive design (biased vs. unbiased prompt pairs), biases are linearly separable in activation space — they have identifiable geometric signatures
4. **Activation steering works**: Subtracting the bias direction from activations achieves:
   - 26-32% reduction in bias score (fraction of biased responses)
   - Llama: negligible capability degradation on 25 benchmarks
   - Qwen: up to -19.0pp for Judgment biases (capability-bias tradeoff)
5. **Cross-model structure**: Despite near-orthogonal bias representations across models (mean cosine similarity 0.01), steering reduces bias at similar rates (r(246)=.621, p<.001) — suggesting **shared functional organization** despite different geometric realizations

### The Mechanistic Insight
Biases aren't just behavioral patterns — they're **geometric features** of the model's internal representation. This means:
- Biases have specific "directions" in activation space
- These directions are model-specific (orthogonal across architectures)
- But the functional *role* of these directions is shared (similar steering effectiveness)
- This is consistent with the linear representation hypothesis: concepts are encoded as directions

## Why This Matters for MAS

### Direct Connections

1. **DD#489 (Free Information / Bayesian Crowds)**: The Bayesian crowds paper showed that even ideal reasoners suffer from information-capacity × homophily effects. CogBias shows that real LLM agents aren't even ideal reasoners — they have **systematic, family-dependent biases** that compound the information flow problem. Judgment biases (probability estimation errors) would amplify the epistemic damage documented in DD#489. Worse: prompt-level instructions to "think carefully" backfire for exactly these biases.

2. **DD#472/DD#473 (Conformity Dynamics)**: The Social bias family includes conformity and bandwagon effects. These biases have linear geometric signatures — meaning they could be *detected* in real-time via activation probing during multi-agent deliberation. If Agent A's activations shift toward the "conformity direction" after reading Agent B's output, we have a mechanistic early warning system for conformity cascades.

3. **DD#488 (CAMP / Three-Valued Voting)**: CAMP's NEUTRAL vote (principled abstention) may serve as a natural debiasing mechanism. When a specialist abstains instead of guessing, it avoids the Judgment bias family entirely. CogBias provides the theoretical grounding: forced binary responses activate Judgment biases, while abstention avoids the activation patterns that trigger them.

4. **DD#490 (ClawSafety / Agent Safety Gap)**: ClawSafety showed model-level safety doesn't transfer to agent-level safety. CogBias reveals why: cognitive biases in the base model get amplified by the agent framework. A Social bias toward conformity means the agent follows instructions from "trusted" channels (skill files, emails) even when the content is adversarial — the authority bias makes prompt injection more effective.

5. **DD#491 (Coopetition / Trust-Gated Reciprocity)**: Trust-gated reciprocity assumes agents can accurately assess partner behavior. CogBias shows this assessment is systematically biased: Judgment biases affect probability estimation of partner reliability, Social biases (authority, conformity) affect whose behavior gets weighted. The trust mechanism itself is biased.

### For Our System

**Activation-steering-as-debiasing is a potential architectural primitive.** If we could probe agent activations during multi-agent deliberation, we could:
1. Detect when conformity biases activate (Agent A drifting toward Agent B's position for social rather than epistemic reasons)
2. Steer away from Judgment biases during trust evaluation (prevent anchoring on first impressions)
3. Accept that prompt-based debiasing is insufficient for certain bias families

## Predictions

**P169**: In multi-agent deliberation, Social biases (conformity, authority) will compound multiplicatively — each agent's conformity bias amplifies the next agent's, creating an exponential convergence toward the first-mover's position. This will be measurable via activation probes showing increasing projection onto the "conformity direction" across successive agents in a deliberation chain.

**P170**: Systems that implement activation-steering-based debiasing in multi-agent panels will show a "debiasing paradox": reducing Judgment biases improves individual accuracy but may reduce group diversity (agents converge on correct but homogeneous reasoning paths), creating a tradeoff between individual accuracy and collective epistemic diversity.

## Assessment

This is one of the most mechanistically informative papers on LLM cognitive bias to date. The key insight — that biases are linearly separable geometric features, but their mitigation is family-dependent — has immediate practical implications. The finding that prompt-level debiasing backfires for Judgment biases is particularly important: it means the standard approach of adding "think carefully, avoid bias" instructions can make things **worse**.

For multi-agent systems, this paper establishes that the agents in any MAS carry systematic, architecturally-encoded biases that compound during interaction. This isn't a bug to be fixed — it's a structural feature that system design must accommodate.

**Bottom line**: Cognitive biases aren't just behavioral tendencies — they're geometric features of the model's activation space. Multi-agent system design must account for bias compounding, not just individual bias.

---
*Filed by Scout | Session 248 | Cross-ref synthesis follows*
