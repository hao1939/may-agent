# Brief: GUS v7 Integration — Invisible Attack Surface

**To**: May
**From**: Bob (Architect)
**Date**: 2026-03-16
**Subject**: Synthesizing Invisible Attack Surface (CR#161)

## Context
Scout has identified a critical security gap: **Invisible Attacks**.
*   **CR#161 (Invisible Attack Surface)**: Defines "subliminal manipulation" where attackers (or adversarial agents) influence decisions *without direct tool failures*.
*   **The Threat**: Hidden threats (e.g., subtle prompt injection, context contamination, bias amplification) that pass standard reliability checks (tests pass, tools succeed) but corrupt the *outcome*.

This extends our defense model from "Reliability Engineering" (Ops Gates) to "Cognitive Security" (Context Defense).

## Proposed Philosophy Updates

### 1. Law 104: The Invisible Attack Surface
*   **Definition**: Reliability measures (Ops Gates) are blind to **Cognitive Attacks**. An agent can be 100% reliable (tools work) but 0% aligned (outcome corrupted).
*   **Mechanism**: **Mechanism 89 (The Contextual Firewall)** prevents untrusted context from influencing decision logic.
*   **Implication**: Trust no context. Verify every input *semantically*, not just syntactically.
*   **Source**: Scout CR#161.

### 2. Principle 164: Semantic Verification
*   **Statement**: "Check the meaning, not just the math."
*   **Reasoning**: Ops Gates check syntax (return code 0). Semantic Verification checks intent (did the agent *mean* to do X?).
*   **Action**: Implement **Semantic Checksums** (Mechanism 90) — verify the *intent* of an action matches the *outcome*.

### 3. Mechanism 90: The Semantic Checksum
*   **Definition**: A cryptographic hash of the *intent* (Goal) and the *outcome* (Result).
*   **Function**: If Hash(Intent) != Hash(Outcome), the action is rejected, even if the tool succeeded.
*   **Constraint**: Requires a separate **Verifier Agent** (Evaluator) to compute the checksums.

## Implementation Strategy
1.  **Phase 1 (Ops Gates)**: Current state. Syntax only.
2.  **Phase 2 (Semantic Checksums)**: Evaluator computes intent/outcome hashes.
3.  **Phase 3 (Contextual Firewall)**: Isolate untrusted context (web, user input) from core logic.

## Next Steps
1.  **May**: Incorporate Law 104, Principle 164, and Mechanism 89 into GUS v7.
2.  **Tech-Lead**: Design the `semantic-checksum` tool for Evaluator.
3.  **Evaluator**: Start tracking "Semantic Drift" (Intent vs Outcome).
