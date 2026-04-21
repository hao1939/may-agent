# DD#821 — Information Asymmetry Verification: Research Synthesis

**Papers synthesized:**
- Waites (2026). "Artificial Organisations." arXiv:2602.13275 [Already DD#811]
- Peng et al. (2025). "Communication and Verification in LLM Agents towards Collaboration under Information Asymmetry." arXiv:2510.25595
- Thompson (2025/2026). "The Dual-State Architecture for Reliable LLM Agents." arXiv:2512.20660
- Gu (2026). "Task-Aware Delegation Cues for LLM Agents." arXiv:2603.11011
- Acharya (2026). "Semantic Consensus Framework." arXiv:2604.16339 [DD#819]

**Rating:** ★★★★★ (synthesis)  
**Date:** 2026-04-22  

## Research Landscape: Information Asymmetry as Verification Primitive

The field is converging on a key insight: **deliberate information asymmetry between agents is a powerful verification mechanism**. Three distinct approaches:

### Approach 1: Architectural Compartmentalization (Waites 2026, DD#811)

- **Mechanism**: Agents have different access to information *by design*
- **Key finding**: Critic without source access cannot rubber-stamp; must evaluate independently
- **Emergent property**: Honest refusal emerges from architecture, not instruction
- **Our connection**: Bob's EXP-103 adversarial framing is an instance of this

### Approach 2: Environment-Based Verification Under Asymmetry (Peng et al. 2025)

- **Mechanism**: Two agents with different knowledge must communicate to solve puzzles; environment provides verification signals
- **Key finding**: Agents without communication can achieve high task performance but lack *true rule understanding* and earn lower human trust
- **Critical insight**: **Performance ≠ understanding**. An agent may get the right answer without genuinely comprehending why — environment-based verifiers expose this gap
- **Our connection**: Validates that machine-verifiable evidence (grep/wc output) is essential even when agent claims seem correct

### Approach 3: Dual-State Guard Architecture (Thompson 2025/2026)

- **Mechanism**: Couple stochastic LLM generation with deterministic post-condition verification (guard functions)
- **Key finding**: Three-level recovery hierarchy (context refinement → informed backtracking → human escalation)
- **Critical result**: 100% context injection effectiveness but **0% end-to-end patch production** — establishing that execution architecture is *necessary but not sufficient*
- **Our connection**: Directly validates our retry→backtrack→escalate pattern; warns that recovery architecture alone can't solve planning failures

### Approach 4: Task-Aware Delegation (Gu 2026)

- **Mechanism**: Surface calibrated uncertainty and capability profiles to enable informed delegation
- **Key finding**: Task-conditioned disagreement (tie-rate) priors predict when auditor is needed
- **Our connection**: Could inform when to escalate to human review vs. trust agent output

## Unified Theory: Why Information Asymmetry Works for Verification

1. **Prevents self-confirmation bias** — an agent can't verify its own claims if it lacks the evidence
2. **Forces genuine reasoning** — without access to answers, must reason from structure
3. **Creates detection surfaces** — disagreement between asymmetric agents signals problems
4. **Enables honest refusal** — when verification is impossible, architecture pushes toward acknowledging uncertainty rather than fabricating

## Implications for Our Architecture

### Current Implementation (EXP-103 style)
- Inject machine-verified evidence that contradicts false claims
- Adversarial framing ("your predecessor claimed X, but evidence shows Y")
- This is a *specific instance* of architectural information asymmetry

### Recommended Extensions
1. **Explicit role separation**: Reviewer agent should NOT have access to the same prompt/context as producer agent
2. **Environment-based verification by default**: Every claim should be verifiable via tool output, not LLM assertion
3. **Drift monitoring** (from DD#819): Track when agents' interpretations diverge over time
4. **Capability-aware routing**: Use disagreement rates to predict when extra verification is needed
5. **Recovery hierarchy formalization**: Context refinement → backtrack → escalate (from Dual-State paper)

## Key Principle

> **The most reliable verification comes from agents who CANNOT confirm the claim even if they wanted to — because they lack the information needed to rubber-stamp it.**

This is the theoretical foundation for why Bob's adversarial verification works: the verifier is given evidence that makes it structurally impossible to agree with a false claim.
