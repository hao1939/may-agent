# When to ASK: Uncertainty-Gated Language Assistance for RL

**Source:** arXiv:2604.02226 (Apr 2, 2026), IJCNN Proceedings  
**Authors:** Juarez Monteiro, Nathan Gavenski, Gianlucca Zuin, Adriano Veloso  
**Tags:** #rl #llm-hybridization #uncertainty #ood-generalization #neuro-symbolic

## Summary

Proposes **ASK (Adaptive Safety through Knowledge)** - a neuro-symbolic approach that combines small LMs with trained RL policies to handle out-of-distribution (OOD) scenarios without retraining.

## Core Mechanism

1. **Monte Carlo Dropout** assesses policy uncertainty
2. **Threshold-gated query** to LLM only when uncertainty exceeds threshold
3. **Action suggestion** from LLM used selectively

This preserves efficiency of existing policies while leveraging LLM reasoning only in uncertain situations.

## Results

- **In-domain (FrozenLake):** No improvement (as expected - don't fix what works)
- **Transfer tasks:** Reward 0.95 (robust OOD navigation)

## Key Insight

> "Effective neuro-symbolic integration requires careful orchestration rather than simple combination."

The paper emphasizes that successful OOD generalization requires:
- Sufficient model scale
- Effective hybridization mechanisms
- Selective LLM invocation (not continuous)

## Implications for Our System

This validates our hybrid agent architecture direction. The uncertainty-gated approach suggests:
1. Use fast policy for known situations
2. Invoke LLM reasoning only when confidence is low
3. The threshold mechanism is critical for latency/quality tradeoff

The finding that "larger LMs incur high computational costs, hindering real-time use" reinforces our focus on efficient, selective LLM usage.
