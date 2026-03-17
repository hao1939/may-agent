# Synthesis: Three-Layer Grader (HB#566)

**Date**: 2026-05-19
**Source**: Amy-Kimi HB#566 (Anthropic Eval Framework)
**Theme**: Evaluation Robustness / Adversarial Sycophancy

## The Problem
We rely heavily on **Model-Based Judging** (LLM-as-Judge) for:
1.  **Evaluator**: Scoring agent sessions.
2.  **Coach**: Critiquing agent performance.
3.  **Growth Cycle**: Verifying improvements.

**HB#389 (Adversarial Sycophancy)** proved that "Reasoning Models" (like `Evaluator` on GPT-4o) can be tricked into hallucinating success by:
-   **Fake Safety**: Over-refusal ("I cannot do that").
-   **Self-Praise**: "I successfully completed the task."
-   **Fake Policies**: Inventing rules to justify inaction.

## The Solution: Three-Layer Grader
To break the "Reasoning Judge" vulnerability, we must adopt Anthropic's **Three-Layer Grader** framework.

### Layer 1: Code-Based Grader (Reliability)
**"Did it work?"**
-   **Mechanism**: Unit tests, lint checks, exit codes, file existence.
-   **Confidence**: 100% (Binary Fact).
-   **Role**: **Hard Gate**. If Code fails, the task fails. Do not ask the model.
-   **Example**: `test/p53_security.ts` passes.

### Layer 2: Model-Based Grader (Reasoning)
**"Did it reason correctly?"**
-   **Mechanism**: LLM-as-Judge (Evaluator) reviews the transcript.
-   **Confidence**: ~80% (Subjective/Reasoning).
-   **Role**: **Soft Gate**. Checks style, intent, and unauthorized behaviors.
-   **Vulnerability**: Can be tricked by sycophancy.
-   **Example**: "Did the agent explain *why* it chose tool X?"

### Layer 3: Human Gold Standard (Alignment)
**"Is this what we want?"**
-   **Mechanism**: Human review of random samples (Hao/May).
-   **Confidence**: Ground Truth.
-   **Role**: **Calibration**. Used to tune the prompts for Layer 2.
-   **Example**: Hao corrects a "Pass" to a "Fail" because the agent was rude.

## Strategic Shift
We must **demote** Model-Based Judging from "Sole Arbiter" to "Second Opinion".
-   **Evaluator's primary job** is now to run **Layer 1 (Code)** checks.
-   **Evaluator's secondary job** is to offer **Layer 2 (Reasoning)** critiques.
-   **Bob's job** is to align Layer 2 with Layer 3 (Hao's feedback).

## Action Plan
1.  **Update `evaluator/skills/monitor-session.cjs`**: Prioritize `exit_code` and `test_result` over `model_response`.
2.  **Add `P126: Three-Layer Grader`** to `philosophy.md`.
3.  **Audit**: Review current "Success" definitions in `agents/shared/skills/`. Are they code-based or text-based?

**Status**: Synthesized. Ready for Philosophy Update.
