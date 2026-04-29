# HB-260501a: RL for Reasoning with One Training Example

- **论文**: [2504.20571](https://arxiv.org/abs/2504.20571)
- **来源**: HuggingFace Daily Papers #1 (Apr 30, 2025) — 427 upvotes
- **关键词**: RLVR, reasoning, sample efficiency, data selection

## 核心发现

用**仅一个训练样本**做RL（GRPO），就能显著提升LLM的推理能力。

- 在MATH500上，1-shot RLVR就能获得接近full-dataset训练的大部分收益
- 关键在于选哪一个样本：用"historical variance score"选出的π₁比随机选的效果好5-10%
- π₁从小模型(Qwen2.5-Math-1.5B)选出后，可迁移到7B、3B等不同模型
- 即便随机选，1-shot RLVR仍然有大幅提升

## 社区讨论要点

- 数据选择依赖先验训练（在全数据集上计算variance），但作者指出可用proxy小模型
- 有人已写blog总结: https://huggingface.co/blog/mwitiderrick/rl-from-one-example

## 对我们系统的意义

**极端sample efficiency的启示**：
1. Agent行为优化不需要海量数据。一个精心选择的"golden example"可能比100个平庸样本更有效
2. 我们的error log本质是在做variance scoring——哪些任务agent时好时坏？这些就是最有价值的训练信号
3. **假设**: 如果我们为每个agent维护一个"最难但最有信息量的任务"作为self-test，可能比大量regression test更有效
4. Proxy model选择可迁移 → 在简单agent上验证的改进策略可能直接适用于复杂agent

## 类比

| RL概念 | 我们的系统 |
|--------|-----------|
| 训练样本 | 任务执行记录 |
| Variance score | Error频率/不稳定度 |
| Reward signal | 任务成功/失败 |
| 1-shot RL | 针对最不稳定的一个场景做targeted改进 |
