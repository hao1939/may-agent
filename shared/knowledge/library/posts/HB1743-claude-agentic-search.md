# HB#1743: Claude为何放弃向量RAG选择Agentic Search

**Source**: XHS@大厂AI搜推踩坑侠  
**URL**: https://www.xiaohongshu.com/explore/69882a19000000001a01d8a4  
**Date**: 2026-02-08  
**Engagement**: 1253赞 / 1736收藏 / 114评论  
**Fire Rating**: 🔥🔥🔥🔥🔥

---

## 核心发现

### Claude Code的搜索策略转变
- **放弃**: 向量数据库（Vector RAG）
- **采用**: Agentic Search + grep文本查找
- **原因**: 向量检索损失原始信息，语义匹配不准确

### Agentic Search架构
- **概念**: 让大模型做推理式、渐进式查询
- **底层工具**: 可配备各种搜索工具（grep/keyword/结构化查询）
- **关键组件**: 意图识别 → 检测 → 纠正循环

---

## 向量RAG的问题

### 信息损失
> "做向量检索首先获取向量就对信息做了压缩，损失了原始内容。和KG的问题是一样的，构图就损失了原始文本大量的信息。" — @奇奇加油

### 语义漂移案例
- `auth` vs `login`：语义相近，向量检索可能混淆
- 代码变量命名场景下，文本精确匹配更准确

---

## 为什么选择grep？

| 优势 | 说明 |
|------|------|
| **信息完整保留** | 原始文本无损 |
| **即插即用** | 无需search索引更新 |
| **永远最新** | 实时文件系统状态 |
| **简单快捷** | 代码查找层面足够 |

### 局限性（社区指出）
- @茄子包子: "复杂项目要读很多无用代码"
- @休利特: "grep也不scale"

---

## OpenClaw相关性

### 🔍 设计验证
1. **原始文本优先**: OpenClaw的AGENTS.md直接注入 vs 向量检索 → 符合Agentic Search哲学
2. **Context信噪比**: 作者强调"有效信息召回效率决定效果"
3. **渐进式查询**: Skill的multi-step execution类似Agentic Search的渐进式查询

### 📋 技术决策支持
- AGENTS.md全文本注入 vs RAG截断 → 前者信息完整性更优
- Error Log原始文本记录 → 无损信息保留
- 禁止运行时self-evolution → 避免"猜测"引入的不确定性

---

## 社区洞察

**@大厂AI搜推踩坑侠**:
> "正统的搜索agent都需要有意图识别，检测，纠正的循环。"

**@山南阿姜** 问Token消耗:
> "从效果好的角度，肯定是claude code现在的方式消耗少。一般来说context信噪比决定了最终效果。"

---

**L3 Flag**: #1743 — 向量RAG过时信号？Agentic Search + 原始文本成为新共识
