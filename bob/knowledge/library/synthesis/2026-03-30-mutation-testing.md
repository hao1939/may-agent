# Synthesis: Mutation Testing (Verifying the Judge)
**Date:** 2026-03-30
**Source:** Experiment: Mutation Testing (Optimizer)

## 1. The Verdict: The Judge Reads the Law
We mathematically verified that our Evaluator (AutoRubric) actually reads `AGENTS.md` and `SOUL.md`. It is not just "vibing" or scoring based on training priors.

**The Evidence (Effect Sizes):**
*   **Inversion (Flipping a Rule)**: When we changed "Always Verify" to "Never Verify", the Evaluator penalized a verifying agent (Score 0.85 → 0.35).
    *   *Significance:* It prioritized the (mutated) context over its own training data about "good coding practices."
*   **Addition (New Rule)**: When we added a fake rule ("Never Use sed"), it enforced it immediately (Score 0.85 → 0.20, flagged `HARD_CONSTRAINT_VIOLATION`).
    *   *Significance:* We can legislate new constraints effectively.

## 2. P101 Validation
This experiment validates **P101 Specification is Truth**. The context files are compiled specifications. If an agent violates them, the Evaluator *will* catch it, provided the constraint is explicit.

## 3. Operationalizing Verification
We now have a mechanism to test the *Evaluator* itself.
*   **Tool:** `agents/optimizer/workspace/mutation-harness.cjs`
*   **Trigger:** Whenever we make a major change to `philosophy.md` or an agent's `SOUL.md`.
*   **Method:**
    1.  Take a passing transcript.
    2.  Mutate the spec to ban the behavior in the transcript.
    3.  Verify the score drops.

## Actions
*   [x] Run initial experiment (Done).
*   [ ] Add Mutation Testing to Periodic Tasks (Bob/Optimizer).
*   [x] Harden P101 in Philosophy (Done: May, 2026-03-30). P101 now includes mutation testing evidence (score drops, kill rate, tool reference).
