# Agent Sandbox 架构：两种模式

**来源**: 小红书 @奥森木  
**发布时间**: 2025-04-25  
**原文链接**: https://www.xiaohongshu.com/explore/69ecaa6700000000370360e8

---

## 核心洞察

LangChain CEO Harrison Chase 提出 Agent 接入 Sandbox 的两种架构模式，分水岭在于 **Agent 运行位置**。

---

## Pattern 1: Agent IN Sandbox

Agent 住在 sandbox 里，外部应用通过 WebSocket 或 HTTP 连进来。

### 优点
- Agent 能直接访问文件系统、修改环境
- 适合需要与执行环境紧耦合的场景（持续访问特定库、保留复杂环境状态）
- 本地 terminal 能跑的命令 sandbox 里一样能跑

### 代价
- 跨边界通信需自己搭建（WebSocket/HTTP + session 管理 + 错误处理）
- **API keys 必须进 sandbox** → 一旦被攻破或被 prompt injection 偷凭证就麻烦了
- 每次更新要重建容器镜像再部署，开发迭代慢
- Agent 代码和 prompt 都在 sandbox 里，IP 容易被窃取
- **安全洞察**: Witan Labs 的 Nuno Campos 指出，sandbox 里任何 tool 的权限都不能超过 bash tool；带 web fetch 工具时，所有 LLM 生成的代码都能无限 fetch，是大风险

---

## Pattern 2: Sandbox as Tool

Agent 跑在你的机器/服务器上，要执行代码时调远程 sandbox 的 API。

**供应商**: E2B / Modal / Daytona / Runloop

### 优点
- Agent 代码即时更新，不用重建镜像
- **API keys 留在 sandbox 外**，只有执行发生在隔离环境
- Agent 状态（对话历史、memory、reasoning）与 sandbox 完全分离 → sandbox 故障不会丢状态
- 可无痛切换 backend
- 多 sandbox 并行跑任务
- **只为执行代码付费**，不为整个 process runtime 烧钱
- Future-proof: 可让 agent harness 跑在 GPU 机器上

### 代价
- 网络延迟：每次执行都跨网络边界
- 大量小执行会累积 latency（但 stateful session 可缓解）

---

## 选型指南

| 场景 | 推荐模式 |
|------|---------|
| 需要紧耦合、镜像本地开发、provider SDK 已处理通信层 | Pattern 1 |
| 快速迭代、keys 留外、偏好干净分离 | Pattern 2 |

**deepagents** 两种都支持，简单配置即可切换。

---

## 对我们的意义

我们的系统采用类似 Pattern 2 的架构：
- Agent 状态由系统管理
- Skill 执行环境可隔离
- 但需评估：是否需要更细粒度的 sandbox 隔离？

**值得深挖**:
- 技能执行的沙箱隔离策略
- 多租户环境下的凭证安全
- stateful session 设计降低延迟

---

**标签**: #sandbox #agent-architecture #security #deployment
