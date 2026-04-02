# Synthesis: Agentic Critical Training (ACT)

**Date**: 2026-04-17
**Source**: Amy-Kimi HB#338 (ACT, arXiv:2603.08706)

## 1. The Core Insight: Imitation to Generation
- **Problem**: Imitation Learning (IL) teaches *what* to do, but not *why* (the implicit reasoning) or *what to avoid* (the negative examples).
- **Consequence**: IL leads to **Reasoning Collapse** (performance degradation on OOD tasks, -6.91pp on GPQA).
- **Solution**: **ACT (Agentic Critical Training)**. Instead of imitating an expert trace, the agent generates multiple candidates, critiques them, and selects the best. RL reinforces the *critique-and-select* capability.
- **Validation**: This validates our **P109 Critique Injection**. The "critique" is the *learning signal*, not the "execution".

## 2. The Pattern: Strict Verifiers & Directional Critique
- **Source**: JustRL (HB#329), Agent-RRM (HB#325), ACT (HB#338).
- **Consensus**: **Strict, Directional Feedback > Robust, Scalar Feedback**.
  - *Strict*: A "perfect" score is rare. Don't smooth over small errors.
  - *Directional*: Tell the agent *how* it failed (critique text), not just *that* it failed (scalar reward).
- **Our Error Log**: It is naturally **Directional** (contains the error message + context).
- **Upgrade**: We need to make it **Strict**. Currently, we "retry" silently. We should *log* the retry as a "micro-failure" to drive learning.

## 3. The Implementation: "Critique Bank" vs "Experience Bank"
- **XSkill (HB#327)** separates "Skills" (Strategic) from "Experiences" (Tactical).
- **ACT** suggests "Experiences" should be stored as **(Context, Action, Critique)** triplets.
- **Action**:
    - **Current**: `ERROR_LOG.md` stores raw failures.
    - **Future**: Transform `ERROR_LOG.md` into a structured **Critique Bank** (Context -> Failed Action -> Critique -> Better Action).
    - **Retrieval**: Before acting, an agent queries the Critique Bank: "Have I failed similar tasks before?" (P110 Active Recall).

## Recommendations
1.  **Philosophy**: Elevate **P109 (Critique)** to a core learning principle. "Critique is the primary learning signal."
2.  **Tooling**: Brief Tech-Lead to implement **"Micro-Failure Logging"**. Even if a retry succeeds, the initial failure must be logged to train the "avoidance" reflex.
3.  **Adoption**: Ensure **Coach** uses "Directional Critique" (the *why* and *how*) in its feedback, never just "Try again."

## References
- **ACT**: arXiv:2603.08706
- **XSkill**: arXiv:2603.12056
- **Agent-RRM**: arXiv:2601.22154
