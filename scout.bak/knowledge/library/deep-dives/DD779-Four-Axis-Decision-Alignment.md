# DD779: Four-Axis Decision Alignment for Long-Horizon Enterprise AI Agents

**Paper:** 2604.19457  
**Authors:** Vasundra Srinivasan  
**Date triaged:** 2026-04-23  
**Relevance:** ★★★★☆ (high)

## Summary

This paper argues that evaluating long-horizon agents with a single task-success scalar hides critical failure modes. It decomposes decision behavior into **four orthogonal alignment axes**:

1. **Factual Precision (FRP):** Does the agent get the facts right from its memory/retrieval?
2. **Reasoning Coherence (RCS):** Are the reasoning steps logically valid given the facts?
3. **Compliance Reconstruction (CRR):** Can the agent reconstruct and follow regulatory/procedural constraints?
4. **Calibrated Abstention (CAR):** Does the agent know when NOT to decide?

## Key Findings

- **Retrieval architectures collapse on factual precision** — they retrieve the wrong facts confidently.
- **Schema-anchored architectures pay a "scaffolding tax"** — structure overhead hurts other axes.
- **Plain summarization with fact-preservation prompt is surprisingly strong** across FRP, RCS, and CRR.
- **ALL six tested architectures commit on every case** — zero abstention. This is the paper's most striking finding: agents don't know when to say "I don't know."
- **Axis-level reversal hidden by aggregate accuracy** — summarization was predicted to fail factual recall but actually excelled, a reversal invisible in single-scalar metrics.

## Connections to Our System

### Verification Gravity Wells (FM-3.3)
The "zero calibrated abstention" finding maps directly to our verification gravity well problem (EXP-099, H-072). Agents get stuck in error-compounding loops partly because they **never abstain** — they always commit to a verification path even when their beliefs are corrupted. The CAR axis gives us a measurable way to detect this.

### Guard Architecture (KE-106)
Our guards check outputs but not decision confidence. Adding a CAR-like axis to guard evaluation could catch cases where agents are confidently wrong — the exact failure mode guards currently miss.

### Belief-State Externalization (H-072)
The FRP axis directly measures what H-072 proposes to fix: corrupted beliefs that compound. If we externalize beliefs, we could score them on FRP before they cascade.

### Multi-Axis Evaluation
We currently evaluate agents on task success (single scalar). This paper's framework suggests we should decompose into at least: factual correctness, reasoning validity, rule compliance, and abstention quality.

## Actionable Ideas

1. **Add abstention capability to verification agents** — give them explicit "confidence too low, escalating" paths
2. **Decompose our eval metrics** along the four axes instead of single task-success
3. **Test if fact-preservation prompts** in context passing reduce verification gravity wells (cheap experiment)

## Status
Triaged. Recommend hypothesis on calibrated abstention.
