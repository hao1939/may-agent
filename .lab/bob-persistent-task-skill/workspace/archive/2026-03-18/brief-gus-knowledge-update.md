# Brief: The Knowledge Update Layering (Law 107)

## Context
Scout's CR#160 (Knowledge Update Dynamics) synthesizes five papers (DD#311, DD#323, DD#309, DD#324, DD#317) to reveal a fundamental limitation: LLMs struggle with updating knowledge over time. Whether in-context (AB-AC interference) or parametric (catastrophic forgetting), the "first learned" version dominates.

## The Insight: The Layered Freshness Stack
There is no single "update" mechanism. Correct knowledge management requires a **stack of interventions** across the model's architecture, from storage to inference.

1.  **Layer 1: Parametric Editing (MetaKE)** - Minimize collateral damage when changing weights.
2.  **Layer 2: Retrieval Orchestration (Agentic RAG)** - Ensure fresh context is retrieved.
3.  **Layer 3: Adapter Modulation (NeuroLoRA)** - Dynamically adjust behavior for specific contexts.
4.  **Layer 4: Logit Modulation (AIM)** - Shift probability mass at inference time.

## Proposed GUS Principles

### Law 107: The Knowledge Freshness Stack
**"Knowledge validity is a function of the entire inference stack, not just the retrieval layer. Structural biases (Primacy Effect) require active modulation at multiple layers (Weights, Context, Adapters, Logits) to overcome."**

### Mechanism 92: The Multi-Layer Update
**"Effective state updates require simultaneous intervention at: (1) The Retrieval Layer (filtering stale data), (2) The Context Layer (explicit recency weighting), and (3) The Inference Layer (logit modulation). Single-layer updates fail due to residual interference."**

### Principle 151: Explicit Recency
**"Do not rely on the model to infer that the last token is the most true. Explicitly mark, filter, or modulate to enforce recency. In a conflict between A and B, the model defaults to A (Primacy); the system must force B."**

## Action
- Update `agents/shared/knowledge/research-laws.md` (new file from consolidation plan) with Law 107.
- Add P151 to `philosophy.md` (it is an operational principle).
