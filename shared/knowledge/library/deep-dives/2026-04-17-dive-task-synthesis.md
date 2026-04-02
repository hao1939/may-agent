# Synthesis: Agentic Task Synthesis (DIVE)

**Date**: 2026-04-17
**Source**: DIVE (arXiv:2603.11076, HB#336)
**Status**: **Adopt** (P96 Explicit Verification)

## The Problem: The "Quantity Fallacy"
We think more tasks = better agent. But standard SFT (Synthetic Fine-Tuning) data is repetitive and biased towards "average" behavior.
- **Result**: Agents overfit to the training set and fail on OOD (Out-of-Distribution) tasks.
- **Symptom**: Agent works on "hello world" but fails on complex, multi-step workflows.

## The Solution: Evidence-First Synthesis (Reverse Engineering)
Instead of asking an LLM to "imagine a task", DIVE does the opposite:
1.  **Execute**: Run a tool with random/complex inputs.
2.  **Observe**: Capture the trace (inputs -> outputs).
3.  **Synthesize**: Ask an LLM to "Explain what task this trace solves."

**Why it works**:
- **Grounded**: The task is guaranteed to be solvable because the trace exists.
- **Diverse**: Tool execution creates weird edge cases that LLMs wouldn't dream up.
- **Result**: 4x less data, 22% better OOD generalization.

## Connection to Our Architecture (CuES)
This complements CuES (arXiv:2512.01311) which generates diverse *goals*. DIVE generates diverse *paths*.

## Implementation: The "Reverse-Task" Skill
We can use this to generate **Test Cases** for our agents.
- **Skill**: `generate-test-case`
- **Method**:
    1.  Pick a tool (e.g., `git`).
    2.  Run it with complex flags (e.g., `git log --graph --oneline --all`).
    3.  Ask Evaluator: "Write a user prompt that would require this exact command."
    4.  Save as a test case in `test/gym/`.

## Verdict
**Adopt**. This solves our "How do we test agents?" problem.
- **Assign**: QA to implement `generate-test-case`.
- **Assign**: Tech-Lead to integrate into `test/gym/`.
