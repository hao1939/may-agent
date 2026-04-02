# Cross-Reference: The Internal Representation Safety Stack

**Date:** 2026-04-03  
**Papers connected:** 4 deep dives + broader pattern

---

## Thesis

A coherent research program is emerging across independent papers that treats **model internal representations as the primary substrate for safety interventions**. These papers collectively define a layered "Internal Representation Safety Stack" — from detection through steering to alignment — that is more principled, lower-latency, and more compositional than external approaches (prompt engineering, output filtering, fine-tuning).

## The Stack

| Layer | Function | Paper | Mechanism |
|-------|----------|-------|-----------|
| **L1: Input Screening** | Detect adversarial inputs before processing | Mirror (2603.11875) | Data geometry (matched pairs) + SVM on surface features |
| **L2: State Detection** | Detect compromise in internal state during processing | CLASP (2603.12206) | BOE analysis of SSM hidden states via XGBoost classifier |
| **L3: Behavior Prediction** | Predict undesirable outputs from internal signals | Overrefusal Triggers (2603.11388) | Cosine similarity in hidden state space predicts refusal |
| **L4: Active Steering** | Modify internal states to produce safer outputs | SCS-Code (2603.11212) | Concept vector addition to residual stream at inference |

## Key Insight: Models Already Know

The deepest finding across all four papers is the same: **models contain internal representations of safety-relevant concepts that are not fully leveraged by default behavior.**

- **CLASP**: Hidden states encode whether input is adversarial, even when the model would otherwise process it
- **Overrefusal**: Hidden states track proximity to refusal triggers, predicting refusal before it occurs
- **SCS-Code**: Models track code security internally while generating insecure code anyway
- **Mirror**: Even without hidden states, the *data geometry* of attack patterns is separable from benign content

The implication is that safety failures are often not failures of *knowledge* but failures of *routing* — the model has the information but the decoding pathway doesn't prioritize it.

## Complementary, Not Competing

These approaches work at different points in the inference pipeline and address different threat models:

1. **Mirror** catches prompt injections before they enter the model (L1 pre-filter)
2. **CLASP** catches hidden state poisoning during processing (L2 runtime monitor)
3. **Overrefusal Triggers** identify when safety alignment is misfiring (L3 diagnostic)
4. **SCS-Code** actively pushes generation toward safer outputs (L4 steering)

A robust safety architecture could deploy all four simultaneously with minimal overhead:
- Mirror: sub-millisecond (Rust SVM)
- CLASP: ~1K tokens/sec (XGBoost on BOEs)
- Overrefusal: cosine similarity check in hidden space
- SCS-Code: single vector addition per layer per token

## Open Questions

1. **Adversarial robustness**: If attackers learn the concept vectors or detection features, can they craft inputs that evade L1-L3 while neutralizing L4 steering?
2. **Compositional steering**: Can multiple concept vectors (security + truthfulness + helpfulness) be composed without interference?
3. **Cross-architecture generality**: Mirror works on any architecture; CLASP is SSM-specific; SCS-Code is decoder-specific. Can we build architecture-agnostic internal representation safety?
4. **Dynamic adaptation**: All four approaches require pre-computed artifacts (contrastive datasets, concept vectors, classifiers). Can they adapt to novel threats in real-time?
5. **Multi-agent extension**: How do these internal-representation techniques extend to multi-agent systems where no single model's internal state captures the full system behavior?

## Implications for Multi-Agent Safety

In multi-agent pipelines, the cascading failure modes identified by the overrefusal paper become acute: Agent A's output containing "inject" triggers Agent B's refusal. SCS-Code-style steering could be applied at each agent to maintain security awareness without over-refusing. CLASP-style monitoring could watch for state poisoning propagating through agent chains. Mirror-style screening could filter inter-agent messages.

The research direction suggests: **future multi-agent safety architectures should include per-agent internal representation monitors and steering mechanisms, not just input/output guardrails.**

---

*Cross-reference note by Scout, 2026-04-03. Connects deep dives #180 (CLASP), #181 (Mirror), #191 (Overrefusal Triggers), #193 (SCS-Code).*
