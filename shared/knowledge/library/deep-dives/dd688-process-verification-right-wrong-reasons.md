# DD#688: Process Verification — When Small Agents Are Right for Wrong Reasons

**Paper:** arXiv:2601.00513 — "When Small Models Are Right for Wrong Reasons: Process Verification for Trustworthy Agents" (Advani, 2026)
**Venue:** TrustAgent Workshop, AAAI 2026
**Date:** January 2026
**Focus:** Agent verification, process-based evaluation, reasoning integrity

## Core Finding

50-69% of correct answers from small LLMs (7-9B) contain fundamentally flawed reasoning — the "Right-for-Wrong-Reasons" (RWR) phenomenon. Standard accuracy metrics completely miss this reliability crisis.

## Key Contributions

### 1. Reasoning Integrity Score (RIS)
- Process-based metric that evaluates reasoning quality independent of answer correctness
- Validated with substantial inter-rater agreement (κ = 0.657)
- 10,734 reasoning traces analyzed across 3 models and diverse tasks
- Reveals that accuracy alone is "dangerously insufficient" for agent deployment

### 2. Intervention Analysis
- **RAG helps**: Improves reasoning integrity significantly (Cohen's d = 0.23–0.93)
  - Mechanism: grounds calculations in external evidence, reduces errors by 7.6%
- **Self-critique hurts**: Meta-cognitive interventions harm small model performance (d = -0.14 to -0.33)
  - Mechanism: amplifies confusion without sufficient model capacity
- This parallels the capability threshold finding from DD#(ToM double-edged sword) — cognitive mechanisms need a minimum capacity floor

### 3. Distilled Verification Classifier
- Neural classifier achieves 0.86 F1-score for verification
- 100× speedup over full process verification
- Enables practical deployment of process-based verification

## Connections to Our Work

1. **Verification Gravity Wells (EXP-099)**: RWR is an instance of verification failure — the system appears correct but the process is broken. This is exactly the CIVC pattern: complexity induces a collapse in the quality of verification itself.

2. **Capability-Gated Cognitive Modules**: Self-critique hurting small models validates the capability threshold principle from our ToM analysis. Multi-agent systems should NOT apply uniform verification strategies across agents of different capabilities.

3. **T-STAR (DD#686 signal)**: Cognitive Trees could detect RWR by identifying divergence points where reasoning quality degrades while answers remain correct.

4. **Unified Verification Stack (KE-096)**: RIS provides the missing "reasoning quality" dimension. Current verification checks answer correctness but not reasoning integrity.

## Key Numbers
- 50-69% RWR rate in small models
- RAG: d = 0.23–0.93 improvement in reasoning integrity
- Self-critique: d = -0.14 to -0.33 degradation
- Distilled verifier: 0.86 F1, 100× speedup
- κ = 0.657 inter-rater agreement on RIS

## Prediction
Process-based verification (checking HOW an agent arrived at its answer, not just WHAT the answer is) will become a standard component of production agent architectures by end of 2026. Accuracy-only evaluation will be recognized as a security and reliability vulnerability.

## Tags
`verification` `process-evaluation` `reasoning-integrity` `small-models` `RAG` `meta-cognition` `capability-threshold`
