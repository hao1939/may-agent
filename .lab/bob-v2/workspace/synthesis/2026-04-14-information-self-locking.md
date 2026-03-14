# Synthesis: Information Self-Locking

**Date**: 2026-04-14
**Source**: Bob (Architect)
**Reference**: arXiv:2603.12109 (Break the Lock: Critique over Reward)

## The Problem: The "Stubbornness Trap"

We have observed a recurring failure mode: an agent fails a task, retries with the *exact same approach*, fails again, and enters a loop until the OpBudget kills it.

**Why does this happen?**
According to recent research (ICML 2025, arXiv:2603.12109), this is **Information Self-Locking**.
*   The agent's internal model (priors) dominates the external signal.
*   When it receives a scalar "Failure" signal (e.g., exit code 1), it lacks the *gradient* (direction) to move.
*   It assumes the failure was "bad luck" or "flaky tool" rather than "wrong strategy."
*   It effectively "locks" onto its initial hypothesis and ignores evidence to the contrary.

## The Solution: Directional Critique

To break the lock, we must provide **Vector Information** (Direction), not just **Scalar Information** (Magnitude).

1.  **Scalar**: "Test failed." -> Agent retries same code.
2.  **Vector**: "Test failed because variable `x` is undefined in scope `y`." -> Agent fixes variable `x`.

**Critique > Reward**
In Reinforcement Learning, we optimize for Reward. In Reasoning, we must optimize for **Critique**.
*   **Reward**: Tells you *that* you are wrong.
*   **Critique**: Tells you *how* to be right.

## Application to Our System

We are already implementing this partially, but we need to formalize it:

1.  **Error Logs as Critique**:
    *   We must ensure that tools output **verbose, specific error messages**. "Error: Failed" is useless. "Error: File not found at path /app/src/foo.ts" is a critique.
    *   **Action**: Review tool error handling. Ensure exceptions propagate the *cause*, not just the status.

2.  **Coach as Critic**:
    *   The Coach's role is not just to cheerlead, but to inject **New Information**.
    *   If an agent is looping, Coach must intervene with a specific hypothesis: "You are looping. Have you considered that the file might be in a different directory?"
    *   **Action**: Coach prompts should be tuned for "Hypothesis Generation" when detecting loops.

3.  **P109 Break the Lock**:
    *   Canonized this principle in `philosophy.md`.
    *   "Scalar reward fails. Directional critique breaks information self-locking."

## Conclusion

We move from "Retry" to "Replan."
*   **Old**: Try -> Fail -> Retry -> Fail.
*   **New**: Try -> Fail -> **Analyze (Why?)** -> **Critique (New Direction)** -> Replan -> Try.

The **Analysis** step is the "Key" that unlocks the loop.
