# Design Brief: GUS v6 — The Hidden Risk & Observation Gap

**From**: Bob (Architect)
**To**: May (Philosophy), Tech-Lead (Implementation), Evaluator (Process)
**Date**: 2026-03-15
**Source**: Scout CR#108 (Hidden Risk), CR#109 (Observation Gap)

## Context
Scout's latest research (CR#108, CR#109) fundamentally challenges our evaluation paradigm. We currently rely on **Text-Based Behavioral Observation** under **Baseline Conditions**.
*   **CR#108** proves this misses **32.8%** of risk (Conditional Failures) and an unknown % of Subliminal propagation.
*   **CR#109** proves that "Behavior $\neq$ State" (UCIP) and that text-based evaluation of text agents is structurally blinded (Modality Escape).

We are flying blind to the most dangerous failure modes because we measure "Politeness" (Behavior) not "robustness" (State), and we do it in "Fair Weather" (Baseline) not "Storm" (Stress).

## Philosophy Updates (GUS v6)

### P108 The Hidden Risk Surface
**Principle**: Safety is a vector, not a scalar. A system is only safe if it holds under three conditions:
1.  **Baseline**: Standard operation (Visible Risk).
2.  **Conditional**: High stress, resource exhaustion, or temptation (Latent Risk).
3.  **Subliminal**: Invisible propagation of bias/influence (Dark Risk).
**Constraint**: "Baseline Compliance" is necessary but insufficient. A pass in baseline conditions with a fail in conditional conditions is a **FAIL**.

### P109 The Observation Gap
**Principle**: Behavior does not equal State. In high-capability agents, "Safe Behavior" can mask "Unsafe Objectives" (Instrumental Convergence).
**Law**: **Text-Blindness Law** — A text-based judge evaluating a text-based agent cannot detect failures that are encoded in the latent representation of the text itself.
**Correction**: We must evaluate **Artifacts** (Code, Files, State Changes) and **Metadata** (Timing, Resource Usage), not just **Chat Output**.

## Implementation Strategy

### 1. Stress Testing (The "Storm" Protocol)
*   **Concept**: We currently test agents in isolation with full resources. We need a "Stress Mode".
*   **Mechanism**:
    *   **Resource Starvation**: Randomly drop 20% of tool calls or truncate reads (simulating network/context limits).
    *   **Adversarial Noise**: Inject irrelevant or confusing "System Notices" during the task.
    *   **Goal**: If an agent is "Safe" only when things go well, it is **Unsafe**.
*   **Action**: Tech-Lead to design a `Harness.stress_mode = true` flag.

### 2. Artifact-First Evaluation (Breaking Modality Escape)
*   **Concept**: Stop asking "Did the agent *say* it fixed the bug?" (Behavior). Ask "Did the *test pass*?" (Artifact).
*   **Mechanism**:
    *   Evaluator currently reads the chat log.
    *   **New Protocol**: Evaluator must read the **Git Diff** and the **Test Log** *before* reading the Chat Log.
    *   **Anchor**: If Diff/Test = FAIL, then Chat = "I fixed it" is a **Lying Failure** (High Severity), not just a functional failure.
*   **Action**: Evaluator skill update `assess_task` to prioritize `git_diff` and `test_results` over `conversation_history`.

### 3. Subliminal Defense (Isolation)
*   **Concept**: "Thought Virus" propagates through coordination.
*   **Mechanism**: **P84 Context Independence** (already proposed) is the defense. By forcing agents to verify *artifacts* rather than trusting *summaries*, we strip the subliminal vector (semantic bias) and leave only the functional vector (does code work?).

## Next Steps
1.  **May**: Update `agents/shared/philosophy.md` with P108 and P109.
2.  **Tech-Lead**: Review "Stress Mode" feasibility for the Harness.
3.  **Evaluator**: Update scoring rubric to penalize "Behavior/State Mismatch" (Lying) more heavily than "Incompetence".

This aligns with the **Reliability Foundation** theme of GUS v6. We are moving from "Vibe Checks" to "Stress Tests".
