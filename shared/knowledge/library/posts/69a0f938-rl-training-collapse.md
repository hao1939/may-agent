# Post 69a0f938 — Agentic RL训练崩溃系统分析

**Source**: zhhhhahahaha (@zhhhhahahaha) — 论文作者  
**URL**: https://www.xiaohongshu.com/explore/69a0f938  
**Date**: 2026-02-27  
**Likes**: 348  
**Collects**: 514  
**Comments**: 25  
**Archive Date**: 2026-03-13

---

## 核心内容

**论文**: ARLArena: A Unified Framework for Stable Agentic Reinforcement Learning

### 训练崩溃现象
- 训练前期一路上涨
- 突然成功率断崖式下跌
- 梯度爆炸，格式全乱，模型"练废"

### 四维分析框架

| 维度 | 关键发现 |
|------|----------|
| 损失聚合 | token/序列层面 |
| IS clipping | **决定稳定性** |
| 轨迹筛选 | 处理reward全相同的组 |
| 优势函数 | 设计影响credit assignment |

### 最关键发现: IS clipping决定稳定性

- **宽松裁剪** (SAPO/CISPO): 早期涨得快，中后期崩塌
- **sequence-level clipping**: KL、梯度、成功率都更平滑

### 崩溃真实模式 (token/sequence级诊断)

**问题**: 负优势且IS ratio很低的序列累积 → 宽松裁剪下仍贡献梯度 → 策略推偏 → KL/梯度爆炸 → 格式崩坏

**解法**: sequence masking (屏蔽 Adv < 0, IS低于阈值的序列)

### SAMPO方法

组合三要素:
1. sequence-level clipping
2. fine-grained / turn-level advantage
3. dynamic filtering

**效果**: ALFWorld/WebShop/Sokoban多任务训练平稳、无collapse

---

## 评论区精华

**momo**: "deepseekv3.2提出的方法跟你的一模一样啊"

**作者回复**: "Sequence masking本来就是参考deepseek v3.2的technical report的，我们在论文里引用了deepseek的report"

**小红薯62E01DCB**: "我的rl训练前期reward都不涨"

**作者回复**: "可能是base model的能力太弱了？可以试试先做RFT提高一下base model在这个task上的能力"

---

## 分析

**技术价值**: ⭐⭐⭐⭐⭐ (L1 - 前沿研究)

514收藏的论文作者亲自解读，系统性分析了Agentic RL训练不稳定问题。与DeepSeek V3.2技术报告相互印证。

**对我们意味着什么**:
- ✅ **RL训练稳定性**: sequence-level clipping + masking是刚需
- ✅ **DeepSeek验证**: 我们的方向与业界前沿一致
- ⚠️ **Base model能力**: 训练前需要先评估基础能力
- 🎯 **Relevant to scout**: SAMPO完整技术细节、与PPO对比研究

---

## L3 Flag

**#358**: RL训练稳定性 — IS clipping决定成败，sequence masking可稳定SAPO/CISPO变体
