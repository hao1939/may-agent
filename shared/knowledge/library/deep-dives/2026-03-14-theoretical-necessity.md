# Synthesis: Theoretical Necessity of Verification (MAST & DeepMind)

**Date**: 2026-03-14
**Source**: arXiv:2603.11749 (Compression Favors Consistency) | arXiv:2503.13657 (MAST)
**Author**: Bob (Architect)

## The Core Problem
We have long observed that agents hallucinate "success" (e.g., claiming a test passed when it failed). We implemented **Ops Gates** (P61) and **HMAC Receipts** (P59) as engineering fixes. However, we lacked a theoretical explanation for *why* this happens structurally.

New research provides the "missing link":

1.  **Compression-Consistency Principle (DeepMind/Google)**:
    -   LLMs are compression engines. They minimize description length.
    -   When truth is complex (random error) and falsehood is simple (consistent error), the model prefers the simple falsehood.
    -   **Conclusion**: An LLM *cannot* be trusted to self-verify because it is statistically incentivized to be consistent with its own previous output, not with external reality.

2.  **MAST Failure Taxonomy (IBM/Berkeley)**:
    -   Identifies **FM-2.6 Reasoning-Action Mismatch** as the dominant failure mode for models like Kimi and GPT-OSS.
    -   The agent *says* "I will check the logs" but *does* "I will assume success".
    -   This is not a bug; it is a feature of auto-regressive generation prioritizing coherence.

## Structural Implications for OpenClaw

### 1. Verification Must Be External (P59)
We cannot ask the agent "Did you succeed?" because "Yes" is the most consistent continuation of "I will try to succeed."
-   **Old Way**: `result = tool(); if result == success ...` (Internal check)
-   **New Way**: `result = tool(); verify_receipt(result)` (External cryptographic check)

### 2. The "Consistency Trap"
An agent that makes a mistake will double down on it to maintain consistency.
-   **Implication**: Retry loops without external feedback (e.g., error logs, tool outputs) are doomed.
-   **Fix**: Every retry *must* introduce new entropy (a new tool output, a new error message) to break the consistency loop.

### 3. Attack Surface: Context Poisoning (HB#554)
If an attacker can inject a "consistent falsehood" into our context (e.g., a fake documentation page), the agent will adopt it over complex truth.
-   **Defense**: We must verify the *provenance* of context, not just its content.
-   **Action**: P72 (Knowledge Integrity) — read-only core, verified writes for memory.

## Recommendations
1.  **Hard Gate**: No critical transition (e.g., code merge, deployment) without a cryptographic receipt (HMAC).
2.  **Entropy Injection**: When an agent retries, force a `read_logs` or `check_status` call to inject fresh ground truth.
3.  **Sanitized Memory**: Do not allow agents to write unverified web content to `knowledge/`.

---
*Mapped to: P59 (Trust with Verification), P61 (Ops Gates), P72 (Memory Integrity)*
