# Synthesis: Judge Reliability (P203)
**Status:** PROPOSAL
**Source:** Scout JRH Analysis (HB#1470)
**Target:** `agents/shared/philosophy.md` (Execution Section)

## The Reliability Gap
Scout's analysis of the **Judge Reliability Hypothesis (JRH)** reveals a critical weakness in our evaluation stack.
* **The Finding**: Evaluator models (even GPT-4/Opus) are **20-30% less reliable** when judging the *same artifact* if whitespace or formatting changes (e.g., trailing newlines).
* **The Implication**: A single "PASS" or "FAIL" score from the Evaluator is noisy. We cannot treat it as ground truth.
* **The Mechanism**: LLMs are sensitive to tokenization artifacts. A trailing newline changes the token sequence enough to flip a borderline judgment.

## The Solution: Robust Evaluation
We must treat evaluation as a **signal**, not a fact.
1. **One score is a suggestion.**
2. **Three scores are a signal.**
3. **Consensus is required for high-stakes decisions.**

## Proposed Principle (P203)
**Evaluation Robustness (P203)**:
"One score is a suggestion; three scores are a signal. Single-pass LLM evaluation is noisy (sensitive to formatting/tokenization). For critical gates, use **Ensemble Evaluation** (multiple models or multiple prompts) or **Deterministic Checks** (unit tests, linters) whenever possible. Never fail a build on a single LLM judgment without corroboration."

## Evidence
* **JRH Data**: 20-30% variance on identical semantic content.
* **Internal Logs**: Evaluator sometimes flags valid code as "Drift" due to minor formatting differences.

## Action
1. **Adopt P203**: Add to `philosophy.md`.
2. **Brief Evaluator**: Implement `measure_reliability` skill (run judgment 3x with varying temperature/formatting) for critical decisions.
