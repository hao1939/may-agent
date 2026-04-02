# HB#1785: 上下文工程——AI时代最重要的技术活儿

**Source:** XHS@AI技术立文  
**Date:** 2026-03-17  
**Likes:** New post  
**URL:** https://www.xiaohongshu.com/explore/69b81ac70000000022003c32

---

## 核心观点

> 如果只记住一件事：别优化prompt了，开始工程化上下文吧。

这是一篇关于Context Engineering的实践指南，与OpenClaw的AGENTS.md设计理念高度一致。

---

## 7条上下文工程实践原则

### 1. 审计你的CLAUDE.md
- **问题**: 是配置文件还是入职文档？
- **解决**: 重写成"高级工程师入职培训"那样的文档
- **OpenClaw映射**: AGENTS.md应像"高级工程师入职培训"而非简单配置

### 2. 分离关注点
- 架构上下文、编码规范、领域知识放**不同文件**
- **原则**: 加载任务需要的，不是所有东西
- **OpenClaw映射**: 多文件AGENTS.md + Skills分离设计已验证

### 3. 渐进式披露
- MEMORY.md作为**路由文档**，控制在**200行以内**
- 详细主题文件从它链接出去
- **OpenClaw映射**: 符合我们的AGENTS.md层级结构设计

### 4. 观点命名
- 文件名回答"这个相关吗"，不用打开就知道
- **好例子**: "我们选X因为Y.md"
- **坏例子**: "决策.md"
- **OpenClaw映射**: SOUL.md/DOMAIN.md/TOOLS.md的命名已符合此原则

### 5. 挖掘会议
- 录下来，提取观点和决策，加到图里
- **关键洞察**: 锁在对话里的隐性知识是你最大的上下文泄漏
- **OpenClaw映射**: Error Log机制正是为了捕获隐性失败知识

### 6. 让Agent维护它
- 设置钩子标记矛盾、过时上下文、结构漂移
- **理念**: Agent应该在正常工作副作用下改进上下文系统
- **OpenClaw映射**: Self-evolution禁止 vs Agent维护上下文 —— 需要权衡

### 7. 测量上下文健康
- **指标**: session重新解释时间、Agent漂移率、跨session决策一致性
- **诊断**: 如果Agent问同样的问题两次，你的上下文架构有洞
- **OpenClaw映射**: 新增监控需求 —— Agent重复提问检测

---

## 与OpenClaw设计的验证关系

| 本文原则 | OpenClaw现状 | 差距 |
|---------|-------------|------|
| CLAUDE.md如入职培训 | AGENTS.md部分符合 | 需持续优化 |
| 分离关注点 | ✅ 多文件设计 | 已对齐 |
| 渐进式披露 | ✅ AGENTS.md层级 | 已对齐 |
| 观点命名 | ✅ SOUL/DOMAIN/TOOLS | 已对齐 |
| 挖掘隐性知识 | ✅ Error Log机制 | 已对齐 |
| Agent自维护 | ❌ 禁止Self-evolution | 需权衡 |
| 上下文健康指标 | ❌ 未监控 | 需新增 |

---

## Relevance

- **Bob**: Context Engineering作为核心设计原则验证
- **Tech-Lead**: AGENTS.md健康度监控指标
- **Scout**: 可研究"上下文健康"评估方法

---

**Tags:** #context-engineering #agent-design #openclaw-aligned #best-practices
