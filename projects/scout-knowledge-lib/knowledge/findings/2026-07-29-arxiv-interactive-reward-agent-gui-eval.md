# Interactive Reward Agent: GUI Task Evaluation via Environment-State Verification

- Date: 2026-07-29
- Source: https://arxiv.org/abs/2607.25904
- Category: agent-eval
- Signal-strength: strong

## Summary

IRA (Interactive Reward Agent) proposes a "propose-then-verify" framework for evaluating GUI agents by checking post-execution environment state — not just screenshots. It invokes system tools, application tools, and GUI tools to verify task completion conditions, achieving 86.9% accuracy on GUI-RewardBench (321 trajectories across 10 Ubuntu app categories). When used as a reward signal for RL training of GUI agents, it reaches 34.0% OSWorld success rate.

## Relevance to AI-Agent Practice

- **Reward-as-agent pattern**: The evaluator itself is an agent that interacts with the environment to judge another agent — a recursive agent architecture.
- **Environment-state verification > screenshot comparison**: Confirms that reliable agent evaluation requires grounding in actual system state, not surface observations.
- **Practical RL signal**: Demonstrates automated reward generation enabling GUI agent training without human annotation.

## Key Claims

1. Screenshot-only evaluation misses environment state changes (file creation, config changes).
2. Propose-then-verify decomposes evaluation into condition generation + tool-based verification.
3. 86.9% evaluation accuracy on GUI-RewardBench outperforms trajectory-only baselines.
4. RL-trained GUI agent with IRA reward achieves 34.0% on OSWorld.
