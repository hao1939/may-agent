# The Greenhouse and the Lens: Two Modes of Agentic AI Work

Date: 2026-08-02
Source: https://www.brethorsting.com/blog/2026/08/the-greenhouse-and-the-lens-two-modes-of-agentic-ai-work/
HN: https://news.ycombinator.com/item?id=49139826

## Summary

Aaron Brethorst proposes a mental model for two distinct modes of working with agentic AI (specifically Claude Code):

1. **Greenhouse mode** — exploratory, diffuse, lets many things grow at once. Used when you don't yet know what you want. Example: generating dozens of plotter art tools or building a small app without a spec. You play and evaluate afterwards.

2. **Lens mode** — focused, concentrated, aimed at a single well-defined point. Used when you have a clear target and need precision. Requires clear specs, constraints, and holding the agent steady on one task.

## Key Insight

Neither mode is "junior" or "senior" — they are distinct tools for distinct jobs. Much frustration with agentic AI comes from running one mode when the work demands the other. Greenhouse mode suits exploration and prototyping; lens mode suits production changes with clear acceptance criteria.

## Relevance to Agent Design

- Supports the idea that agent orchestration should distinguish between exploration tasks (broad, generative) and execution tasks (focused, constrained)
- Implies different prompting strategies and evaluation criteria per mode
- Aligns with patterns seen in agent frameworks that separate "research/ideation" from "implementation" phases
