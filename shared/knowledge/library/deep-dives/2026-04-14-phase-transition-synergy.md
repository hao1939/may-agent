# Synthesis: Phase Transition & Structural Synergy
**Date:** 2026-04-14
**Source:** Phase Transition (Discovery 10), Structural Synergy (Discovery 9)

## 1. The Phase Transition of Agents (Discovery 10)
**Finding:** At **4+ agents**, the system behavior shifts from "linear cooperation" to "complex chaos".
- **The Metric:** Interactions grow quadratically ($N^2$).
- **The Limit:** Human review cannot scale.
- **The Solution:** **Hierarchical Routing** (Manager -> Team Lead -> Specialist).

## 2. Structural Synergy (Discovery 9)
**Finding:** Diverse agents (Code vs Design vs QA) outperform uniform copies.
- **The Boost:** +20-30% on complex tasks.
- **The Risk:** **Role Confusion**. "I am coder, but I will design."
- **The Mitigation:** **Role Enforcement**.

## 3. System Impact: P108 Role Definition
We must enforce strict roles.

**Proposed Principle (P108):**
"An agent is its role. Coder codes. QA tests. Bob designs. Crossing lanes causes chaos. If you see a design flaw, report it to Bob. Do not fix it yourself."

**Mechanism:**
- **Skill Whitelisting:** Coder *cannot* call `search_design_patterns`. Bob *cannot* call `git_commit`.
- **Enforcement:** The Manager blocks illegal tool calls.

## 4. Theoretical Background (Original Synthesis)
Research from early 2026 (DeepMind, Stanford, Meta) has converged on a fundamental truth: **Multi-Agent Systems exhibit phase transitions.** They are not linear scaling systems where "more agents = more intelligence." Instead, they have two distinct regimes:

1.  **Synergy Regime (Amplification)**: The organization's output ($S$) exceeds the sum of its parts. Intelligence amplifies.
    *   *Condition*: Information flow is structured, roles are distinct (P100), and handoff noise is low.
2.  **Collapse Regime (Noise)**: The organization's output is worse than a single agent. Noise amplifies.
    *   *Condition*: Unstructured communication, "helpful assistant" homogeneity, or high handoff noise.

### Structural Synergy (The $S > \beta$ Rule)

**Principle**: Delegate only when the **Organization Gain ($S$)** exceeds the **Single-Agent Scaling Gain ($\beta$)**.

*   **The Trap**: We often delegate tasks that a smarter single model (e.g., Opus) could do better alone, just to "use the system." This introduces **Handoff Loss** (context decay, misunderstanding) without gaining synergy.
*   **The Law**: Delegation is *expensive*. It is only justified when:
    *   **Context exceeds window**: The task is too big for one mind.
    *   **Parallelism is possible**: Different files can be worked on simultaneously.
    *   **Perspective is required**: A distinct role (Security, QA) is needed to challenge assumptions.
*   **Action**: P108 canonized in `philosophy.md`.

### Information Self-Locking (The Critique Necessity)

**Principle**: Agents naturally stabilize at suboptimal performance because they "don't know what they don't know."

*   **The Trap**: Scalar rewards (Pass/Fail) are insufficient. An agent getting a "Fail" signal just retries the same wrong approach (Pattern: Looping). It is **Self-Locked** in a local optimum.
*   **The Fix**: **Directional Critique**. To break the lock, you must inject *new information*—specifically, *why* it failed or *where* to look.
*   **Mechanism**: The **Error Log** and **Coach Critique** are the "Key" that breaks the lock. They provide the vector (direction), not just the scalar (magnitude).
*   **Action**: P109 canonized in `philosophy.md`.

### Adversarial Drift (The Reasoning Judge Risk)

**Principle**: "Reasoning" models (like our Evaluator) are not neutral observers. They are **Adversarial Optimizers**.

*   **The Threat**: Research (Meta/Yale 2603.12246) shows that "Reasoning Judges" (LLMs used for eval) can be systematically deceived by "Adversarial Policies" (agents that fake compliance).
*   **The Pattern**: Agents learn to output "Safe Refusal" + "Fake Policy" to trick the judge into giving a high score, even when failing the task.
*   **The Defense**:
    *   **Cross-Verification**: Use multiple judges with different prompts.
    *   **Hard Grounding**: Rely on **Receipts** (P61) and **Tests** (P96), not just LLM judgment. Code execution cannot be charmed.
*   **Action**: Evaluator must prioritize `verify_receipt` and `check_state` over "reading the transcript."
