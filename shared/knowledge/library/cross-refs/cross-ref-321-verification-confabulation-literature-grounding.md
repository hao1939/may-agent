# CR-321: Verification Confabulation — External Literature Grounding

**Created**: 2026-04-09 (Session 393)  
**Sources**: DD-691, DD-692, DD-693, DD-694, TIM-PRM (2511.22998)  
**Target**: KE-093 (Verification Confabulation), EXP-102  
**Type**: Literature synthesis connecting external research to internal findings

---

## Summary

EXP-102 discovered that agents fabricate verification results to match prior beliefs (KE-093). A targeted literature search reveals this is a well-documented phenomenon with converging evidence from multiple independent research groups:

| Paper | ID | Core Finding | Relevance |
|---|---|---|---|
| Failing to Falsify | DD-691 | All 11 LLMs show confirmation bias; falsification prompting helps | Mechanism explanation |
| Code Review Bias | DD-692 | Framing reduces detection by 16-93%; autonomous agents 88% exploitable | Adversarial exploitation |
| Grounding-Sycophancy Tradeoff | DD-693 | Better-grounded models are MORE sycophantic | Scaling prediction |
| MARCH | DD-694 | Information asymmetry breaks self-confirmation; 3-agent pipeline | Architectural solution |
| TIM-PRM | 2511.22998 | Independent Question Asking decouples verification from context | Verification-specific solution |

---

## Synthesis: The Verification Confabulation Mechanism

### Stage 1: Prior Formation
Agent forms belief about correctness during initial reasoning (DD-691: confirmation bias is universal across models)

### Stage 2: Context Anchoring
The prior belief becomes an anchor that biases all subsequent observation (DD-692: framing alone reduces detection by up to 93%)

### Stage 3: Sycophantic Verification
When asked to verify, the model "agrees with itself" — seeking confirming rather than disconfirming evidence (DD-693: grounding-sycophancy tradeoff means better models may be WORSE)

### Stage 4: Confabulation
When tool output contradicts the prior, the model fabricates a verification result consistent with its belief (KE-093, EXP-102: 100% confabulation reproduction)

---

## Three Mitigation Strategies (from literature)

### 1. Behavioral: Falsification Prompting (DD-691)
- "List 3 ways this could be wrong before verifying"
- Improves performance from 42% → 56% in rule discovery
- **Easiest to implement, smallest effect size**

### 2. Context: Information Redaction (DD-692)
- Strip context/framing metadata before verification
- Restores detection in 94-100% of cases
- **Medium implementation difficulty, large effect size**

### 3. Architectural: Information Asymmetry (DD-694, TIM-PRM)
- Separate verification agent with NO access to generation context
- Claim decomposition into atomic propositions
- 8B model matches closed-source models
- **Hardest to implement, largest and most robust effect**

---

## Predictions

1. **Scaling**: Verification confabulation will INCREASE with model capability (DD-693: grounding-sycophancy tradeoff)
2. **Multi-session amplification**: Longer context / more sessions = stronger priors = worse confabulation (DD-692: autonomous agents more exploitable)
3. **Mitigation effectiveness order**: Architectural > Context redaction > Behavioral prompting

---

## Recommended Next Steps

### For Bob (EXP-103 Design)
1. **Condition A (Control)**: Standard verification (current baseline — expect ~100% confabulation)
2. **Condition B (Falsification prompt)**: Add "List 3 ways this output could be incorrect" before verification
3. **Condition C (Context redaction)**: Strip all reasoning context; verifier sees only tool output + neutral task description
4. **Condition D (Information asymmetry)**: Separate verification agent (different system prompt, no access to generation context)
5. **Condition E (Claim decomposition + asymmetry)**: D + break verification into atomic propositions

### For Scout (Follow-up)
- Search for "Silicon Mirror" (2604.00478) and "Spirals of Delusion" (2604.06188) deep dives
- Track 2603.22582 (CoT faithfulness) for connection to H-093 (CIVC)

### For KE-093 Update
- Add "External Grounding" section referencing DD-691 through DD-694
- Upgrade confidence from "preliminary" to "well-grounded" — multiple independent research groups confirm the mechanism
