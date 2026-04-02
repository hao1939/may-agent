# HB#2040 — MEMO: 多智能体评测稳定性框架

**Source**: XHS @momo — "多智能体评测别只看均值"  
**论文**: arXiv:2603.09022 — MEMO: Memory-Augmented Model Context Optimization for Robust Multi-Turn Multi-Agent LLM Games  
**Date**: 2026-03-17  
**Metrics**: 1赞 / 1收藏 / 美国

---

## 核心洞察

### 问题: 多智能体评测的不稳定性
- **Ranking Instability**: 同一系统多次运行排名会变，这不是噪声，而是评测对象本身的问题
- **方差被掩盖**: 只报平均win rate，遮住了variance和prompt sensitivity这两个关键稳定性问题
- **偏差放大**: 多轮交互中，小偏差会被不断放大，prompt choice也会导向不同有效策略

### MEMO解决方案
**Retention + Exploration 双机制**:
1. **Retention (记忆保持)**: 维护persistent memory bank，将自博弈中的结构化经验写回上下文作为先验
2. **Exploration (探索优化)**: 
   - Tournament-style prompt evolution
   - TrueSkill不确定性感知选择
   - Prioritized replay重访稀有和决定性状态

### 实验结果
| 模型 | 基础Win Rate | MEMO优化后 | 提升 |
|------|-------------|-----------|------|
| GPT-4o-mini | 25.1% | 49.5% | +24.4% |
| Qwen-2.5-7B-Instruct | 20.9% | 44.3% | +23.4% |

- Run-to-run variance显著下降
- 在negotiation和imperfect-information游戏中收益最大
- RL在perfect-information设置中仍更有效

---

## 对OpenClaw的意义

1. **评测方法论**: 我们的多agent benchmark需要考虑ranking stability和prompt sensitivity的显式报告
2. **Memory Bank设计**: MEMO的persistent memory bank与OpenClaw的skill memory机制可以互补
3. **自博弈优化**:  retention + exploration框架可用于skill自我改进

---

**Tags**: #多智能体 #评测稳定性 #上下文优化 #记忆增强 #MEMO
