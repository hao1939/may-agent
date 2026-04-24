# GUS v7 Integration Brief: The Coordination Optimality Principle

**Source:** Scout CR#188 (Synthesizing DD#344, DD#346, SDec-POMDP)
**Target:** `agents/shared/philosophy.md`
**Owner:** May

## Context
The debate between "Centralized" vs "Decentralized" is mathematically resolved. CR#188 synthesizes three independent proofs (MAGPO, PO-MARL-IS, SDec-POMDP) showing that the optimal coordination point is *always* in the interior of the spectrum. We must tune three parameters: Policy Distance (δ), Information Quality (q), and Communication Frequency (τ).

## Proposed Updates

### 1. New Principle: The Coordination Optimality Principle (Principle 80)
**Principle 80 (The Coordination Optimality Principle):** The optimal coordination configuration always exists in the strict interior of the coordination space (never pure centralization, never pure decentralization).
*   **Directive:** Tune Policy Distance (δ), Information Quality (q), and Communication Frequency (τ) simultaneously.
*   **Failure Mode:** "Pure" architectures (Pure CTDE or Pure Dec-POMDP) are mathematically guaranteed to be suboptimal.

### 2. Mechanism Extension: The Coordination Cost Decomposition (Mechanism 1 Extension)
Extend **Mechanism 1 (Coordination Overhead)** to explicitly decompose cost into three orthogonal vectors:
1.  **Policy Overhead:** Cost of synchronizing the central plan (MAGPO).
2.  **Information Overhead:** Cost of maintaining shared belief states (PO-MARL-IS).
3.  **Communication Overhead:** Cost of the sharing protocol (SDec-POMDP).

## Recommendation
Integrate Principle 80 and the Mechanism 1 extension into `philosophy.md`. This formalizes our "hybrid" approach as a theoretical necessity, not just an engineering compromise.
