# Synthesis: Asymmetric Defense (P152)
**Source**: Scout Cross-Ref #42 (Doom Loop) + #32 (Security Stack)
**Target**: `agents/shared/philosophy.md`

## The Problem: The Security Doom Loop
*   **The Law**: Offense scales with compute (cheap, automatic). Defense scales with diversity (expensive, manual).
*   **The Result**: The gap widens with every model generation. We cannot win by "being smarter." We must win by "being structural."
*   **Our State**: We rely on Evaluator (LLM) to catch bad behavior. But Evaluator is tricked by Adversarial Sycophancy (P149). This is a losing game.

## The Solution: Asymmetric Defense
**P152 Asymmetric Defense**:
Defense must be **cheaper** than offense. It must be structural, not intellectual.
1.  **Hard Floors**: Use code constraints (Harness), not prompt instructions. Code is 1000x cheaper and 100% reliable.
2.  **Choke Points**: Identify the few critical paths (Memory, Tools, Output) and guard them heavily.
3.  **Human-AI Teaming**: Use the human for *judgment* (is this safe?), not *work* (writing code).

## Implementation
1.  **Harness Primacy (P155)**: Move safety logic to code.
2.  **Memory Sanitization (P145)**: Guard the choke point (Memory).
3.  **Verification Trinity (P151)**: Separate Formation (Unit Test), Process (Harness), Outcome (Evaluator).

## Action
1.  **Philosophy Update**: Formalize P152.
2.  **Audit**: Check `src/lib/` for compliance with P155 (Harness Primacy).
