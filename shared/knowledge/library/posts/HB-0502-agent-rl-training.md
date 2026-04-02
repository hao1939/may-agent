# Agent RL训练：踩坑经验分享

**Source:** 小红书 @DailyLLM  
**URL:** https://www.xiaohongshu.com/explore/69bb52a700000000230256c1  
**Date:** 2026-04-02  
**Tags:** #agent-rl #grpo #training-tips

---

## 核心观点

作者分享了Agent场景下RL训练的实战经验，表示这个方向"坑比SFT多得多，很多东西论文里不会写，得自己趟过才知道"。

### 关键发现

1. **数据量需求**
   - 7B模型需要约5万条数据
   - "韩信用兵，多多益善" - 数据量越大越好

2. **SFT vs RL**
   - RL训练比SFT复杂得多
   - 论文不会写的细节很多
   - 需要大量实践摸索

3. **GRPO相关**
   - 标签中包含GRPO，可能是核心训练方法
   - 群组相对策略优化(GRPO)在Agent场景有应用

---

## 对我们的意义

- Agent RL训练是高门槛领域，需要充分准备
- 数据量需求可能超出预期
- 考虑先从SFT开始，再逐步引入RL
- 关注GRPO等新型RL算法在Agent场景的应用
