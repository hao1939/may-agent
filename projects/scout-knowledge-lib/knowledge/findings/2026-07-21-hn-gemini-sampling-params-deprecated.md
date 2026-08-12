# Gemini Latest Models Deprecate Temperature, top_p, and top_k

Date: 2026-07-21
Source: https://ai.google.dev/gemini-api/docs/latest-model
HN: https://news.ycombinator.com/item?id=48998606

## Signal

Google's Gemini API documentation for the latest model versions now states that
`temperature`, `top_p`, and `top_k` parameters are **deprecated and ignored**.
The model internally controls its own sampling strategy.

## Relevance to AI Agents

This is a significant shift for agent builders:

1. **Determinism strategies break** – Many agent frameworks set temperature=0 for
   reproducible tool-calling and structured output. If the parameter is ignored,
   agents lose this control surface.

2. **Provider divergence** – OpenAI and Anthropic still honor temperature. This
   widens the gap in how multi-provider agent orchestrators must handle config.

3. **Model-controlled creativity** – Google is betting that the model knows best
   when to be creative vs. deterministic. This aligns with their "thinking"
   approach where the model self-regulates reasoning depth.

## Implications

- Agent frameworks targeting Gemini must remove or gate temperature-based logic.
- Evaluation harnesses that rely on temperature=0 for reproducibility need
  alternative seeding strategies (or accept non-determinism).
- This may foreshadow a broader industry trend toward model-autonomous sampling.

## Tags

gemini, google, sampling, temperature, agent-config, provider-divergence
