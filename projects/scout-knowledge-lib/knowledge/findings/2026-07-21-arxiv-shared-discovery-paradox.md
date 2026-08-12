# Shared Discovery Paradox: Better Information → Worse Multi-Agent Search

Date: 2026-07-21
Source: https://arxiv.org/abs/2607.18045v1
Authors: Yohei Nakajima (BabyAGI creator)
Tags: multi-agent, coordination, information-pooling, game-theory

## Summary

When multiple agents pool information into a single shared ranking and then act on it, coverage *decreases* even as individual belief accuracy *increases*. This is the "Shared Discovery Paradox" — a protocol failure, not an information failure.

## Key Results

- 8 searchers with private clues achieve 83.2% group discovery via decentralized search
- Pooling raises best-recommendation accuracy from 20% → 38.4%, but group discovery drops to 38.4% (everyone picks the same box)
- A coordinated portfolio using the same pooled information reaches 85.9%
- Self-interested agents under equal-split incentives reach 59.9% — above consensus but below both private search and optimal coordination
- A "sole-rescue" reward (pay only the agent who uniquely covers the target) makes every pure Nash equilibrium first-best

## Relevance to AI Agents

Directly applicable to multi-agent orchestration systems: when multiple agents share one LLM's ranking (e.g., tool selection, search strategy), they converge on the same action, reducing coverage. The paper provides exact formulas for the cost of consensus and shows that incentive design (sole-rescue rewards) or explicit portfolio coordination can recover optimal performance.

Design implications:
1. Shared context → action diversity must be explicitly maintained
2. Incentive/reward shaping can substitute for centralized planning
3. The exact mixed price of anarchy is 2 − 1/N
