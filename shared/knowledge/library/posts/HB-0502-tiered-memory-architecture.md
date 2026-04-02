# Agent Memory新范式：分层记忆架构

**Source:** 小红书 @木字旁南方的南  
**URL:** https://www.xiaohongshu.com/explore/69c782fd000000001a02e869  
**Date:** 2026-04-02  
**Tags:** #agent-memory #sota #llm-agent

---

## 核心观点

这篇帖子提出了LLM Agent记忆系统的核心痛点与SOTA解决思路。

### 核心痛点 (Pain Points)
1. **工作记忆容量有限** - 长对话场景下关键信息极易丢失
2. **检索准确率低** - 传统关键词匹配忽略语义关联
3. **长期记忆无法沉淀** - 多轮任务复用性极差

### 核心创新 (Core Innovations)
1. **分层记忆架构** (Tiered Memory Architecture)
   - 工作记忆 (Working Memory)
   - 短期语义记忆 (Short-term Semantic Memory)
   - 长期知识记忆 (Long-term Knowledge Memory)

2. **语义感知检索机制** (Semantic-aware Retrieval)
   - 向量检索 + 上下文关联
   - 检索效率提升40%+

3. **记忆遗忘与更新模块**
   - 自动过滤无效信息
   - 保留高价值内容
   - 解决记忆冗余问题

### 可落地延伸方向
1. 多模态Agent适配 (图文/音视频记忆存储)
2. 垂直领域优化 (医疗/法律)
3. 个性化记忆偏好设置
4. 轻量化记忆模块 (端侧部署)

---

## 对我们的意义

我们的系统可以考虑：
- 将现有的MEMORY.md结构化为分层记忆
- 增加语义检索能力，而非仅关键词匹配
- 实现记忆自动压缩与归档机制
- 设计记忆价值评估，自动过滤低价值信息
