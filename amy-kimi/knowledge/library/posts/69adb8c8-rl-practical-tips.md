# Post 69adb8c8 — 一年RL工程实践经验

**Source**: Yinjie (@Yinjie) — OpenClaw-RL核心开发者  
**URL**: https://www.xiaohongshu.com/explore/69adb8c8  
**Date**: 2026-03-09 (4天前)  
**Collects**: 1986  
**Comments**: 146  
**Archive Date**: 2026-03-13

---

## 核心内容

**作者背景**: OpenClaw-RL, RLAnything, dLLM-RL, CURE项目经验

### 稳定RL的算法 tricks

**1. KL Loss选择 (k1 vs k3)**

| 类型 | 问题 | 解决 |
|------|------|------|
| k1 | 持续惩罚小log p，难任务上模型易坍塌 | ❌ |
| k3 | 保证KL loss严格为正 | ✅ |

> 用slime训computer use agents时总训一半崩，换k3解决

**2. Value Model重要性**

> "很多人不知道value model的重要性，赋予token level advantage能很好稳定训练。上波ICLR文章reviewer认为value model是多余的，这就属于典型的实验不跑，天天看各种g*po的后遗症。业界大多用的还是ppo。"

**3. 常见参数设置**

| 参数 | 建议值 | 说明 |
|------|--------|------|
| updates per step | 1 | 保证尽量on-policy |
| RL loss学习率 | 1e-6 | 新手常误设为1e-5导致训练失败 |
| task per step × sample per task | 越多越好 | rollout越多越稳定 |

**4. Agentic RL特有问题**

- **每个step的advantage估计**: 需做好standardization
- **env复杂性**: 去掉未完成或被低质量env feedback污染的样本
- **异步off-policy**: "这种'off-policy'我反倒觉得没什么影响"

---

## 评论区精华

**问**: "agentic rl大概需要多少算力呢"
**答**: "八张卡就够了"

**问**: "slime和openrlhf内存泄漏"
**答**: "Slime确实有这个问题，你可以直接把我OpenClaw-RL的优化过的slime拷过去试试"

**问**: "grpo用lora微调学习率"
**答**: "都是×10然后再调，全量1e-6 → LoRA 1e-5"

**问**: "创意写作用rlhf还是llm judge"
**答**: "有数据就rlhf，没数据就prompt好然后llm judge"

---

## 分析

**技术价值**: ⭐⭐⭐⭐⭐ (L1 - 工程实践)

1986收藏的一线工程实践总结，来自OpenClaw-RL核心开发者。含金量极高。

**对我们意味着什么**:
- ✅ **k3 KL loss**: 难任务训练稳定性关键
- ✅ **Value Model非多余**: PPO仍是业界主流
- ✅ **学习率敏感**: 1e-6 vs 1e-5差距巨大
- ✅ **LoRA学习率**: 全量×10原则
- ✅ **八卡门槛**: Agentic RL算力需求参考
- ⚠️ **Slime内存泄漏**: 已知问题，需用OpenClaw-RL优化版

---

## L3 Flag

**#359**: RL工程实践 — k3 KL loss防坍塌，value model稳定训练，学习率1e-6敏感，八卡可训
