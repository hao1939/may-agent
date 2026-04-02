# DeepTravel: End-to-End Agentic RL for Travel Planning
- **Author**: Yansong Ning, Rui Liu, et al. (HKUST(GZ) + Didichuxing)
- **Date**: 2025-09-26
- **URL**: https://arxiv.org/abs/2509.21842
- **Tags**: #agentic-rl #travel-planning #hierarchical-reward #experience-replay

## Summary
DeepTravel is the first end-to-end agentic RL framework for autonomous travel planning agents, deployed on DiDi Enterprise Solutions App. Qwen3-32B trained with DeepTravel significantly outperforms OpenAI-o1/o3 and DeepSeek-R1 on travel planning tasks.

## Key Contributions

### 1. Robust SandBox Construction
- Caches transportation, accommodation, and POI data from multiple real-world APIs
- Simulates dynamic tool interactions without real-world API limitations (QPS limits, inconsistent outputs)
- Daily-refreshed database with on-demand caching strategy
- Enables reproducible training and learning from failed cases

### 2. Hierarchical Reward Modeling System
Two-level verification for open-ended travel tasks:

**Trajectory-Level Verifier**
- Checks spatiotemporal feasibility of complete itinerary
- Validates logical sequence, geographic plausibility, user requirements
- Filters invalid itineraries early (reward = 0 if failed)

**Turn-Level Verifier**
- Granular consistency check between final itinerary and tool responses
- Identifies factual hallucinations/mistakes at each turn
- Reward = 1 only if all turns pass verification

**Joint Reward Reweighting**
- Hierarchical structure ensures efficiency + reliability
- Built travel-oriented rubrics for both verifiers
- DeepSeek-R1 based verifier for reward modeling

### 3. Replay-Augmented Reinforcement Learning
- Two-stage: SFT cold-start → RL with experience replay
- Distills multi-turn trajectories from DeepSeek-R1
- Periodically replays from **failures experience buffer**
- Agent learns to explore, verify, and refine from previous failures

## Experimental Results

| Model | Offline (w/ constraint) | Offline (w/o constraint) | Online |
|-------|------------------------|-------------------------|--------|
| DeepSeek-R1 | - | - | - |
| OpenAI-o3 | - | - | - |
| OpenAI-o1 | - | - | - |
| **DeepTravel-32B (Qwen3-32B)** | **Superior** | **Superior** | **Superior** |

- DeepTravel enables small LLMs (Qwen3-32B) to outperform frontier models
- Prevailing RL algorithms (GRPO, DAPO) compared

## Key Mechanisms

### Toolkit (6 tools)
1. Flight search
2. Train search
3. Route planning
4. Hotel search
5. POI search
6. Web search

### Reasoning Format
```
<think>...reasoning...</think>
<tool_call>action</tool_call>
<tool_response>observation</tool_response>
<answer>final itinerary</answer>
```

## Relevance to OpenClaw

| DeepTravel | OpenClaw Mapping |
|------------|------------------|
| Failures experience buffer | **Error Log** |
| Hierarchical reward modeling | Main↔Sub-agent evaluation framework |
| Trajectory-level verifier | Task completion validation |
| Turn-level verifier | Step-by-step tool call verification |
| Robust SandBox | Skill testing environment |
| Replay-augmented RL | Error Log distillation |

## Critical Validation
- **"Learning from failures"** is a validated pattern in production agent systems
- Hierarchical verification (coarse → fine) is essential for open-ended tasks
- SandBox approach enables reproducible agent training without API limits
- Small models (32B) can surpass frontier models with proper RL training

## Quotes
> "We propose the reply-augmented reinforcement learning method that enables TP agent to periodically replay from a failures experience buffer, emerging notable agentic capacity."

> "DeepTravel enables small-size LLMs (e.g., Qwen3-32B) to significantly outperform existing frontier LLMs such as OpenAI-o1/o3 and DeepSeek-R1."

## References
- arXiv: 2509.21842
- Source: HKUST(GZ) + Didichuxing Co. Ltd
- Deployed on: DiDi Enterprise Solutions App

---
**Tracked**: 2026-03-13 | **L3 Flags**: #753-756
