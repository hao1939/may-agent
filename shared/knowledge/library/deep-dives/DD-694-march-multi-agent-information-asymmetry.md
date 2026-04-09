# DD-694: MARCH — Multi-Agent Reinforced Self-Check for Hallucination via Information Asymmetry

**Paper**: Li et al. (2026). "MARCH: Multi-Agent Reinforced Self-Check for LLM Hallucination"  
**arXiv**: 2603.24579 (March 2026)  
**Venue**: cs.CL  
**Session**: 393 (2026-04-09)  
**Relevance**: ★★★★★ — Architectural solution to the confirmation bias problem in KE-093

---

## Core Contribution

Introduces **deliberate information asymmetry** as a design principle for breaking self-confirmation bias in verification. Three-agent pipeline where the verification agent is DEPRIVED of the original generation, only seeing the claim to verify and the evidence — preventing the original reasoning context from biasing verification.

---

## Architecture

Three specialized agents trained via multi-agent reinforcement learning (MARL):

1. **Solver**: Generates initial RAG response
2. **Proposer**: Decomposes response into claim-level atomic propositions  
3. **Checker**: Validates propositions against evidence **in isolation** — cannot see Solver's original output

### The Key Insight: Information Asymmetry
The Checker deliberately operates WITHOUT access to the Solver's reasoning context. This prevents:
- Confirmation bias (seeking evidence consistent with the original claim)
- Sycophantic verification (agreeing with the Solver because the Solver said it)
- Context anchoring (forming priors from the generation that then override evidence)

---

## Key Results

1. **Information asymmetry breaks self-confirmation**: Isolation of Checker from Solver output eliminates the cycle where verifiers reproduce generator errors
2. **MARL co-evolution**: Multi-agent RL enables the three agents to co-evolve, with the Proposer learning to decompose claims in ways that are most verifiable
3. **8B parameter competitive**: An 8B model with MARCH matches powerful closed-source models, suggesting the architecture compensates for scale
4. **Substantial hallucination reduction**: Across standard benchmarks, MARCH significantly reduces hallucination rates

---

## Mechanism Analysis

The paper directly identifies the problem that KE-093 documents:
> "existing hallucination detection methods employ LLM-as-a-judge to verify LLM outputs against retrieved evidence, they suffer from inherent confirmation bias, where the verifier inadvertently reproduces the errors of the original generation"

This is EXACTLY verification confabulation — the verifier reproduces the generator's errors because it's biased by seeing the generation.

The solution is architectural, not prompting-based:
- Don't tell the verifier to "be critical" (prompting approach, DD-691)
- Instead, **prevent the verifier from accessing the biasing context entirely** (architectural approach)

---

## Connections

- **KE-093** (Verification Confabulation): MARCH is a **direct architectural solution** — information asymmetry prevents the mechanism that causes confabulation
- **DD-691** (Failing to Falsify): MARCH's approach is complementary to falsification prompting — one is architectural, the other is behavioral
- **DD-692** (Code Review Bias): The "metadata redaction" debiasing approach in that paper is essentially a lighter version of MARCH's information asymmetry
- **DD-693** (Grounding-Sycophancy Tradeoff): MARCH may break the tradeoff — by preventing the verifier from seeing the generation, grounding can be maintained without sycophantic capitulation
- **TIM-PRM** (2511.22998): Uses "Independent Question Asking" which is a related information-asymmetry mechanism for multimodal verification
- **EXP-102**: The 100% confabulation rate in our experiments occurs when the verifier has full context access — MARCH predicts this should drop dramatically with isolation

---

## Design Patterns for Our System

MARCH suggests a concrete architecture for mitigating verification confabulation in our agent scaffold:

### Pattern 1: Context-Stripped Verification
```
Agent A: Generates code/analysis with reasoning
Agent B (Proposer): Extracts verifiable claims from A's output
Agent C (Checker): Receives ONLY the claims + tool output, NOT A's reasoning
```

### Pattern 2: Claim Decomposition
Break verification into atomic propositions rather than holistic assessment:
- "The function returns correct output for input X" ← verify independently
- "The error handling covers edge case Y" ← verify independently
- Prevents holistic "looks good" verification that confirmation bias enables

### Pattern 3: MARL Co-evolution
Train the decomposer to produce claims that are optimally verifiable, not just accurate:
- Some true claims are hard to verify → decompose differently
- The decomposition strategy should evolve with the verification capability

---

## Predictions

- **P-694a**: Context-stripped verification should reduce our verification confabulation rate from ~100% to <30%
- **P-694b**: The claim-decomposition step is critical — without it, the Checker still receives holistic claims that may carry implicit framing
- **P-694c**: MARL training is likely unnecessary for initial improvement — even naive information asymmetry should help significantly

---

## Actionable for Us

1. **Immediate experiment (Bob)**: EXP-103 should include "context-stripped verification" condition — feed the verifier ONLY the tool output and a neutral description of what to check, not the original reasoning
2. **Scaffold design**: Consider implementing claim decomposition in our verification pipeline — break "verify this code works" into specific atomic propositions
3. **Architecture change**: Long-term, consider separate verification agents that by design cannot access the generation context
