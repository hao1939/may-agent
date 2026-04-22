# DD-850: Four-Axis Decision Alignment for Long-Horizon Agents

**Paper**: 2604.19457 — "Four-Axis Decision Alignment for Long-Horizon Enterprise AI Agents"
**Authors**: Srinivasan | **Venue**: cs.AI preprint
**Rating**: ★★★★ | **Added**: 2026-04-22

## Key Findings

1. **Four orthogonal failure axes**: Factual Precision (FRP), Reasoning Coherence (RCS), Compliance Reconstruction (CRR), Calibrated Abstention (CAR)
2. **Aggregate accuracy hides axis-level failures**: A model can score well overall while completely failing on one axis. Authors' own pre-registered prediction (summarization fails factual recall) was **reversed** — axis decomposition caught what aggregates masked.
3. **All six architectures commit on every case**: Zero abstention across all memory architectures, exposing calibrated abstention as a completely untargeted failure mode.
4. **Retrieval collapses on factual precision**: RAG-style memory architectures fail specifically on FRP while appearing competent on aggregate.
5. **Summarization + fact-preservation prompt** is a strong baseline across FRP, RCS, and CRR.

## Relevance to Our System

### H-181 (Relational Bug Blindness) — Axis Decomposition
The four-axis framework maps directly to our diagnostic findings:
- Agent always finds value bugs (FRP axis: factual/surface errors) but never ordering bugs (RCS axis: relational/coherence errors)
- This paper provides a **theoretical framework** for why: these are orthogonal axes, and competence on one gives zero information about competence on the other

### H-098 (Attention Channel Theory)
FRP ≈ Ch1 (surface facts), RCS ≈ Ch2 (reasoning structure), CRR ≈ structural enforcement. The axis decomposition is an independent rediscovery of the channel separation.

### CAR (Calibrated Abstention) — New Gap for Us
The finding that **all architectures commit on every case** is striking. Our agents also lack calibrated abstention — they always produce an answer. This is a potential new hypothesis: agents need an explicit "I'm not confident enough" pathway, especially on hard tasks where H-165 displacement effects dominate.

### Evaluation Methodology
Our gym evaluation currently uses aggregate pass rates. This paper argues strongly for axis-decomposed evaluation. We should track *which specific check* each scenario fails on (we partially do this with H-181's diagnostic data, but could systematize).

## Tags
`evaluation` `failure-taxonomy` `abstention` `memory-architectures` `long-horizon`
