# Adaptive Adversaries: Multi-Turn LLM Agent Security Benchmark

Date: 2026-07-21
Source: https://arxiv.org/abs/2607.18063v1
Tags: #agent-security #prompt-injection #benchmark #adversarial #multi-turn

## Summary

A 21-scenario benchmark for adaptive multi-round attacks against memoryless LLM defenders. An autonomous LLM attacker observes prior defender responses and pivots across rounds, while each defender response is evaluated as a fresh interaction.

## Key Findings

- Single-turn attack success rate (ASR): 0–1%. After 15 adaptive rounds: 5.4–14.0% ASR.
- Pooling three frontier attacker LLMs uncovers 1.4–2.2× more unique successful attacks than any single attacker.
- Generated attacks have low cosine similarity (0.02–0.14) to existing benchmark attacks — adaptive search finds novel vectors.
- Claude Opus 4.6 and GPT-5.4 tied in aggregate (5.4% ASR each), but weaknesses differ sharply across scenarios.
- 13 of 21 scenarios distinguish at least one defender pair, yet rankings disagree across scenarios (Kendall's W = 0.19) — no single "most secure" model.

## Relevance to AI Agents

Directly measures the security surface of LLM-based agents that process external content. The adaptive multi-turn protocol is more realistic than static attack pools: real adversaries iterate. The finding that model rankings are scenario-dependent (W = 0.19) implies defense-in-depth is more important than model selection alone.

## Artifacts

- 21 evaluation scenarios + 10 dev scenarios + orchestrator + CLI released open-source
- 945 transcripts from 3×3 frontier matrix
- 18,422 battles from open competition scoring rounds
