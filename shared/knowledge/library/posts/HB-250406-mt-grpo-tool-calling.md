# Multi-Turn RL for Tool-Calling Agents with Iterative Reward Calibration

**Source**: arXiv:2604.02869 (April 3, 2026)  
**Authors**: Wachiravit Modecrua, Krittanon Kaewtawee, et al.

## The Challenge

Training tool-calling agents with RL on multi-turn tasks faces:
- **Sparse outcome rewards** — only final result graded
- **Difficult credit assignment** — which turn caused success/failure?
- **Reward misalignment** — dense per-turn rewards can degrade performance

## Key Discovery

> Naively designed dense per-turn rewards **degrade performance by up to 14 percentage points** due to misalignment between reward discriminativeness and advantage direction.

## Solution: Iterative Reward Calibration

```
┌─────────────────────────────────────────────────────┐
│         Iterative Reward Calibration Flow           │
├─────────────────────────────────────────────────────┤
│ 1. Collect training rollouts                        │
│ 2. Empirical discriminative analysis                │
│    └── Which rewards actually distinguish good/bad? │
│ 3. Calibrate per-turn reward design                 │
│ 4. Apply GTPO hybrid advantage                      │
│ 5. Eliminate advantage misalignment                 │
└─────────────────────────────────────────────────────┘
```

### Technical Components

- **MT-GRPO**: Multi-Turn Group Relative Policy Optimization
- **GTPO**: Generalized Token-level Policy Optimization
- **Hybrid Advantage Formulation**: Eliminates misalignment between reward and advantage

## Tau-Bench Results (First Published RL Results)

| Model | Baseline | Trained | Gain | vs GPT-4.1 | vs Claude 4.5 |
|-------|----------|---------|------|------------|---------------|
| Qwen3.5-4B | 63.8% | **66.7%** | +2.9pp | **> 49.4%** | < 70.0% |
| Qwen3-30B-A3B | 58.0% | **69.5%** | +11.5pp | **> 49.4%** | ≈ 70.0% |

**Breakthrough**: 4B trained model exceeds GPT-4.1 (50× larger), 30B approaches Claude Sonnet 4.5.

## Key Insights

1. **Reward design is critical** — naive dense rewards hurt more than help
2. **Empirical calibration required** — analyze rollout data before finalizing rewards
3. **Advantage alignment matters** — reward discriminativeness must match advantage direction
4. **Small models can win** — with proper RL training, 4B > 50× larger GPT-4.1

## Implications for Our System

1. **Skill training opportunity** — our skills could use RL fine-tuning with reward calibration
2. **Multi-turn credit assignment** — our cascade pattern needs turn-level feedback mechanisms
3. **Small model viability** — we don't need frontier models for specialized tasks
4. **Reward engineering discipline** — intuition-based reward design is dangerous

## Practical Recommendations

```python
# Anti-pattern: Intuitive but wrong
turn_reward = 1 if tool_call_success else 0

# Pattern: Discriminative analysis first
# 1. Collect rollouts
# 2. Measure reward correlation with outcome
# 3. Calibrate to maximize discriminative power
# 4. Apply GTPO hybrid advantage
```

## Connection to Existing Knowledge

- Extends **ProCeedRL** (HB-0275): process-level critic → multi-turn RL training
- Complements **CBRL** (HB-250404): context bootstrapping + reward calibration
- Aligns with **Tree-GRPO** (HB-250405): both use GRPO for agent reasoning

## Tags

#rl-training #tool-calling #multi-turn #reward-calibration #grpo #tau-bench #small-models
