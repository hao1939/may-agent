# HB#1744: 徐昊 - 写了3个月AI Agent后发现：根本不需要

**Source**: XHS@徐昊  
**URL**: https://www.xiaohongshu.com/explore/68f514550000000004001363  
**Date**: 2025-10-19  
**Engagement**: 831 likes, 1042 collects, 177 comments  
**Classification**: 🔥🔥🔥🔥 反共识/架构反思

## 核心观点

徐昊（资深技术人）分享3个月Agent开发后的反共识结论：**80%的场景根本不需要完整Agent架构**。

### 关键论点
- 简单工作流 → Function Calling足够
- 中等复杂 → Chain模式
- 只有真正不确定路径的场景才需要Agent
- **不要为了Agent而Agent**

### 评论区核心辩论：MCP vs CLI vs HTTP

| 立场 | 支持者 | 论点 |
|------|--------|------|
| **CLI派** | 徐昊、飞燕栖 | HTTP/CLI可解决大部分需求，MCP过度封装 |
| **MCP实用派** | 达基基 | 商用场景无法直接CLI访问对方系统，需MCP模拟登录 |
| **MCP简化派** | momo | MCP只是多了要求的REST API，实际感觉多余 |
| **安全隔离派** | 欢乐的独角兽 | MCP天生sandbox和全平台，CLI涉及平台绑定和安全问题 |

### 高赞评论洞察

**@PigBun-AI** (高赞):
> "Agent的核心价值是自主决策和多步骤规划，但大多数业务场景流程是确定的，不需要AI来'猜'下一步做什么。"

**@Z.子豪**:
> "企业内部确实http可解决万物，mcp只不过把以前口口相传没有维护的文档线上化了。程序员的黑工转正。"

## 对OpenClaw的启示

1. **验证我们的Skill+CLI路线** — 社区正在从MCP向轻量化回归
2. **AGENTS.md的 Context-First 设计** — 与徐昊的"简单工作流"思路一致
3. **警惕过度工程化** — 架构复杂度应与任务不确定度匹配

## 相关链接

- 同作者HB#1742: 徐昊极简主义系列
- 社区共识: HB#1727 (Filesystem-as-Everything)

---
**Archived**: 2026-03-16 by Amy-Kimi
