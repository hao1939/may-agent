# HB-260429: Google A2A协议 — Agent互操作性的新时代

**Source**: Google Developers Blog (April 9, 2025)  
**信号强度**: ⭐⭐⭐⭐⭐  
**发现时间**: 2026-04-29  
**发现者**: Amy-Kimi

---

## 核心发现

Google正式发布 **Agent2Agent Protocol (A2A)** —— 一个开放协议，专门解决Agent之间的互操作性问题。与Anthropic的MCP（垂直工具连接）形成**互补关系**，A2A聚焦**水平Agent连接**。

### 关键数据
- **50+ 技术合作伙伴**: Atlassian, Box, Cohere, Intuit, Langchain, MongoDB, PayPal, Salesforce, SAP, ServiceNow, Workday 等
- **服务提供商**: Accenture, BCG, Capgemini, Deloitte, KPMG, McKinsey, PwC, TCS, Wipro 等
- **发布日期**: 2025年4月9日

---

## A2A vs MCP: 协议分层明确

| 协议 | 层级 | 定位 | 类比 |
|------|------|------|------|
| **MCP** | 垂直 | 工具层协议 — Agent ↔ 工具/资源 | USB接口 |
| **A2A** | 水平 | Agent层协议 — Agent ↔ Agent | 网络协议 |

**Google官方定位**: "A2A is an open protocol that **complements** Anthropic's Model Context Protocol (MCP), which provides helpful tools and context to agents."

---

## A2A五大设计原则

1. **拥抱Agent能力**: 支持Agent在**自然、非结构化模态**中协作，即使不共享内存、工具和上下文。Agent不是被限制的"工具"

2. **基于现有标准**: 构建于HTTP、SSE、JSON-RPC等成熟标准之上，易于与企业现有IT栈集成

3. **默认安全**: 支持企业级认证授权，启动时即与OpenAPI认证方案对等

4. **支持长周期任务**: 从快速任务到需要数小时/数天的深度研究，支持人类在环。提供实时反馈、通知和状态更新

5. **模态无关**: 不仅限于文本，支持音频、视频流等多种模态

---

## A2A核心机制

### 1. Agent Card (能力发现)
```json
{
  "name": "Expense Agent",
  "capabilities": ["submit_expense", "get_policy"],
  "authentication": {"type": "oauth2", "scope": "expenses"},
  "endpoint": "https://agent.company.com/a2a"
}
```
- Client Agent通过JSON格式的Agent Card发现Remote Agent能力
- 动态选择最适合执行任务的Agent

### 2. Task管理
- **任务对象**: 协议定义的任务有完整生命周期
- **即时/长时**: 可立即完成或持续数天的任务
- **Artifact**: 任务输出称为"Artifact"，可以是最终结果或中间产物
- **状态同步**: 双方Agent保持任务状态同步

### 3. 协作消息
- Agent间发送消息传递上下文、回复、产物或用户指令
- 支持**流式响应**（SSE）和**轮询模式**

### 4. 用户体验协商
- 每条消息包含"parts"字段，描述如何渲染（如text、file、form）
- 支持富交互体验

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    A2A Protocol Stack                        │
├─────────────────────────────────────────────────────────────┤
│  Application Layer    │  Agent Card + Task + Artifact       │
├─────────────────────────────────────────────────────────────┤
│  Message Layer        │  JSON-RPC 2.0                       │
├─────────────────────────────────────────────────────────────┤
│  Transport Layer      │  HTTP/1.1 or HTTP/2 + SSE           │
├─────────────────────────────────────────────────────────────┤
│  Security Layer       │  OAuth 2.0 / OIDC / API Keys        │
└─────────────────────────────────────────────────────────────┘
```

---

## 与MCP的协作关系

```
┌──────────────────────────────────────────────────────────────┐
│                    Agent A (Client)                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  A2A Protocol ──────► Agent B (Remote)                 │  │
│  │     │                                                    │  │
│  │     ▼                                                    │  │
│  │  ┌─────────────────────────────────────────┐             │  │
│  │  │  MCP Protocol ──────► Tools/Resources   │             │  │
│  │  │  (文件系统、API、数据库等)                 │             │  │
│  │  └─────────────────────────────────────────┘             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**关系总结**: MCP解决Agent如何**使用工具**，A2A解决Agent如何**与其他Agent对话**。

---

## 对OpenClaw的意义

### ✅ 架构验证
- **协议分层清晰化**: 本地CLI / 远程MCP / 跨Agent A2A 的三层架构明确
- **我们的多Agent设计**: 基于markdown的协调机制可以被A2A标准化替代

### 🔬 技术债/机会
| 领域 | 现状 | A2A机会 |
|------|------|---------|
| **Agent发现** | 手动配置AGENTS.md | 动态Agent Card发现 |
| **跨会话协作** | 基于文件/DB的异步 | 标准化Task生命周期 |
| **人机协作** | read_by机制 | UX协商标准化 |
| **长周期任务** | Session超时问题 | 显式Task状态管理 |

### ⚠️ 兼容性考虑
1. **短期**: 保持现有架构，监控A2A生态发展
2. **中期**: 评估将`AGENTS.md`映射到Agent Card格式
3. **长期**: 跨OpenClaw实例协作可通过A2A标准化

### ❓ 关键问题
- **A2A vs 现有协调机制**: 我们的markdown-based协调 vs A2A结构化消息，哪种更适合开发者体验？
- **认证模型**: A2A的OAuth 2.0与我们当前密钥模型如何整合？
- **生态时机**: 50+合作伙伴是 momentum，但协议刚发布，需要观察 adoption

---

## 参考链接

- **官方博客**: https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/
- **协议规范**: https://github.com/google/A2A
- **示例代码**: https://github.com/google/A2A/tree/main/samples

---

## 标签

#a2a #mcp #google #agent-protocol #multi-agent #interoperability #google-cloud
