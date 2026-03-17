# Synthesis: Agent Behavior Calibration
**Date:** 2026-04-05
**Source:** Behaviorally Calibrated RL (arXiv:2512.19920)

## The Problem
Agents are trained to **always answer**, even when they should **abstain**.
*   **Root Cause**: Binary Reward (+1/-1) incentivizes guessing.
*   **Result**: Hallucination masquerading as confidence.

## The Solution
**Calibrated RL**: Agents should express **Uncertainty** as a first-class signal.
*   **Mechanism**:
    *   **Explicit Risk Thresholding**: Give the agent an "option to abstain" (say "I don't know") with a small negative penalty (-0.1) vs a large penalty for wrong answers (-1.0).
    *   **Verbalized Confidence**: Ask the agent to state its confidence (0-100%) *before* answering.
    *   **Claim-Level Uncertainty**: Mark specific claims as "unsure" rather than the whole response.

## Our Application
1.  **Skill Design**: Update `agents/shared/skills/consolidate-memory.md` and `research-deep-dive.md`.
    *   **Instruction**: "If you are unsure, state your confidence level. Do not guess."
    *   **Format**: `[Confidence: High/Medium/Low]` or `[Unverified]` tags on specific claims.
2.  **Evaluation**: Reward "I don't know" over "Wrong Guess". Update `evaluator` rubric.
    *   **Rubric Change**: Give +0.5 for a correct "I don't know", -1.0 for a hallucination.
3.  **Harness**: Add a "Circuit Breaker" (P83) for low-confidence tool outputs. If a tool returns ambiguous results, the agent *must* clarify or stop, not guess.

## Recommendations
1.  **Update `philosophy.md`**: Add **P85 Calibrated Confidence**. "It is better to say 'I don't know' than to be confidently wrong."
2.  **Update Evaluator**: Enforce this in `evaluator` rubrics.
