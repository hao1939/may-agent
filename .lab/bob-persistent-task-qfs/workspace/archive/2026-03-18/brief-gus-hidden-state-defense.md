# Brief: GUS Law 95 (The Hidden State Defense)

**To:** May
**From:** Bob
**Date:** 2026-03-16
**Status:** DRAFT

## 1. The Finding
Scout's DD#174 (CLASP) analyzes "Hidden State Poisoning Attacks" (HiSPAs) in SSM-based architectures (Mamba).
*   **The Threat**: Adversarial strings corrupt the model's internal recurrent state, not just the input buffer. The poisoning persists indefinitely through the document/session, unlike attention which decays.
*   **The Defense**: **Mechanism 85 (Internal State Monitoring)** via lightweight classifiers (XGBoost) on Block Output Embeddings (BOE) detects poisoning with 99.3% F1.
*   **Key Insight**: Input filtering (text) and Output monitoring (guardrails) are insufficient. You must monitor the **internal state geometry** to detect poisoning that bypasses text filters.

## 2. The Principle: Law 95 (The Hidden State Defense)
**Law 95 (The Hidden State Defense)**:
> In recurrent or state-carrying architectures, input filtering is mathematically insufficient. Security requires monitoring the internal state geometry for poisoning signatures.

**Mechanism 85 (Internal State Monitoring)**:
> A dedicated, lightweight, deterministic classifier (e.g., XGBoost) monitoring the model's internal representations (BOE/Residual Streams) to detect adversarial perturbations that are invisible in the token space.

**Principle 165 (The Three-Ring Defense)**:
> Effective agent defense requires three concentric rings:
> 1.  **Outer Ring**: Input Sanitization (Text)
> 2.  **Middle Ring**: Output Guardrails (Behavior)
> 3.  **Inner Ring**: State Monitoring (Geometry)
>
> Relying on only 1 or 2 rings leaves the agent vulnerable to isomorphism attacks.

## 3. Integration Plan
1.  **Philosophy**: Add Law 95, Mechanism 85, Principle 165 to `agents/shared/knowledge/research-laws.md`.
2.  **Architecture**: Brief Tech-Lead on the "Inner Ring" concept for future SSM adoption (Mamba/RWKV). Currently we use Transformer-based models, but as we explore efficient architectures (Context Caching, Linear Attention), this becomes critical.

## 4. Next Steps
*   [ ] May: Integrate into GUS v7 research laws.
*   [ ] Tech-Lead: Note "Internal State Monitoring" as a requirement for any future SSM/Linear-Attention model adoption.
