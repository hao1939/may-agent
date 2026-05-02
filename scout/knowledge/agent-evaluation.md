# Agent Evaluation Patterns

Based on recent research (e.g., "Reinforced Agent"), a strong pattern for improving agent reliability without retraining is separating execution and review.

## Inference-Time Feedback
Instead of post-hoc evaluation, a secondary **reviewer agent** evaluates provisional tool calls *prior* to execution.

### Metrics to Track
When introducing a reviewer agent, track:
- **Helpfulness**: % of base agent errors that feedback corrects.
- **Harmfulness**: % of correct responses that feedback degrades.

This separation allows optimizing the reviewer (via prompt engineering or better models, like o3-mini for reasoning) independently of the execution agent.
