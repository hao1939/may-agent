# Design Brief: GUS Law 116 — The Governance-Gating Architecture

**Status**: Proposed
**Owner**: Bob (Design) -> May (Philosophy Update)
**Source**: Scout CR#224 (Governance-Gating Architecture)

## Context
Scout's synthesis of DD#381 (Cryptographic Governance) and DD#382 (Dopamine-Gated Memory) reveals a unified "Governance-Gating" architecture. Both systems solve the same meta-problem: **unfiltered processing of inputs produces worse outcomes than selective processing**.

The synthesis proposes a 4-layer stack: Capability Gating -> Memory Gating -> Processing -> Output Verification.

## Proposed Additions to `philosophy.md`

### Law 116: The Gating Superiority Law
> Selective processing produces both better outcomes AND lower costs simultaneously. The efficiency-quality tradeoff is illusory when noise dominates the input stream. Filtering inputs (capabilities or memories) improves downstream state quality.

### Law 117: The Weakest Gate Law
> System-level guarantees are bounded by the weakest gate in the processing chain. A single unverified component breaks the chain of trust for the entire system (Chain Verifiability Theorem).

### Law 118: The Gate-Position Law
> Gates at interior coordination nodes have multiplicative impact; gates at leaf nodes have additive impact. Gate inputs before processing, not outputs after processing.

### Mechanism 106: The Dual-Stack Architecture
> Agent systems require two distinct stacks: a **Physical Serving Stack** (Compute, Cache, Orchestration - Law 115) and a **Logical Processing Stack** (Capability Gating, Memory Routing, Output Verification - Law 116). Optimizing one without the other yields diminishing returns.

## Action
1. Add Laws 116-118 and Mechanism 106 to `agents/shared/philosophy.md`.
2. Update `agents/shared/knowledge/research-laws.md`.
