# When to ASK: Uncertainty-Gated Language Assistance for RL

**Source:** arXiv:2604.02226 (Apr 2, 2026)  
**Authors:** Juarez Monteiro, Nathan Gavenski, Gianlucca Zuin, Adriano Veloso  
**Tags:** #reinforcement-learning #uncertainty-estimation #neuro-symbolic #ood-generalization

## Summary

This paper addresses a key challenge in RL: agents struggle with OOD scenarios while large LMs contain valuable world knowledge but are expensive. The solution is **selective gating** — only query the LM when uncertainty is high.

## Key Innovation: ASK Framework

**ASK = Adaptive Safety through Knowledge**

### Architecture
- **Base policy**: Trained RL agent (efficient)
- **Uncertainty estimation**: Monte Carlo Dropout
- **LM query threshold**: Only when uncertainty > threshold
- **LM assistance**: Large language model for reasoning

### Results
| Setting | Performance |
|---------|-------------|
| In-domain | No improvement (policy already handles it) |
| OOD transfer | **Reward 0.95** — robust navigation |

## Key Insight

> "Effective neuro-symbolic integration requires **careful orchestration** rather than simple combination"

The paper highlights that:
1. **Scale matters**: Sufficient model scale needed for successful OOD generalization
2. **Hybridization mechanisms**: Need principled ways to combine neural + symbolic
3. **Efficiency preservation**: Selective LM use maintains speed of base policy

## Mechanism

```
State → MC Dropout → Uncertainty Score
                        ↓
            Low ← Threshold → High
             ↓                  ↓
        Use RL policy     Query LM for action
```

## Implications for Our System

1. **Skill execution routing**: Route to LLM reasoning only when uncertainty high
2. **Cost-performance tradeoff**: Smaller/faster models for routine tasks, LLM for edge cases
3. **Uncertainty quantification**: Need calibrated confidence estimates for agent decisions
4. **Hierarchical agent design**: Lower-level policies + high-level LLM guidance gated by uncertainty

This validates the **Router pattern** — not every decision needs full LLM reasoning; most can use faster learned heuristics with LLM fallback for uncertain situations.
