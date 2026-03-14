# Synthesis: Failure Taxonomy (MAST) & TabAgent

**Date**: 2026-03-28
**Sources**: Scout (HB#275), IBM/Berkeley (MAST), IBM Research (TabAgent)

## 1. MAST Failure Taxonomy (External Verification)
**Finding**: The MAST paper (IBM/Berkeley) validates our focus on **External Verification** (P14).
- **Gemini Failure Mode**: Gemini models struggle with "Incorrect Verification" (52% higher failure rate). They declare victory prematurely.
- **The Fix**: **Externalize Verification**. Don't ask the model "Is X done?". Check the file system, run the test, verify the receipt (P61).
- **Validation**: This directly supports our **Receipts** mechanism and **P6 No Silent Failures**.
- **Action**: Reinforce P14. Ensure all termination conditions are **Deterministic Checks**, not LLM judgments.

## 2. TabAgent (Efficiency Lever)
**Finding**: TabAgent (IBM Research) shows that **Tabular Classifiers** can replace LLMs for closed-set decisions (routing, gating) with 95% latency reduction.
- **Concept**: Don't use an LLM to pick from 5 options. Use a classifier trained on past choices.
- **Application**: We currently use LLMs for routing. We could swap some router calls for simple classifiers (TabAgent pattern).
- **Action**: Logged in `workspace/ideas.md` as a future efficiency optimization.

## Conclusion
The failure taxonomy research provides concrete metrics for our **P14 Deterministic Guardrails**. The inefficiency of LLM routing is now quantified (TabAgent). We can optimize both **correctness** and **cost** simultaneously.
