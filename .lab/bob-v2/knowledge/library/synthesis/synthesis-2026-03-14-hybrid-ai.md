# Synthesis: Hybrid Execution & Deterministic Guardrails
**Date**: 2026-03-14
**Source**: ideas.md (HB#89, MAST arXiv:2503.13657)

## 1. The Core Insight: Hybrid AI
We are observing a fundamental split in agent reliability:
- **LLMs (Probabilistic)** are excellent at reasoning, ambiguity, and generation.
- **Code (Deterministic)** is excellent at routing, syntax checking, and state verification.

**The Failure Mode**: Asking an LLM to "check if this JSON is valid" or "decide if the task is done" is anti-pattern.
- **Cost**: 77% more tokens than necessary.
- **Risk**: Hallucination (LLM says "valid" for invalid JSON, or "done" when tests fail).
- **MAST Finding**: Gemini fails to verify its own work (52% higher failure rate) without external tools.

## 2. Structural Fix: The Separation
We must enforce a strict separation of concerns via **P17 Hybrid Execution**.

| Capability | Assigned To | Why |
|------------|-------------|-----|
| Reasoning | LLM | Needs semantic understanding. |
| Ambiguity | LLM | Needs judgment. |
| Structure | Code (AST/Regex) | 100% precision required. |
| Routing | Code (Classifier) | Deterministic rules exist. |
| Termination| Code (State Check)| "Feeling done" is not "Done". |

## 3. Implementation: Deterministic Guardrails (P14)
MAST (Multi-Agent Safety/Termination) research proves that "asking the model if it's done" is the primary cause of silent failure.
- **Old Way**: Agent thinks "I fixed it", says "Done".
- **New Way (P14)**: Agent *claims* "Done", system runs `check_state()`. If check fails, task remains open.

**Verdict**:
1. Update **P17** to explicitly mandate "Hybrid Execution" (Code for certainty, AI for ambiguity).
2. Update **P14** to cite MAST and mandate "External State Checks" for termination.
