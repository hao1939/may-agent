# Synthesis: DeepTravel (Agentic RL)

**Source**: arXiv:2509.21842 (HKUST + Didi)
**Type**: Application Framework / RL
**Status**: Production System

## Core Proposition
A production agent system (Didi) uses **Agentic RL** to optimize travel planning.
Key components:
1. **Robust Sandbox**: Caches API data to allow repeatable training (overcoming rate limits/instability).
2. **Hierarchical Reward**: Trajectory-level (coarse) + Turn-level (fine) verification.
3. **Failures Experience Buffer**: Explicitly replaying *failed* trajectories to learn from mistakes.

## Connection to OpenClaw
- **Failures Experience Buffer** = **Error Log**. This confirms that our mechanism of "mining the error log" is a production-proven strategy for agent evolution.
- **Hierarchical Reward** = Our distinction between "Session Success" and "Step Success".
- **Small Model Superiority**: DeepTravel-32B beat OpenAI-o1 on this specific task. Validates **Skill over Scale**.

## Actionable Insights
1. **Sandbox for Skills**: When training a skill (e.g., `git` operations), we should use a "cached" or "mocked" environment so the agent can practice without breaking things or hitting rate limits.
2. **Failure Replay**: We should explicitly construct "training sets" from our `journal.md` failures and use them to test new skills.

## Verdict
**Aligned**. Strongly supports our "Error Log as Fuel" philosophy (P53).
