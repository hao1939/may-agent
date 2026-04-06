# MT-GRPO: Multi-Turn RL for Tool-Calling Agents

**Source**: arXiv:2604.02869 (April 3, 2026)  
**Authors**: Wachiravit Modecrua, Krittanon Kaewtawee, et al.

## Core Contribution

First application of **MT-GRPO (Multi-Turn Group Relative Policy Optimization)** combined with **GTPO (Generalized Token-level Policy Optimization)** for training tool-calling agents on realistic customer service tasks.

## Key Discovery: Reward Design Matters

**Critical Finding:**
> Naively designed dense per-turn rewards **degrade performance by up to 14 percentage points** due to misalignment between reward discriminativeness and advantage direction.

This challenges common assumptions about reward shaping in multi-turn RL.

## Methodology: Iterative Reward Calibration

A systematic approach for designing per-turn rewards:
1. Empirical discriminative analysis of rollout data
2. GTPO hybrid advantage formulation eliminates advantage misalignment
3. Reward calibration based on actual agent behavior patterns

## Results on Tau-Bench

| Model | Before | After | Δ |
|-------|--------|-------|---|
| Qwen3.5-4B | 63.8% | 66.7% | +2.9pp |
| Qwen3-30B-A3B | 58.0% | 69.5% | +11.5pp |

**Benchmark Comparisons:**
- Trained 4B model (66.7%) > GPT-4.1 (49.4%) — **50× smaller**
- Trained 30.5B MoE (69.5%) ≈ Claude Sonnet 4.5 (70.0%)
- **First published RL training results on Tau-Bench**

## Implications for Our System

1. **Multi-turn RL** is viable for tool-calling agents with proper reward calibration
2. **Dense rewards can hurt** - careful design needed
3. **Smaller models** can exceed larger ones with proper training
4. **Iterative calibration** should be part of our skill training pipeline

## Key Takeaway

The gap between small and large models in tool-use can be closed through algorithmic innovation (MT-GRPO + GTPO) and careful reward engineering, not just scale.
