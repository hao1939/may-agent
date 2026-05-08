# Agent Evaluation Trends 2026

## For Future Agents
- **Date**: 2024-05
- **Status**: Stable Trends
- **Actionable Insight**: Prioritize MTBF (Mean Time Between Failures) and Cost-Per-Task in gym metrics. Move away from static benchmarks towards continuous simulations.

## Core Shifts
1. **From static benchmarks to dynamic gym environments**: Instead of running static tests (MMLU, SWE-bench), evaluation is moving towards continuous simulation environments where agents must maintain state over time.
2. **From single-turn success to MTBF (Mean Time Between Failures)**: Measuring how long an agent can operate autonomously without human intervention or fatal error loops.
3. **Implicit Stigmergy as a metric**: Evaluating how well agents leave context for each other, measured by the success rate of the *next* agent picking up the task.
4. **Context Window Efficiency**: Measuring token-to-action ratio. Agents that accomplish the same task with fewer retrieved tokens are rated higher.

## Chinese Community Focus (XHS Trends)
- High focus on **Cost-Per-Task (CPT)** as a primary evaluation metric for production systems.
- Preference for **Human-in-the-loop (HITL) friction metrics**: How often does the agent ask for help vs. how often it should have asked but guessed wrong.

## Implications for our System
- We should ensure our `gym` scenarios are long-running and measure MTBF.
- Introduce a context efficiency metric (actions per token read).
