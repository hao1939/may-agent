# HB#2061: Agent记忆蒸馏成薄层

**来源**: 小红书 @momo  
**原文链接**: https://www.xiaohongshu.com/explore/69b97518000000001a02c2d0  
**归档时间**: 2026-03-17  
**热度**: 5赞/12收藏  
**价值评级**: 🔥🔥🔥🔥🔥 架构范式级洞察

---

## 核心论文

**Structured Distillation for Personalized Agent Memory: 11x Token Reduction with Retrieval Preservation**

---

## 核心问题

长对话 Agent 的困境：
- 历史记忆很有用
- 但原样带着走太贵（token 成本高）
- **真正难的不是压短，而是压短以后 retrieval 还不能塌**

---

## 方法: 四段式结构化蒸馏

每轮交互蒸馏为结构化对象：

| 字段 | 含义 |
|------|------|
| **exchange core** | 交互核心内容 |
| **specific context** | 特定上下文 |
| **theme room assignment** | 主题房间分配 |
| **files touched** | 涉及文件 |

### 压缩效果
- **原始**: 平均 371 token/轮
- **蒸馏后**: 约 38 token/轮
- **压缩比**: 11x

---

## 实验结果

| 配置 | 效果 |
|------|------|
| 最优 pure distilled 检索 | 保留 96% verbatim MRR |
| best cross-layer setup | 略微超过 verbatim baseline |

---

## 关键洞察

### 结构化 > 摘要
> "它把 agent memory 做成了结构化可检索对象，而不是一句话摘要了事"

这与传统的对话摘要方法有本质区别：
- **传统**: 压缩成自然语言摘要，丢失结构
- **本文**: 保持结构化，支持精确检索

---

## 与 XSkill 的对比

| 维度 | XSkill | Memory Distillation |
|------|--------|---------------------|
| **目标** | 从轨迹学习提升执行能力 | 压缩历史保持可检索性 |
| **知识形式** | Skills + Experiences | 结构化记忆对象 |
| **时间维度** | 跨任务累积 | 单会话内压缩 |
| **互补性** | 学习 WHAT to do | 记住 WHAT happened |

---

## 对 OpenClaw 的启示

1. **记忆压缩**: context 窗口有限，需要结构化压缩方案
2. **检索优先**: 压缩的衡量标准不是压缩率，而是检索准确率
3. **四段式结构**: exchange/core/context/theme/files 的分层思路可借鉴

---

## 社区关联
- 与 HB#2021 (agent记忆开始蒸馏成薄层) 形成连续讨论
- 与 HB#2051 (双轨蒸馏: Success→Skill / Failure→Guardrail) 主题相关
