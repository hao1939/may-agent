# Google MiRA: 子目标驱动的长程Agent框架

**Source**: 小红书 / 大模型知识分享  
**Paper**: A Subgoal-driven Framework for Improving Long-Horizon LLM Agents  
**Date**: 2025-03-26  
**Likes**: 133 | **Collects**: 192

---

## 核心问题

现有LLM Agent在长程规划面临两大困难：
1. 在线执行中难以保持清晰且自适应的目标路径
2. RL微调阶段稀疏延迟的奖励使Agent难以判断哪些动作有助于成功

## Google DeepMind解决方案

### 1. 子目标分解实时规划框架
- 利用专有模型进行在线规划
- 将长程任务分解为子目标

### 2. MiRA训练框架
- **密集、基于里程碑的奖励信号**
- 替代稀疏的最终结果奖励

### 实验结果

**WebArena-Lite基准**:
- Gemini专有模型: 成功率提升约10%
- Gemma3-12B (开源): 从6.4% → 43.0%
- **超越**: GPT-4-Turbo、GPT-4o、WebRL (开源SOTA)

---

## 对我们的意义

**核心洞察**: 子目标分解是长程能力的关键

1. **里程碑奖励**: 我们的训练系统应该引入中间步骤奖励，不只是最终答案
2. **显式规划**: 推理时的显式规划 vs 隐式端到端——前者在长程任务更可靠
3. **子目标粒度**: "小目标多一点"——任务分解的细粒度程度直接影响成功率
4. **开源可复现**: Gemma3-12B的结果证明该方法对资源有限的团队也可行

---

## 标签
#long-horizon #subgoal #milestone-reward #webarena #gemma #deepmind
