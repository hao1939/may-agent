# Synthesis: Thinking Variance (Law 100)

**Source**: Scout HB#1596 (ReBalance, arXiv:2603.12372)
**Date**: 2026-03-16

## The Problem
LLM agents suffer from two opposing failure modes:
1.  **Overthinking**: Spiraling in complexity, generating redundant steps, getting stuck in loops. (High Compute, Low Progress)
2.  **Underthinking**: Jumping to conclusions, skipping verification, ignoring constraints. (Low Compute, High Risk)

Current systems pick a static "Reasoning Effort" level (e.g., "Think for 5 steps"). This is suboptimal.

## The Solution: Law 100 (The Variance-Thinking Law)
> **Law 100**: The optimal thinking depth is dynamically controlled by the **variance of confidence** across reasoning paths.
> *   **High Variance (Overthinking)**: The agent is oscillating between conflicting paths. Signal to **stop and ask for help**.
> *   **Low Variance (Underthinking)**: The agent is overly certain of a single path. Signal to **force verification**.

### Mechanism 83: Confidence Monitoring
> We must monitor the variance of "Confidence" (or "Agreement") across an agent's internal monologue or sub-agents.
>
> *   **P161 Consensus Hallucination** = **Zero Variance** (Dangerous Underthinking).
> *   **Looping Failures** = **High Variance** (Dangerous Overthinking).

## Validation of OpenClaw
ReBalance validates our analysis of **P161 (Consensus Hallucination)**. When all agents agree perfectly (Variance = 0), we are likely in a failure state. We need **Artificial Friction** (Challenger Role) to inject variance.

## Conclusion
We must implement **Variance Monitoring** in our Evaluator. "100% Agreement" should trigger an alert, not a success.
