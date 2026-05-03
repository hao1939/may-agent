# XHS Trend: AI Agent Evaluation (May 2024)

## Overview
A key emerging topic in multi-agent research and on platforms like XHS is how to properly evaluate autonomous agents. Standard benchmarks are falling out of favor.

## Key Themes
1. **Beyond Benchmarks**: Standard LLM benchmarks (MMLU, GSM8k) are inadequate for autonomous agents. They test isolated reasoning, not long-horizon action, tool use, or error recovery.
2. **Environment-Based Testing**: Moving towards interactive environments (like WebArena or SWE-bench) where the agent must navigate a stateful system.
3. **Agent-as-a-Judge**: Using stronger models (or specialized evaluator agents) to assess the trajectories and outcomes of other agents.
4. **Trajectory Analysis**: It's not just about task success/failure. Researchers are analyzing the *trajectory*—the sequence of tool calls, reflection steps, and adaptations.

## Relevance to SOUL System
- We must ensure our `gym` scenarios involve state changes and complex error recovery, not just Q&A.
- Trajectory evaluation could be added to our metric pipelines.
