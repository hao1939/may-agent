# DD-691: Failing to Falsify — Evaluating and Mitigating Confirmation Bias in Language Models

**Paper**: Jhaveri et al. (2026). "Failing to Falsify: Evaluating and Mitigating Confirmation Bias in Language Models"  
**arXiv**: 2604.02485 (April 2026)  
**Venue**: cs.CL  
**Session**: 393 (2026-04-09)  
**Relevance**: ★★★★★ — Directly grounds KE-093 (Verification Confabulation)

---

## Core Contribution

Adapts the classic Wason 2-4-6 rule-discovery task from human psychology to LLMs. In this task, an agent must discover a hidden rule by proposing triples and receiving feedback — optimal strategy is to attempt falsification, but confirmation bias leads to only testing confirming instances.

**Key finding**: Across 11 LLMs of multiple families and scales, ALL exhibit confirmation bias — systematically proposing triples that confirm rather than falsify their hypothesis.

---

## Key Results

1. **Universal confirmation bias**: All 11 tested LLMs preferentially seek confirming evidence
2. **Performance impact**: Confirmation bias leads to slower and less frequent rule discovery
3. **Human-psychology interventions work**: Prompting LLMs to consider counterexamples consistently reduces confirmation bias
4. **Quantitative improvement**: Rule discovery rates improve from 42% → 56% with explicit falsification prompting
5. **Distillation generalizes**: Training models to exhibit de-biased behavior (via distillation from intervention-prompted behavior) generalizes to new tasks (Blicket test)

---

## Mechanism Analysis

The paper identifies confirmation bias as a *structural* property of LLM reasoning, not an incidental failure:
- Models form an initial hypothesis and then generate evidence consistent with it
- This mirrors human cognitive bias but has a different mechanistic origin (attention to context patterns vs. psychological motivation)
- The bias is robust across model families and scales — not a training artifact of one family

### Critical for KE-093 (Verification Confabulation)

This paper provides the **theoretical grounding** for why verification confabulation occurs:
1. Agent forms belief about code/output correctness during reasoning
2. When asked to verify, the agent seeks confirming evidence (reads tool output looking for confirmation rather than disconfirmation)
3. When tool output contradicts prior belief, the prior belief dominates → confabulation

The paper's falsification-prompting intervention maps directly to potential mitigations for KE-093:
- Explicit instruction to "try to find evidence that your current belief is WRONG"
- Independent verification agents (cf. MARCH, DD-694) that operate without access to the original reasoning context

---

## Connections

- **KE-093** (Verification Confabulation): Direct theoretical grounding — confirmation bias IS the mechanism behind verification confabulation
- **DD-694** (MARCH): Multi-agent architecture that breaks confirmation bias through information asymmetry
- **DD-693** (Grounding-Sycophancy Tradeoff): Complementary finding — well-grounded models may be MORE susceptible to context-driven confirmation
- **EXP-102**: Our experimental finding of 100% confabulation reproduction is consistent with the universality of confirmation bias across all 11 LLMs
- **H-093** (CIVC): Complexity-Induced Verification Collapse may be confirmation bias + cognitive load interaction
- **DD-682** (Trajectory Guard): Anomaly detection that could flag moments where verification behavior shifts from falsification to confirmation

---

## Predictions

- **P-691a**: Falsification prompting ("before verifying, list 3 ways this could be wrong") should reduce verification confabulation rates by 20-40%
- **P-691b**: Larger models may show MORE confirmation bias (more confident priors) — testable across Bob's EXP-102 conditions
- **P-691c**: Distillation of de-biased verification behavior should generalize across task domains (code → research → analysis)

---

## Actionable for Us

1. **Immediate**: Bob should test falsification prompting as EXP-103 condition — add "List 3 ways this output could be incorrect before making your assessment" to verification prompts
2. **Medium-term**: The distillation result suggests we could fine-tune verification behavior to be inherently less confirmation-biased
3. **Framework**: KE-093 should be updated to reference this paper as the theoretical mechanism explanation
