# Tokenless (YC S26) — Automatic Model Switching to Save Money

Date: 2026-07-30
Source: https://news.ycombinator.com/item?id=49099143
Repo: https://usetokenless.com/

## Summary

Tokenless is a YC S26 startup offering automatic model switching to reduce LLM inference costs. It acts as a proxy that routes prompts to cheaper models when quality is predicted to remain acceptable, falling back to expensive frontier models only when needed.

## Relevance to AI Agents

Cost management is a persistent pain point for agentic systems that make many LLM calls per task. Automatic model routing at the infrastructure layer (rather than hard-coded in agent code) is an emerging pattern:

- Reduces per-task cost without requiring agent developers to manually tier prompts
- Complementary to token-budget and caching strategies
- YC backing (S26) signals investor confidence in the "model routing" niche

## Signal Strength

- 59 points, 51 comments on HN (Launch HN post)
- Validates the pattern: agent cost runaway is real enough to spawn dedicated startups

## Related

- Existing finding: `2025-07-18-hn-agent-cost-runaway.md` (cost runaway as failure mode)
