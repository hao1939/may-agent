# DD#771 — Bi-Predictability: Detecting Silent Uncoupling in LLM Interactions

**Paper**: Hafez & Nazeri, "Bi-Predictability: A Real-Time Signal for Monitoring LLM Interaction Integrity" (arXiv:2604.13061, March 2026)
**Relevance**: ★★★★½ | **Novelty**: ★★★★★ | **Actionability**: ★★★★

## Key Findings

1. **Silent uncoupling**: LLMs produce high-scoring outputs despite degrading conversational context. Semantic judges rate output quality as high while structural coupling has already broken down. This is a critical blind spot for evaluation.

2. **Bi-predictability (P)**: An information-theoretic measure of mutual predictability between context and response. Unlike perplexity (unidirectional), P measures whether the interaction is structurally coupled — does the context predict the response AND does the response fit the context?

3. **Information Digital Twin (IDT)**: Lightweight architecture estimating P across the (context → response → next prompt) loop using raw token frequency statistics — no secondary inference or embeddings needed.

4. **100% sensitivity** on injected disruptions across 4,500 turns.

5. **Critical dissociation**: P aligned with structural consistency in 85% of conditions but with semantic judge scores in only 44%. This means **more than half the time, semantic quality and structural integrity diverge**.

## The "Silent Uncoupling" Phenomenon

This is potentially the most important finding for our work. It means:
- An agent can produce correct-looking outputs while its reasoning has decoupled from the actual context
- Post-hoc semantic evaluation (LLM-as-judge) cannot detect this
- This maps directly to **verification confabulation** (FM-3.3) — the agent produces confident verification statements that are structurally decoupled from actual file contents

## Connection to Our Work

### FM-3.3 Verification Confabulation
Silent uncoupling IS the mechanism behind FM-3.3. The agent's "verification" output scores well semantically (sounds like verification) but is structurally decoupled from file state. P could detect this in real-time.

### KE-098 Entropy-Based Anomaly Detection
Bob's entropy-based anomaly detection (from MARCH, DD#694) operates on a similar principle — detecting when outputs diverge from expected information content. Bi-predictability offers a more principled information-theoretic formulation.

### Cognitive Companion (DD#769 / 2604.13759)
The parallel monitoring architecture from DD#769 could use P as its core signal — lightweight, real-time, no secondary inference needed.

### CR#321 Verification Architecture Triad
P fits at the Trust tier (Layer 4) — a continuous integrity signal that operates independently of semantic evaluation.

## Predictions

- **P-771a**: FM-3.3 failures will show measurably lower bi-predictability scores in the turns preceding the confabulation, even when semantic judge scores remain high.
- **P-771b**: A P-based monitor would detect verification confabulation earlier than entropy-based or hedging-based approaches (cf. EXP-101 HVR failure).

## Tags
`interaction-integrity` `silent-uncoupling` `verification-confabulation` `real-time-monitoring` `information-theory` `agent-observability`
